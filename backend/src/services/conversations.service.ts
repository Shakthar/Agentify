import prisma from '../lib/prisma.js';
import { callLLM, detectSentiment, LLMMessage } from '../lib/llm.js';
import { encrypt, decrypt } from '../lib/encryption.js';
import { unwrapDataKey } from '../lib/keyVault.js';
import { buildContextForQuery } from './knowledge.service.js';
import { createMbwayCharge } from './payments.service.js';
import { PLAN_LIMITS, Plan } from '../types/index.js';
import {
  BadRequestError,
  NotFoundError,
  PaymentRequiredError,
  UpstreamError,
} from '../lib/errors.js';
import { writeAuditLog } from './admin.service.js';

interface ListConversationsParams {
  skip?: number;
  take?: number;
  agentId?: string;
}

interface CreateConversationInput {
  agentId?: string;
  channelType?: string;
  visitorId?: string;
  externalId?: string;
}

/** Decifra o conteúdo de uma mensagem quando há IV e chave disponíveis. */
function decryptContent(content: string, iv: string | null, key?: string | null): string {
  if (iv && key) {
    try {
      return decrypt(content, iv, key);
    } catch {
      /* fallback para texto original */
    }
  }
  return content;
}

export async function listConversations(tenantId: string, params: ListConversationsParams) {
  const skip = params.skip ?? 0;
  const take = Math.min(params.take ?? 20, 50);

  const where = {
    tenantId,
    ...(params.agentId ? { agentId: params.agentId } : {}),
  };

  const [conversations, total] = await Promise.all([
    prisma.conversation.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, agentId: true, channelType: true, visitorId: true, visitorName: true,
        sentiment: true, urgency: true, resolved: true,
        handedOffToHuman: true, tokensUsed: true, creditsUsed: true,
        rating: true, needsReview: true,
        createdAt: true, closedAt: true,
        agent: { select: { name: true } },
        _count: { select: { messages: true } },
      } as any,
    }),
    prisma.conversation.count({ where }),
  ]);

  return { conversations, total };
}

export async function createConversation(tenantId: string, input: CreateConversationInput) {
  if (!input.agentId) {
    throw new BadRequestError('agentId is required');
  }

  // SECURITY: Enforce channelType allowlist — prevents arbitrary strings from
  // being stored in the DB and potentially being reflected unsanitized downstream.
  const ALLOWED_CHANNEL_TYPES = ['web', 'whatsapp', 'email', 'api'];
  const channelType = input.channelType && ALLOWED_CHANNEL_TYPES.includes(input.channelType)
    ? input.channelType
    : 'web';

  // SECURITY: Cap externalId to prevent oversized strings being stored in DB
  const externalId = input.externalId ? input.externalId.slice(0, 200) : undefined;

  const agent = await prisma.agent.findFirst({
    where: { id: input.agentId, tenantId, isActive: true },
  });
  if (!agent) {
    throw new NotFoundError('Agent not found or inactive');
  }

  const conversation = await prisma.conversation.create({
    data: {
      tenantId,
      agentId: input.agentId,
      channelType,
      visitorId: input.visitorId,
      externalId,
      modelUsed: agent.model,
    },
  });

  writeAuditLog(tenantId, 'conversation_created', 'conversation', conversation.id, { agentId: input.agentId, channel: channelType });
  return conversation;
}

export async function getConversation(tenantId: string, conversationId: string) {
  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, tenantId },
    include: {
      agent: { select: { name: true, model: true, systemPrompt: true } },
      messages: {
        orderBy: { timestamp: 'asc' },
        select: { id: true, role: true, content: true, contentIV: true, tokens: true, timestamp: true },
      },
    },
  });

  if (!conversation) {
    throw new NotFoundError('Conversation not found');
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { encryptionKey: true },
  });

  const dataKey = unwrapDataKey(tenant?.encryptionKey);
  const messages = conversation.messages.map((m) => ({
    id: m.id,
    role: m.role,
    content: decryptContent(m.content, m.contentIV, dataKey),
    tokens: m.tokens,
    timestamp: m.timestamp,
  }));

  return { ...conversation, messages };
}

