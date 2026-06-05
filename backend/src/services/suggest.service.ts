import { callLLM } from '../lib/llm.js';
import { UpstreamError } from '../lib/errors.js';

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

export async function suggestAgent(businessDescription: string, language: string) {
  const userMessage = `Business description (language: ${language}):\n\n${businessDescription}\n\nGenerate the agent configuration JSON now.`;

  let result;
  try {
    result = await callLLM(
      'claude-sonnet-4-5-20250929',
      SUGGESTION_PROMPT,
      [{ role: 'user', content: userMessage }],
      1500,
      0.7,
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    throw new UpstreamError(`LLM error: ${msg}`);
  }

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
