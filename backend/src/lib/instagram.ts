/**
 * Helper para envio de mensagens Instagram DM via Meta Graph API.
 * Usado por webhooks.ts para responder a mensagens diretas no Instagram.
 */

export async function sendInstagramDM(
  recipientId: string,
  text: string,
  pageId: string,
  token: string | undefined,
): Promise<void> {
  const version = process.env.INSTAGRAM_API_VERSION ?? process.env.WHATSAPP_API_VERSION ?? 'v20.0';
  if (!token) {
    console.warn('[Instagram] Token em falta — DM não enviada para', recipientId);
    return;
  }
  try {
    // Nova Instagram API (Instagram Login for Business): envia via /{ig-user-id}/messages
  // O pageId aqui é o Instagram User ID da conta Business (instagramAccountId)
  const resp = await fetch(`https://graph.facebook.com/${version}/${pageId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient: { id: recipientId },
        message: { text },
      }),
    });
    const respBody = await resp.text();
    if (!resp.ok) {
      console.error(`[Instagram] Erro ao enviar DM para ${recipientId} (pageId=${pageId}) status=${resp.status}:`, respBody);
    } else {
      console.log(`[Instagram] DM enviada com sucesso para ${recipientId} (status=${resp.status}):`, respBody.slice(0, 200));
    }
  } catch (err) {
    console.error('[Instagram] Falha ao enviar DM (network/fetch error):', err);
  }
}