export async function sendMessage(tenantId: string, conversationId: string, content: string) {
  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, tenantId },
    include: {
      agent: true,
      // FIX: get the LAST 40 messages ordered newest-first, then reverse for LLM.
      // The old `take: 20` with orderBy asc returned the OLDEST 20, meaning in a long
      // ordering conversation the LLM lost track of items added later.
      messages: { orderBy: { timestamp: 'desc' }, take: 40 },
    },
  });

  if (!conversation) {
    throw new NotFoundError('Conversation not found');
  }

  // ── Avaliação pós-atendimento: captura da nota do cliente ─────────────────
  // O agente pede a nota através do marcador [RESOLVED] (mais abaixo) SEM
  // fechar a conversa nesse momento — fica "awaitingRating" e só fechamos
  // quando o cliente responder com um número. Por isso este bloco corre
  // ANTES do guard de "conversa fechada" logo a seguir.
  if ((conversation as any).awaitingRating && !conversation.resolved && !conversation.closedAt) {
    const ratingMatch = content.match(/[1-5]/);
    if (ratingMatch) {
      const rating = parseInt(ratingMatch[0], 10);
      const ratingTextRaw = content.replace(ratingMatch[0], '').trim();
      const ratingText = ratingTextRaw ? ratingTextRaw.slice(0, 500) : null;

      const tenantForRating = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { encryptionKey: true },
      });
      const dataKeyForRating = unwrapDataKey(tenantForRating?.encryptionKey);

      let ratingUserContent = content;
      let ratingUserIV: string | undefined;
      if (dataKeyForRating) {
        const enc = encrypt(content, dataKeyForRating);
        ratingUserContent = enc.ciphertext;
        ratingUserIV = enc.iv;
      }
      await prisma.message.create({
        data: { conversationId: conversation.id, role: 'user', content: ratingUserContent, contentIV: ratingUserIV },
      });

      const thankYou = 'Obrigado pelo teu feedback! 🙌';
      let ratingAssistantContent = thankYou;
      let ratingAssistantIV: string | undefined;
      if (dataKeyForRating) {
        const enc = encrypt(thankYou, dataKeyForRating);
        ratingAssistantContent = enc.ciphertext;
        ratingAssistantIV = enc.iv;
      }
      const ratingAssistantMsg = await prisma.message.create({
        data: {
          conversationId: conversation.id,
          role: 'assistant',
          content: ratingAssistantContent,
          contentIV: ratingAssistantIV,
          tokens: 0,
        },
      });

      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { rating, ratingText, awaitingRating: false } as any,
      });
      // Fecho automático + recálculo da taxa de resolução real (item partilhado com closeConversation).
      await finalizeConversationClosure(tenantId, conversation.agentId, conversation.id);

      // NOTA: sem chamada ao LLM — não gasta créditos nem tokens.
      return {
        id: ratingAssistantMsg.id,
        role: 'assistant',
        content: thankYou,
        tokens: 0,
        creditsUsed: 0,
        sentiment: null,
        timestamp: ratingAssistantMsg.timestamp,
        docAttachment: null,
        mbwayCharge: null,
        handoff: null,
        ratingRequested: false,
      };
    }
    // Sem número reconhecível nesta mensagem — segue o fluxo normal (o cliente
    // pode ter escrito outra coisa); continuamos "awaitingRating" para a próxima.
  }

  if (conversation.resolved || conversation.closedAt) {
    throw new BadRequestError('Conversation is closed');
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { encryptionKey: true, creditsTotal: true, creditsUsed: true, plan: true },
  });
  if (!tenant) {
    throw new NotFoundError('Tenant not found');
  }

  const available = tenant.creditsTotal - tenant.creditsUsed;
  if (available <= 0) {
    throw new PaymentRequiredError('No credits available. Please purchase more.');
  }

  const planLimits = PLAN_LIMITS[tenant.plan as Plan] ?? PLAN_LIMITS.free;
  const paymentSkillCost = planLimits.paymentSkillCost; // null = bloqueado, 0+ = custo em créditos

  // SECURITY: Reservar créditos atomicamente ANTES de chamar o LLM.
  // O padrão "check (t=0) → call LLM (t=1..5s) → increment (t=5s)" tem race condition:
  // dois pedidos concorrentes passam ambos o check com saldo positivo, chamam ambos
  // o LLM, e ambos incrementam → saldo final negativo (overdraft ilimitado).
  //
  // Solução: pre-reservar o pior caso (maxTokens × custo/token) com UPDATE atómico
  // que só executa se "creditsUsed + reserva <= creditsTotal". Após o LLM,
  // devolver os créditos não usados (refund = reserva − custo_real).
  const costPerKTokens = 3; // default conservador; o custo real pode ser menor
  const maxReserve = Math.ceil(((conversation.agent.maxTokens + 2000) / 1000) * costPerKTokens);

  const reserveResult = await prisma.$executeRaw`
    UPDATE "Tenant"
    SET "creditsUsed" = "creditsUsed" + ${maxReserve}
    WHERE id = ${tenantId}
      AND "creditsTotal" - "creditsUsed" >= ${maxReserve}
  `;

  if (reserveResult === 0) {
    throw new PaymentRequiredError('No credits available. Please purchase more.');
  }

  const dataKey = unwrapDataKey(tenant.encryptionKey);

  // Histórico para o LLM (decifrado) — mensagens vêm ordenadas desc (mais recente primeiro),
  // invertemos para asc (cronológico) antes de enviar ao LLM.
  const history: LLMMessage[] = conversation.messages
    .slice() // não mutar o array original
    .reverse()
    .map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: decryptContent(m.content, m.contentIV, dataKey),
    }));
  history.push({ role: 'user', content });

  // Persiste a mensagem do utilizador (cifrada)
  let userContent = content;
  let userIV: string | undefined;
  if (dataKey) {
    const enc = encrypt(content, dataKey);
    userContent = enc.ciphertext;
    userIV = enc.iv;
  }

  await prisma.message.create({
    data: {
      conversationId: conversation.id,
      role: 'user',
      content: userContent,
      contentIV: userIV,
    },
  });

  // Recupera contexto relevante da base de conhecimento (RAG).
  // Falhas aqui não devem impedir a conversa.
  let systemPrompt = conversation.agent.systemPrompt;

  // Instrução global de eficiência — injetada ANTES do prompt do agente.
  // Em canais pagos (WhatsApp/Instagram), cada mensagem custa dinheiro real;
  // respostas concisas reduzem custo de API + créditos LLM.
  const isMessagingChannel = ['whatsapp', 'instagram'].includes(conversation.channelType);
  const efficiencyPrefix = isMessagingChannel
    ? '## REGRA DE EFICIÊNCIA (obrigatória):\n'
      + 'Sê SEMPRE conciso — cada mensagem tem custo direto:\n'
      + '- Resposta típica: 1-3 frases. Máximo absoluto: 5 frases.\n'
      + '- NUNCA divides em múltiplas mensagens — tudo de uma vez.\n'
      + '- Vai direto ao assunto. Evita "Claro!", "Boa pergunta!", "Com certeza!" como intro.\n'
      + '- Quando precisas de info do cliente: faz só UMA pergunta de cada vez.\n\n---\n\n'
    : 'Sê conciso e objetivo. Evita texto de enchimento e repetições.\n\n---\n\n';
  systemPrompt = efficiencyPrefix + systemPrompt;
  try {
    const kbContext = await buildContextForQuery(conversation.agentId, content);
    if (kbContext) systemPrompt += kbContext;
  } catch {
    /* ignora falhas de RAG e segue com o prompt base */
  }

  // Injeta lista de documentos disponíveis para envio
  try {
    const agentDocs = await prisma.agentDoc.findMany({
      where: { agentId: conversation.agentId },
      select: { id: true, name: true, description: true },
    });
    if (agentDocs.length > 0) {
      systemPrompt += '\n\n---\nDocumentos que podes enviar ao cliente (usa exatamente o marcador indicado na tua resposta quando o cliente pedir esse documento):\n';
      for (const doc of agentDocs) {
        systemPrompt += `- [SEND_DOC:${doc.id}] ${doc.name}${doc.description ? ` — ${doc.description}` : ''}\n`;
      }
      systemPrompt += 'Exemplo: "Aqui está o nosso menu! [SEND_DOC:abc123]"\n';
    }
  } catch {
    /* ignorar falhas de doc injection */
  }

  // Injeta skill de cobrança MB Way (apenas para planos com acesso)
  if (paymentSkillCost !== null) {
    systemPrompt += '\n\n---\nGESTÃO DE PEDIDOS (REGRAS OBRIGATÓRIAS):'
      + '\n1. Mantém SEMPRE um carrinho acumulado com todos os itens pedidos nesta conversa.'
      + '\n2. Quando o cliente adiciona um item ou aceita uma sugestão, confirma que os itens anteriores CONTINUAM no pedido.'
      + '\n3. Ao fazer upselling (ex: bebida, sobremesa), nunca substituis itens já pedidos — acrescentas ao carrinho.'
      + '\n4. Antes de pedir o número de telmóvel, apresenta um RESUMO COMPLETO de todos os itens e o total.'
      + '\n5. O marcador MBWAY deve conter TODOS os itens — nunca apenas o último.'
      + '\nCobrança MB Way: quando o cliente confirmar o pedido completo e fornecer o número de telmóvel, usa [MBWAY:NUMERO|VALOR|DESCRICAO].'
      + ' NUMERO = 351XXXXXXXXX; VALOR = total em euros de TODOS os itens; DESCRICAO = lista completa (ex: 1x Pizza Margherita \u20ac8.00, 1x Sumo de Laranja \u20ac2.00).'
      + ' Exemplo correto: "Perfeito! 1x Pizza Margherita + 1x Sumo = \u20ac10.00. [MBWAY:351912345678|10.00|1x Pizza Margherita \u20ac8.00, 1x Sumo de Laranja \u20ac2.00]"'
      + ' Nunca uses este marcador sem ter o número de telmóvel. Se não tiveres, pede-o primeiro.'
      + '\n\nAPÓS ENVIAR O MARCADOR [MBWAY:...]: informa o cliente que o pedido de pagamento foi enviado para o MB Way dele.'
      + ' Diz que vai receber uma notificação na app MB Way e que basta aceitar para o pedido ficar confirmado automaticamente.'
      + ' NÃO peças ao cliente para te confirmar que pagou — o sistema faz isso sozinho.'
      + ' Exemplo pós-MBWAY: "Enviei o pedido de pagamento para o teu MB Way! \ud83d\udcf1 Aceita a notificação na app MB Way e o teu pedido fica automaticamente confirmado. \ud83c\udf89"';
  }

  // Injeta skill de handoff para humano
  if (conversation.agent.skillHandoff) {
    systemPrompt += '\n\n---\nSKILL: HANDOFF PARA HUMANO'
      + '\nQuando o cliente estiver claramente frustrado, insistir em falar com uma pessoa, ou a situação estiver fora do teu âmbito:'
      + '\n1. Informa o cliente de forma simpática que vais transferir a conversa para um colega humano'
      + '\n2. Na MESMA resposta inclui o marcador: [HANDOFF:resumo breve em português, máx 150 chars]'
      + '\nExemplo: "Claro, compreendo! Vou transferir agora para a nossa equipa. [HANDOFF:Cliente quer negociar preço personalizado, pede falar com vendedor]"'
      + '\nNOTA: Usa este marcador APENAS UMA VEZ por conversa, quando tiveres a certeza que o handoff é necessário.';
  }

  // Injeta skill de avaliação pós-atendimento — só pede nota se ainda não estiver à espera de uma
  if ((conversation.agent as any).ratingEnabled && !(conversation as any).awaitingRating) {
    systemPrompt += '\n\n---\nSKILL: AVALIAÇÃO PÓS-ATENDIMENTO'
      + '\nQuando sentires que o pedido/dúvida do cliente ficou totalmente resolvido e a conversa está a terminar naturalmente'
      + ' (despedida, agradecimento, ou já não há mais nada a tratar):'
      + '\n1. Termina a tua resposta despedindo-te normalmente'
      + '\n2. Inclui o marcador [RESOLVED] no final da resposta'
      + '\nExemplo: "Fico feliz por ter ajudado! Qualquer coisa estou por aqui. [RESOLVED]"'
      + '\nNOTA: usa [RESOLVED] no máximo uma vez por conversa, só quando tiveres a certeza que terminou.';
  }

  // Autoavaliação de qualidade (QA automático) — invisível ao cliente, sempre ativa.
  systemPrompt += '\n\n---\nAUTOAVALIAÇÃO DE QUALIDADE (obrigatório, marcador invisível ao cliente):'
    + '\nSe nesta resposta não conseguires ajudar com confiança — pergunta fora do teu âmbito, respostas repetidas sem'
    + ' resolver o problema, cliente a parecer frustrado ou confuso, ou falta de informação — inclui'
    + ' [REVIEW:razão breve em português, máx 100 carateres].'
    + '\nExemplo: "Peço desculpa, não tenho essa informação disponível. [REVIEW:Cliente perguntou sobre devoluções, não está na KB]"'
    + '\nAlém disso, sempre que não encontrares a resposta na tua base de conhecimento, inclui também'
    + ' [UNKNOWN:pergunta original do cliente, resumida] — serve para o dono do negócio saber o que falta documentar.'
    + '\nAmbos os marcadores são invisíveis para o cliente e podes usá-los mais que uma vez por conversa.';

  // Injeta skill de captura de leads (dataCollection)
  if ((conversation.agent as any).skillDataCollection && !(conversation as any).flaggedForOwner) {
    systemPrompt += '\n\n---\nSKILL: CAPTURA DE LEADS'
      + '\nO teu objectivo também é identificar e capturar leads qualificados para o dono do negócio.'
      + '\nQuando o utilizador mostrar interesse claro (pedir proposta, pedir preço, deixar dados de contacto, querer marcar, etc.):'
      + '\n1. Recolhe naturalmente: nome, número de telefone, email e necessidade principal'
      + '\n2. Quando tiveres pelo menos nome + telefone, inclui este marcador invisível EXACTAMENTE UMA VEZ na tua resposta: [LEAD:nome|telefone|email|necessidade]'
      + '\n   Exemplo: [LEAD:Ana Silva|351912345678|ana@email.com|Quer proposta para website]'
      + '\n   Se não tiveres email, usa "-": [LEAD:Ana Silva|351912345678|-|Interesse em consultoria]'
      + '\nNOTA: Usa o marcador [LEAD:...] apenas uma vez, quando tiveres dados suficientes. O dono será notificado automaticamente.';
  }

  // Injeta historial de pedidos anteriores do mesmo visitante (cliente recorrente)
  // e recupera nome do visitante guardado em conversas anteriores
  let knownVisitorName: string | null = conversation.visitorName ?? null;

  if (conversation.visitorId) {
    try {
      // Busca conversas anteriores deste visitante neste agente (excluindo a atual)
      const pastConvs = await prisma.conversation.findMany({
        where: {
          agentId: conversation.agentId,
          visitorId: conversation.visitorId,
          id: { not: conversation.id },
        },
        select: { id: true, visitorName: true },
      });

      // Recupera nome do visitante de conversas anteriores (se ainda não está na conversa atual)
      if (!knownVisitorName) {
        const nameFromPast = pastConvs.find((c) => c.visitorName)?.visitorName ?? null;
        if (nameFromPast) {
          knownVisitorName = nameFromPast;
          // Persiste o nome na conversa atual para evitar lookups repetidos
          await prisma.conversation.update({
            where: { id: conversation.id },
            data: { visitorName: nameFromPast },
          }).catch(() => { /* ignorar falha de persistência */ });
        }
      }

      if (pastConvs.length > 0) {
        const pastOrders = await prisma.order.findMany({
          where: {
            conversationId: { in: pastConvs.map((c) => c.id) },
            status: { in: ['paid', 'done'] },
          },
          orderBy: { createdAt: 'desc' },
          take: 15,
          select: { description: true, amount: true },
        });

        if (pastOrders.length > 0) {
          // Conta frequência de pedidos para identificar os favoritos
          const freq: Record<string, number> = {};
          for (const o of pastOrders) {
            const key = o.description.toLowerCase().trim();
            freq[key] = (freq[key] ?? 0) + 1;
          }
          const top = Object.entries(freq)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3);

          systemPrompt += `\n\n---\nCliente recorrente: este visitante já fez ${pastOrders.length} pedido(s) anteriores.`;
          if (top[0][1] >= 3) {
            // Pedido muito repetido — sugere automaticamente
            systemPrompt += ` O seu pedido mais frequente é: "${top[0][0]}" (${top[0][1]}x).`
              + ' Quando o cliente abrir a conversa, cumprimenta-o e pergunta se quer repetir o mesmo pedido.';
          } else if (top.length >= 2) {
            const topStr = top.map(([d, n]) => `"${d}" (${n}x)`).join(', ');
            systemPrompt += ` Pedidos anteriores mais comuns: ${topStr}. Podes mencioná-los como sugestão.`;
          }
        }
      }
    } catch {
      /* ignorar falhas de histórico — não bloqueia a conversa */
    }
  }

  // Injeta instrução de identificação do visitante
  // (nome para personalização e inclusão nos pedidos)
  if (knownVisitorName) {
    systemPrompt += `\n\n---\nNOME DO CLIENTE: ${knownVisitorName}`
      + `\nTrata o cliente pelo nome "${knownVisitorName}" nas tuas respostas.`
      + ` Inclui sempre o nome no resumo do pedido e na descrição enviada para pagamento.`;
  } else {
    systemPrompt += '\n\n---\nIDENTIFICAÇÃO DO CLIENTE (obrigatório):'
      + '\nAinda não sabes o nome deste cliente. Pede o nome no início da conversa ou,'
      + ' no máximo, antes de apresentares o resumo final do pedido.'
      + ' Quando o cliente disser o nome, inclui o marcador [VISITOR_NAME:NomeAqui] na tua resposta'
      + ' (sem espaços antes/depois dos dois pontos, exatamente assim: [VISITOR_NAME:João]).'
      + ' Após aprender o nome, usa-o nas respostas seguintes e inclui-o sempre no resumo e descrição do pedido.';
  }

  // Chamada ao LLM
  let llmResponse;
  try {
    llmResponse = await callLLM(
      conversation.agent.model,
      systemPrompt,
      history,
      conversation.agent.maxTokens,
      conversation.agent.temperature,
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    throw new UpstreamError(`LLM error: ${msg}`);
  }

  // Parseia [SEND_DOC:id] da resposta do LLM
  const sendDocMatch = llmResponse.content.match(/\[SEND_DOC:([a-z0-9]+)\]/i);
  const docId = sendDocMatch?.[1] ?? null;

  // Parseia [MBWAY:phone|amount|description] da resposta do LLM
  const mbwayMatch = llmResponse.content.match(/\[MBWAY:([^|\]]+)\|([^|\]]+)\|([^\]]+)\]/i);

  // Parseia [HANDOFF:resumo] — transferência para humano
  const handoffMatch = llmResponse.content.match(/\[HANDOFF:([^\]]+)\]/i);
  const handoffSummary = handoffMatch?.[1]?.trim().slice(0, 200) ?? null;

  // Parseia [REVIEW:razão] — QA automático (falha silenciosa do agente, item "roubado" ao Watchtower da Decagon)
  const reviewMatch = llmResponse.content.match(/\[REVIEW:([^\]]+)\]/i);
  const reviewReason = reviewMatch?.[1]?.trim().slice(0, 200) ?? null;

  // Parseia [UNKNOWN:pergunta] — lacuna na base de conhecimento (item "roubado" às Suggestions da Decagon)
  const unknownMatch = llmResponse.content.match(/\[UNKNOWN:([^\]]+)\]/i);
  const unknownQuestion = unknownMatch?.[1]?.trim().slice(0, 300) ?? null;
  if (unknownQuestion) {
    (prisma as any).knowledgeGap.findFirst({
      where: { agentId: conversation.agentId, question: { equals: unknownQuestion, mode: 'insensitive' } },
    }).then((existing: { id: string; status: string } | null) => {
      if (existing) {
        return (prisma as any).knowledgeGap.update({
          where: { id: existing.id },
          data: {
            occurrences: { increment: 1 },
            ...(existing.status === 'dismissed' ? { status: 'open' } : {}),
          },
        });
      }
      return (prisma as any).knowledgeGap.create({
        data: { tenantId, agentId: conversation.agentId, conversationId: conversation.id, question: unknownQuestion },
      });
    }).catch((e: unknown) => console.error('[KnowledgeGap] Falha ao registar lacuna:', e));
  }

  // Marcador [RESOLVED] — pedido de avaliação pós-atendimento (só se a skill estiver ativa)
  const ratingRequested = (conversation.agent as any).ratingEnabled
    && !(conversation as any).awaitingRating
    && /\[RESOLVED\]/i.test(llmResponse.content);

  // Parseia [LEAD:nome|telefone|email|necessidade] — captura de lead para o dono
  const leadMatch = llmResponse.content.match(/\[LEAD:([^\]]+)\]/i);
  if (leadMatch) {
    const parts = leadMatch[1].split('|').map(s => s.trim());
    const [leadName, leadPhone, leadEmail, leadNeed] = parts;
    // Sinaliza a conversa para o dono
    prisma.conversation.update({
      where: { id: conversation.id },
      data: { flaggedForOwner: true } as any,
    }).catch(() => {});
    // Cria/actualiza contacto CRM automaticamente
    if (leadPhone && leadPhone !== '-') {
      (prisma as any).crmContact.upsert({
        where: { tenantId_phone: { tenantId, phone: leadPhone } } as any,
        update: {
          name: leadName !== '-' ? leadName : undefined,
          email: leadEmail && leadEmail !== '-' ? leadEmail : undefined,
          notes: leadNeed && leadNeed !== '-' ? `Lead via agente: ${leadNeed}` : undefined,
          lastSeenAt: new Date(),
          agentId: conversation.agentId,
        },
        create: {
          tenantId,
          agentId: conversation.agentId,
          phone: leadPhone,
          name: leadName !== '-' ? leadName : null,
          email: leadEmail && leadEmail !== '-' ? leadEmail : null,
          notes: leadNeed && leadNeed !== '-' ? `Lead via agente: ${leadNeed}` : null,
          status: 'lead',
          firstSeenAt: new Date(),
          lastSeenAt: new Date(),
        },
      }).catch((e: unknown) => console.error('[Lead] Falha ao criar CRM contact:', e));
    }
    console.log(`[Lead] Capturado: ${leadName} | ${leadPhone} | conv=${conversation.id}`);
  }

  // Parseia [VISITOR_NAME:Nome] — aprende e persiste o nome do visitante
  const visitorNameMatch = llmResponse.content.match(/\[VISITOR_NAME:([^\]]+)\]/i);
  if (visitorNameMatch) {
    const learnedName = visitorNameMatch[1].trim().slice(0, 100);
    if (learnedName) {
      prisma.conversation.update({
        where: { id: conversation.id },
        data: { visitorName: learnedName },
      }).catch(() => { /* ignorar falha de persistência do nome */ });
    }
  }

  let cleanContent = llmResponse.content
    .replace(/\[SEND_DOC:[a-z0-9]+\]/gi, '')
    .replace(/\[MBWAY:[^\]]+\]/gi, '')
    .replace(/\[VISITOR_NAME:[^\]]+\]/gi, '')
    .replace(/\[HANDOFF:[^\]]+\]/gi, '')
    .replace(/\[LEAD:[^\]]+\]/gi, '')
    .replace(/\[REVIEW:[^\]]+\]/gi, '')
    .replace(/\[UNKNOWN:[^\]]+\]/gi, '')
    .replace(/\[RESOLVED\]/gi, '')
    .trim();

  // Anexa a pergunta de avaliação em texto natural (o marcador já foi removido acima)
  // — funciona em todos os canais porque todos reenviam `result.content` tal e qual.
  if (ratingRequested) {
    cleanContent = `${cleanContent}\n\nAntes de terminarmos: de 1 a 5, como avalias este atendimento? 🙂`.trim();
  }

  let docAttachment: { id: string; name: string; url: string } | null = null;
  if (docId) {
    // SECURITY: verificar que o documento pertence ao agente desta conversa
    // (evita IDOR — LLM pode ser manipulado a emitir IDs de docs de outros tenants)
    const doc = await prisma.agentDoc.findFirst({
      where: { id: docId, agentId: conversation.agentId },
      select: { id: true, name: true, fileUrl: true },
    });
    if (doc) docAttachment = { id: doc.id, name: doc.name, url: doc.fileUrl };
    else if (docId) console.warn(`[Security] SEND_DOC bloqueado: docId=${docId} não pertence ao agente ${conversation.agentId}`);
  }

  // Processa cobrança MB Way se o agente a disparou e o plano permite
  let mbwayCharge: { orderId: string; phone: string; amount: number; description: string; mock: boolean } | null = null;
  if (mbwayMatch && paymentSkillCost !== null) {
    const [, rawPhone, rawAmount, rawDesc] = mbwayMatch;
    const phone = rawPhone.replace(/[^0-9]/g, '');
    const amount = parseFloat(rawAmount.replace(',', '.'));
    const description = rawDesc.trim().slice(0, 255);
    if (phone && !isNaN(amount) && amount > 0) {
      try {
        const result = await createMbwayCharge({
          tenantId,
          agentId: conversation.agentId,
          conversationId: conversation.id,
          buyerPhone: phone,
          amount,
          description,
          notifyPhone: conversation.agent.notifyPhone ?? undefined,
          extraCreditCost: paymentSkillCost, // déduz créditos do plano
        });
        mbwayCharge = { orderId: result.orderId, phone, amount, description, mock: result.mock };
        console.log(`[Payments] Order MB Way criada: ${result.orderId} (mock=${result.mock}, custo=${paymentSkillCost} créditos)`);
      } catch (err) {
        console.error('[Payments] Falha ao criar cobrança MB Way:', err);
      }
    }
  }

  // Persiste a resposta do assistente (cifrada, sem o marcador [SEND_DOC])
  let assistantContent = cleanContent;
  let assistantIV: string | undefined;
  if (dataKey) {
    const enc = encrypt(cleanContent, dataKey);
    assistantContent = enc.ciphertext;
    assistantIV = enc.iv;
  }

  const totalTokens = llmResponse.inputTokens + llmResponse.outputTokens;

  const assistantMsg = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      role: 'assistant',
      content: assistantContent,
      contentIV: assistantIV,
      tokens: totalTokens,
      model: llmResponse.model,
    },
  });

  const sentiment = detectSentiment(content);

  // Atualiza estatísticas + créditos numa só transação lógica.
  // SECURITY: Os créditos já foram pré-reservados (maxReserve) antes do LLM.
  // Agora calculamos o refund: créditos reservados em excesso devem ser devolvidos.
  // O saldo final = (creditsUsed + maxReserve) - (maxReserve - creditsUsed_real)
  //              = creditsUsed + creditsUsed_real  ✓
  const creditRefund = maxReserve - llmResponse.creditsUsed;

  await Promise.all([
    prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        tokensUsed: { increment: totalTokens },
        creditsUsed: { increment: llmResponse.creditsUsed },
        modelUsed: llmResponse.model,
        sentiment,
        ...(handoffSummary ? { handedOffToHuman: true, handoffSummary } : {}),
        ...(reviewReason ? { needsReview: true, reviewReason } : {}),
        ...(ratingRequested ? { awaitingRating: true } : {}),
      } as any,
    }),
    // Devolver créditos reservados em excesso (refund ≥ 0 quase sempre)
    creditRefund > 0
      ? prisma.tenant.update({
          where: { id: tenantId },
          data: { creditsUsed: { decrement: creditRefund } },
        })
      : prisma.tenant.update({
          where: { id: tenantId },
          data: { creditsUsed: { increment: -creditRefund } }, // extra cobrado (raro)
        }),
    prisma.agent.update({
      where: { id: conversation.agentId },
      data: { totalMessages: { increment: 2 } },
    }),
    prisma.creditLog.create({
      data: {
        tenantId,
        amount: -llmResponse.creditsUsed,
        reason: 'chat',
        details: {
          agentId: conversation.agentId,
          model: llmResponse.model,
          inputTokens: llmResponse.inputTokens,
          outputTokens: llmResponse.outputTokens,
          apiCostEur: llmResponse.apiCostEur, // custo real pago ao fornecedor
        },
      },
    }),
  ]);

  return {
    id: assistantMsg.id,
    role: 'assistant',
    content: cleanContent,
    tokens: totalTokens,
    creditsUsed: llmResponse.creditsUsed,
    sentiment,
    timestamp: assistantMsg.timestamp,
    docAttachment,
    mbwayCharge,
    handoff: handoffSummary ? { triggered: true as const, summary: handoffSummary } : null,
    ratingRequested,
  };
}

