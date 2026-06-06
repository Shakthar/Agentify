/**
 * Serviço da Base de Conhecimento (RAG).
 *
 * Fluxo de ingestão:
 *  1. O documento é criado com estado "pending".
 *  2. Para ficheiros, o texto é extraído no momento do upload.
 *     Para URLs (YouTube/website), a extração ocorre no worker.
 *  3. enqueueIngestion agenda o processamento (BullMQ ou inline).
 *  4. processDocumentIngestion: extrai (se preciso) → divide em chunks →
 *     gera embeddings → guarda. Atualiza o estado para "completed"/"failed".
 *
 * Pesquisa (retrieval): embeda a query e devolve os chunks mais semelhantes
 * (similaridade de coseno) da base de conhecimento do agente.
 */

import prisma from '../lib/prisma.js';
import { BadRequestError, ForbiddenError, NotFoundError } from '../lib/errors.js';
import { chunkText } from '../lib/chunking.js';
import {
  embedText,
  embedTexts,
  embeddingsEnabled,
  cosineSimilarity,
  serializeEmbedding,
  deserializeEmbedding,
  EMBEDDING_MODEL,
} from '../lib/embeddings.js';
import {
  extractPdf,
  extractDocx,
  extractCsv,
  extractYoutube,
  extractWebsite,
  type DocumentType,
} from '../lib/textExtraction.js';
import { enqueueIngestion } from '../lib/queue.js';
import { writeAuditLog } from './admin.service.js';

const MAX_DOCUMENTS_PER_AGENT = 100;
const MAX_TEXT_CHARS = 1_000_000; // 1M caracteres por documento
const EMBED_BATCH_SIZE = 96;
const MAX_EMBEDDINGS_SCANNED = 5000; // limite de segurança na pesquisa

// Limites de armazenamento de KB por plano (em bytes)
const KB_STORAGE_LIMITS: Record<string, number> = {
  free:       10 * 1024 * 1024,         //   10 MB
  starter:   100 * 1024 * 1024,         //  100 MB
  pro:       500 * 1024 * 1024,         //  500 MB
  business:    2 * 1024 * 1024 * 1024,  //    2 GB
  enterprise: 10 * 1024 * 1024 * 1024,  //   10 GB
};
const DEFAULT_STORAGE_LIMIT = KB_STORAGE_LIMITS.free;

function bytesToMb(b: number) { return (b / (1024 * 1024)).toFixed(1); }

interface TenantCtx {
  id: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Garante que o agente pertence ao tenant e devolve/cria a sua KB. */
async function getOrCreateKnowledgeBase(tenantId: string, agentId: string) {
  const agent = await prisma.agent.findFirst({
    where: { id: agentId, tenantId },
    select: { id: true },
  });
  if (!agent) throw new NotFoundError('Agent not found');

  const existing = await prisma.knowledgeBase.findUnique({ where: { agentId } });
  if (existing) return existing;

  return prisma.knowledgeBase.create({
    data: { agentId, tenantId, embeddingModel: EMBEDDING_MODEL },
  });
}

async function assertDocumentQuota(knowledgeBaseId: string) {
  const count = await prisma.document.count({ where: { knowledgeBaseId } });
  if (count >= MAX_DOCUMENTS_PER_AGENT) {
    throw new ForbiddenError(`Limite de ${MAX_DOCUMENTS_PER_AGENT} documentos por agente atingido`);
  }
}

/** Verifica se o tenant ainda tem espaço de armazenamento disponível para newBytes. */
async function assertStorageQuota(tenantId: string, newBytes: number): Promise<void> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { plan: true },
  });
  const plan = tenant?.plan ?? 'free';
  const limit = KB_STORAGE_LIMITS[plan] ?? DEFAULT_STORAGE_LIMIT;

  // Soma todos os bytes de KB deste tenant
  const result = await prisma.document.aggregate({
    where: { knowledgeBase: { tenantId } },
    _sum: { contentBytes: true },
  });
  const used = result._sum.contentBytes ?? 0;

  if (used + newBytes > limit) {
    const usedMb = bytesToMb(used);
    const limitMb = bytesToMb(limit);
    throw new ForbiddenError(
      `Limite de armazenamento do plano "${plan}" atingido: ${usedMb} MB / ${limitMb} MB. Faça upgrade para continuar.`,
    );
  }
}

