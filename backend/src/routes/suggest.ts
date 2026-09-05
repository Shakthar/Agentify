import { Router, Response, NextFunction, type Request } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.js';
import { authLimiter, suggestLimiter } from '../middleware/rateLimit.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { BadRequestError } from '../lib/errors.js';
import { AuthenticatedRequest } from '../types/index.js';
import * as suggestService from '../services/suggest.service.js';
import { extractPdf, extractDocx, extractCsv } from '../lib/textExtraction.js';

const router = Router();
router.use(authenticate);

const suggestSchema = z.object({
  businessDescription: z.string().min(20).max(2000),
  language: z.string().max(10).optional().default('pt'),
  templateSystemPrompt: z.string().max(3000).optional(),
});

// POST /api/suggest/suggest
// Usa suggestLimiter (por tenant, 10/hora) para prevenir Denial-of-Wallet:
// cada chamada dispara claude-sonnet (modelo caro) e o custo é do operador.
router.post('/suggest', authLimiter, suggestLimiter, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const parsed = suggestSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new BadRequestError('businessDescription must be between 20 and 2000 characters');
  }
  const result = await suggestService.suggestAgent(
    req.tenant!.id,
    parsed.data.businessDescription,
    parsed.data.language,
    parsed.data.templateSystemPrompt,
  );
  res.json(result);
}));

// ── Criar agente a partir de um documento real (SOP, FAQ, price list, etc) ──

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
const EXT_TO_TYPE: Record<string, 'pdf' | 'docx' | 'csv' | 'text'> = { pdf: 'pdf', docx: 'docx', csv: 'csv', txt: 'text', md: 'text' };
const ALLOWED_MIMES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/csv',
  'application/csv',
  'text/plain',
  'text/markdown',
  'application/octet-stream',
]);

function fileExt(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : '';
}

const documentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    const ext = fileExt(file.originalname);
    if (!EXT_TO_TYPE[ext]) return cb(new Error('Tipo de ficheiro não suportado (use pdf, docx, csv, txt, md)'));
    if (!ALLOWED_MIMES.has(file.mimetype)) return cb(new Error('Tipo MIME não permitido'));
    cb(null, true);
  },
});

function handleDocumentUpload(req: Request, res: Response, next: NextFunction) {
  documentUpload.single('file')(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError) {
      const msg = err.code === 'LIMIT_FILE_SIZE' ? 'Ficheiro excede 10 MB' : err.message;
      return next(new BadRequestError(msg));
    }
    if (err instanceof Error) return next(new BadRequestError(err.message));
    next();
  });
}

// POST /api/suggest/suggest-from-document
router.post('/suggest-from-document', authLimiter, suggestLimiter, handleDocumentUpload, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const file = (req as Request & { file?: Express.Multer.File }).file;
  if (!file) throw new BadRequestError('Nenhum ficheiro enviado (campo "file")');

  const type = EXT_TO_TYPE[fileExt(file.originalname)];
  let text = '';
  switch (type) {
    case 'pdf': text = await extractPdf(file.buffer); break;
    case 'docx': text = await extractDocx(file.buffer); break;
    case 'csv': text = extractCsv(file.buffer.toString('utf-8')); break;
    case 'text': text = file.buffer.toString('utf-8'); break;
  }
  text = text.trim();
  if (!text) throw new BadRequestError('Não foi possível extrair texto do documento');

  const language = typeof req.body.language === 'string' ? req.body.language : 'pt';
  const result = await suggestService.suggestAgentFromDocument(req.tenant!.id, text, language);
  res.json(result);
}));

export default router;
