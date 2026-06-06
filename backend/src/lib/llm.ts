import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { TOKEN_COSTS } from '../types/index.js';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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
  const response = await anthropic.messages.create({
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

  return { content, inputTokens, outputTokens, model, creditsUsed };
}

async function callOpenAI(
  model: string,
  systemPrompt: string,
  messages: LLMMessage[],
  maxTokens: number,
  temperature: number,
): Promise<LLMResponse> {
  const response = await openai.chat.completions.create({
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

  return { content, inputTokens, outputTokens, model, creditsUsed };
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