// ── Criação de documentos ───────────────────────────────────────────────────

interface AddFileInput {
  type: Extract<DocumentType, 'pdf' | 'docx' | 'csv' | 'text'>;
  fileName: string;
  buffer: Buffer;
}

/** Adiciona um documento a partir de um ficheiro carregado. */
export async function addFileDocument(tenant: TenantCtx, agentId: string, input: AddFileInput) {
  const kb = await getOrCreateKnowledgeBase(tenant.id, agentId);
  await assertDocumentQuota(kb.id);

  // Extrai o texto conforme o tipo
  let content = '';
  switch (input.type) {
    case 'pdf':
      content = await extractPdf(input.buffer);
      break;
    case 'docx':
      content = await extractDocx(input.buffer);
      break;
    case 'csv':
      content = extractCsv(input.buffer.toString('utf-8'));
      break;
    case 'text':
      content = input.buffer.toString('utf-8');
      break;
  }

  content = content.slice(0, MAX_TEXT_CHARS).trim();
  if (!content) throw new BadRequestError('Não foi possível extrair texto do ficheiro');

  const contentBytes = Buffer.byteLength(content, 'utf8');
  await assertStorageQuota(tenant.id, contentBytes);

  const doc = await prisma.document.create({
    data: {
      knowledgeBaseId: kb.id,
      type: input.type,
      fileName: input.fileName,
      content,
      contentBytes,
      status: 'pending',
    },
    select: { id: true, type: true, fileName: true, status: true, createdAt: true },
  });

  writeAuditLog(tenant.id, 'kb_document_added', 'document', doc.id, { agentId, type: input.type, fileName: input.fileName });
  await enqueueIngestion(doc.id);
  return doc;
}

interface AddUrlInput {
  type: Extract<DocumentType, 'youtube' | 'website'>;
  url: string;
}

/** Adiciona um documento a partir de uma URL (YouTube/website). */
export async function addUrlDocument(tenant: TenantCtx, agentId: string, input: AddUrlInput) {
  const kb = await getOrCreateKnowledgeBase(tenant.id, agentId);
  await assertDocumentQuota(kb.id);

  // Sem conteúdo ainda (extração é diferida) — quota será verificada no worker
  const doc = await prisma.document.create({
    data: {
      knowledgeBaseId: kb.id,
      type: input.type,
      sourceUrl: input.url,
      content: '', // extração ocorre na ingestão (rede)
      contentBytes: 0,
      status: 'pending',
    },
    select: { id: true, type: true, sourceUrl: true, status: true, createdAt: true },
  });

  writeAuditLog(tenant.id, 'kb_document_added', 'document', doc.id, { agentId, type: input.type, url: input.url });
  await enqueueIngestion(doc.id);
  return doc;
}

interface AddTextInput {
  title?: string;
  text: string;
}

/** Adiciona um documento de texto livre. */
export async function addTextDocument(tenant: TenantCtx, agentId: string, input: AddTextInput) {
  const kb = await getOrCreateKnowledgeBase(tenant.id, agentId);
  await assertDocumentQuota(kb.id);

  const content = input.text.slice(0, MAX_TEXT_CHARS).trim();
  if (!content) throw new BadRequestError('Texto vazio');

  const contentBytes = Buffer.byteLength(content, 'utf8');
  await assertStorageQuota(tenant.id, contentBytes);

  const doc = await prisma.document.create({
    data: {
      knowledgeBaseId: kb.id,
      type: 'text',
      fileName: input.title ?? 'Texto',
      content,
      contentBytes,
      status: 'pending',
    },
    select: { id: true, type: true, fileName: true, status: true, createdAt: true },
  });

  writeAuditLog(tenant.id, 'kb_document_added', 'document', doc.id, { agentId, type: 'text' });
  await enqueueIngestion(doc.id);
  return doc;
}

