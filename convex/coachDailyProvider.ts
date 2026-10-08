import type { DailyOutput } from './coachDailyPolicy';
import type { DailyOutputV2 } from './coachDailyPolicyV2';
import type { DailyOutputV3 } from './coachDailyPolicyV3';
import { DAILY_PLAN_PROMPT_VERSION, DAILY_PLAN_SYSTEM_PROMPT } from './coachDailyPrompt';
import { DAILY_PLAN_V2_PROMPT_VERSION, DAILY_PLAN_V2_SYSTEM_PROMPT } from './coachDailyPromptV2';
import {
  DAILY_PLAN_V2_1_PROMPT_VERSION,
  DAILY_PLAN_V2_1_SYSTEM_PROMPT,
  isV2DailyPrompt,
} from './coachDailyPromptV2_1';
import { DAILY_PLAN_V3_PROMPT_VERSION, DAILY_PLAN_V3_SYSTEM_PROMPT } from './coachDailyPromptV3';
import { DAILY_PLAN_COPY_LIMITS } from '../shared/coachPlanCopy';

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
      output: DailyOutput | DailyOutputV2 | DailyOutputV3;
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
  const minimum =
    isV2DailyPrompt(promptVersion) || promptVersion === DAILY_PLAN_V3_PROMPT_VERSION
      ? V2_OUTPUT_TOKENS
      : DEFAULT_OUTPUT_TOKENS;
  const requestedTokens = Number(
    isV2DailyPrompt(promptVersion) || promptVersion === DAILY_PLAN_V3_PROMPT_VERSION
      ? process.env.COACH_V2_MAX_OUTPUT_TOKENS
      : process.env.COACH_V1_MAX_OUTPUT_TOKENS
  );
  const requestedTimeout = Number(
    isV2DailyPrompt(promptVersion) || promptVersion === DAILY_PLAN_V3_PROMPT_VERSION
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
        : isV2DailyPrompt(promptVersion) || promptVersion === DAILY_PLAN_V3_PROMPT_VERSION
          ? 30000
          : 20000,
  };
}

