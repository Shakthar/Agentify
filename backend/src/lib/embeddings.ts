/**
 * Embeddings para a base de conhecimento (RAG).
 *
 * Usa a API de embeddings da OpenAI (text-embedding-3-small, 1536 dims).
 * A Anthropic não oferece embeddings, por isso é necessário OPENAI_API_KEY.
 *
 * Os vetores são guardados como JSON na coluna Embedding.embedding e a
 * pesquisa por similaridade é feita em memória (coseno). Para escalas muito
 * grandes, migrar para pgvector é o passo seguinte.
 */

const OPENAI_EMBEDDINGS_URL = 'https://api.openai.com/v1/embeddings';
export const EMBEDDING_MODEL = 'text-embedding-3-small';
export const EMBEDDING_DIMENSIONS = 1536;

/** Indica se o serviço de embeddings está configurado. */
export function embeddingsEnabled(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

interface OpenAIEmbeddingResponse {
  data: { embedding: number[]; index: number }[];
  usage: { prompt_tokens: number; total_tokens: number };
}

/**
 * Gera embeddings para um lote de textos.
 * Retorna um array de vetores na mesma ordem dos textos de entrada.
 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY não configurada — embeddings indisponíveis');
  }
  if (texts.length === 0) return [];

  const res = await fetch(OPENAI_EMBEDDINGS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: texts,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    if (res.status === 429) {
      // Distingue quota esgotada de rate limit temporário
      const isQuota = detail.includes('exceeded your current quota') || detail.includes('insufficient_quota');
      if (isQuota) {
        throw new Error('Conta OpenAI sem créditos. Adiciona saldo em platform.openai.com/settings/billing');
      }
      throw new Error('OpenAI: limite de pedidos atingido. Tenta novamente em alguns segundos.');
    }
    if (res.status === 401) {
      throw new Error('OPENAI_API_KEY inválida ou revogada');
    }
    throw new Error(`OpenAI embeddings falhou (${res.status}): ${detail.slice(0, 200)}`);
  }

  const json = (await res.json()) as OpenAIEmbeddingResponse;
  // Garante a ordem por index
  return json.data
    .slice()
    .sort((a, b) => a.index - b.index)
    .map((d) => d.embedding);
}

/** Gera o embedding de um único texto. */
export async function embedText(text: string): Promise<number[]> {
  const [vec] = await embedTexts([text]);
  return vec;
}

/** Similaridade de coseno entre dois vetores de igual dimensão. */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/** Serializa um vetor para armazenamento (JSON compacto). */
export function serializeEmbedding(vec: number[]): string {
  return JSON.stringify(vec);
}

/** Desserializa um vetor armazenado. Retorna [] em caso de erro. */
export function deserializeEmbedding(stored: string): number[] {
  try {
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
