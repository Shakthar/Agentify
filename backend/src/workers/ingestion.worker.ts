/**
 * Worker de ingestão da base de conhecimento (BullMQ).
 *
 * Só é iniciado quando REDIS_URL está configurado. Sem Redis, a ingestão
 * corre inline (ver lib/queue.ts) e este worker não é necessário.
 */

import { Worker, type Job, type ConnectionOptions } from 'bullmq';
import { INGESTION_QUEUE, getRedisConnection, redisEnabled, type IngestionJobData } from '../lib/queue.js';
import { processDocumentIngestion } from '../services/knowledge.service.js';

let worker: Worker | null = null;

/** Inicia o worker de ingestão se o Redis estiver disponível. */
export function startIngestionWorker(): Worker | null {
  if (!redisEnabled()) {
    console.log('ℹ️  Ingestão em modo inline (REDIS_URL não definido)');
    return null;
  }
  if (worker) return worker;

  const connection = getRedisConnection();
  if (!connection) return null;

  worker = new Worker<IngestionJobData>(
    INGESTION_QUEUE,
    async (job: Job<IngestionJobData>) => {
      await processDocumentIngestion(job.data.documentId);
    },
    {
      connection: connection as unknown as ConnectionOptions,
      concurrency: 3,
      limiter: { max: 10, duration: 1000 }, // protege a API de embeddings
    },
  );

  worker.on('completed', (job) => {
    console.log(`✅ [ingestion] documento ${job.data.documentId} indexado`);
  });
  worker.on('failed', (job, err) => {
    console.error(`❌ [ingestion] falha no documento ${job?.data.documentId}:`, err.message);
  });

  console.log('✅ Worker de ingestão iniciado (Redis)');
  return worker;
}

/** Encerra o worker (graceful shutdown). */
export async function stopIngestionWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
  }
}
