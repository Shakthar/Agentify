/**
 * Helper para interações com Instagram via Meta Graph API (nova Instagram Login API).
 * Suporta: DMs, respostas a comentários, publicação de conteúdo, insights.
 */

const IG_GRAPH = 'https://graph.facebook.com';

function igVersion(): string {
  return process.env.INSTAGRAM_API_VERSION ?? process.env.WHATSAPP_API_VERSION ?? 'v20.0';
}

// ─── DMs ─────────────────────────────────────────────────────────────────────

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
    const resp = await fetch(`${IG_GRAPH}/${igVersion()}/${pageId}/messages`, {
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
