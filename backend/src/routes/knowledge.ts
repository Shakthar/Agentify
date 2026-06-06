/**
 * Rotas da Base de Conhecimento de um agente.
 *
 * Montado em: /api/agents/:agentId/knowledge
 *
 * Segurança:
 *  - Autenticação obrigatória + scoping por tenant em todas as operações.
 *  - Upload limitado em tamanho e tipo (allowlist por extensão + mimetype).
 *  - URLs validadas contra SSRF na camada de extração.
 */

import { Router, Response, NextFunction, type Request } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { BadRequestError } from '../lib/errors.js';
import { AuthenticatedRequest } from '../types/index.js';
import * as kb from '../services/knowledge.service.js';
import type { DocumentType } from '../lib/textExtraction.js';

const router = Router({ mergeParams: true });
router.use(authenticate);

// Valida o formato do agentId (cuid) em todas as rotas
router.use((req: Request, _res: Response, next: NextFunction) => {
  const agentId = req.params.agentId;
  if (!agentId || !/^c[a-z0-9]{20,32}$/.test(agentId)) {
    return next(new BadRequestError('Invalid agentId'));
  }
  next();
});

// ── Upload de ficheiro ──────────────────────────────────────────────────────

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

const EXT_TO_TYPE: Record<string, Extract<DocumentType, 'pdf' | 'docx' | 'csv' | 'text'>> = {
  pdf: 'pdf',
  docx: 'docx',
  csv: 'csv',
  txt: 'text',
  md: 'text',
};

const ALLOWED_MIMES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/csv',
  'application/csv',
  'text/plain',
  'text/markdown',
  'application/octet-stream', // alguns browsers enviam isto; validamos por extensão
]);

function fileExt(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : '';
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    const ext = fileExt(file.originalname);
    if (!EXT_TO_TYPE[ext]) {
      return cb(new Error('Tipo de ficheiro não suportado (use pdf, docx, csv, txt, md)'));
    }
    if (!ALLOWED_MIMES.has(file.mimetype)) {
      return cb(new Error('Tipo MIME não permitido'));
    }
    cb(null, true);
  },
});

/** Traduz erros do multer para BadRequestError legível. */
function handleUpload(req: Request, res: Response, next: NextFunction) {
  upload.single('file')(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError) {
      const msg = err.code === 'LIMIT_FILE_SIZE' ? 'Ficheiro excede 10 MB' : err.message;
      return next(new BadRequestError(msg));
    }
    if (err instanceof Error) return next(new BadRequestError(err.message));
    next();
  });
}

// POST /api/agents/:agentId/knowledge/upload
router.post('/upload', handleUpload, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const file = (req as Request & { file?: Express.Multer.File }).file;
  if (!file) throw new BadRequestError('Nenhum ficheiro enviado (campo "file")');

  const type = EXT_TO_TYPE[fileExt(file.originalname)];
  const doc = await kb.addFileDocument(req.tenant!, req.params.agentId, {
    type,
    fileName: file.originalname.slice(0, 255),
    buffer: file.buffer,
  });
  res.status(202).json(doc);
}));

// ── URL (YouTube / website) ─────────────────────────────────────────────────

const urlSchema = z.object({
  type: z.enum(['youtube', 'website']),
  url: z.string().url().max(2048),
});

// POST /api/agents/:agentId/knowledge/url
router.post('/url', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const parsed = urlSchema.safeParse(req.body);
  if (!parsed.success) throw new BadRequestError('Validation failed', parsed.error.flatten());

  const doc = await kb.addUrlDocument(req.tenant!, req.params.agentId, parsed.data);
  res.status(202).json(doc);
}));

// ── Texto livre ─────────────────────────────────────────────────────────────

const textSchema = z.object({
  title: z.string().max(255).optional(),
  text: z.string().min(1).max(1_000_000),
});

// POST /api/agents/:agentId/knowledge/text
router.post('/text', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const parsed = textSchema.safeParse(req.body);
  if (!parsed.success) throw new BadRequestError('Validation failed', parsed.error.flatten());

  const doc = await kb.addTextDocument(req.tenant!, req.params.agentId, parsed.data);
  res.status(202).json(doc);
}));

// ── Listar ──────────────────────────────────────────────────────────────────

// GET /api/agents/:agentId/knowledge
router.get('/', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const result = await kb.listDocuments(req.tenant!.id, req.params.agentId);
  res.json(result);
}));

// ── Reprocessar ─────────────────────────────────────────────────────────────

// POST /api/agents/:agentId/knowledge/:documentId/reingest
router.post('/:documentId/reingest', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const result = await kb.reingestDocument(req.tenant!.id, req.params.agentId, req.params.documentId);
  res.status(202).json(result);
}));

// ── Apagar ──────────────────────────────────────────────────────────────────

// DELETE /api/agents/:agentId/knowledge/:documentId
router.delete('/:documentId', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  await kb.deleteDocument(req.tenant!.id, req.params.agentId, req.params.documentId);
  res.status(204).send();
}));

export default router;
