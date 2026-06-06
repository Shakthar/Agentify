/**
 * Fila de ingestão da base de conhecimento.
 *
 * - Se REDIS_URL estiver definido, usa BullMQ (processamento assíncrono,
 *   resiliente, com retentativas).
 * - Caso contrário, processa de forma inline (em background, no próprio
 *   processo) para que o desenvolvimento funcione sem Redis.
 */

import { Queue, type ConnectionOptions } from 'bullmq';
import IORedis, { type Redis } from 'ioredis';

export const INGESTION_QUEUE = 'kb-ingestion';

let connection: Redis | null = null;
let ingestionQueue: Queue | null = null;

export function redisEnabled(): boolean {
  return !!process.env.REDIS_URL;
}

/** Conexão Redis partilhada (configurada para BullMQ). */
export function getRedisConnection(): Redis | null {
  if (!redisEnabled()) return null;
  if (!connection) {
    connection = new IORedis(process.env.REDIS_URL as string, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
    connection.on('error', (err) => {
      console.error('[redis] erro de conexão:', err.message);
    });
  }
  return connection;
}

/** Fila de ingestão (ou null se Redis não estiver configurado). */
export function getIngestionQueue(): Queue | null {
  if (!redisEnabled()) return null;
  if (!ingestionQueue) {
    ingestionQueue = new Queue(INGESTION_QUEUE, {
      connection: getRedisConnection() as unknown as ConnectionOptions,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    });
  }
  return ingestionQueue;
}

export interface IngestionJobData {
  documentId: string;
}

/**
 * Agenda a ingestão de um documento.
 * Em modo Redis, adiciona à fila. Em modo inline, processa em background.
 */
export async function enqueueIngestion(documentId: string): Promise<void> {
  const queue = getIngestionQueue();
  if (queue) {
    await queue.add('ingest', { documentId } satisfies IngestionJobData, {
      jobId: documentId, // idempotência: evita duplicar ingestão do mesmo doc
    });
    return;
  }

  // Fallback inline — não bloqueia o pedido HTTP.
  setImmediate(() => {
    void import('../services/knowledge.service.js')
      .then((m) => m.processDocumentIngestion(documentId))
      .catch((err) => {
        console.error(`[ingestion:inline] falha no documento ${documentId}:`, err);
      });
  });
}

/** Fecha as conexões da fila (graceful shutdown). */
export async function closeQueue(): Promise<void> {
  if (ingestionQueue) await ingestionQueue.close();
  if (connection) await connection.quit();
}
