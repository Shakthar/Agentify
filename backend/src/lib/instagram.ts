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
 * nesta app, via POST /{page-id}/subscribed_apps?subscribed_fields=<campos>.
 *
 * NOTA (04/09): esta função usava o ID da conta Instagram em vez do Page ID, o que
 * dava sempre "(#3) Application does not have the capability to make this API call.".
 * Corrigido para usar pageId (commit b5a8a36) — eliminou o erro #3.
 *
 * CORREÇÃO (11/09): a nota anterior (04/09) dizia que esta falha "não tem impacto nas
 * DMs" — isso estava errado para contas de clientes reais. Confirmámos com a
 * documentação oficial da Meta (Instagram Platform > Webhooks, tabela de permissões
 * por campo) que o campo "messages" — o que entrega DMs via Messenger Platform/
 * Facebook Login for Business — exige pages_manage_metadata (além de instagram_basic,
 * instagram_manage_messages, pages_read_engagement, pages_show_list). A app ainda não
 * tem esta permissão aprovada, por isso esta chamada continua a falhar por agora.
 *
 * O motivo de "ter funcionado" antes é que a conta usada nos testes de 04/09 tinha um
 * papel (developer/tester) na própria app Meta — a Meta aplica regras mais leves
 * (Standard Access) a essas contas. Uma conta de cliente externo genuína (Advanced
 * Access, obrigatório em produção) precisa mesmo de pages_manage_metadata para a
 * Meta entregar qualquer webhook de mensagens dessa conta — confirmado em produção a
 * 11/09: nenhuma mensagem enviada para uma conta nova chegou sequer aos logs do
 * servidor, porque a Meta nunca a chega a "instalar".
 *
 * Passámos a pedir também o campo "messages" (antes só "mention", que serve para
 * comentários/menções). Assim que pages_manage_metadata for aprovada no App Review,
 * esta chamada passa a ter sucesso sem precisar de mais nenhuma alteração de código.
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
      `${IG_GRAPH}/${igVersion()}/${pageId}/subscribed_apps?subscribed_fields=messages,mention&access_token=${encodeURIComponent(pageToken)}`,
      { method: 'POST' },
    );
    const data = await resp.json() as { success?: boolean; error?: unknown };
    if (!resp.ok || !data.success) {
      console.warn(`[Instagram] Instalação da Página ${pageId} (conta Instagram ${igAccountId}) falhou — provavelmente falta pages_manage_metadata (pendente de aprovação no App Review). Para contas sem papel na app Meta, isto IMPEDE a entrega de DMs:`, JSON.stringify(data));
      return false;
    }
    console.log(`[Instagram] Página ${pageId} (conta Instagram ${igAccountId}) subscrita/instalada para webhooks (messages + mention).`);
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
