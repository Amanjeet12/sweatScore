import { DAILY_PLAN_COPY_LIMITS } from '../shared/coachPlanCopy';
import { DAILY_PLAN_PROMPT_VERSION, DAILY_PLAN_SYSTEM_PROMPT } from './coachDailyPrompt';
import { DAILY_PLAN_V2_PROMPT_VERSION, DAILY_PLAN_V2_SYSTEM_PROMPT } from './coachDailyPromptV2';
import {
  DAILY_PLAN_V2_1_PROMPT_VERSION,
  DAILY_PLAN_V2_1_SYSTEM_PROMPT,
  isV2DailyPrompt,
} from './coachDailyPromptV2_1';
import type { DailyOutput } from './coachDailyPolicy';
import type { DailyOutputV2 } from './coachDailyPolicyV2';

const API_URL = 'https://api.anthropic.com/v1/messages';
const TOOL_NAME = 'submit_daily_plan';
export const DEFAULT_OUTPUT_TOKENS = 1600; // Six fields and the longest client example fit comfortably.
export const V2_OUTPUT_TOKENS = 2400;
const OUTPUT_LIMITS = {
  headline: 80,
  workout: 180,
  steps: 30,
  sleep: 180,
  meals: 500,
  why: 1200,
} as const;
const V2_LIMITS = DAILY_PLAN_COPY_LIMITS;
export type ProviderCode =
  | 'provider_timeout'
  | 'provider_rate_limited'
  | 'provider_unavailable'
  | 'invalid_output';
export type ProviderResult =
  | {
      ok: true;
      output: DailyOutput | DailyOutputV2;
      inputTokens?: number;
      outputTokens?: number;
      latencyMs: number;
    }
  | { ok: false; code: ProviderCode; latencyMs: number; formatCode?: string };
export type ProviderConfig = {
  apiKey: string;
  model: string;
  maxOutputTokens: number;
  timeoutMs: number;
};

export function providerConfig(promptVersion = DAILY_PLAN_PROMPT_VERSION): ProviderConfig | null {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  const model = process.env.PROGRESS_COACH_MODEL?.trim();
  if (!apiKey || !model) return null;
  const minimum = isV2DailyPrompt(promptVersion) ? V2_OUTPUT_TOKENS : DEFAULT_OUTPUT_TOKENS;
  const requestedTokens = Number(
    isV2DailyPrompt(promptVersion)
      ? process.env.COACH_V2_MAX_OUTPUT_TOKENS
      : process.env.COACH_V1_MAX_OUTPUT_TOKENS
  );
  const requestedTimeout = Number(
    isV2DailyPrompt(promptVersion)
      ? (process.env.COACH_V2_TIMEOUT_MS ?? process.env.COACH_V1_TIMEOUT_MS)
      : process.env.COACH_V1_TIMEOUT_MS
  );
  return {
    apiKey,
    model,
    maxOutputTokens:
      Number.isInteger(requestedTokens) && requestedTokens >= minimum
        ? Math.min(requestedTokens, 4096)
        : minimum,
    timeoutMs:
      Number.isInteger(requestedTimeout) && requestedTimeout >= 1000
        ? Math.min(requestedTimeout, 30000)
        : isV2DailyPrompt(promptVersion)
          ? 30000
          : 20000,
  };
}

function parse(
  value: unknown,
  promptVersion: string
): { output: DailyOutput | DailyOutputV2; inputTokens?: number; outputTokens?: number } | null {
  if (!value || typeof value !== 'object') return null;
  const body = value as Record<string, unknown>;
  if (!Array.isArray(body.content)) return null;
  const calls = body.content.filter(
    (block) =>
      block && typeof block === 'object' && (block as Record<string, unknown>).type === 'tool_use'
  );
  // A text block may accompany the one forced tool call. Ignore that text;
  // accept only one named structured result and validate its six fields.
  if (calls.length !== 1 || (calls[0] as Record<string, unknown>).name !== TOOL_NAME) return null;
  const input = (calls[0] as Record<string, unknown>).input;
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const data = input as Record<string, unknown>;
  const v2 = isV2DailyPrompt(promptVersion);
  const limits = v2 ? V2_LIMITS : OUTPUT_LIMITS;
  const keys = [...Object.keys(limits), ...(v2 ? ['workoutExamples'] : [])];
  // The validated contract is the required field projection. Harmless extra
  // tool-input keys must not discard an otherwise valid plan.
  if (keys.some((key) => !(key in data))) return null;
  if (
    v2 &&
    (!Array.isArray(data.workoutExamples) ||
      data.workoutExamples.length > 3 ||
      data.workoutExamples.some((item: unknown) => typeof item !== 'string' || item.length > 40))
  )
    return null;
  for (const key of Object.keys(limits))
    if (
      typeof data[key] !== 'string' ||
      !(data[key] as string).trim() ||
      (data[key] as string).length > limits[key as keyof typeof limits]
    )
      return null;
  const usage =
    body.usage && typeof body.usage === 'object' ? (body.usage as Record<string, unknown>) : {};
  const integer = (x: unknown) =>
    typeof x === 'number' && Number.isInteger(x) && x >= 0 ? x : undefined;
  return {
    output: Object.fromEntries(keys.map((key) => [key, data[key]])) as DailyOutput | DailyOutputV2,
    inputTokens: integer(usage.input_tokens),
    outputTokens: integer(usage.output_tokens),
  };
}

