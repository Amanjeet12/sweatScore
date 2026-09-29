import { MEAL_SYSTEM_PROMPT } from './coachMealPrompt';
import { MealResult, validateMealResult } from './coachMealPolicy';
import { providerConfig, ProviderConfig } from './coachDailyProvider';

export type MealProviderOutcome =
  | { ok: true; result: MealResult; inputTokens?: number; outputTokens?: number; latencyMs: number }
  | {
      ok: false;
      code:
        | 'provider_unavailable'
        | 'provider_timeout'
        | 'provider_rate_limited'
        | 'invalid_output';
      latencyMs: number;
    };

export async function analyzeMealPhoto(args: {
  imageBase64: string;
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';
  goal: 'lose' | 'recomp' | 'fitness' | 'unavailable';
  workoutLoggedToday: boolean;
  style: { tone: string; detail: string };
  fetchImpl?: typeof fetch;
  config?: ProviderConfig;
}): Promise<MealProviderOutcome> {
  const config = args.config ?? providerConfig();
  const started = Date.now();
  if (!config) return { ok: false, code: 'provider_unavailable', latencyMs: 0 };
  const controller = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, config.timeoutMs);
  try {
    let inputTokens = 0;
    let outputTokens = 0;
    let hasInputTokens = true;
    let hasOutputTokens = true;
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await (args.fetchImpl ?? fetch)('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'anthropic-version': '2023-06-01',
          'x-api-key': config.apiKey,
        },
        body: JSON.stringify({
          model: config.model,
          max_tokens: Math.max(config.maxOutputTokens, 768),
          temperature: 0,
          system: [
            { type: 'text', text: MEAL_SYSTEM_PROMPT },
            {
              type: 'text',
              text: 'Only describe food visible in the actual photo. Nigerian and West African meals are normal primary use cases. Do not invent ingredients or assert what is hidden beneath a layer. Distinguish large creamy avocado pieces from small whole or ring-shaped olives. If a food identity is uncertain, discuss visible plate groups without naming it. If visibility is insufficient, use the unclear-image rule. Style changes flexible wording only.',
            },
          ],
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image',
                  source: { type: 'base64', media_type: args.mediaType, data: args.imageBase64 },
                },
                {
                  type: 'text',
                  text: JSON.stringify({
                    goal: args.goal,
                    workout_logged_today: args.workoutLoggedToday,
                    style: args.style,
                    note:
                      attempt === 0
                        ? 'Style affects flexible wording only. Follow all system rules and verdict meanings.'
                        : 'The previous structured response failed validation. Return exactly one submit_meal_check tool call with only verdict and feedback. Feedback must be three sentences or fewer and must avoid prohibited wording.',
                  }),
                },
              ],
            },
          ],
          tools: [
            {
              name: 'submit_meal_check',
              description: 'Return the meal verdict and private feedback.',
              input_schema: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  verdict: {
                    type: ['string', 'null'],
                    enum: ['On point', 'Nearly there', 'Room to improve', null],
                  },
                  feedback: { type: 'string', maxLength: 600 },
                },
                required: ['verdict', 'feedback'],
              },
            },
          ],
          tool_choice: { type: 'tool', name: 'submit_meal_check' },
        }),
        signal: controller.signal,
      });
      if (response.status === 429)
        return { ok: false, code: 'provider_rate_limited', latencyMs: Date.now() - started };
      if (!response.ok)
        return { ok: false, code: 'provider_unavailable', latencyMs: Date.now() - started };
      const body = (await response.json()) as Record<string, any>;
      if (Number.isInteger(body.usage?.input_tokens) && body.usage.input_tokens >= 0)
        inputTokens += body.usage.input_tokens;
      else hasInputTokens = false;
      if (Number.isInteger(body.usage?.output_tokens) && body.usage.output_tokens >= 0)
        outputTokens += body.usage.output_tokens;
      else hasOutputTokens = false;
      const calls = Array.isArray(body.content)
        ? body.content.filter(
            (item: any) => item.type === 'tool_use' && item.name === 'submit_meal_check'
          )
        : [];
      const result = calls.length === 1 ? validateMealResult(calls[0].input) : null;
      if (result)
        return {
          ok: true,
          result,
          inputTokens: hasInputTokens ? inputTokens : undefined,
          outputTokens: hasOutputTokens ? outputTokens : undefined,
          latencyMs: Date.now() - started,
        };
    }
    return { ok: false, code: 'invalid_output', latencyMs: Date.now() - started };
  } catch {
    return {
      ok: false,
      code: timedOut ? 'provider_timeout' : 'provider_unavailable',
      latencyMs: Date.now() - started,
    };
  } finally {
    clearTimeout(timeout);
  }
}
