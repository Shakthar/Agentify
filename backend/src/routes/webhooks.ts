import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { asyncHandler } from '../utils/asyncHandler.js';
import prisma from '../lib/prisma.js';
import * as conversationsService from '../services/conversations.service.js';
import { decrypt } from '../lib/encryption.js';

/** Verifica a assinatura X-Hub-Signature-256 enviada pelo Meta */
function verifyMetaSignature(req: Request & { rawBody?: Buffer }): boolean {
  const appSecret = process.env.META_APP_SECRET;
  if (!appSecret) {
    console.error('[WhatsApp] META_APP_SECRET não configurado — verificação de assinatura ignorada');
    return false;
  }
  const signature = req.headers['x-hub-signature-256'] as string | undefined;
  if (!signature || !req.rawBody) return false;
  const expected = 'sha256=' + crypto.createHmac('sha256', appSecret).update(req.rawBody).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

const router = Router();

// ─── GET /api/webhooks/whatsapp/status ──────────────────────────────────────
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
    res.status(200).send(challenge);
  } else {
    res.status(403).send('Forbidden');
  }
});

// ─── POST /api/webhooks/whatsapp ─────────────────────────────────────────────
// Meta envia mensagens recebidas para este endpoint
router.post('/whatsapp', asyncHandler(async (req: Request & { rawBody?: Buffer }, res: Response) => {
  // Verificar assinatura HMAC-SHA256 antes de processar qualquer payload
  if (!verifyMetaSignature(req)) {
    res.status(403).send('Forbidden');
    return;
  }

  // Responder 200 imediatamente — Meta retenta se não receber 200 em 20s
  res.status(200).send('EVENT_RECEIVED');

  const body = req.body;
  if (body.object !== 'whatsapp_business_account') return;

  for (const entry of (body.entry ?? []) as WhatsAppEntry[]) {
    for (const change of (entry.changes ?? [])) {
      if (change.field !== 'messages') continue;

      const value       = change.value;
      const phoneId     = value.metadata?.phone_number_id as string | undefined;
      const messages    = (value.messages ?? []) as WhatsAppMessage[];

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
            const [iv, ciphertext] = agentForReply.whatsappToken.split(':');
            try { replyToken = decrypt(ciphertext, iv, agentForReply.tenant.encryptionKey); } catch { /* usa fallback */ }
          }
          await sendWhatsAppReply(
            phoneId,
            from,
            '⚠️ De momento apenas consigo responder a mensagens de texto. Por favor, escreva a sua mensagem.',
            replyToken ?? process.env.WHATSAPP_TOKEN,
          );
          continue;
        }

        const text = msg.text?.body ?? '';
        if (!text) continue;

        // Encontrar agente pelo phone_number_id do Meta
        const agent = await prisma.agent.findFirst({
          where: { whatsappNumber: phoneId, whatsappEnabled: true, isActive: true },
          include: { tenant: { select: { encryptionKey: true } } },
        });

        if (!agent) {
          console.warn(`[WhatsApp] Nenhum agente encontrado para phone_number_id=${phoneId}`);
          continue;
        }

        // Token por agente (encriptado) ou fallback para env global
        let agentToken: string | undefined;
        if (agent.whatsappToken && agent.tenant.encryptionKey) {
          const [iv, ciphertext] = agent.whatsappToken.split(':');
          try { agentToken = decrypt(ciphertext, iv, agent.tenant.encryptionKey); } catch { /* usa fallback */ }
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
        let result: { content: string };
        try {
          result = await conversationsService.sendMessage(agent.tenantId, conversation.id, text);
        } catch (err) {
          console.error('[WhatsApp] Erro ao processar mensagem:', err);
          continue;
        }

        // Enviar resposta de volta ao WhatsApp
        await sendWhatsAppReply(phoneId, from, result.content, effectiveToken);
      }
    }
  }
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function sendWhatsAppReply(phoneId: string, to: string, text: string, token: string | undefined): Promise<void> {
  const version = process.env.WHATSAPP_API_VERSION ?? 'v20.0';

  if (!token) {
    console.warn('[WhatsApp] Token não disponível — resposta não enviada');
    return;
  }

  const url = `https://graph.facebook.com/${version}/${phoneId}/messages`;

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: text },
      }),
    });

    if (!resp.ok) {
      const err = await resp.text();
      console.error('[WhatsApp] Erro ao enviar mensagem:', err);
    }
  } catch (err) {
    console.error('[WhatsApp] Falha na chamada à API do Meta:', err);
  }
}

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