function formatFailure(value: unknown, promptVersion: string): string {
  if (!value || typeof value !== 'object') return 'invalid_response';
  const body = value as Record<string, unknown>;
  if (body.stop_reason === 'max_tokens') return 'truncated';
  if (!Array.isArray(body.content)) return 'missing_content';
  const calls = body.content.filter(
    (block) =>
      block && typeof block === 'object' && (block as Record<string, unknown>).type === 'tool_use'
  );
  if (calls.length !== 1) return 'tool_count';
  const call = calls[0] as Record<string, unknown>;
  if (call.name !== TOOL_NAME) return 'wrong_tool';
  if (!call.input || typeof call.input !== 'object' || Array.isArray(call.input))
    return 'invalid_tool_input';
  const input = call.input as Record<string, unknown>;
  const v2 = isV2DailyPrompt(promptVersion);
  const keys = [...Object.keys(v2 ? V2_LIMITS : OUTPUT_LIMITS), ...(v2 ? ['workoutExamples'] : [])];
  if (keys.some((key) => !(key in input))) return 'missing_field';
  if (v2 && !Array.isArray(input.workoutExamples)) return 'invalid_examples';
  return 'invalid_field';
}

export async function generateDailyPlan(args: {
  config: ProviderConfig | null;
  input: unknown;
  style: { tone: string; detail: string };
  fetchImpl?: typeof fetch;
  promptVersion?: string;
  retryGuidance?: {
    previousCandidate?: DailyOutput | DailyOutputV2;
    validationCode?: string;
  };
}): Promise<ProviderResult> {
  const started = Date.now();
  if (!args.config) return { ok: false, code: 'provider_unavailable', latencyMs: 0 };
  const controller = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, args.config.timeoutMs);
  try {
    const response = await (args.fetchImpl ?? fetch)(API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'anthropic-version': '2023-06-01',
        'x-api-key': args.config.apiKey,
      },
      body: JSON.stringify({
        model: args.config.model,
        max_tokens: args.config.maxOutputTokens,
        temperature: args.retryGuidance ? 0.2 : 0,
        system:
          args.promptVersion === DAILY_PLAN_V2_1_PROMPT_VERSION
            ? DAILY_PLAN_V2_1_SYSTEM_PROMPT
            : args.promptVersion === DAILY_PLAN_V2_PROMPT_VERSION
              ? DAILY_PLAN_V2_SYSTEM_PROMPT
              : DAILY_PLAN_SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: JSON.stringify({
              input: args.input,
              character_limits: isV2DailyPrompt(args.promptVersion ?? '')
                ? V2_LIMITS
                : OUTPUT_LIMITS,
              length_instruction:
                'Never exceed any field character limit. Keep the individual sections concise. Keep why personalized and explanatory within its separate allowance.',
              style: args.style,
              ...(args.retryGuidance
                ? {
                    revision_instruction:
                      "The previous candidate failed validation or did not have a complete tool input. Call submit_daily_plan exactly once with every required field and the required types. Produce a materially corrected candidate, not a near-copy. Never use an em dash in any field. Keep headline and sleep exactly as output_constraints require. Copy output_constraints.workout and output_constraints.steps only when they are non-null; otherwise follow the workout type, duration and step cap. Meals must use the exact fixed meal guidance required by the system prompt, within 140 characters. Never name specific foods or dishes. Why must include the same numeric Steps target returned in steps and explain the balanced nutrient guidance; connect both to today's saved answers and rest or workout choice. Keep exercise examples matched to the workout type and never invent history. Return all required tool fields.",
                    previous_candidate: args.retryGuidance.previousCandidate ?? null,
                    validation_failure: args.retryGuidance.validationCode ?? 'invalid_output',
                  }
                : {}),
            }),
          },
        ],
        tools: [
          {
            name: TOOL_NAME,
            description: isV2DailyPrompt(args.promptVersion ?? '')
              ? 'Return the nine daily-plan v2 fields.'
              : 'Return the six daily-plan v1 fields.',
            input_schema: {
              type: 'object',
              additionalProperties: false,
              properties: {
                ...Object.fromEntries(
                  Object.entries(
                    isV2DailyPrompt(args.promptVersion ?? '') ? V2_LIMITS : OUTPUT_LIMITS
                  ).map(([key, maxLength]) => [key, { type: 'string', maxLength }])
                ),
                ...(isV2DailyPrompt(args.promptVersion ?? '')
                  ? {
                      workoutExamples: {
                        type: 'array',
                        items: { type: 'string', maxLength: 40 },
                        maxItems: 3,
                      },
                    }
                  : {}),
              },
              required: isV2DailyPrompt(args.promptVersion ?? '')
                ? [...Object.keys(V2_LIMITS), 'workoutExamples']
                : Object.keys(OUTPUT_LIMITS),
            },
          },
        ],
        tool_choice: { type: 'tool', name: TOOL_NAME },
      }),
      signal: controller.signal,
    });
    if (response.status === 429)
      return { ok: false, code: 'provider_rate_limited', latencyMs: Date.now() - started };
    if (!response.ok)
      return { ok: false, code: 'provider_unavailable', latencyMs: Date.now() - started };
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      return {
        ok: false,
        code: 'invalid_output',
        formatCode: 'invalid_json',
        latencyMs: Date.now() - started,
      };
    }
    const parsed = parse(body, args.promptVersion ?? DAILY_PLAN_PROMPT_VERSION);
    if (!parsed)
      return {
        ok: false,
        code: 'invalid_output',
        formatCode: formatFailure(body, args.promptVersion ?? DAILY_PLAN_PROMPT_VERSION),
        latencyMs: Date.now() - started,
      };
    return { ok: true, ...parsed, latencyMs: Date.now() - started };
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
