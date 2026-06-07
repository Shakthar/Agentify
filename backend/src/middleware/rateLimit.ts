import rateLimit from 'express-rate-limit';

export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 2000,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === '/health' || req.path === '/api/health',
  message: { error: 'Too many requests, please try again later' },
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  // SECURITY: skipSuccessfulRequests:true permitiria brute-force alternando entre contas;
  // contar TODAS as tentativas (sucesso e falha) para limitar eficazmente.
  skipSuccessfulRequests: false,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many auth attempts, please try again later' },
});

// Rate limiter mais agressivo para tentativas de login (5 por minuto por IP)
export const loginLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 5,
  skipSuccessfulRequests: false,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts, please wait a minute' },
});

export const chatLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 min
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many messages, slow down' },
});

// Rate limiter específico para signup: 3 registos por IP por 24h
// Mitiga criação em massa de contas para acumular créditos gratuitos.
export const signupLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 horas
  max: 5,
  skipSuccessfulRequests: false,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many registrations from this IP, please try again tomorrow' },
});

// Rate limiter para webhooks externos (Easypay, Meta, etc.)
// Limita rajadas de webhooks forjados enquanto permite volume legítimo de produção.
// Meta envia ~1 mensagem por utilizador por segundo em pico; 200/min por IP é generoso.
export const webhookLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 min
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Webhook rate limit exceeded' },
});
