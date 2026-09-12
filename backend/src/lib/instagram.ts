/**
 * Helper para interações com Instagram via Meta Graph API — Instagram API with
 * Instagram Login ("Business Login for Instagram").
 * Suporta: DMs, respostas a comentários, publicação de conteúdo, insights.
 *
 * MIGRAÇÃO (11/09/2026): este ficheiro usava antes o fluxo "Instagram API with
 * Facebook Login" (graph.facebook.com, Page Access Token, exigia uma Página do
 * Facebook ligada e a permissão pages_manage_metadata para receber webhooks).
 * Passámos para o Instagram Login porque:
 *   1. Não exige Página do Facebook nenhuma — o cliente autentica diretamente
 *      com a conta Instagram dele (Business ou Creator).
 *   2. As chamadas usam sempre o Instagram-scoped User ID diretamente — já não
 *      há noção de "Page Access Token" nem troca prévia de token.
 *   3. A subscrição de webhooks (messages) precisa apenas de
 *      instagram_business_manage_messages — NÃO de pages_manage_metadata, que
 *      era o bloqueio identificado a 11/09 e nunca chegou a ser aprovado.
 *
 * Contrapartida: o token de longa duração aqui expira ao fim de 60 dias (ao
 * contrário do Page Access Token, que na prática não expirava) — por isso
 * existe refreshInstagramToken(), a chamar periodicamente antes de expirar
 * (ver Agent.instagramTokenExpiresAt no schema).
 *
 * Documentação oficial: developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login
 */

const IG_GRAPH = 'https://graph.instagram.com';
// Host DIFERENTE — só usado para a troca inicial do code por um token de curta
// duração (Business Login). Todos os outros pedidos (incluindo a troca para
// long-lived e o refresh) usam graph.instagram.com.
const IG_OAUTH = 'https://api.instagram.com';

function igVersion(): string {
  return process.env.INSTAGRAM_API_VERSION ?? process.env.WHATSAPP_API_VERSION ?? 'v26.0';
}

// ─── OAuth (Instagram Login) ──────────────────────────────────────────────────

export interface InstagramCodeExchangeResult {
  accessToken: string;
  userId: string;
  permissions?: string[];
}

/**
 * Troca o "code" devolvido pelo redirect de https://www.instagram.com/oauth/authorize
 * por um access_token de curta duração + o Instagram-scoped User ID. Ao contrário
 * de todos os outros pedidos deste ficheiro, este é feito em api.instagram.com
 * (não graph.instagram.com) e como POST com corpo form-urlencoded — não query string.
 */
