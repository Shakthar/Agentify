/**
 * CustomerIdentificationService
 *
 * Unifica a identidade do cliente através de múltiplos canais (WhatsApp, Instagram, Webchat).
 * Estratégia de match por prioridade:
 *  1. Exact phone match (E.164 normalizado)
 *  2. Exact email match
 *  3. externalIds JSON match (ex: instagram senderId)
 *  4. Criar novo Customer se não encontrado
 */

import prisma from '../lib/prisma.js';

/** Normaliza número de telefone para E.164 sem o + */
function normalizePhone(phone: string): string {
  // Remove tudo que não seja dígito
  return phone.replace(/\D/g, '');
}

export interface IdentifyCustomerInput {
  tenantId: string;
  phone?: string;       // número de telemóvel (qualquer formato)
  email?: string;
  name?: string;
  channel: string;      // 'whatsapp' | 'instagram' | 'webchat'
  channelId: string;    // ID do utilizador no canal (ex: WA number, IG senderId)
}

export interface CustomerRecord {
  id: string;
  tenantId: string;
  phone: string | null;
  email: string | null;
  name: string | null;
  externalIds: Record<string, string> | null;
}

/**
 * Encontra ou cria um Customer unificado.
 * Retorna sempre um Customer — nunca null.
 */
export async function identifyCustomer(input: IdentifyCustomerInput): Promise<CustomerRecord> {
  const { tenantId, email, name, channel, channelId } = input;
  const phone = input.phone ? normalizePhone(input.phone) : undefined;

  // 1. Match por channelId nos externalIds
  const byExternalId = await (prisma as any).customer.findFirst({
    where: {
      tenantId,
      externalIds: { path: [channel], equals: channelId },
    },
  });
  if (byExternalId) {
    // Atualizar nome se aprendemos algo novo
    if (name && !byExternalId.name) {
      await (prisma as any).customer.update({
        where: { id: byExternalId.id },
        data: { name },
      });
    }
    return byExternalId as CustomerRecord;
  }

  // 2. Match por telefone
  if (phone) {
    const byPhone = await (prisma as any).customer.findFirst({
      where: { tenantId, phone },
    });
    if (byPhone) {
      // Adicionar mapeamento deste canal
      const existing = (byPhone.externalIds as Record<string, string>) ?? {};
      await (prisma as any).customer.update({
        where: { id: byPhone.id },
        data: {
          externalIds: { ...existing, [channel]: channelId },
          ...(name && !byPhone.name ? { name } : {}),
        },
      });
      return byPhone as CustomerRecord;
    }
  }

  // 3. Match por email
  if (email) {
    const byEmail = await (prisma as any).customer.findFirst({
      where: { tenantId, email },
    });
    if (byEmail) {
      const existing = (byEmail.externalIds as Record<string, string>) ?? {};
      await (prisma as any).customer.update({
        where: { id: byEmail.id },
        data: {
          externalIds: { ...existing, [channel]: channelId },
          ...(phone ? { phone } : {}),
          ...(name && !byEmail.name ? { name } : {}),
        },
      });
      return byEmail as CustomerRecord;
    }
  }

  // 4. Criar novo Customer
  const newCustomer = await (prisma as any).customer.create({
    data: {
      tenantId,
      phone: phone ?? null,
      email: email ?? null,
      name: name ?? null,
      externalIds: { [channel]: channelId },
    },
  });

  console.log(`[Customer] Novo customer criado: ${newCustomer.id} tenantId=${tenantId} channel=${channel} channelId=${channelId}`);
  return newCustomer as CustomerRecord;
}

/**
 * Tenta encontrar uma conversa existente (aberta) para este customer + agent, independente do canal.
 * Permite cross-channel merging: se o mesmo customer contactar via WA e depois IG,
 * pode continuar a mesma conversa.
 */
export async function findOpenConversationForCustomer(
  customerId: string,
  agentId: string,
  channelType: string,
): Promise<{ id: string; channelType: string } | null> {
  // Preferir conversa do mesmo canal
  const sameChannel = await (prisma.conversation as any).findFirst({
    where: {
      customerId,
      agentId,
      channelType,
      resolved: false,
      closedAt: null,
      handedOffToHuman: false,
    },
  });
  if (sameChannel) return sameChannel;

  // Fallback: qualquer canal aberto (cross-channel merge)
  const anyChannel = await (prisma.conversation as any).findFirst({
    where: {
      customerId,
      agentId,
      resolved: false,
      closedAt: null,
      handedOffToHuman: false,
    },
  });
  return anyChannel ?? null;
}
