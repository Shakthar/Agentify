/**
 * Supabase Storage helper — armazena ficheiros partilháveis pelo agente.
 * Usa a REST API do Supabase Storage diretamente (sem SDK extra).
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;
const BUCKET       = 'agent-docs';

function storageBase(): string {
  if (!SUPABASE_URL) throw new Error('SUPABASE_URL não configurado');
  return `${SUPABASE_URL}/storage/v1`;
}

function headers(extra: Record<string, string> = {}): Record<string, string> {
  if (!SERVICE_KEY) throw new Error('SUPABASE_SERVICE_KEY não configurado');
  return {
    Authorization: `Bearer ${SERVICE_KEY}`,
    apikey: SERVICE_KEY,
    ...extra,
  };
}

/** Garante que o bucket existe e é público. Cria-o se necessário. */
export async function ensureBucket(): Promise<void> {
  const base = storageBase();

  // Verifica se existe
  const check = await fetch(`${base}/bucket/${BUCKET}`, { headers: headers() });
  if (check.ok) return;

  // Cria bucket público
  const create = await fetch(`${base}/bucket`, {
    method: 'POST',
    headers: headers({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ id: BUCKET, name: BUCKET, public: true }),
  });

  if (!create.ok) {
    const err = await create.text();
    // "already exists" não é erro
    if (!err.includes('already exists') && !err.includes('Duplicate')) {
      throw new Error(`Falha ao criar bucket: ${err.slice(0, 200)}`);
    }
  }
}

/**
 * Faz upload de um ficheiro e retorna a URL pública.
 * storageKey: caminho dentro do bucket, ex: "agentId/uuid.pdf"
 */
export async function uploadFile(
  storageKey: string,
  buffer: Buffer,
  mimeType: string,
): Promise<string> {
  await ensureBucket();
  const base = storageBase();

  const res = await fetch(`${base}/object/${BUCKET}/${storageKey}`, {
    method: 'POST',
    headers: headers({ 'Content-Type': mimeType }),
    body: buffer,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Upload falhou (${res.status}): ${err.slice(0, 200)}`);
  }

  return getPublicUrl(storageKey);
}

/** Devolve a URL pública de um ficheiro no bucket. */
export function getPublicUrl(storageKey: string): string {
  if (!SUPABASE_URL) throw new Error('SUPABASE_URL não configurado');
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${storageKey}`;
}

/** Apaga um ficheiro do bucket. */
export async function deleteFile(storageKey: string): Promise<void> {
  const base = storageBase();
  await fetch(`${base}/object/${BUCKET}/${storageKey}`, {
    method: 'DELETE',
    headers: headers(),
  });
}
