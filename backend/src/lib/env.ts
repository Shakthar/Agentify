/**
 * Validação de variáveis de ambiente no arranque.
 * Falha rápido (fail-fast) em produção quando segredos críticos estão
 * em falta ou demasiado fracos, evitando subir um servidor inseguro.
 */

const isProd = process.env.NODE_ENV === 'production';

interface Issue {
  level: 'error' | 'warn';
  message: string;
}

function isHex(value: string, bytes: number): boolean {
  return new RegExp(`^[0-9a-fA-F]{${bytes * 2}}$`).test(value);
}

export function validateEnv(): void {
  const issues: Issue[] = [];

  // ── Segredos obrigatórios ────────────────────────────────────────────────
  const required = ['DATABASE_URL', 'JWT_SECRET', 'JWT_REFRESH_SECRET', 'ANTHROPIC_API_KEY'];
  for (const key of required) {
    if (!process.env[key]) {
      issues.push({ level: 'error', message: `${key} é obrigatório e está em falta` });
    }
  }

  // ── Força dos segredos JWT ───────────────────────────────────────────────
  for (const key of ['JWT_SECRET', 'JWT_REFRESH_SECRET']) {
    const val = process.env[key];
    if (val && val.length < 32) {
      issues.push({ level: 'error', message: `${key} deve ter pelo menos 32 caracteres (tem ${val.length})` });
    }
  }
  if (process.env.JWT_SECRET && process.env.JWT_SECRET === process.env.JWT_REFRESH_SECRET) {
    issues.push({ level: 'error', message: 'JWT_SECRET e JWT_REFRESH_SECRET não podem ser iguais' });
  }

  // ── Chave-mestra de encriptação (envelope encryption) ────────────────────
  const masterKey = process.env.ENCRYPTION_MASTER_KEY;
  if (!masterKey) {
    issues.push({
      level: isProd ? 'error' : 'warn',
      message: 'ENCRYPTION_MASTER_KEY em falta — as chaves por tenant ficam em texto plano na DB. Gere com: openssl rand -hex 32',
    });
  } else if (!isHex(masterKey, 32)) {
    issues.push({ level: 'error', message: 'ENCRYPTION_MASTER_KEY deve ser 64 caracteres hexadecimais (32 bytes)' });
  }

  // ── Segurança de webhooks Meta ───────────────────────────────────────────
  // Só é crítico quando a integração WhatsApp/Meta está realmente em uso.
  const metaInUse = !!(process.env.WHATSAPP_TOKEN || process.env.WHATSAPP_VERIFY_TOKEN);
  if (!process.env.META_APP_SECRET) {
    if (metaInUse) {
      issues.push({
        level: isProd ? 'error' : 'warn',
        message: 'META_APP_SECRET em falta mas o WhatsApp está configurado — os webhooks não podem ser verificados (assinatura X-Hub-Signature-256)',
      });
    } else {
      issues.push({
        level: 'warn',
        message: 'META_APP_SECRET não definido — defina-o antes de ativar a integração WhatsApp/Meta',
      });
    }
  }

  // ── CORS ─────────────────────────────────────────────────────────────────
  if (isProd && !process.env.ALLOWED_ORIGINS) {
    issues.push({ level: 'warn', message: 'ALLOWED_ORIGINS em falta — CORS cai no default localhost:3000' });
  }

  // ── Base de conhecimento (RAG) ───────────────────────────────────────────
  if (!process.env.OPENAI_API_KEY) {
    issues.push({
      level: 'warn',
      message: 'OPENAI_API_KEY em falta — a base de conhecimento (embeddings/RAG) ficará indisponível',
    });
  }
  if (!process.env.REDIS_URL) {
    issues.push({
      level: 'warn',
      message: 'REDIS_URL em falta — a ingestão de documentos correrá em modo inline (sem fila resiliente)',
    });
  }

  // ── Relatório ────────────────────────────────────────────────────────────
  const errors = issues.filter((i) => i.level === 'error');
  const warnings = issues.filter((i) => i.level === 'warn');

  for (const w of warnings) console.warn(`⚠️  [env] ${w.message}`);
  for (const e of errors) console.error(`❌ [env] ${e.message}`);

  if (errors.length > 0) {
    throw new Error(`Configuração de ambiente inválida — ${errors.length} erro(s) crítico(s). Servidor não vai arrancar.`);
  }

  console.log('✅ Validação de ambiente concluída');
}
