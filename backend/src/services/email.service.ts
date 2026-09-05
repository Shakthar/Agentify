/**
 * Envio de email transacional via Brevo (ex-Sendinblue).
 *
 * Usa a API HTTP da Brevo diretamente (fetch nativo do Node 18+), sem
 * dependência nova no package.json. Requer as variáveis de ambiente:
 *   BREVO_API_KEY  — chave de API da conta Brevo (dashboard → SMTP & API → API Keys)
 *   SENDER_EMAIL   — remetente, tem de estar verificado na conta Brevo
 *   FRONTEND_URL   — usado para montar links clicáveis dentro do email
 *
 * Se BREVO_API_KEY não estiver definida, sendEmail() só regista um aviso e
 * não faz nada — nunca lança erro, para nunca partir o fluxo da conversa
 * (o envio de email é sempre "best effort", chamado em fire-and-forget).
 */

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: SendEmailInput): Promise<void> {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.SENDER_EMAIL;

  if (!apiKey || !senderEmail) {
    console.warn('[Email] BREVO_API_KEY ou SENDER_EMAIL não configurados — email não enviado.', { to, subject });
    return;
  }

  const res = await fetch(BREVO_API_URL, {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      sender: { email: senderEmail, name: 'Agentfy' },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Brevo respondeu ${res.status}: ${body.slice(0, 500)}`);
  }
}

interface HandoffAlertInput {
  to: string;
  agentName: string;
  agentId: string;
  conversationId: string;
  summary: string;
}

/**
 * Email disparado assim que o agente de IA transfere uma conversa para um
 * humano ([HANDOFF:resumo] detetado em conversations.service.ts). Não há
 * deep-link direto para a conversa específica (a UI ainda não suporta um
 * query param para isso) — o link leva ao separador Histórico do agente.
 */
export async function sendHandoffAlertEmail({ to, agentName, agentId, conversationId, summary }: HandoffAlertInput): Promise<void> {
  const frontendUrl = process.env.FRONTEND_URL ?? 'https://agentfy.tech';
  const dashboardUrl = `${frontendUrl}/dashboard/${agentId}?tab=history`;

  await sendEmail({
    to,
    subject: `🔀 ${agentName} precisa de ti numa conversa`,
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; color: #1f2937;">
        <h2 style="color: #3b57f0;">O agente ${agentName} transferiu uma conversa para ti</h2>
        <p style="background: #f9fafb; border-left: 3px solid #3b57f0; padding: 12px 16px; border-radius: 4px;">${summary}</p>
        <p><a href="${dashboardUrl}" style="display: inline-block; background: #3b57f0; color: #fff; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: 600;">Abrir conversa →</a></p>
        <p style="color: #9ca3af; font-size: 12px;">Conversa #${conversationId} · Agentfy</p>
      </div>
    `.trim(),
  });
}
