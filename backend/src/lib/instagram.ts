/**
 * Helper para interações com Instagram via Meta Graph API (nova Instagram Login API).
 * Suporta: DMs, respostas a comentários, publicação de conteúdo, insights.
 */

const IG_GRAPH = 'https://graph.facebook.com';
// NOTA (04/09): tentei mudar esta chamada para graph.instagram.com (é o host usado no
// exemplo da doc "Instagram Platform"), mas esse host devolve
// "(#190) Invalid OAuth access token - Cannot parse access token" para QUALQUER token
// desta app — porque o nosso token é um Facebook Page Access Token (obtido via Login do
// Facebook para Empresas), e graph.instagram.com só reconhece tokens da "Instagram Login"
// (formato IGAA..., de uma app Instagram distinta). Por isso voltámos a usar
// graph.facebook.com aqui, que é o host correto para o tipo de token que este app usa.

function igVersion(): string {
  // NOTA (04/09): esta função tinha 'v20.0' como último fallback, muito mais antiga do
  // que o resto do código (whatsapp.ts e webhooks.ts usam 'v26.0'). Se INSTAGRAM_API_VERSION
  // e WHATSAPP_API_VERSION não estiverem definidos no Railway, todas as chamadas do
  // Instagram (incluindo subscribed_apps) caíam para v20.0 — uma versão da API anterior à
  // unificação do tópico "instagram" (mensagens+comentários), o que explica plausivelmente o
  // "(#3) Application does not have the capability to make this API call.": nessa versão
  // antiga a app pode não ter mesmo essa capacidade para este tipo de nó. Alinhado agora
  // com o resto do código.
  return process.env.INSTAGRAM_API_VERSION ?? process.env.WHATSAPP_API_VERSION ?? 'v26.0';
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
 * Subscreve (instala) a Página do Facebook ligada à conta profissional do Instagram
 * nesta app, via POST /{page-id}/subscribed_apps?subscribed_fields=feed.
 *
 * NOTA (04/09): esta função usava o ID da conta Instagram (Instagram Business Account
 * ID) em vez do Page ID, o que dava sempre "(#3) Application does not have the
 * capability to make this API call.". A doc oficial da Meta
 * (developers.facebook.com/docs/instagram-platform/webhooks/, tabela "Requirements")
 * esclarece isto: para "Facebook Login for Business" (o que o Agentify usa), o
 * endpoint correto é sempre /<PAGE_ID> ou /me — nunca o ID da conta Instagram
 * diretamente. Corrigido para usar pageId (commit b5a8a36), o que eliminou o erro #3.
 *
 * NOTA 2 (04/09): depois de corrigir o endpoint, tentámos passar
 * subscribed_fields=messages,messaging_postbacks,comments — mas "comments" dá sempre
 * "(#100) ... must be one of {feed, mention, name, ...}" (o enum de campos do tópico
 * "page", que não inclui "comments"), e "messages"/"messaging_postbacks" dão
 * "(#200) ... precisa de pages_messaging" (permissão que o Agentify não pede, de
 * propósito, por ser específica do Messenger).
 *
 * Causa raiz: o parâmetro subscribed_fields deste endpoint refere-se aos campos do
 * tópico "page" (feed, mention, etc.) — a doc "Open Graph Page Subscribed Apps"
 * confirma: "You cannot use the subscribed_fields parameter to configure or subscribe
 * to Webhooks for Instagram. You must use your app dashboard to subscribe to Instagram
 * Webhooks." Ou seja: os campos do Instagram (comments, live_comments, messages,
 * messaging_postbacks, mentions, etc.) configuram-se a nível de app no Dashboard da
 * Meta (Casos de uso → API do Instagram → Webhooks), passo que já foi feito
 * manualmente. Esta chamada a /{page-id}/subscribed_apps serve só para
 * "instalar"/ligar esta app a esta Página específica (autorizar a Página a entregar
 * à app os webhooks a que a app já está subscrita a nível global) — por isso só
 * precisa de UM campo válido do tópico "page", e usamos "feed" (o exemplo oficial da
 * própria doc da Meta para este passo). Não deve incluir "comments"/"messages"/
 * "messaging_postbacks" — esses não são campos válidos aqui.
 */
export async function subscribeInstagramAccount(
  igAccountId: string,
  pageId: string,
  systemUserToken: string,
): Promise<boolean> {
  if (!igAccountId || !systemUserToken) return false;
  if (!pageId) {
    console.error(`[Instagram] Sem pageId para subscrever webhooks da conta ${igAccountId} — endpoint correto (Facebook Login for Business) é sempre /{page-id}/subscribed_apps.`);
    return false;
  }
  try {
    const pageToken = await getPageAccessToken(pageId, systemUserToken) ?? systemUserToken;

    const resp = await fetch(
      `${IG_GRAPH}/${igVersion()}/${pageId}/subscribed_apps?subscribed_fields=feed&access_token=${encodeURIComponent(pageToken)}`,
      { method: 'POST' },
    );
    const data = await resp.json() as { success?: boolean; error?: unknown };
    if (!resp.ok || !data.success) {
      console.error(`[Instagram] Falha ao subscrever/instalar a Página ${pageId} (conta Instagram ${igAccountId}):`, JSON.stringify(data));
      return false;
    }
    console.log(`[Instagram] Página ${pageId} (conta Instagram ${igAccountId}) subscrita/instalada para webhooks.`);
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