/**
 * Marca a conversa como resolvida, incrementa o contador de conversas do
 * agente e recalcula a taxa de resolução real: percentagem de conversas
 * fechadas que NÃO precisaram de handoff para um humano (substitui o antigo
 * `averageResolution`, que nunca era calculado). Partilhado pelo fecho manual
 * (botão no dashboard) e pelo fecho automático após a avaliação pós-atendimento.
 */
async function finalizeConversationClosure(tenantId: string, agentId: string, conversationId: string) {
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { resolved: true, closedAt: new Date() },
  });

  await prisma.agent.update({
    where: { id: agentId },
    data: { totalConversations: { increment: 1 } },
  });

  try {
    const [totalClosed, resolvedWithoutHandoff] = await Promise.all([
      prisma.conversation.count({ where: { agentId, resolved: true } }),
      prisma.conversation.count({ where: { agentId, resolved: true, handedOffToHuman: false } }),
    ]);
    if (totalClosed > 0) {
      await prisma.agent.update({
        where: { id: agentId },
        data: { averageResolution: resolvedWithoutHandoff / totalClosed },
      });
    }
  } catch (e) {
    console.error('[Resolution] Falha ao recalcular averageResolution:', e);
  }

  writeAuditLog(tenantId, 'conversation_closed', 'conversation', conversationId);
}

