import 'dotenv/config';
import { createServer } from 'http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { Server as SocketIOServer } from 'socket.io';
import { validateEnv } from './lib/env.js';
import { globalLimiter } from './middleware/rateLimit.js';
import { errorHandler } from './middleware/errorHandler.js';
import authRouter from './routes/auth.js';
import agentsRouter from './routes/agents.js';
import conversationsRouter from './routes/conversations.js';
import billingRouter from './routes/billing.js';
import suggestRouter from './routes/suggest.js';
import adminRouter from './routes/admin.js';
import chatRouter from './routes/chat.js';
import twoFactorRouter from './routes/twoFactor.js';
import webhooksRouter from './routes/webhooks.js';
import knowledgeRouter from './routes/knowledge.js';
import { registerChatSocket } from './sockets/chat.socket.js';
import { startIngestionWorker, stopIngestionWorker } from './workers/ingestion.worker.js';
import { closeQueue } from './lib/queue.js';

// Falha rápido se a configuração de ambiente for insegura
validateEnv();

const app = express();
app.disable('x-powered-by'); // não revelar a stack
app.set('trust proxy', true); // Railway usa múltiplos hops — confiar em todos para obter IP real do cliente
const httpServer = createServer(app);
const PORT = process.env.PORT || 3001;

const allowedOrigins = [
  ...(process.env.ALLOWED_ORIGINS?.split(',') ?? []),
  ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
].map((o) => o.trim()).filter(Boolean);

if (allowedOrigins.length === 0) allowedOrigins.push('http://localhost:3000');

// Socket.io — chat em tempo real para visitantes
const io = new SocketIOServer(httpServer, {
  cors: { origin: allowedOrigins, methods: ['GET', 'POST'], credentials: true },
  maxHttpBufferSize: 1e5, // 100 KB — evita payloads gigantes
  pingTimeout: 20000,
  connectTimeout: 10000,
});

// Limite de ligações simultâneas por IP (anti-flood de conexões)
const MAX_SOCKETS_PER_IP = 10;
const socketsPerIp = new Map<string, number>();
io.use((socket, next) => {
  const ip = (socket.handshake.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
    || socket.handshake.address;
  const count = socketsPerIp.get(ip) ?? 0;
  if (count >= MAX_SOCKETS_PER_IP) {
    return next(new Error('Too many connections'));
  }
  socketsPerIp.set(ip, count + 1);
  socket.on('disconnect', () => {
    const c = (socketsPerIp.get(ip) ?? 1) - 1;
    if (c <= 0) socketsPerIp.delete(ip);
    else socketsPerIp.set(ip, c);
  });
  next();
});

registerChatSocket(io);

// Middleware
app.use(cors({
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));
app.use(helmet({
  // Permite embeber o widget de chat em iframes de clientes
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  // Força HTTPS nos browsers durante 1 ano (HSTS)
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  referrerPolicy: { policy: 'no-referrer' },
}));
app.use(express.json({
  limit: '1mb',
  verify: (req: express.Request & { rawBody?: Buffer }, _res, buf) => {
    req.rawBody = buf;
  },
}));
app.use(globalLimiter);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', message: 'Agentfy backend is running', ts: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRouter);
app.use('/api/agents', agentsRouter);
app.use('/api/agents/:agentId/knowledge', knowledgeRouter);
app.use('/api/conversations', conversationsRouter);
app.use('/api/billing', billingRouter);
app.use('/api/suggest', suggestRouter);
app.use('/api/admin', adminRouter);
app.use('/api/chat', chatRouter);
app.use('/api/auth/2fa', twoFactorRouter);
app.use('/api/webhooks', webhooksRouter);

// Global error handler (must be last)
app.use(errorHandler);

// Start server
httpServer.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔌 Socket.io ready for real-time chat`);
  // Inicia o worker de ingestão da base de conhecimento (se Redis disponível)
  startIngestionWorker();
});

// Graceful shutdown — fecha worker e fila de ingestão
async function shutdown(signal: string) {
  console.log(`\n${signal} recebido — a encerrar...`);
  await stopIngestionWorker().catch(() => undefined);
  await closeQueue().catch(() => undefined);
  httpServer.close(() => process.exit(0));
  // Força saída se não fechar a tempo
  setTimeout(() => process.exit(0), 10000).unref();
}
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
