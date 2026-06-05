import 'dotenv/config';
import { createServer } from 'http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { Server as SocketIOServer } from 'socket.io';
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
import { registerChatSocket } from './sockets/chat.socket.js';

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 3001;

const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') ?? ['http://localhost:3000'];

// Socket.io — chat em tempo real para visitantes
const io = new SocketIOServer(httpServer, {
  cors: { origin: allowedOrigins, methods: ['GET', 'POST'], credentials: true },
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
}));
app.use(express.json({ limit: '1mb' }));
app.use(globalLimiter);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', message: 'Agentfy backend is running', ts: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRouter);
app.use('/api/agents', agentsRouter);
app.use('/api/conversations', conversationsRouter);
app.use('/api/billing', billingRouter);
app.use('/api/suggest', suggestRouter);
app.use('/api/admin', adminRouter);
app.use('/api/chat', chatRouter);
app.use('/api/auth/2fa', twoFactorRouter);

// Global error handler (must be last)
app.use(errorHandler);

// Start server
httpServer.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔌 Socket.io ready for real-time chat`);
});