// ── Processamento de ingestão (worker / inline) ─────────────────────────────

/**
 * Processa a ingestão de um documento: extrai (se necessário), divide em
 * chunks, gera embeddings e guarda-os. Idempotente (substitui embeddings).
 */
export async function processDocumentIngestion(documentId: string): Promise<void> {
  const doc = await prisma.document.findUnique({
    where: { id: documentId },
  });
  if (!doc) return; // documento removido entretanto

  if (!embeddingsEnabled()) {
    await prisma.document.update({
      where: { id: documentId },
      data: { status: 'failed', error: 'OPENAI_API_KEY não configurada — embeddings indisponíveis' },
    });
    return;
  }

  try {
    await prisma.document.update({ where: { id: documentId }, data: { status: 'processing', error: null } });

    // Extração para fontes remotas (rede acontece aqui, no worker)
    let content = doc.content;
    if (!content) {
      if (doc.type === 'youtube' && doc.sourceUrl) {
        content = await extractYoutube(doc.sourceUrl);
      } else if (doc.type === 'website' && doc.sourceUrl) {
        content = await extractWebsite(doc.sourceUrl);
      }
      content = (content ?? '').slice(0, MAX_TEXT_CHARS).trim();
      if (content) {
        const contentBytes = Buffer.byteLength(content, 'utf8');
        // Verificar quota antes de persistir conteúdo remoto
        const kb = await prisma.knowledgeBase.findUnique({
          where: { id: doc.knowledgeBaseId },
          select: { tenantId: true },
        });
        if (kb) await assertStorageQuota(kb.tenantId, contentBytes);
        await prisma.document.update({ where: { id: documentId }, data: { content, contentBytes } });
      }
    }

    if (!content) throw new Error('Sem conteúdo para indexar');

    const chunks = chunkText(content);
    if (chunks.length === 0) throw new Error('Falha ao dividir o conteúdo em chunks');

    // Remove embeddings anteriores (re-ingestão)
    await prisma.embedding.deleteMany({ where: { documentId } });

    // Gera embeddings em lotes
    let chunkIndex = 0;
    for (let i = 0; i < chunks.length; i += EMBED_BATCH_SIZE) {
      const batch = chunks.slice(i, i + EMBED_BATCH_SIZE);
      const vectors = await embedTexts(batch);
      await prisma.embedding.createMany({
        data: batch.map((chunk, j) => ({
          documentId,
          chunk,
          embedding: serializeEmbedding(vectors[j]),
          chunkIndex: chunkIndex++,
        })),
      });
    }

    await prisma.document.update({
      where: { id: documentId },
      data: { status: 'completed', chunkCount: chunks.length, error: null },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido na ingestão';
    await prisma.document.update({
      where: { id: documentId },
      data: { status: 'failed', error: message.slice(0, 1000) },
    }).catch(() => undefined);
    throw err; // permite à fila registar a falha/retentar
  }
}

// ── Pesquisa (RAG retrieval) ────────────────────────────────────────────────

export interface RetrievedChunk {
  chunk: string;
  score: number;
  documentId: string;
}

/**
 * Devolve os chunks mais relevantes da base de conhecimento de um agente
 * para uma dada query. Retorna [] se não houver KB/embeddings ou se os
 * embeddings estiverem desativados.
 */
export async function searchKnowledge(
  agentId: string,
  query: string,
  topK = 5,
): Promise<RetrievedChunk[]> {
  if (!embeddingsEnabled() || !query.trim()) return [];

  const rows = await prisma.embedding.findMany({
    where: {
      document: { knowledgeBase: { agentId }, status: 'completed' },
    },
    select: { chunk: true, embedding: true, documentId: true },
    take: MAX_EMBEDDINGS_SCANNED,
  });
  if (rows.length === 0) return [];

  let queryVec: number[];
  try {
    queryVec = await embedText(query);
  } catch {
    return []; // falha de embeddings não deve quebrar o chat
  }

  const scored = rows.map((r) => ({
    chunk: r.chunk,
    documentId: r.documentId,
    score: cosineSimilarity(queryVec, deserializeEmbedding(r.embedding)),
  }));

  scored.sort((a, b) => b.score - a.score);
  // Filtra resultados pouco relevantes
  return scored.filter((s) => s.score > 0.2).slice(0, topK);
}

/**
 * Constrói um bloco de contexto para injetar no system prompt do agente.
 * Retorna string vazia se não houver contexto relevante.
 */
export async function buildContextForQuery(agentId: string, query: string): Promise<string> {
  const chunks = await searchKnowledge(agentId, query, 5);
  if (chunks.length === 0) return '';

  const context = chunks.map((c, i) => `[${i + 1}] ${c.chunk}`).join('\n\n');
  return (
    '\n\n# Base de Conhecimento\n' +
    'Usa as informações abaixo para responder quando forem relevantes. ' +
    'Se a resposta não estiver aqui, usa o teu conhecimento geral e não inventes.\n\n' +
    context
  );
}

// ── Gestão (listar / detalhe / apagar) ──────────────────────────────────────

/** Lista os documentos da KB de um agente, incluindo uso de armazenamento. */
export async function listDocuments(tenantId: string, agentId: string) {
  const agent = await prisma.agent.findFirst({ where: { id: agentId, tenantId }, select: { id: true } });
  if (!agent) throw new NotFoundError('Agent not found');

  const kb = await prisma.knowledgeBase.findUnique({ where: { agentId } });
  if (!kb) return { documents: [], total: 0, storageUsedBytes: 0, storageLimitBytes: DEFAULT_STORAGE_LIMIT, plan: 'free' };

  const [documents, storageResult, tenant] = await Promise.all([
    prisma.document.findMany({
      where: { knowledgeBaseId: kb.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, type: true, fileName: true, sourceUrl: true,
        status: true, error: true, chunkCount: true, contentBytes: true,
        createdAt: true, updatedAt: true,
      },
    }),
    prisma.document.aggregate({
      where: { knowledgeBase: { tenantId } },
      _sum: { contentBytes: true },
    }),
    prisma.tenant.findUnique({ where: { id: tenantId }, select: { plan: true } }),
  ]);

  const plan = tenant?.plan ?? 'free';
  const storageUsedBytes = storageResult._sum.contentBytes ?? 0;
  const storageLimitBytes = KB_STORAGE_LIMITS[plan] ?? DEFAULT_STORAGE_LIMIT;

  return { documents, total: documents.length, storageUsedBytes, storageLimitBytes, plan };
}

/** Apaga um documento (e os seus embeddings via cascade), com scoping de tenant. */
export async function deleteDocument(tenantId: string, agentId: string, documentId: string) {
  const doc = await prisma.document.findFirst({
    where: {
      id: documentId,
      knowledgeBase: { agentId, tenantId },
    },
    select: { id: true },
  });
  if (!doc) throw new NotFoundError('Document not found');

  await prisma.document.delete({ where: { id: documentId } });
  writeAuditLog(tenantId, 'kb_document_deleted', 'document', documentId, { agentId });
}

/** Reprocessa um documento existente (re-ingestão). */
export async function reingestDocument(tenantId: string, agentId: string, documentId: string) {
  const doc = await prisma.document.findFirst({
    where: { id: documentId, knowledgeBase: { agentId, tenantId } },
    select: { id: true },
  });
  if (!doc) throw new NotFoundError('Document not found');

  await prisma.document.update({ where: { id: documentId }, data: { status: 'pending', error: null } });
  await enqueueIngestion(documentId);
  return { id: documentId, status: 'pending' };
}
