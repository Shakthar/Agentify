/**
 * Serviço da skill "Validação" — allow-list de contactos aprovados por agente.
 *
 * Quando `skillValidationEnabled=true` num agente, só números de telefone
 * (WhatsApp/Telegram) presentes nesta lista podem conversar com o agente; os
 * restantes recebem uma recusa fixa e a mensagem NUNCA chega ao LLM (poupa
 * créditos e impede que estranhos usem o agente). O envio da recusa é limitado
 * a 1x por 24h por contacto para não fazer spam.
 *
 * Não se aplica ao Instagram: a Graph API do Instagram só devolve o PSID do
 * remetente, nunca um número de telefone, por isso não há o que validar aí —
 * as mensagens de Instagram passam sempre, mesmo com a skill ativa.
 */

import prisma from '../lib/prisma.js';
import { NotFoundError, BadRequestError } from '../lib/errors.js';
import { normalizePhone } from './customer.service.js';
import { parseCsv } from '../lib/textExtraction.js';

const DEFAULT_BLOCKED_MESSAGE =
  'Este número não está autorizado a usar este agente. Contacta o responsável do negócio se achas que isto é um engano.';

const DEFAULT_CONTACT_PROMPT_MESSAGE =
  'Para continuar, precisamos de confirmar o teu número de telefone. Toca no botão abaixo para partilhares o teu contacto.';

// Não (re)enviar a mesma mensagem automática (recusa ou pedido de contacto) mais
// do que 1x por dia ao mesmo contacto.
const VALIDATION_THROTTLE_MS = 24 * 60 * 60 * 1000;

// ── Mensagens ────────────────────────────────────────────────────────────────

/** Mensagem de recusa configurada no agente, ou a mensagem padrão em português. */
export function getBlockedMessage(agent: { validationBlockedMessage?: string | null }): string {
  return agent.validationBlockedMessage?.trim() || DEFAULT_BLOCKED_MESSAGE;
}

/** Mensagem fixa que acompanha o pedido de partilha de contacto (Telegram). */
export function getContactPromptMessage(): string {
  return DEFAULT_CONTACT_PROMPT_MESSAGE;
}

// ── Verificação da allow-list ────────────────────────────────────────────────

/** Verifica se um telefone (em qualquer formato) está na allow-list do agente. */
export async function isPhoneAllowed(agentId: string, rawPhone: string): Promise<boolean> {
  const phone = normalizePhone(rawPhone);
  if (!phone) return false;
  const contact = await (prisma as any).agentAllowedContact.findFirst({ where: { agentId, phone } });
  return !!contact;
}

// ── Throttle de mensagens automáticas (1x/24h por Customer) ─────────────────

/** true se ainda não enviámos a recusa a este customer nas últimas 24h. */
export function shouldSendBlockedMessage(customer: { lastValidationBlockedAt?: Date | null }): boolean {
  if (!customer.lastValidationBlockedAt) return true;
  return Date.now() - new Date(customer.lastValidationBlockedAt).getTime() > VALIDATION_THROTTLE_MS;
}

export async function markBlockedMessageSent(customerId: string): Promise<void> {
  await (prisma as any).customer.update({ where: { id: customerId }, data: { lastValidationBlockedAt: new Date() } });
}

/** true se ainda não pedimos a este customer (Telegram) para partilhar o contacto nas últimas 24h. */
export function shouldSendContactPrompt(customer: { lastValidationPromptAt?: Date | null }): boolean {
  if (!customer.lastValidationPromptAt) return true;
  return Date.now() - new Date(customer.lastValidationPromptAt).getTime() > VALIDATION_THROTTLE_MS;
}

export async function markContactPromptSent(customerId: string): Promise<void> {
  await (prisma as any).customer.update({ where: { id: customerId }, data: { lastValidationPromptAt: new Date() } });
}

// ── Gestão da allow-list (endpoints /api/agents/:id/validation/contacts) ────

async function assertAgentOwnership(tenantId: string, agentId: string): Promise<void> {
  const agent = await prisma.agent.findFirst({ where: { id: agentId, tenantId }, select: { id: true } });
  if (!agent) throw new NotFoundError('Agent not found');
}

interface ListParams {
  skip?: number;
  take?: number;
}

