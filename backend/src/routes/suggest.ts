import { Router, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimit.js';
import { callLLM } from '../lib/llm.js';
import { AuthenticatedRequest } from '../types/index.js';

const router = Router();
router.use(authenticate);

const suggestSchema = z.object({
  businessDescription: z.string().min(20).max(2000),
  language: z.string().max(10).optional().default('pt'),
});

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

// POST /api/agents/suggest
router.post('/suggest', authLimiter, async (req: AuthenticatedRequest, res: Response) => {
  const parsed = suggestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'businessDescription must be between 20 and 2000 characters' });
  }

  const { businessDescription, language } = parsed.data;

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
    return res.status(502).json({ error: `LLM error: ${msg}` });
  }

  // Parse JSON from response
  try {
    const jsonMatch = result.content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in response');
    const suggestion = JSON.parse(jsonMatch[0]);

    // Validate required fields
    if (!suggestion.name || !suggestion.systemPrompt) {
      throw new Error('Missing required fields in suggestion');
    }

    return res.json({
      name: String(suggestion.name).slice(0, 40),
      description: String(suggestion.description ?? '').slice(0, 120),
      systemPrompt: String(suggestion.systemPrompt),
      suggestedModel: String(suggestion.suggestedModel ?? 'claude-haiku-4-5-20251001'),
      temperature: Number(suggestion.temperature ?? 0.7),
      creditsUsed: result.creditsUsed,
    });
  } catch {
    return res.status(502).json({ error: 'Failed to parse AI suggestion. Please try again.' });
  }
});

export default router;
