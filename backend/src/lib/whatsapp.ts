/**
 * Helper partilhado para envio de mensagens WhatsApp via Meta Cloud API.
 * Usado por webhooks.ts, payments.ts, etc.
 */

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
  try {
    const resp = await fetch(`https://graph.facebook.com/${version}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body: text } }),
    });
    if (!resp.ok) console.error('[WhatsApp] Erro ao enviar texto:', await resp.text());
  } catch (err) {
    console.error('[WhatsApp] Falha ao enviar texto:', err);
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
  try {
    const resp = await fetch(`https://graph.facebook.com/${version}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'document', document: { link: fileUrl, filename } }),
    });
    if (!resp.ok) console.error('[WhatsApp] Erro ao enviar documento:', await resp.text());
  } catch (err) {
    console.error('[WhatsApp] Falha ao enviar documento:', err);
  }
}
