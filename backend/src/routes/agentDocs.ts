import { Router, Response } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { BadRequestError, NotFoundError, ForbiddenError } from '../lib/errors.js';
import { AuthenticatedRequest } from '../types/index.js';
import prisma from '../lib/prisma.js';
import { uploadFile, deleteFile } from '../lib/storage.js';

const router = Router({ mergeParams: true }); // herda :agentId do mount
router.use(authenticate);

const ALLOWED_MIME = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'image/png', 'image/jpeg', 'image/webp',
  'text/plain',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME.has(file.mimetype)) return cb(null, true);
    cb(new Error('Tipo de ficheiro não suportado'));
  },
});

/** Verifica que o agente pertence ao tenant autenticado. */
async function assertAgentOwner(tenantId: string, agentId: string) {
  const agent = await prisma.agent.findFirst({ where: { id: agentId, tenantId } });
  if (!agent) throw new ForbiddenError('Agente não encontrado ou sem permissão');
  return agent;
}

// GET /api/agents/:agentId/docs
router.get('/', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { agentId } = req.params;
  await assertAgentOwner(req.tenant!.id, agentId);
  const docs = await prisma.agentDoc.findMany({
    where: { agentId },
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, description: true, fileName: true, mimeType: true, fileSize: true, fileUrl: true, createdAt: true },
  });
  res.json({ docs });
}));

// POST /api/agents/:agentId/docs — multipart upload
router.post('/', upload.single('file'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { agentId } = req.params;
  await assertAgentOwner(req.tenant!.id, agentId);

  if (!req.file) throw new BadRequestError('Ficheiro obrigatório');

  const { name, description } = req.body as { name?: string; description?: string };
  const displayName = (name?.trim() || req.file.originalname).slice(0, 200);

  const ext = path.extname(req.file.originalname).toLowerCase() || '';
  const storageKey = `${agentId}/${uuidv4()}${ext}`;

  const fileUrl = await uploadFile(storageKey, req.file.buffer, req.file.mimetype);

  const doc = await prisma.agentDoc.create({
    data: {
      agentId,
      tenantId: req.tenant!.id,
      name: displayName,
      description: description?.trim() || null,
      fileUrl,
      fileName: req.file.originalname,
      mimeType: req.file.mimetype,
      fileSize: req.file.size,
      storageKey,
    },
    select: { id: true, name: true, description: true, fileName: true, mimeType: true, fileSize: true, fileUrl: true, createdAt: true },
  });

  res.status(201).json(doc);
}));

// DELETE /api/agents/:agentId/docs/:docId
router.delete('/:docId', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { agentId, docId } = req.params;
  await assertAgentOwner(req.tenant!.id, agentId);

  const doc = await prisma.agentDoc.findFirst({ where: { id: docId, agentId } });
  if (!doc) throw new NotFoundError('Documento não encontrado');

  await deleteFile(doc.storageKey);
  await prisma.agentDoc.delete({ where: { id: docId } });

  res.json({ success: true });
}));

export default router;
