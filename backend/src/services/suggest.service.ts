import { callLLM } from '../lib/llm.js';
import { PaymentRequiredError, UpstreamError } from '../lib/errors.js';
import prisma from '../lib/prisma.js';

// Modelo fixo para sugest\u00f5es — mais capaz para gerar prompts profissionais
const SUGGEST_MODEL = 'claude-sonnet-4-5-20250929';

// Custo m\u00e1ximo estimado por chamada de suggest (usado na reserva de cr\u00e9ditos)
// 2000 chars descri\u00e7\u00e3o + 1500 tokens resposta ≈ 3500 tokens × 3 (sonnet) ≈ 11 cr\u00e9ditos de reserva
const SUGGEST_MAX_CREDITS_ESTIMATE = 15;

const SUGGESTION_PROMPT = `You are an expert AI assistant builder. Based on the business description provided, generate a professional AI agent configuration in JSON format.

Return ONLY valid JSON with these exact fields:
{
  "name": "short agent name (max 40 chars)",
  "description": "one-line description (max 120 chars)",
  "systemPrompt": "detailed system prompt (300-600 words) that defines the agent personality, knowledge, tone, goals, and how it handles edge cases",
  "suggestedModel": "claude-haiku-4-5-20251001",
  "temperature": 0.7
}

Rules:
- The system prompt must be in the same language as the business description
- Make the system prompt specific, professional and actionable
- suggestedModel: use "claude-haiku-4-5-20251001" for simple support, "claude-sonnet-4-5-20250929" for complex/sales
- Include how the agent should handle: greetings, unknown questions, escalation to human
- Do NOT include placeholder text like [Company Name] — infer from the description`;

const ADAPT_TEMPLATE_PROMPT = `You are an expert AI assistant builder. A base template system prompt has been provided for a specific industry sector. Your job is to ADAPT this template to the specific business described by the user.

Return ONLY valid JSON with these exact fields:
{
  "name": "short agent name (max 40 chars)",
  "description": "one-line description (max 120 chars)",
  "systemPrompt": "the adapted system prompt (300-600 words)",
  "suggestedModel": "claude-haiku-4-5-20251001",
  "temperature": 0.7
}

Rules:
- Keep the structure and best practices from the template
- Replace ALL placeholder variables like {nome_negocio}, {horarios}, {telefone}, etc. with the real information inferred from the business description
- Adjust the tone and responsibilities to match the specific business
- The system prompt must be in the same language as the business description
- suggestedModel: use "claude-haiku-4-5-20251001" for simple support, "claude-sonnet-4-5-20250929" for complex/sales
- Do NOT leave any unfilled placeholders — if information is missing, use a sensible default or omit that line`;

export async function suggestAgent(tenantId: string, businessDescription: string, language: string, templateSystemPrompt?: string) {
  // SECURITY: Verificar e reservar cr\u00e9ditos antes de chamar o LLM.
  // Sem este check, qualquer tenant pode chamar claude-sonnet infinitamente
  // (dentro do suggestLimiter) sem gastar cr\u00e9ditos — o operador paga a fatura.
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { creditsTotal: true, creditsUsed: true },
  });
  if (!tenant) throw new PaymentRequiredError('Tenant not found');

  const available = tenant.creditsTotal - tenant.creditsUsed;
  if (available < SUGGEST_MAX_CREDITS_ESTIMATE) {
    throw new PaymentRequiredError('Cr\u00e9ditos insuficientes para gerar sugest\u00e3o. Compra mais cr\u00e9ditos ou faz upgrade do plano.');
  }

  const activeSystemPrompt = templateSystemPrompt
    ? ADAPT_TEMPLATE_PROMPT + `\n\nBASE TEMPLATE TO ADAPT:\n${templateSystemPrompt}`
    : SUGGESTION_PROMPT;

  const userMessage = templateSystemPrompt
    ? `Business description (language: ${language}):\n\n${businessDescription}\n\nAdapt the template above for this specific business. Generate the JSON now.`
    : `Business description (language: ${language}):\n\n${businessDescription}\n\nGenerate the agent configuration JSON now.`;

  let result;
  try {
    result = await callLLM(
      SUGGEST_MODEL,
      activeSystemPrompt,
      [{ role: 'user', content: userMessage }],
      1500,
      0.7,
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    throw new UpstreamError(`LLM error: ${msg}`);
  }

  // Debitar cr\u00e9ditos reais ap\u00f3s a chamada (custo real, n\u00e3o estimado)
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { creditsUsed: { increment: result.creditsUsed } },
  });
  await prisma.creditLog.create({
    data: { tenantId, amount: -result.creditsUsed, reason: 'suggest' },
  });

  try {
    const jsonMatch = result.content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in response');
    const suggestion = JSON.parse(jsonMatch[0]);

    if (!suggestion.name || !suggestion.systemPrompt) {
      throw new Error('Missing required fields in suggestion');
    }

    return {
      name: String(suggestion.name).slice(0, 40),
      description: String(suggestion.description ?? '').slice(0, 120),
      systemPrompt: String(suggestion.systemPrompt),
      suggestedModel: String(suggestion.suggestedModel ?? 'claude-haiku-4-5-20251001'),
      temperature: Number(suggestion.temperature ?? 0.7),
      creditsUsed: result.creditsUsed,
    };
  } catch {
    throw new UpstreamError('Failed to parse AI suggestion. Please try again.');
  }
}
