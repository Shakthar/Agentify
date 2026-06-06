/**
 * Cofre de chaves — envelope encryption.
 *
 * Cada tenant tem uma chave de dados (AES-256) usada para cifrar mensagens e
 * tokens. Em vez de guardar essa chave em texto plano na DB, ela é "embrulhada"
 * (cifrada) com uma chave-mestra (ENCRYPTION_MASTER_KEY) que vive apenas no
 * ambiente do servidor. Assim, um dump da base de dados não chega para decifrar
 * dados — o atacante precisaria também da chave-mestra fora da DB.
 *
 * Formato armazenado: "v2:<iv>:<ciphertext>".
 * Chaves antigas (texto plano, 64 hex) continuam a funcionar (compatibilidade).
 */

import { encrypt, decrypt } from './encryption.js';

const MASTER_KEY = process.env.ENCRYPTION_MASTER_KEY;
const WRAP_PREFIX = 'v2:';

/** Embrulha (cifra) uma chave de dados para armazenamento seguro. */
export function wrapDataKey(plainKeyHex: string): string {
  if (!MASTER_KEY) return plainKeyHex; // sem chave-mestra (dev) → guarda como está
  const { ciphertext, iv } = encrypt(plainKeyHex, MASTER_KEY);
  return `${WRAP_PREFIX}${iv}:${ciphertext}`;
}

/** Desembrulha (decifra) a chave de dados de um tenant. */
export function unwrapDataKey(stored: string | null | undefined): string | null {
  if (!stored) return null;

  if (stored.startsWith(WRAP_PREFIX)) {
    if (!MASTER_KEY) {
      throw new Error('ENCRYPTION_MASTER_KEY é necessária para desembrulhar a chave do tenant');
    }
    const parts = stored.split(':');
    const iv = parts[1];
    const ciphertext = parts.slice(2).join(':');
    return decrypt(ciphertext, iv, MASTER_KEY);
  }

  // Chave legada em texto plano (compatibilidade com dados existentes)
  return stored;
}
