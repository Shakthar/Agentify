import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { asyncHandler } from '../utils/asyncHandler.js';
import { authenticate } from '../middleware/auth.js';
import { ForbiddenError } from '../lib/errors.js';
import { AuthenticatedRequest } from '../types/index.js';
import { webhookLimiter } from '../middleware/rateLimit.js';
import prisma from '../lib/prisma.js';
import * as conversationsService from '../services/conversations.service.js';
import { identifyCustomer } from '../services/customer.service.js';
import { decrypt } from '../lib/encryption.js';
import { unwrapDataKey } from '../lib/keyVault.js';
import { sendWhatsAppText, sendWhatsAppDocument } from '../lib/whatsapp.js';
import { sendInstagramDM, replyToInstagramComment } from '../lib/instagram.js';
import { deductWaMsgCredit } from '../services/billing.service.js';
import { isWithinSchedule } from '../utils/schedule.js';

/** Verifica a assinatura X-Hub-Signature-256 enviada pelo Meta */
function verifyMetaSignature(req: Request & { rawBody?: Buffer }): boolean {
  // Mesma prioridade de variáveis usada em integrations.ts (OAuth do Facebook/Instagram):
  // FACEBOOK_APP_SECRET tem prioridade, com fallback para META_APP_SECRET. Antes disto,
  // esta função só lia META_APP_SECRET — se o Railway tivesse FACEBOOK_APP_SECRET (usado
  // com sucesso no OAuth) e um META_APP_SECRET diferente/desatualizado, a troca de token
  // funcionava mas a verificação de assinatura dos webhooks falhava sempre.
  const appSecret = process.env.FACEBOOK_APP_SECRET ?? process.env.META_APP_SECRET;
  if (!appSecret) {
    // FIX: sem segredo configurado, REJEITAR — nunca permitir sem verificação
    console.error('[WhatsApp] FACEBOOK_APP_SECRET/META_APP_SECRET não configurado — a rejeitar webhook (configure a variável de ambiente)');
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
  // DEBUG TEMPORÁRIO: diagnóstico de mismatch de assinatura sem expor o segredo.
  // Nenhum destes valores (tamanhos, digests, content-type, preview do corpo) revela
  // o app secret — o HMAC digest não é reversível. Remover depois de confirmada a causa.
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    console.error('[Webhook Signature Debug]', JSON.stringify({
      contentType: req.headers['content-type'] ?? null,
      contentLength: req.headers['content-length'] ?? null,
      rawBodyBytes: req.rawBody.length,
      receivedSig: signature,
      expectedSig: expected,
      rawBodyPreview: req.rawBody.toString('utf8').slice(0, 200),
    }));
  }
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
      WHATSAPP_API_VERSION: process.env.WHATSAPP_API_VERSION ?? 'v26.0',
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

      const bodyValue   = change.value;
      const phoneId     = bodyValue.metadata?.phone_number_id as string | undefined;
      const messages    = (bodyValue.messages ?? []) as WhatsAppMessage[];
      const statuses    = (bodyValue as any).statuses ?? [];
      console.log(`[WhatsApp Webhook] phone_number_id=${phoneId} mensagens=${messages.length} statuses=${statuses.length}`);
      // Log delivery status updates from Meta
      for (const st of statuses) {
        console.log(`[WhatsApp Status] id=${st.id} status=${st.status} recipient=${st.recipient_id} ts=${st.timestamp}${st.errors ? ' errors=' + JSON.stringify(st.errors) : ''}`);
      }

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

        // Deduplicação: ignorar mensagem já processada
        if (msg.id) {
          const dup = await (prisma.message as any).findFirst({ where: { channelMessageId: msg.id } });
          if (dup) {
            console.log(`[WhatsApp] Mensagem duplicada ignorada: ${msg.id}`);
            continue;
          }
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
          try { if (dataKey) agentToken = decrypt(ciphertext, iv, dataKey); } catch (decErr) {
            console.error('[WhatsApp] Erro ao desencriptar token do agente:', decErr);
          }
        }
        const effectiveToken = agentToken ?? process.env.WHATSAPP_TOKEN;
        console.log(`[WhatsApp] Token: agente=${agentToken ? 'sim' : 'não'} env=${process.env.WHATSAPP_TOKEN ? 'sim' : 'não'} effectiveToken=${effectiveToken ? 'presente' : 'AUSENTE!'}`);

        // Verificar horário de funcionamento
        if (!isWithinSchedule((agent as any).whatsappSchedule)) {
          console.log(`[WhatsApp] Fora de horário — ignorando mensagem de ${from}`);
          const offMsg = (agent as any).offHoursMessage as string | undefined;
          if (offMsg && effectiveToken) {
            await sendWhatsAppText(from, offMsg, phoneId, effectiveToken);
          }
          continue;
        }

        // Identificar/criar Customer unificado
        const customer = await identifyCustomer({
          tenantId: agent.tenantId,
          phone: from,
          channel: 'whatsapp',
          channelId: from,
        }).catch(err => { console.error('[WhatsApp] Erro ao identificar customer:', err); return null; });

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

        // Se em handoff humano, não responder automaticamente
        if (conversation?.handedOffToHuman) {
          console.log(`[WhatsApp] Conversa ${conversation.id} em handoff humano — a ignorar resposta automática para ${from}`);
          continue;
        }

        console.log(`[WhatsApp] Conversa existente: ${conversation ? conversation.id : 'nenhuma, a criar nova'}`);
        if (!conversation) {
          conversation = await prisma.conversation.create({
            data: {
              agentId:     agent.id,
              tenantId:    agent.tenantId,
              channelType: 'whatsapp',
              externalId:  from,
              visitorId:   from,
              ...(customer?.id ? { customerId: customer.id } : {}),
            } as any,
          });
          console.log(`[WhatsApp] Conversa criada: ${conversation.id} customer=${customer?.id ?? 'none'}`);
        } else if (customer?.id && !(conversation as any).customerId) {
          // Vincular customer a conversa existente que não tinha
          await prisma.conversation.update({
            where: { id: conversation.id },
            data: { customerId: customer.id } as any,
          });
        }

        // Processar mensagem no LLM
        console.log(`[WhatsApp] A enviar para LLM (conversa=${conversation.id})...`);
        let result: { content: string; docAttachment?: { id: string; name: string; url: string } | null; mbwayCharge?: { orderId: string; phone: string; amount: number; description: string; mock: boolean } | null; handoff?: { triggered: true; summary: string } | null };
        try {
          result = await conversationsService.sendMessage(agent.tenantId, conversation.id, text);
          console.log(`[WhatsApp] LLM respondeu (${result.content.length} chars). A enviar resposta WhatsApp...`);
        } catch (err) {
          console.error('[WhatsApp] Erro ao processar mensagem LLM:', err);
          try {
            await sendWhatsAppText(
              phoneId,
              from,
              '⚠️ Ocorreu um erro ao processar a sua mensagem. Por favor, tente novamente mais tarde.',
              effectiveToken,
            );
          } catch (sendErr) {
            console.error('[WhatsApp] Erro ao enviar mensagem de erro:', sendErr);
          }
          continue;
        }

        // Enviar resposta de volta ao WhatsApp
        console.log(`[WhatsApp] A chamar sendWhatsAppText para ${from}...`);
        await sendWhatsAppText(phoneId, from, result.content, effectiveToken);
        console.log(`[WhatsApp] sendWhatsAppText concluído para ${from}`);
        // Debitar crédito WA por mensagem enviada (Meta cobra por msg)
        deductWaMsgCredit(agent.tenantId, agent.id, conversation.id, 'whatsapp').catch(() => {});
        // Notificar responsável via WhatsApp quando handoff foi ativado
        if (result.handoff?.triggered && agent.notifyPhone) {
          const notifMsg = `🤝 *Handoff WhatsApp — ${agent.name}*\n\n📱 Cliente: +${from}\n📝 Resumo: ${result.handoff.summary}\n\n💬 Responde diretamente no WhatsApp a este número.`;
          await sendWhatsAppText(phoneId, agent.notifyPhone, notifMsg, effectiveToken)
            .catch(err => console.error('[WhatsApp] Falha ao enviar notificação de handoff:', err));
          console.log(`[WhatsApp] Notificação de handoff enviada para ${agent.notifyPhone}`);
        }
        // Enviar documento separado se o agente o indicou
        if (result.docAttachment) {
          await sendWhatsAppDocument(phoneId, from, result.docAttachment.url, result.docAttachment.name, effectiveToken);
        }
        // Notificar sobre cobrança MB Way criada
        if (result.mbwayCharge) {
          const { phone, amount, description, mock } = result.mbwayCharge;
          const amountFmt = amount.toFixed(2).replace('.', ',');
          const waMsg = mock
            ? `🧾 *Pedido recebido!* (modo teste)\\n\\n📋 ${description}\\n💶 Total: €${amountFmt}\\n\\n⚠️ MB Way em modo teste — não é cobrado nada.`
            : `💳 Enviamos um pedido de pagamento MB Way de *€${amountFmt}* para o número +${phone}.\\n\\n📱 Abre a app MB Way e aceita o pagamento para confirmar o teu pedido:\\n📋 ${description}`;
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

// ─── GET /api/webhooks/instagram ─────────────────────────────────────────────
// Meta chama este endpoint para verificar o webhook Instagram (challenge handshake)
router.get('/instagram', (req: Request, res: Response) => {
  const mode      = req.query['hub.mode'];
  const token     = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.INSTAGRAM_VERIFY_TOKEN) {
    console.log('[Instagram] Webhook verificado com sucesso');
    const safeChallenge = String(challenge ?? '').replace(/[^0-9]/g, '').slice(0, 32);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.status(200).send(safeChallenge);
  } else {
    res.status(403).send('Forbidden');
  }
});

// ─── POST /api/webhooks/instagram ────────────────────────────────────────────
// Meta envia mensagens DM do Instagram para este endpoint
router.post('/instagram', webhookLimiter, asyncHandler(async (req: Request & { rawBody?: Buffer }, res: Response) => {
  const body = req.body;

  if (body.object !== 'instagram') {
    console.warn(`[Instagram Webhook] object inesperado: ${body.object} — ignorado`);
    res.status(200).send('EVENT_RECEIVED');
    return;
  }

  // Verificar assinatura HMAC-SHA256 antes de processar qualquer payload
  if (!verifyMetaSignature(req)) {
    console.error('[Instagram Webhook] assinatura inválida — a rejeitar com 403');
    res.status(403).send('Forbidden');
    return;
  }

  // Responder 200 imediatamente — Meta retenta se não receber 200 em 20s
  res.status(200).send('EVENT_RECEIVED');

  for (const entry of (body.entry ?? []) as InstagramEntry[]) {
    const pageId = entry.id;

    // ── Comentários em posts ────────────────────────────────────────────────
    for (const change of (entry.changes ?? []) as InstagramChange[]) {
      if (change.field !== 'comments') continue;
      const commentId = change.value?.id;
      const commentText = change.value?.text;
      const commentFrom = change.value?.from?.id;
      if (!commentId || !commentText || !commentFrom) continue;

      // Ignorar comentários da própria conta
      if (commentFrom === pageId) continue;

      console.log(`[Instagram] Comentário ${commentId} de ${commentFrom}: "${commentText.slice(0, 80)}"`);

      const agentForComment = await prisma.agent.findFirst({
        where: { instagramAccountId: pageId, instagramEnabled: true, isActive: true },
        include: { tenant: { select: { encryptionKey: true } } },
      });
      if (!agentForComment) continue;

      // Verificar horário de funcionamento (Instagram comentários)
      if (!isWithinSchedule((agentForComment as any).instagramSchedule)) {
        console.log(`[Instagram] Fora de horário — ignorando comentário de ${commentFrom}`);
        continue;
      }

      let commentToken: string | undefined;
      if (agentForComment.instagramToken && agentForComment.tenant.encryptionKey) {
        const { unwrapDataKey } = await import('../lib/keyVault.js');
        const { decrypt } = await import('../lib/encryption.js');
        const dataKey = unwrapDataKey(agentForComment.tenant.encryptionKey);
        const [iv, ciphertext] = agentForComment.instagramToken.split(':');
        try { if (dataKey) commentToken = decrypt(ciphertext, iv, dataKey); } catch { /* usa fallback */ }
      }
      const effectiveCommentToken = commentToken ?? process.env.INSTAGRAM_TOKEN;

      // Cria/reutiliza conversa para este comentário
      let commentConv = await prisma.conversation.findFirst({
        where: { agentId: agentForComment.id, tenantId: agentForComment.tenantId, channelType: 'instagram_comment', externalId: commentFrom, resolved: false, closedAt: null },
      });
      if (!commentConv) {
        commentConv = await prisma.conversation.create({
          data: { agentId: agentForComment.id, tenantId: agentForComment.tenantId, channelType: 'instagram_comment' as any, externalId: commentFrom, visitorId: commentFrom } as any,
        });
      }

      try {
        const result = await conversationsService.sendMessage(agentForComment.tenantId, commentConv.id, commentText);
        await replyToInstagramComment(commentId, result.content, effectiveCommentToken);
        deductWaMsgCredit(agentForComment.tenantId, agentForComment.id, commentConv.id, 'instagram').catch(() => {});
      } catch (err) {
        console.error('[Instagram] Erro ao processar comentário LLM:', err);
      }
    }

    // ── DMs ────────────────────────────────────────────────────────────────
    for (const messaging of (entry.messaging ?? [])) {
      const senderId = messaging.sender?.id;
      const text = messaging.message?.text;

      // Ignorar echo (mensagens enviadas pela própria página) e mensagens sem texto
      if (!senderId || !text || messaging.message?.is_echo) continue;

      // Deduplicação: ignorar mensagem já processada
      const msgMid = messaging.message?.mid;
      if (msgMid) {
        const dup = await (prisma.message as any).findFirst({ where: { channelMessageId: msgMid } });
        if (dup) {
          console.log(`[Instagram] Mensagem duplicada ignorada: ${msgMid}`);
          continue;
        }
      }

      console.log(`[Instagram] DM de ${senderId} → pageId=${pageId} texto="${text.slice(0, 80)}"`);

      // Encontrar agente pelo Instagram Account ID (page ID do Meta)
      const agent = await prisma.agent.findFirst({
        where: { instagramAccountId: pageId, instagramEnabled: true, isActive: true },
        include: { tenant: { select: { encryptionKey: true } } },
      });

      if (!agent) {
        console.warn(`[Instagram] Nenhum agente encontrado para instagramAccountId=${pageId}`);
        continue;
      }

      // Verificar horário de funcionamento (Instagram DMs)
      if (!isWithinSchedule((agent as any).instagramSchedule)) {
        console.log(`[Instagram] Fora de horário — ignorando DM de ${senderId}`);
        // Para DMs podemos enviar mensagem de fora de horário se configurada
        const offMsg = (agent as any).offHoursMessage as string | undefined;
        if (offMsg) {
          let offToken: string | undefined;
          if (agent.instagramToken && agent.tenant.encryptionKey) {
            const dataKey = unwrapDataKey(agent.tenant.encryptionKey);
            const [iv, ciphertext] = agent.instagramToken.split(':');
            try { if (dataKey) offToken = decrypt(ciphertext, iv, dataKey); } catch { /* ignore */ }
          }
          const tok = offToken ?? process.env.INSTAGRAM_TOKEN;
          if (tok) await sendInstagramDM(senderId, offMsg, pageId, tok);
        }
        continue;
      }

      // Token por agente (encriptado) ou fallback para env global
      let agentToken: string | undefined;
      if (agent.instagramToken && agent.tenant.encryptionKey) {
        const dataKey = unwrapDataKey(agent.tenant.encryptionKey);
        const [iv, ciphertext] = agent.instagramToken.split(':');
        try { if (dataKey) agentToken = decrypt(ciphertext, iv, dataKey); } catch (decErr) {
          console.error('[Instagram] Erro ao desencriptar token:', decErr);
        }
      }
      const effectiveToken = agentToken ?? process.env.INSTAGRAM_TOKEN ?? process.env.WHATSAPP_TOKEN;

      // Identificar/criar Customer unificado
      const igCustomer = await identifyCustomer({
        tenantId: agent.tenantId,
        channel: 'instagram',
        channelId: senderId,
      }).catch(err => { console.error('[Instagram] Erro ao identificar customer:', err); return null; });

      // Reutilizar conversa aberta deste contacto ou criar nova
      let conversation = await prisma.conversation.findFirst({
        where: {
          agentId:     agent.id,
          tenantId:    agent.tenantId,
          channelType: 'instagram',
          externalId:  senderId,
          resolved:    false,
          closedAt:    null,
        },
      });

      if (!conversation) {
        conversation = await prisma.conversation.create({
          data: {
            agentId:     agent.id,
            tenantId:    agent.tenantId,
            channelType: 'instagram',
            externalId:  senderId,
            visitorId:   senderId,
            ...(igCustomer?.id ? { customerId: igCustomer.id } : {}),
          } as any,
        });
      } else if (igCustomer?.id && !(conversation as any).customerId) {
        await prisma.conversation.update({
          where: { id: conversation.id },
          data: { customerId: igCustomer.id } as any,
        });
      }

      // Se em handoff humano, não responder automaticamente
      if (conversation?.handedOffToHuman) {
        console.log(`[Instagram] Conversa ${conversation.id} em handoff humano — a ignorar resposta automática para ${senderId}`);
        continue;
      }

      // Processar mensagem no LLM
      let result: { content: string; handoff?: { triggered: true; summary: string } | null };
      try {
        result = await conversationsService.sendMessage(agent.tenantId, conversation.id, text);
      } catch (err) {
        console.error('[Instagram] Erro ao processar mensagem LLM:', err);
        await sendInstagramDM(senderId, '⚠️ Ocorreu um erro. Por favor, tenta novamente mais tarde.', pageId, effectiveToken);
        continue;
      }

      await sendInstagramDM(senderId, result.content, pageId, effectiveToken);
      // Debitar crédito WA por mensagem Instagram enviada
      deductWaMsgCredit(agent.tenantId, agent.id, conversation.id, 'instagram').catch(() => {});
      // Notificar responsável via WhatsApp quando handoff foi ativado no Instagram
      if (result.handoff?.triggered && agent.notifyPhone) {
        const phoneIdForNotif = agent.whatsappNumber ?? process.env.WHATSAPP_PHONE_ID;
        const tokenForNotif = effectiveToken ?? process.env.WHATSAPP_TOKEN;
        if (phoneIdForNotif) {
          const notifMsg = `🤝 *Handoff Instagram — ${agent.name}*\n\n📸 Cliente IG ID: ${senderId}\n📝 Resumo: ${result.handoff.summary}\n\n💬 Abre o Instagram e responde diretamente à conversa com este utilizador.`;
          await sendWhatsAppText(phoneIdForNotif, agent.notifyPhone, notifMsg, tokenForNotif)
            .catch(err => console.error('[Instagram] Falha ao enviar notificação WA de handoff:', err));
          console.log(`[Instagram] Notificação de handoff enviada para ${agent.notifyPhone}`);
        } else {
          console.warn('[Instagram] Handoff ativado mas sem whatsappNumber/WHATSAPP_PHONE_ID — notificação WA não enviada');
        }
      }
    }
  }
}));

interface InstagramChange {
  field: string;
  value?: {
    id?: string;
    text?: string;
    from?: { id: string; username?: string };
    media?: { id: string };
  };
}

interface InstagramEntry {
  id: string;
  changes?: InstagramChange[];
  messaging: {
    sender: { id: string };
    recipient: { id: string };
    timestamp: number;
    message?: {
      mid: string;
      text?: string;
      is_echo?: boolean;
    };
  }[];
}

export default router;