export async function exchangeInstagramCode(
  code: string,
  redirectUri: string,
  appId: string,
  appSecret: string,
): Promise<InstagramCodeExchangeResult | null> {
  try {
    const body = new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
      code,
    });
    const resp = await fetch(`${IG_OAUTH}/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    const data = await resp.json() as { access_token?: string; user_id?: string | number; permissions?: string[]; error_message?: string; error_type?: string };
    console.log(`[Instagram] Troca de code status=${resp.status}:`, JSON.stringify(data).slice(0, 300));
    if (!resp.ok || !data.access_token || !data.user_id) return null;
    return { accessToken: data.access_token, userId: String(data.user_id), permissions: data.permissions };
  } catch (err) {
    console.error('[Instagram] Erro ao trocar code por access_token:', err);
    return null;
  }
}

export interface InstagramTokenResult {
  accessToken: string;
  expiresIn: number; // segundos
}

/** Troca um token de curta duração por um de longa duração (60 dias). */
export async function exchangeLongLivedToken(shortToken: string, appSecret: string): Promise<InstagramTokenResult | null> {
  try {
    const resp = await fetch(`${IG_GRAPH}/access_token?` + new URLSearchParams({
      grant_type: 'ig_exchange_token',
      client_secret: appSecret,
      access_token: shortToken,
    }));
    const data = await resp.json() as { access_token?: string; expires_in?: number; error?: unknown };
    console.log(`[Instagram] Troca long-lived status=${resp.status}:`, JSON.stringify(data).slice(0, 200));
    if (!resp.ok || !data.access_token) return null;
    return { accessToken: data.access_token, expiresIn: data.expires_in ?? 60 * 24 * 60 * 60 };
  } catch (err) {
    console.error('[Instagram] Erro ao trocar por token de longa duração:', err);
    return null;
  }
}

/**
 * Renova um token de longa duração antes de expirar (só funciona se ainda tiver
 * pelo menos 24h de validade). Chamar periodicamente (ex: cron diário) para
 * cada agente com instagramTokenExpiresAt a aproximar-se — sem isto, ao fim de
 * 60 dias o envio de DMs e a subscrição de webhooks passam a falhar.
 */
export async function refreshInstagramToken(longToken: string): Promise<InstagramTokenResult | null> {
  try {
    const resp = await fetch(`${IG_GRAPH}/refresh_access_token?` + new URLSearchParams({
      grant_type: 'ig_refresh_token',
      access_token: longToken,
    }));
    const data = await resp.json() as { access_token?: string; expires_in?: number; error?: unknown };
    if (!resp.ok || !data.access_token) {
      console.warn('[Instagram] Falha ao renovar token:', JSON.stringify(data).slice(0, 200));
      return null;
    }
    return { accessToken: data.access_token, expiresIn: data.expires_in ?? 60 * 24 * 60 * 60 };
  } catch (err) {
    console.error('[Instagram] Erro ao renovar token:', err);
    return null;
  }
}

/** Obtém o perfil (Instagram-scoped User ID + username) do dono do token. */
export async function getInstagramProfile(token: string): Promise<{ userId: string; username?: string; name?: string } | null> {
  try {
    const resp = await fetch(`${IG_GRAPH}/${igVersion()}/me?fields=user_id,username,name&access_token=${encodeURIComponent(token)}`);
    const data = await resp.json() as { user_id?: string | number; username?: string; name?: string; error?: unknown };
    if (!resp.ok || !data.user_id) {
      console.error('[Instagram] Falha ao obter perfil:', JSON.stringify(data).slice(0, 300));
      return null;
    }
    return { userId: String(data.user_id), username: data.username, name: data.name };
  } catch (err) {
    console.error('[Instagram] Erro ao obter perfil:', err);
    return null;
  }
}

// ─── DMs ─────────────────────────────────────────────────────────────────────

/**
 * Subscreve a conta Instagram para receber webhooks (mensagens, comentários,
 * menções), via POST /{ig-user-id}/subscribed_apps?subscribed_fields=<campos>.
 *
 * Instagram Login não usa Página nenhuma — o token já é do próprio utilizador
 * Instagram, por isso esta chamada usa-o diretamente (sem troca prévia por
 * Page Access Token, ao contrário do fluxo antigo via Login do Facebook).
 * Permissão exigida para o campo "messages": instagram_business_manage_messages
 * (base: instagram_business_basic). Confirmado na doc oficial da Meta — NÃO
 * depende de pages_manage_metadata, que bloqueava o fluxo antigo.
 */
export async function subscribeInstagramAccount(
  igUserId: string,
  token: string,
): Promise<boolean> {
  if (!igUserId || !token) return false;
  try {
    const resp = await fetch(
      `${IG_GRAPH}/${igVersion()}/${igUserId}/subscribed_apps?subscribed_fields=messages,comments,mentions&access_token=${encodeURIComponent(token)}`,
      { method: 'POST' },
    );
    const data = await resp.json() as { success?: boolean; error?: unknown };
    if (!resp.ok || !data.success) {
      console.warn(`[Instagram] Falha ao subscrever webhooks da conta ${igUserId}:`, JSON.stringify(data));
      return false;
    }
    console.log(`[Instagram] Conta ${igUserId} subscrita para webhooks (messages, comments, mentions).`);
    return true;
  } catch (err) {
    console.error('[Instagram] Erro ao subscrever webhooks da conta Instagram:', err);
    return false;
  }
}

export async function sendInstagramDM(
  recipientId: string,
  text: string,
  igUserId: string,
  token: string | undefined,
): Promise<void> {
  // Instagram Login: o endpoint /{ig-user-id}/messages usa diretamente o
  // Instagram-scoped User ID da conta ligada — já não existe Facebook Page
  // nenhuma envolvida neste fluxo.
  if (!token) { console.warn('[Instagram] Token em falta — DM não enviada para', recipientId); return; }
  if (!igUserId) { console.warn('[Instagram] Instagram Account ID em falta — DM não enviada para', recipientId); return; }
  try {
    const resp = await fetch(`${IG_GRAPH}/${igVersion()}/${igUserId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
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
      `${IG_GRAPH}/${igVersion()}/${commentId}?fields=text,from,timestamp&access_token=${encodeURIComponent(token)}`,
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
