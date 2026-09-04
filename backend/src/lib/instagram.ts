/**
 * Helper para interações com Instagram via Meta Graph API (nova Instagram Login API).
 * Suporta: DMs, respostas a comentários, publicação de conteúdo, insights.
 */

const IG_GRAPH = 'https://graph.facebook.com';
// Host dedicado da "Instagram Platform" API (graph.instagram.com). A doc oficial da Meta
// (developers.facebook.com/docs/instagram-platform/webhooks/) mostra o exemplo de
// POST /{ig-id}/subscribed_apps sempre neste host, mesmo quando o token usado é um
// Facebook Page Access Token (o host aceita ambos). Isolamos esta chamada porque o
// erro "(#3) Application does not have the capability to make this API call." só
// ocorre ao chamar subscribed_apps via graph.facebook.com para uma Instagram
// Business Account ID — a hipótese é que esta edge não está exposta nesse host
// para contas ligadas via Login do Facebook para Empresas, só em graph.instagram.com.
const IG_PLATFORM_GRAPH = 'https://graph.instagram.com';

function igVersion(): string {
  return process.env.INSTAGRAM_API_VERSION ?? process.env.WHATSAPP_API_VERSION ?? 'v20.0';
}

// ─── DMs ─────────────────────────────────────────────────────────────────────

/**
 * Troca um token de System User (ou qualquer token com acesso ao ativo) por um
 * verdadeiro Page Access Token da Página indicada. A Graph API exige este tipo
 * de token especificamente para POST /{PAGE-ID}/messages — um token de System
 * User "genérico", mesmo com as permissões corretas, é rejeitado com
 * "(#190) This method must be called with a Page Access Token".
 */
export async function getPageAccessToken(pageId: string, systemUserToken: string): Promise<string | null> {
  try {
    const resp = await fetch(`${IG_GRAPH}/${igVersion()}/${pageId}?fields=access_token&access_token=${systemUserToken}`);
    const data = await resp.json() as { access_token?: string; error?: unknown };
    if (!resp.ok || !data.access_token) {
      console.error('[Instagram] Falha ao obter Page Access Token:', JSON.stringify(data).slice(0, 300));
      return null;
    }
    return data.access_token;
  } catch (err) {
    console.error('[Instagram] Erro ao trocar por Page Access Token:', err);
    return null;
  }
}

/**
 * Subscreve a conta profissional do Instagram (Instagram Business Account ID)
 * para receber webhooks de mensagens e comentários, via
 * POST /{ig-account-id}/subscribed_apps?subscribed_fields=messages,messaging_postbacks,comments.
 *
 * Porquê subscrever pelo ID da conta Instagram e não pelo Facebook Page ID:
 * - "comments" só é um campo válido no tópico "instagram" da Meta — subscrevê-lo
 *   via /{page-id}/subscribed_apps é rejeitado com
 *   "(#100) Param subscribed_fields[1] must be one of {...}" (lista do tópico "page",
 *   que não inclui "comments").
 * - "messages"/"messaging_postbacks" via /{page-id}/subscribed_apps exigem a
 *   permissão pages_messaging (Messenger), que este app não tem — dá
 *   "(#200) ... permission pages_messaging is needed". Mas esses dois campos
 *   também existem no tópico "instagram", coberto por instagram_manage_messages
 *   (que já temos), por isso subscrevemo-los ali em vez da Página.
 * - A conta Instagram não tem um "access_token" próprio (GET .../instagram-id
 *   ?fields=access_token dá "(#100) Tried accessing nonexisting field") — por
 *   isso o token usado na chamada é sempre o Page Access Token da Página ligada.
 */
export async function subscribeInstagramAccount(
  igAccountId: string,
  pageId: string,
  systemUserToken: string,
): Promise<boolean> {
  if (!igAccountId || !systemUserToken) return false;
  try {
    const pageToken = (pageId ? await getPageAccessToken(pageId, systemUserToken) : null) ?? systemUserToken;
    const resp = await fetch(
      `${IG_PLATFORM_GRAPH}/${igVersion()}/${igAccountId}/subscribed_apps?subscribed_fields=messages,messaging_postbacks,comments`,
      { method: 'POST', headers: { Authorization: `Bearer ${pageToken}` } },
    );
    const data = await resp.json() as { success?: boolean; error?: unknown };
    if (!resp.ok || !data.success) {
      console.error(`[Instagram] Falha ao subscrever webhooks da conta ${igAccountId}:`, JSON.stringify(data).slice(0, 300));
      return false;
    }
    console.log(`[Instagram] Conta ${igAccountId} subscrita para webhooks (messages, comments).`);
    return true;
  } catch (err) {
    console.error('[Instagram] Erro ao subscrever webhooks da conta Instagram:', err);
    return false;
  }
}