function parse(
  value: unknown,
  promptVersion: string
): {
  output: DailyOutput | DailyOutputV2 | DailyOutputV3;
  inputTokens?: number;
  outputTokens?: number;
} | null {
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
  if (promptVersion === DAILY_PLAN_V3_PROMPT_VERSION) {
    if (!validV3Shape(data)) return null;
    const usage = body.usage as Record<string, unknown> | undefined;
    const count = (v: unknown) =>
      typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : undefined;
    return {
      output: data as unknown as DailyOutputV3,
      inputTokens: count(usage?.input_tokens),
      outputTokens: count(usage?.output_tokens),
    };
  }
  const v2 = isV2DailyPrompt(promptVersion) || promptVersion === DAILY_PLAN_V3_PROMPT_VERSION;
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
    output: Object.fromEntries(keys.map((key) => [key, data[key]])) as
      | DailyOutput
      | DailyOutputV2
      | DailyOutputV3,
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
  const v2 = isV2DailyPrompt(promptVersion) || promptVersion === DAILY_PLAN_V3_PROMPT_VERSION;
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
    previousCandidate?: DailyOutput | DailyOutputV2 | DailyOutputV3;
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
        temperature:
          args.promptVersion === DAILY_PLAN_V3_PROMPT_VERSION ? 0.7 : args.retryGuidance ? 0.2 : 0,
        system:
          args.promptVersion === DAILY_PLAN_V3_PROMPT_VERSION
            ? DAILY_PLAN_V3_SYSTEM_PROMPT
            : args.promptVersion === DAILY_PLAN_V2_1_PROMPT_VERSION
              ? DAILY_PLAN_V2_1_SYSTEM_PROMPT
              : args.promptVersion === DAILY_PLAN_V2_PROMPT_VERSION
                ? DAILY_PLAN_V2_SYSTEM_PROMPT
                : DAILY_PLAN_SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: JSON.stringify({
              input: args.input,
              character_limits:
                args.promptVersion === DAILY_PLAN_V3_PROMPT_VERSION
                  ? DAILY_PLAN_COPY_LIMITS
                  : isV2DailyPrompt(args.promptVersion ?? '')
                    ? V2_LIMITS
                    : OUTPUT_LIMITS,
              length_instruction:
                'Never exceed any field character limit. Keep the individual sections concise. Keep why personalized and explanatory within its separate allowance.',
              style: args.style,
              ...(args.retryGuidance
                ? {
                    revision_instruction:
                      args.promptVersion === DAILY_PLAN_V3_PROMPT_VERSION
                        ? "Revise the previous candidate to correct validation_failure. Return the complete nested submit_daily_plan structure required by the client prompt. Keep the recommendation personalized to the goal and readiness; never copy historical fixed mappings. Respect ALL numeric bounds in input.output_constraints. Keep headline at 3 to 6 words. Make Why five sentences, 105 to 115 words, naming her goal early and including protein, carbs, vegetables, water and sleep even on rest days. Keep Meals exact. Sleep.text must be Aim for N hours tonight. with N equal to sleep.hours. The failure why_length means the previous Why had the wrong number of sentences or words; expand or combine sentences to fix BOTH, without omitting nutrient groups or water. The failure goal_explanation means the opening did not name the goal or the explanation omitted one of protein, carbs, vegetables, water or sleep; include every one. The failure new_member_load or recent_training_load means minutes exceeded workout_max_minutes or intensity exceeded workout_allowed_intensity; reduce the plan to these bounds. The failure unsafe_language means remove calories, calorie burn, grams, food judgement, guilt words or numeric weight/body discussion; naming her weight loss goal is allowed. The failure invented_missing_history means do not say she has not trained this week when there are no logs; describe only today's answers. The failure internal_copy means remove tracking/data/algorithm terminology. Missing water in Why must be fixed explicitly even when water is already in Meals. A validation_failure beginning why_missing_ names the exact missing topic: include that topic in Why itself, not just in Meals or Sleep. Follow input.output_constraints.why_outline so no topic is forgotten. Carbs must be included explicitly as a fist-sized portion even on rest days. unsupported_strength_gap means the recent strength count does not support claiming a gap; explain recovery instead. Do not repeat the invalid candidate unchanged."
                        : "The previous candidate failed validation or did not have a complete tool input. Call submit_daily_plan exactly once with every required field and the required types. Produce a materially corrected candidate, not a near-copy. Never use an em dash in any field. Keep headline and sleep exactly as output_constraints require. Copy output_constraints.workout and output_constraints.steps only when they are non-null; otherwise follow the workout type, duration and step cap. Meals must use the exact fixed meal guidance required by the system prompt, within 140 characters. Never name specific foods or dishes. Why must include the same numeric Steps target returned in steps and explain the balanced nutrient guidance; connect both to today's saved answers and rest or workout choice. Keep exercise examples matched to the workout type and never invent history. Return all required tool fields.",
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
            description:
              args.promptVersion === DAILY_PLAN_V3_PROMPT_VERSION
                ? 'Return the six nested client Daily Plan fields with matching numeric targets.'
                : isV2DailyPrompt(args.promptVersion ?? '')
                  ? 'Return the nine daily-plan v2 fields.'
                  : 'Return the six daily-plan v1 fields.',
            input_schema:
              args.promptVersion === DAILY_PLAN_V3_PROMPT_VERSION
                ? V3_TOOL_SCHEMA
                : {
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

const V3_TOOL_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    headline: { type: 'string', maxLength: 80 },
    workout: {
      type: 'object',
      additionalProperties: false,
      properties: {
        text: { type: 'string', maxLength: 180 },
        type: {
          type: 'string',
          enum: [
            'full_body_strength',
            'upper_body_strength',
            'lower_body_strength',
            'core',
            'cardio',
            'walking',
            'mobility',
            'stretching',
            'rest',
          ],
        },
        minutes: { type: 'integer', minimum: 0, maximum: 90 },
        intensity: { type: 'string', enum: ['low', 'moderate', 'high'] },
      },
      required: ['text', 'type', 'minutes', 'intensity'],
    },
    steps: {
      type: 'object',
      additionalProperties: false,
      properties: { target: { type: 'integer', minimum: 0, maximum: 12000 } },
      required: ['target'],
    },
    meals: {
      type: 'object',
      additionalProperties: false,
      properties: {
        text: { type: 'string', maxLength: 140 },
        water_litres: { type: 'number', minimum: 1.5, maximum: 3 },
      },
      required: ['text', 'water_litres'],
    },
    sleep: {
      type: 'object',
      additionalProperties: false,
      properties: {
        text: { type: 'string', maxLength: 180 },
        hours: { type: 'number', minimum: 7, maximum: 9 },
      },
      required: ['text', 'hours'],
    },
    why: { type: 'string', maxLength: 1200 },
  },
  required: ['headline', 'workout', 'steps', 'meals', 'sleep', 'why'],
};
function validV3Shape(data: Record<string, unknown>) {
  if (
    Object.keys(data).sort().join('|') !==
      ['headline', 'workout', 'steps', 'meals', 'sleep', 'why'].sort().join('|') ||
    typeof data.headline !== 'string' ||
    typeof data.why !== 'string'
  )
    return false;
  for (const [key, fields] of Object.entries({
    workout: { text: 'string', type: 'string', minutes: 'number', intensity: 'string' },
    steps: { target: 'number' },
    meals: { text: 'string', water_litres: 'number' },
    sleep: { text: 'string', hours: 'number' },
  })) {
    const value = data[key];
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    if (Object.keys(value).sort().join('|') !== Object.keys(fields).sort().join('|')) return false;
    for (const [field, type] of Object.entries(fields))
      if (typeof (value as Record<string, unknown>)[field] !== type) return false;
  }
  return true;
}
