/**
 * Divisão de texto em pedaços (chunks) para embeddings/RAG.
 *
 * Estratégia: divide por parágrafos/frases respeitando um tamanho-alvo em
 * caracteres, com sobreposição (overlap) para preservar contexto entre chunks.
 */

export interface ChunkOptions {
  /** Tamanho-alvo de cada chunk em caracteres. */
  chunkSize?: number;
  /** Sobreposição em caracteres entre chunks consecutivos. */
  overlap?: number;
  /** Número máximo de chunks a produzir (proteção contra documentos enormes). */
  maxChunks?: number;
}

const DEFAULT_CHUNK_SIZE = 1200;
const DEFAULT_OVERLAP = 150;
const DEFAULT_MAX_CHUNKS = 2000;

/** Normaliza espaços em branco excessivos. */
function normalize(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Divide texto em chunks com sobreposição.
 * Tenta quebrar em fronteiras naturais (parágrafo, frase) quando possível.
 */
export function chunkText(input: string, options: ChunkOptions = {}): string[] {
  const chunkSize = options.chunkSize ?? DEFAULT_CHUNK_SIZE;
  const overlap = Math.min(options.overlap ?? DEFAULT_OVERLAP, Math.floor(chunkSize / 2));
  const maxChunks = options.maxChunks ?? DEFAULT_MAX_CHUNKS;

  const text = normalize(input);
  if (!text) return [];
  if (text.length <= chunkSize) return [text];

  const chunks: string[] = [];
  let start = 0;

  while (start < text.length && chunks.length < maxChunks) {
    let end = Math.min(start + chunkSize, text.length);

    // Tenta terminar numa fronteira natural dentro da última janela do chunk
    if (end < text.length) {
      const window = text.slice(start, end);
      const lastBreak = Math.max(
        window.lastIndexOf('\n\n'),
        window.lastIndexOf('. '),
        window.lastIndexOf('\n'),
      );
      // Só usa a fronteira se estiver razoavelmente avançada no chunk
      if (lastBreak > chunkSize * 0.5) {
        end = start + lastBreak + 1;
      }
    }

    const piece = text.slice(start, end).trim();
    if (piece) chunks.push(piece);

    if (end >= text.length) break;
    start = Math.max(end - overlap, start + 1);
  }

  return chunks;
}
