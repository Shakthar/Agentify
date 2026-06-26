import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { asyncHandler } from '../utils/asyncHandler.js';
import { authenticate } from '../middleware/auth.js';
import { ForbiddenError } from '../lib/errors.js';
import { AuthenticatedRequest } from '../types/index.js';
import { webhookLimiter } from '../middleware/rateLimit.js';
import prisma from '../lib/prisma.js';
import * as conversationsService from '../services/conversations.service.js';
import { decrypt } from '../lib/encryption.js';
import { unwrapDataKey } from '../lib/keyVault.js';
import { sendWhatsAppText, sendWhatsAppDocument } from '../lib/whatsapp.js';

/** Verifica a assinatura X-Hub-Signature-256 enviada pelo Meta */
function verifyMetaSignature(req: Request & { rawBody?: Buffer }): boolean {
  const appSecret = process.env.META_APP_SECRET;
  if (!appSecret) {
    // FIX: sem segredo configurado, REJEITAR — nunca permitir sem verificação
    console.error('[WhatsApp] META_APP_SECRET não configurado — a rejeitar webhook (configure a variável de ambiente)');
    return false;
  }
  const signature = req.headers['x-hub-signature-256'] as string | undefined;
  if (!signature || !req.rawBody) {
    console.warn('[WhatsApp] Assinatura ou rawBody em falta na verificação');
    return false;
  }
  const expected = 'sha256=' + crypto.createHmac('sha256', appSecret).update(req.rawBody).digest('hex');
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  // timingSafeEqual requer buffers do mesmo tamanho
  if (sigBuf.length !== expBuf.length) { console.warn('[WhatsApp] Assinatura com tamanho errado'); return false; }
  const match = crypto.timingSafeEqual(sigBuf, expBuf);
  if (!match) console.warn('[WhatsApp] Assinatura inválida — possível payload adulterado');
  return match;
}

const router = Router();

// ─── GET /api/webhooks/whatsapp/debug (SUPERADMIN ONLY) ─────────────────────────────────────
// Diagnóstico: mostra o estado da configuração do WhatsApp + todos os agentes
// SECURITY: requer autenticação + isAdmin — nunca expor publicamente
router.get('/whatsapp/debug', authenticate, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.tenant?.isAdmin) throw new ForbiddenError('Superadmin only');
  const allAgents = await prisma.agent.findMany({
    where: { whatsappEnabled: true },
    select: { id: true, name: true, whatsappNumber: true, whatsappEnabled: true, isActive: true },
  });
  res.json({
    config: {
      WHATSAPP_TOKEN: process.env.WHATSAPP_TOKEN ? `${process.env.WHATSAPP_TOKEN.slice(0, 12)}…` : null,
      META_APP_SECRET: process.env.META_APP_SECRET ? '***configured***' : null,
      WHATSAPP_VERIFY_TOKEN: process.env.WHATSAPP_VERIFY_TOKEN ? '***configured***' : null,
      WHATSAPP_API_VERSION: process.env.WHATSAPP_API_VERSION ?? 'v20.0',
    },
    whatsappAgents: allAgents,
    hint: 'whatsappNumber deve ser o Phone Number ID do Meta (não o Business Account ID nem o número de telefone)',
  });
}));

// ─── POST /api/webhooks/whatsapp/simulate (SUPERADMIN ONLY) ─────────────────────────────────────
// Testa o fluxo completo sem necessitar de mensagem real do WhatsApp
// SECURITY: requer autenticação + isAdmin — nunca expor publicamente (causa credit drain)
router.post('/whatsapp/simulate', authenticate, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.tenant?.isAdmin) throw new ForbiddenError('Superadmin only');
  const { phoneNumberId, text = 'Olá!' } = req.body as { phoneNumberId?: string; text?: string };
  if (!phoneNumberId) {
    res.status(400).json({ error: 'phoneNumberId é obrigatório' });
    return;
  }

  const agent = await prisma.agent.findFirst({
    where: { whatsappNumber: phoneNumberId, whatsappEnabled: true, isActive: true },
    select: { id: true, name: true, tenantId: true },
  });

  if (!agent) {
    const allAgents = await prisma.agent.findMany({
      where: { whatsappEnabled: true },
      select: { name: true, whatsappNumber: true, isActive: true },
    });
    res.status(404).json({
      error: `Nenhum agente encontrado para phoneNumberId="${phoneNumberId}"`,
      agentesWhatsAppAtivos: allAgents,
      solucao: 'O campo whatsappNumber do agente deve ser exactamente igual ao Phone Number ID do Meta',
    });
    return;
  }

  // Simular processamento sem enviar mensagem real
  let conversation = await prisma.conversation.findFirst({
    where: { agentId: agent.id, tenantId: agent.tenantId, channelType: 'whatsapp', externalId: 'simulate_test', resolved: false, closedAt: null },
  });
  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: { agentId: agent.id, tenantId: agent.tenantId, channelType: 'whatsapp', externalId: 'simulate_test', visitorId: 'simulate_test' },
    });
  }

  const result = await conversationsService.sendMessage(agent.tenantId, conversation.id, text);
  res.json({ success: true, agent: agent.name, userMessage: text, agentResponse: result.content });
}));

