import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { TOKEN_COSTS, API_EUR_COST } from '../types/index.js';

// Lazy initialization — env vars may not be populated at module load time in ESM
let _anthropic: Anthropic | null = null;
let _openai: OpenAI | null = null;

function getAnthropic(): Anthropic {
  if (!_anthropic) {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY não configurado');
    _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _anthropic;
}

function getOpenAI(): OpenAI {
  if (!_openai) {
    if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY não configurado');
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}

export interface LLMMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface LLMResponse {
  content: string;
  inputTokens: number;
  outputTokens: number;
  model: string;
  creditsUsed: number;
  apiCostEur: number; // custo real pago ao fornecedor LLM (EUR)
}

/**
 * Selecciona o modelo para modo automático.
 * - Historial curto (< 2000 chars totais) → modelo rápido/barato
 * - Historial longo ou sistema prompt complexo → modelo mais capaz
 */
function autoSelectModel(systemPrompt: string, messages: LLMMessage[]): string {
  const totalChars = systemPrompt.length + messages.reduce((s, m) => s + m.content.length, 0);
  if (totalChars > 4000) return 'claude-sonnet-4-5-20250929';
  return 'claude-haiku-4-5-20251001';
}

export async function callLLM(
  model: string,
  systemPrompt: string,
  messages: LLMMessage[],
  maxTokens = 2000,
  temperature = 0.7,
): Promise<LLMResponse> {
  const resolvedModel = model === 'auto' ? autoSelectModel(systemPrompt, messages) : model;

  if (resolvedModel.startsWith('claude')) {
    return callAnthropic(resolvedModel, systemPrompt, messages, maxTokens, temperature);
  }
  if (resolvedModel.startsWith('gpt')) {
    return callOpenAI(resolvedModel, systemPrompt, messages, maxTokens, temperature);
  }

  throw new Error(`Model "${resolvedModel}" não suportado`);
}

async function callAnthropic(
  model: string,
  systemPrompt: string,
  messages: LLMMessage[],
  maxTokens: number,
  temperature: number,
): Promise<LLMResponse> {
  const response = await getAnthropic().messages.create({
    model,
    max_tokens: maxTokens,
    temperature,
    system: systemPrompt,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  });

  const content = response.content[0].type === 'text' ? response.content[0].text : '';
  const inputTokens = response.usage.input_tokens;
  const outputTokens = response.usage.output_tokens;
  const costMultiplier = TOKEN_COSTS[model] ?? 3;
  const creditsUsed = Math.ceil(((inputTokens + outputTokens) / 1000) * costMultiplier);
  const price = API_EUR_COST[model];
  const apiCostEur = price
    ? (inputTokens / 1000) * price.inputPer1K + (outputTokens / 1000) * price.outputPer1K
    : 0;

  return { content, inputTokens, outputTokens, model, creditsUsed, apiCostEur };
}

async function callOpenAI(
  model: string,
  systemPrompt: string,
  messages: LLMMessage[],
  maxTokens: number,
  temperature: number,
): Promise<LLMResponse> {
  const response = await getOpenAI().chat.completions.create({
    model,
    max_tokens: maxTokens,
    temperature,
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages.map((m) => ({ role: m.role, content: m.content })),
    ],
  });

  const content = response.choices[0]?.message?.content ?? '';
  const inputTokens = response.usage?.prompt_tokens ?? 0;
  const outputTokens = response.usage?.completion_tokens ?? 0;
  const costMultiplier = TOKEN_COSTS[model] ?? 2;
  const creditsUsed = Math.ceil(((inputTokens + outputTokens) / 1000) * costMultiplier);
  const price = API_EUR_COST[model];
  const apiCostEur = price
    ? (inputTokens / 1000) * price.inputPer1K + (outputTokens / 1000) * price.outputPer1K
    : 0;

  return { content, inputTokens, outputTokens, model, creditsUsed, apiCostEur };
}


export function detectSentiment(text: string): number {
  // Simple heuristic — will be replaced by LLM-based analysis
  const positiveWords = ['obrigado', 'ótimo', 'excelente', 'perfeito', 'thanks', 'great', 'perfect', 'good'];
  const negativeWords = ['problema', 'erro', 'péssimo', 'horrível', 'ruim', 'bad', 'terrible', 'wrong', 'broken'];
  const lower = text.toLowerCase();
  let score = 0;
  positiveWords.forEach((w) => { if (lower.includes(w)) score += 0.2; });
  negativeWords.forEach((w) => { if (lower.includes(w)) score -= 0.2; });
  return Math.max(-1, Math.min(1, score));
}
