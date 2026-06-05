import Anthropic from '@anthropic-ai/sdk';
import { TOKEN_COSTS } from '../types/index.js';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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

export async function callLLM(
  model: string,
  systemPrompt: string,
  messages: LLMMessage[],
  maxTokens = 2000,
  temperature = 0.7,
): Promise<LLMResponse> {
  if (model.startsWith('claude')) {
    return callAnthropic(model, systemPrompt, messages, maxTokens, temperature);
  }

  throw new Error(`Model ${model} not yet supported`);
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