const COPILOT_MODEL = 'claude-haiku-4-5-20251001';
const COPILOT_MAX_CREDITS_ESTIMATE = 6;

/**
 * Copiloto de IA para o atendente humano que recebe um handoff: gera um resumo
 * curto + 2-3 respostas sugeridas com base no histórico recente da conversa.
 * Pode ser chamado a qualquer momento (não só logo após o handoff), para o
 * humano pedir sugestões atualizadas enquanto continua a conversa.
 */
export async function getHandoffCopilot(tenantId: string, conversationId: string) {
  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, tenantId },
    include: {
      agent: { select: { systemPrompt: true, name: true } },
      messages: { orderBy: { timestamp: 'desc' }, take: 12 },
    },
  });
  if (!conversation) throw new NotFoundError('Conversation not found');

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { encryptionKey: true, creditsTotal: true, creditsUsed: true },
  });
  if (!tenant) throw new NotFoundError('Tenant not found');

  const available = tenant.creditsTotal - tenant.creditsUsed;
  if (available < COPILOT_MAX_CREDITS_ESTIMATE) {
    throw new PaymentRequiredError('Créditos insuficientes para gerar sugestões de resposta.');
  }

  const dataKey = unwrapDataKey(tenant.encryptionKey);
  const history = conversation.messages
    .slice()
    .reverse()
    .map((m) => `${m.role === 'user' ? 'Cliente' : 'Agente'}: ${decryptContent(m.content, m.contentIV, dataKey)}`)
    .join('\n');

  const prompt = 'És um copiloto de apoio a um atendente humano que recebeu (ou pode vir a receber) uma conversa transferida'
    + ' por um agente de IA. Lê o histórico e devolve APENAS JSON válido, exatamente neste formato:\n'
    + '{"summary": "resumo em 1-2 frases do que se passou e o que falta resolver", "suggestedReplies": ["resposta sugerida 1", "resposta sugerida 2", "resposta sugerida 3"]}\n'
    + 'As respostas sugeridas devem estar na mesma língua da conversa, ser curtas (1-3 frases) e prontas a enviar tal como estão.';

  let result;
  try {
    result = await callLLM(
      COPILOT_MODEL,
      prompt,
      [{ role: 'user', content: `Contexto do agente (system prompt):\n${conversation.agent.systemPrompt.slice(0, 500)}\n\nHistórico da conversa (mais antiga primeiro):\n${history}` }],
      600,
      0.5,
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    throw new UpstreamError(`LLM error: ${msg}`);
  }

  await prisma.tenant.update({ where: { id: tenantId }, data: { creditsUsed: { increment: result.creditsUsed } } });
  await prisma.creditLog.create({ data: { tenantId, amount: -result.creditsUsed, reason: 'handoff_copilot' } });

  try {
    const jsonMatch = result.content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in response');
    const parsed = JSON.parse(jsonMatch[0]);
    const suggestedReplies = Array.isArray(parsed.suggestedReplies)
      ? parsed.suggestedReplies.slice(0, 3).map((s: unknown) => String(s))
      : [];
    return {
      summary: String(parsed.summary ?? (conversation as any).handoffSummary ?? ''),
      suggestedReplies,
      creditsUsed: result.creditsUsed,
    };
  } catch {
    throw new UpstreamError('Falha ao gerar sugestões. Tenta novamente.');
  }
}

export async function closeConversation(tenantId: string, conversationId: string) {
  const existing = await prisma.conversation.findFirst({
    where: { id: conversationId, tenantId },
  });
  if (!existing) {
    throw new NotFoundError('Conversation not found');
  }

  await finalizeConversationClosure(tenantId, existing.agentId, conversationId);

  return prisma.conversation.findUnique({ where: { id: conversationId } });
}

export async function returnToAgent(tenantId: string, conversationId: string) {
  const existing = await prisma.conversation.findFirst({
    where: { id: conversationId, tenantId },
  });
  if (!existing) {
    throw new NotFoundError('Conversation not found');
  }

  const conversation = await prisma.conversation.update({
    where: { id: conversationId },
    data: { handedOffToHuman: false },
  });

  writeAuditLog(tenantId, 'conversation_returned_to_agent', 'conversation', conversationId);
  return conversation;
}
