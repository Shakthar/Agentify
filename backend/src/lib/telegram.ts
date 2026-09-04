/**
 * Helper partilhado para o canal Telegram (Bot API).
 * Usado por webhooks.ts (receber/responder mensagens) e agents.service.ts
 * (ligar/desligar o webhook quando o cliente guarda/remove o token do bot).
 *
 * Ao contrário do WhatsApp/Instagram, o Telegram não passa por nenhuma app Meta:
 * cada agente tem o seu próprio bot, criado pelo cliente via @BotFather, que dá
 * diretamente um token — sem OAuth, sem App Review, sem config_id.
 */

const TELEGRAM_API = 'https://api.telegram.org';

export interface TelegramBotInfo {
  id: number;
  username?: string;
  first_name?: string;
}

/** GET /getMe — confirma que o token é válido e obtém o @username do bot (só para mostrar no painel). */
export async function getTelegramBotInfo(botToken: string): Promise<TelegramBotInfo | null> {
  try {
    const resp = await fetch(`${TELEGRAM_API}/bot${botToken}/getMe`);
    const data = await resp.json() as { ok: boolean; result?: TelegramBotInfo; description?: string };
    if (!data.ok) {
      console.warn('[Telegram] getMe falhou — token provavelmente inválido:', data.description);
      return null;
    }
    return data.result ?? null;
  } catch (err) {
    console.error('[Telegram] Erro de rede em getMe:', err);
    return null;
  }
}

/** POST /setWebhook — regista o URL do nosso webhook para este bot, com um secret_token
 *  próprio (o Telegram devolve-o no header X-Telegram-Bot-Api-Secret-Token de cada pedido,
 *  já que não assina o payload como a Meta faz com X-Hub-Signature-256). */
export async function setTelegramWebhook(botToken: string, webhookUrl: string, secretToken: string): Promise<boolean> {
  try {
    const resp = await fetch(`${TELEGRAM_API}/bot${botToken}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: webhookUrl, secret_token: secretToken, allowed_updates: ['message'] }),
    });
    const data = await resp.json() as { ok: boolean; description?: string };
    if (!data.ok) console.error('[Telegram] setWebhook falhou:', data.description);
    return data.ok;
  } catch (err) {
    console.error('[Telegram] Erro de rede em setWebhook:', err);
    return false;
  }
}

/** POST /deleteWebhook — remove o webhook (chamado ao desativar o canal ou trocar o token). */
export async function deleteTelegramWebhook(botToken: string): Promise<void> {
  try {
    await fetch(`${TELEGRAM_API}/bot${botToken}/deleteWebhook`, { method: 'POST' });
  } catch (err) {
    console.error('[Telegram] Erro de rede em deleteWebhook:', err);
  }
}

/** POST /sendMessage — envia a resposta do agente de volta ao chat do Telegram. */
export async function sendTelegramMessage(chatId: string | number, text: string, botToken: string): Promise<void> {
  try {
    const resp = await fetch(`${TELEGRAM_API}/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
    const respBody = await resp.text();
    if (!resp.ok) {
      console.error(`[Telegram] Erro ao enviar texto para chat=${chatId} status=${resp.status}:`, respBody);
    } else {
      console.log(`[Telegram] Mensagem enviada com sucesso para chat=${chatId}`);
    }
  } catch (err) {
    console.error('[Telegram] Falha ao enviar texto (network/fetch error):', err);
  }
}