export async function sendInstagramDM(
  recipientId: string,
  text: string,
  pageId: string,
  token: string | undefined,
): Promise<void> {
  // Nota: a Graph API do Instagram (via Facebook Login) exige o ID da Página do
  // Facebook ligada à conta do Instagram neste endpoint — NÃO o Instagram Business
  // Account ID (esse vem nos webhooks e é usado só para encontrar o agente).
  // Usar o ID errado aqui causa "(#3) Application does not have the capability
  // to make this API call.".
  if (!token) { console.warn('[Instagram] Token em falta — DM não enviada para', recipientId); return; }
  if (!pageId) { console.warn('[Instagram] Facebook Page ID em falta (instagramPageId) — DM não enviada para', recipientId); return; }
  try {
    // O token guardado é normalmente um token de System User — trocar por um
    // Page Access Token antes de enviar (exigido por este endpoint específico).
    const pageToken = await getPageAccessToken(pageId, token) ?? token;
    const resp = await fetch(`${IG_GRAPH}/${igVersion()}/${pageId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${pageToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipient: { id: recipientId }, message: { text } }),
    });
    const body = await resp.text();
    if (!resp.ok) console.error(`[Instagram] Erro DM → ${recipientId} status=${resp.status}:`, body);
    else console.log(`[Instagram] DM enviada → ${recipientId}:`, body.slice(0, 200));
  } catch (err) {
    console.error('[Instagram] Falha ao enviar DM:', err);
  }
}

// ─── Comentários ─────────────────────────────────────────────────────────────

/** Responde a um comentário de um post do Instagram */
export async function replyToInstagramComment(
  commentId: string,
  text: string,
  token: string | undefined,
): Promise<void> {
  if (!token) { console.warn('[Instagram] Token em falta — reply a comentário não enviado'); return; }
  try {
    const resp = await fetch(`${IG_GRAPH}/${igVersion()}/${commentId}/replies`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text }),
    });
    const body = await resp.text();
    if (!resp.ok) console.error(`[Instagram] Erro reply comentário ${commentId} status=${resp.status}:`, body);
    else console.log(`[Instagram] Reply a comentário ${commentId} enviado`);
  } catch (err) {
    console.error('[Instagram] Falha ao responder a comentário:', err);
  }
}

/** Obtém o texto de um comentário pelo ID */
export async function getInstagramComment(
  commentId: string,
  token: string | undefined,
): Promise<{ text?: string; from?: { id: string; username?: string } } | null> {
  if (!token) return null;
  try {
    const resp = await fetch(
      `${IG_GRAPH}/${igVersion()}/${commentId}?fields=text,from,timestamp&access_token=${token}`,
    );
    if (!resp.ok) return null;
    return await resp.json() as { text?: string; from?: { id: string; username?: string } };
  } catch {
    return null;
  }
}

// ─── Publicação de conteúdo ───────────────────────────────────────────────────

/** Cria um container de media (passo 1 de publicação) */
export async function createInstagramMediaContainer(
  igUserId: string,
  token: string,
  params: {
    image_url?: string;
    video_url?: string;
    caption?: string;
    media_type?: 'IMAGE' | 'VIDEO' | 'REELS' | 'STORIES';
  },
): Promise<string | null> {
  try {
    const resp = await fetch(`${IG_GRAPH}/${igVersion()}/${igUserId}/media`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...params }),
    });
    const data = await resp.json() as { id?: string; error?: unknown };
    if (!resp.ok || !data.id) { console.error('[Instagram] Erro ao criar container:', data.error); return null; }
    return data.id;
  } catch (err) {
    console.error('[Instagram] Falha ao criar container de media:', err);
    return null;
  }
}

/** Publica um container de media previamente criado (passo 2) */
export async function publishInstagramMedia(
  igUserId: string,
  containerId: string,
  token: string,
): Promise<string | null> {
  try {
    const resp = await fetch(`${IG_GRAPH}/${igVersion()}/${igUserId}/media_publish`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ creation_id: containerId }),
    });
    const data = await resp.json() as { id?: string; error?: unknown };
    if (!resp.ok || !data.id) { console.error('[Instagram] Erro ao publicar media:', data.error); return null; }
    console.log(`[Instagram] Media publicada: ${data.id}`);
    return data.id;
  } catch (err) {
    console.error('[Instagram] Falha ao publicar media:', err);
    return null;
  }
}

// ─── Insights ────────────────────────────────────────────────────────────────

/** Obtém métricas da conta Instagram (seguidores, alcance, impressões) */
export async function getInstagramAccountInsights(
  igUserId: string,
  token: string,
  metrics: string[] = ['reach', 'impressions', 'profile_views', 'accounts_engaged'],
  period: 'day' | 'week' | 'month' = 'day',
): Promise<Record<string, unknown> | null> {
  try {
    const params = new URLSearchParams({
      metric: metrics.join(','),
      period,
      access_token: token,
    });
    const resp = await fetch(`${IG_GRAPH}/${igVersion()}/${igUserId}/insights?${params}`);
    if (!resp.ok) return null;
    return await resp.json() as Record<string, unknown>;
  } catch {
    return null;
  }
}