// ─── GET /api/webhooks/whatsapp/status ────────────────────────────────────────
// Indica ao frontend se o WHATSAPP_TOKEN está configurado
router.get('/whatsapp/status', (_req: Request, res: Response) => {
  res.json({ configured: !!process.env.WHATSAPP_TOKEN });
});

// ─── GET /api/webhooks/whatsapp ───────────────────────────────────────────────
// Meta chama este endpoint para verificar o webhook (challenge handshake)
router.get('/whatsapp', (req: Request, res: Response) => {
  const mode      = req.query['hub.mode'];
  const token     = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    console.log('[WhatsApp] Webhook verificado com sucesso');
    // SECURITY: hub.challenge é controlado pelo chamador. Express define Content-Type:
    // text/html quando a string começa com '<', permitindo XSS reflectido se alguém
    // aceder ao URL com um payload malicioso. Forçar text/plain + sanitizar para só
    // permitir caracteres numéricos (o challenge real do Meta é sempre um número inteiro).
    const safeChallenge = String(challenge ?? '').replace(/[^0-9]/g, '').slice(0, 32);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.status(200).send(safeChallenge);
  } else {
    res.status(403).send('Forbidden');
  }
});

// ─── POST /api/webhooks/whatsapp ─────────────────────────────────────────────
// Meta envia mensagens recebidas para este endpoint
router.post('/whatsapp', webhookLimiter, asyncHandler(async (req: Request & { rawBody?: Buffer }, res: Response) => {
  // Log de entrada — para diagnóstico de routing multi-número
  const body = req.body;
  const phoneIds = (body?.entry ?? []).flatMap((e: WhatsAppEntry) =>
    (e.changes ?? []).map(c => c.value?.metadata?.phone_number_id).filter(Boolean)
  );
  console.log(`[WhatsApp Webhook POST] chegou — phone_number_ids: [${phoneIds.join(', ') || 'nenhum'}]`);

  // Verificar assinatura HMAC-SHA256 antes de processar qualquer payload
  if (!verifyMetaSignature(req)) {
    console.error(`[WhatsApp Webhook POST] assinatura inválida para phone_ids=[${phoneIds.join(', ')}] — a rejeitar com 403`);
    res.status(403).send('Forbidden');
    return;
  }

  // Responder 200 imediatamente — Meta retenta se não receber 200 em 20s
  res.status(200).send('EVENT_RECEIVED');

  const body = req.body;
  console.log(`[WhatsApp Webhook] payload recebido: object=${body.object} entries=${body.entry?.length ?? 0}`);
  if (body.object !== 'whatsapp_business_account') {
    console.warn(`[WhatsApp Webhook] object inesperado: ${body.object} — ignorado`);
    return;
  }

  for (const entry of (body.entry ?? []) as WhatsAppEntry[]) {
    console.log(`[WhatsApp Webhook] entry id=${entry.id} changes=${entry.changes?.length ?? 0}`);
    for (const change of (entry.changes ?? [])) {
      if (change.field !== 'messages') {
        console.log(`[WhatsApp Webhook] campo ignorado: ${change.field}`);
        continue;
      }

      const value       = change.value;
      const phoneId     = value.metadata?.phone_number_id as string | undefined;
      const messages    = (value.messages ?? []) as WhatsAppMessage[];
      console.log(`[WhatsApp Webhook] phone_number_id=${phoneId} mensagens=${messages.length}`);

      for (const msg of messages) {
        const from = msg.from; // Número do remetente (ex: 351912345678)

        if (!phoneId || !from) continue;

        // Não-texto: informar também precisa do token do agente
        if (msg.type !== 'text') {
          const agentForReply = await prisma.agent.findFirst({
            where: { whatsappNumber: phoneId, whatsappEnabled: true, isActive: true },
            include: { tenant: { select: { encryptionKey: true } } },
          });
          let replyToken: string | undefined;
          if (agentForReply?.whatsappToken && agentForReply.tenant.encryptionKey) {
            const dataKey = unwrapDataKey(agentForReply.tenant.encryptionKey);
            const [iv, ciphertext] = agentForReply.whatsappToken.split(':');
            try { if (dataKey) replyToken = decrypt(ciphertext, iv, dataKey); } catch { /* usa fallback */ }
          }
          await sendWhatsAppText(
            phoneId,
            from,
            '⚠️ De momento apenas consigo responder a mensagens de texto. Por favor, escreva a sua mensagem.',
            replyToken ?? process.env.WHATSAPP_TOKEN,
          );
          continue;
        }

        const text = msg.text?.body ?? '';
        console.log(`[WhatsApp] Mensagem de ${from} → phoneId=${phoneId} tipo=${msg.type} texto="${text.slice(0, 80)}"`);
        if (!text) continue;

        // Encontrar agente pelo phone_number_id do Meta
        const agent = await prisma.agent.findFirst({
          where: { whatsappNumber: phoneId, whatsappEnabled: true, isActive: true },
          include: { tenant: { select: { encryptionKey: true } } },
        });

        if (!agent) {
          console.warn(`[WhatsApp] Nenhum agente encontrado para phone_number_id=${phoneId}. Agentes activos:`, 
            await prisma.agent.findMany({ where: { whatsappEnabled: true }, select: { name: true, whatsappNumber: true } }));
          continue;
        }
        console.log(`[WhatsApp] Agente encontrado: ${agent.name} (${agent.id})`);

        // Token por agente (encriptado) ou fallback para env global
        let agentToken: string | undefined;
        if (agent.whatsappToken && agent.tenant.encryptionKey) {
          const dataKey = unwrapDataKey(agent.tenant.encryptionKey);
          const [iv, ciphertext] = agent.whatsappToken.split(':');
          try { if (dataKey) agentToken = decrypt(ciphertext, iv, dataKey); } catch { /* usa fallback */ }
        }
        const effectiveToken = agentToken ?? process.env.WHATSAPP_TOKEN;

        // Reutilizar conversa aberta deste contacto ou criar nova
        let conversation = await prisma.conversation.findFirst({
          where: {
            agentId:     agent.id,
            tenantId:    agent.tenantId,
            channelType: 'whatsapp',
            externalId:  from,
            resolved:    false,
            closedAt:    null,
          },
        });

        if (!conversation) {
          conversation = await prisma.conversation.create({
            data: {
              agentId:     agent.id,
              tenantId:    agent.tenantId,
              channelType: 'whatsapp',
              externalId:  from,
              visitorId:   from,
            },
          });
        }

        // Processar mensagem no LLM
        let result: { content: string; docAttachment?: { id: string; name: string; url: string } | null; mbwayCharge?: { orderId: string; phone: string; amount: number; description: string; mock: boolean } | null };
        try {
          result = await conversationsService.sendMessage(agent.tenantId, conversation.id, text);
        } catch (err) {
          console.error('[WhatsApp] Erro ao processar mensagem:', err);
          // Informar o utilizador que algo falhou em vez de silêncio total
          await sendWhatsAppText(
            phoneId,
            from,
            '⚠️ Ocorreu um erro ao processar a sua mensagem. Por favor, tente novamente mais tarde.',
            effectiveToken,
          );
          continue;
        }

        // Enviar resposta de volta ao WhatsApp
        await sendWhatsAppText(phoneId, from, result.content, effectiveToken);
        // Enviar documento separado se o agente o indicou
        if (result.docAttachment) {
          await sendWhatsAppDocument(phoneId, from, result.docAttachment.url, result.docAttachment.name, effectiveToken);
        }
        // Notificar sobre cobrança MB Way criada
        if (result.mbwayCharge) {
          const { phone, amount, description, mock } = result.mbwayCharge;
          const amountFmt = amount.toFixed(2).replace('.', ',');
          const waMsg = mock
            ? `🧾 *Pedido recebido!* (modo teste)\n\n📋 ${description}\n💶 Total: €${amountFmt}\n\n⚠️ MB Way em modo teste — não é cobrado nada.`
            : `💳 Enviamos um pedido de pagamento MB Way de *€${amountFmt}* para o número +${phone}.\n\n📱 Abre a app MB Way e aceita o pagamento para confirmar o teu pedido:\n📋 ${description}`;
          await sendWhatsAppText(phoneId, from, waMsg, effectiveToken);
        }
      }
    }
  }
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

// ─── Tipos locais ─────────────────────────────────────────────────────────────

interface WhatsAppEntry {
  id: string;
  changes: {
    field: string;
    value: {
      metadata?: { phone_number_id?: string; display_phone_number?: string };
      messages?: WhatsAppMessage[];
    };
  }[];
}

interface WhatsAppMessage {
  from: string;
  id: string;
  type: string;
  text?: { body: string };
}

export default router;