export async function listAllowedContacts(tenantId: string, agentId: string, params: ListParams) {
  await assertAgentOwnership(tenantId, agentId);
  const skip = params.skip ?? 0;
  const take = Math.min(params.take ?? 50, 200);

  const [contacts, total] = await Promise.all([
    (prisma as any).agentAllowedContact.findMany({
      where: { agentId },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    }),
    (prisma as any).agentAllowedContact.count({ where: { agentId } }),
  ]);
  return { contacts, total };
}

interface AddContactInput {
  phone: string;
  label?: string;
}

/** Adiciona (ou atualiza a etiqueta de) um contacto aprovado. Nunca duplica. */
export async function addAllowedContact(tenantId: string, agentId: string, input: AddContactInput) {
  await assertAgentOwnership(tenantId, agentId);

  const phone = normalizePhone(input.phone);
  if (phone.length < 6) throw new BadRequestError('Número de telefone inválido');
  const label = input.label?.trim() || null;

  const existing = await (prisma as any).agentAllowedContact.findFirst({ where: { agentId, phone } });
  if (existing) {
    return (prisma as any).agentAllowedContact.update({ where: { id: existing.id }, data: { label } });
  }
  return (prisma as any).agentAllowedContact.create({ data: { agentId, tenantId, phone, label } });
}

export async function deleteAllowedContact(tenantId: string, agentId: string, contactId: string): Promise<void> {
  await assertAgentOwnership(tenantId, agentId);
  const existing = await (prisma as any).agentAllowedContact.findFirst({ where: { id: contactId, agentId } });
  if (!existing) throw new NotFoundError('Contact not found');
  await (prisma as any).agentAllowedContact.delete({ where: { id: contactId } });
}

// ── Importação em massa via ficheiro (CSV/TXT) ──────────────────────────────
// NOTA: reutiliza o parser CSV já usado pela base de conhecimento (textExtraction.ts)
// em vez de adicionar uma nova dependência para .xlsx. O dono do negócio pode
// exportar o Excel/Sheets como CSV — cobre o caso de uso pedido sem novo pacote.

interface ImportFile {
  buffer: Buffer;
  fileName: string;
}

export interface ImportResult {
  total: number;
  imported: number;
  duplicates: number;
  invalid: number;
}

const MAX_IMPORT_ROWS = 20_000;

function fileExt(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : '';
}

/**
 * Importa números de telefone a partir de um ficheiro CSV/TXT — uma coluna com
 * o número, opcionalmente uma segunda coluna com um nome/etiqueta. Duplicados
 * (já na lista) e linhas inválidas são contados e ignorados, nunca dão erro —
 * o dono do negócio vê o resumo e decide se quer corrigir e reimportar.
 */
export async function importAllowedContacts(tenantId: string, agentId: string, file: ImportFile): Promise<ImportResult> {
  await assertAgentOwnership(tenantId, agentId);

  const ext = fileExt(file.fileName);
  if (ext !== 'csv' && ext !== 'txt') {
    throw new BadRequestError('Tipo de ficheiro não suportado — usa .csv ou .txt (exporta o Excel/Sheets como CSV)');
  }

  const text = file.buffer.toString('utf-8');
  let rows: string[][] = ext === 'csv'
    ? parseCsv(text)
    : text.split(/\r?\n/).map((line) => line.split(',')).filter((r) => r.some((c) => c.trim() !== ''));

  if (rows.length > MAX_IMPORT_ROWS) {
    throw new BadRequestError(`Ficheiro tem demasiadas linhas (máximo ${MAX_IMPORT_ROWS})`);
  }

  // Ignora uma eventual linha de cabeçalho — a primeira célula não tem dígitos
  // suficientes para ser um número de telefone (ex.: "Telefone", "Nome").
  if (rows.length > 0 && !/\d{6,}/.test(rows[0][0] ?? '')) {
    rows = rows.slice(1);
  }

  let imported = 0;
  let duplicates = 0;
  let invalid = 0;

  for (const row of rows) {
    const rawPhone = (row[0] ?? '').trim();
    if (!rawPhone) continue;

    const phone = normalizePhone(rawPhone);
    if (phone.length < 6) { invalid++; continue; }

    const label = (row[1] ?? '').trim() || null;

    const existing = await (prisma as any).agentAllowedContact.findFirst({ where: { agentId, phone } });
    if (existing) { duplicates++; continue; }

    await (prisma as any).agentAllowedContact.create({ data: { agentId, tenantId, phone, label } });
    imported++;
  }

  return { total: rows.length, imported, duplicates, invalid };
}
