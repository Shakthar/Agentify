import { Router, Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import prisma from '../lib/prisma.js';
import * as conversationsService from '../services/conversations.service.js';

const router = Router();

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
router.post('/whatsapp', asyncHandler(async (req: Request, res: Response) => {
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
        // Por agora só tratamos mensagens de texto
        if (msg.type !== 'text') continue;

        const from  = msg.from;   // Número do remetente (ex: 351912345678)
        const text  = msg.text?.body ?? '';

        if (!phoneId || !text) continue;

        // Encontrar agente pelo phone_number_id do Meta
        const agent = await prisma.agent.findFirst({
          where: { whatsappNumber: phoneId, whatsappEnabled: true, isActive: true },
        });

        if (!agent) {
          console.warn(`[WhatsApp] Nenhum agente encontrado para phone_number_id=${phoneId}`);
          continue;
        }

        // Reutilizar conversa aberta deste contacto ou criar nova
        let conversation = await prisma.conversation.findFirst({
          where: {
            agentId:     agent.id,
            tenantId:    agent.tenantId,
            channelType: 'whatsapp',
            externalId:  from,
            status:      'open',
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
              status:      'open',
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
        await sendWhatsAppReply(phoneId, from, result.content);
      }
    }
  }
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function sendWhatsAppReply(phoneId: string, to: string, text: string): Promise<void> {
  const token   = process.env.WHATSAPP_TOKEN;
  const version = process.env.WHATSAPP_API_VERSION ?? 'v19.0';

  if (!token) {
    console.warn('[WhatsApp] WHATSAPP_TOKEN não configurado — resposta não enviada');
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
