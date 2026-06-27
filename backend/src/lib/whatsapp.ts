/**
 * Helper partilhado para envio de mensagens WhatsApp via Meta Cloud API.
 * Usado por webhooks.ts, payments.ts, etc.
 */

/**
 * Normaliza números de telefone para o formato aceite pela Meta Cloud API.
 *
 * Problema conhecido com o Brasil:
 * Desde 2012 os móveis brasileiros têm 9 dígitos (DDD + 9XXXXXXXX).
 * O Meta às vezes entrega o `from` no formato antigo sem o 9 (DDD + XXXXXXXX = 12 dígitos total).
 * Ao tentar responder, a API rejeita porque o WhatsApp do utilizador está registado com 13 dígitos.
 *
 * Fix: se o número começa com 55 (Brasil) e tem exatamente 12 dígitos,
 * inserimos o 9 após os 4 primeiros dígitos (55 + DDD = 4 chars -> 55 + DDD + 9 + XXXXXXXX).
 */
function normalizeWhatsAppNumber(to: string): string {
  // Remover tudo exceto dígitos
  let digits = to.replace(/\D/g, '');

  // Brasil: 55 + DDD (2 dígitos) + número (8 dígitos) = 12 -> inserir o 9
  if (digits.startsWith('55') && digits.length === 12) {
    const fixed = digits.slice(0, 4) + '9' + digits.slice(4);
    console.log(`[WhatsApp] Número BR normalizado (9th digit): ${digits} -> ${fixed}`);
    digits = fixed;
  }

  // Meta Cloud API exige o + no início (E.164 com prefixo)
  return `+${digits}`;
}

export async function sendWhatsAppText(
  phoneNumberId: string,
  to: string,
  text: string,
  token: string | undefined,
): Promise<void> {
  const version = process.env.WHATSAPP_API_VERSION ?? 'v20.0';
  if (!token) {
    console.warn('[WhatsApp] Token em falta — mensagem não enviada para', to);
    return;
  }
  const normalizedTo = normalizeWhatsAppNumber(to);
  try {
    const resp = await fetch(`https://graph.facebook.com/${version}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to: normalizedTo, type: 'text', text: { body: text } }),
    });
    const respBody = await resp.text();
    if (!resp.ok) {
      console.error(`[WhatsApp] Erro ao enviar texto para ${normalizedTo} (original: ${to}) status=${resp.status}:`, respBody);
    } else {
      console.log(`[WhatsApp] Mensagem enviada com sucesso para ${normalizedTo} (status=${resp.status}):`, respBody.slice(0, 200));
    }
  } catch (err) {
    console.error('[WhatsApp] Falha ao enviar texto (network/fetch error):', err);
  }
}

export async function sendWhatsAppDocument(
  phoneNumberId: string,
  to: string,
  fileUrl: string,
  filename: string,
  token: string | undefined,
): Promise<void> {
  const version = process.env.WHATSAPP_API_VERSION ?? 'v20.0';
  if (!token) return;
  const normalizedTo = normalizeWhatsAppNumber(to);
  try {
    const resp = await fetch(`https://graph.facebook.com/${version}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to: normalizedTo, type: 'document', document: { link: fileUrl, filename } }),
    });
    if (!resp.ok) {
      const errBody = await resp.text();
      console.error(`[WhatsApp] Erro ao enviar documento para ${normalizedTo}:`, errBody);
    }
  } catch (err) {
    console.error('[WhatsApp] Falha ao enviar documento:', err);
  }
}
