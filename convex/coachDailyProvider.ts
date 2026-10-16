import type { DailyOutput } from './coachDailyPolicy';
import type { DailyOutputV2 } from './coachDailyPolicyV2';
import { isDailyPlanOutputV3, type DailyOutputV3 } from './coachDailyPolicyV3';
import { DAILY_PLAN_PROMPT_VERSION, DAILY_PLAN_SYSTEM_PROMPT } from './coachDailyPrompt';
import { DAILY_PLAN_V2_PROMPT_VERSION, DAILY_PLAN_V2_SYSTEM_PROMPT } from './coachDailyPromptV2';
import {
  DAILY_PLAN_V2_1_PROMPT_VERSION,
  DAILY_PLAN_V2_1_SYSTEM_PROMPT,
  isV2DailyPrompt,
} from './coachDailyPromptV2_1';
import { DAILY_PLAN_V3_PROMPT_VERSION, DAILY_PLAN_V3_SYSTEM_PROMPT } from './coachDailyPromptV3';
import { DAILY_PLAN_COPY_LIMITS } from '../shared/coachPlanCopy';
import { OTHER_TRAINING_MEANING } from '../shared/coachTrainingYesterday';

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
      model?: string;
      output: DailyOutput | DailyOutputV2 | DailyOutputV3;
      inputTokens?: number;
      outputTokens?: number;
      latencyMs: number;
    }
  | { ok: false; code: ProviderCode; latencyMs: number; formatCode?: string; model?: string };
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
  if (promptVersion === DAILY_PLAN_V3_PROMPT_VERSION) {
    if (['headline', 'workout', 'steps', 'meals', 'sleep', 'why'].some((key) => !(key in input)))
      return 'missing_field';
    return 'invalid_structure';
  }
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
    previousCandidate?: DailyOutput | DailyOutputV2 | DailyOutputV3;
    validationCode?: string;
    validationCodes?: string[];
    validationFeedback?: { prohibited_terms: string[]; food_names: string[] };
  };
}): Promise<ProviderResult> {
  const started = Date.now();
  if (!args.config) return { ok: false, code: 'provider_unavailable', latencyMs: 0 };
  const repairModel = process.env.COACH_V3_REPAIR_MODEL?.trim() || 'claude-sonnet-4-5-20250929';
  const selectedModel =
    args.promptVersion === DAILY_PLAN_V3_PROMPT_VERSION &&
    args.retryGuidance &&
    args.config.model.startsWith('claude-haiku-4-5')
      ? repairModel
      : args.config.model;
  const controller = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, args.config.timeoutMs);
  const trainingInput = args.input as {
    today?: { trainedYesterday?: string[]; trained_yesterday?: string[] };
  } | null;
  const otherTraining = (
    trainingInput?.today?.trainedYesterday ??
    trainingInput?.today?.trained_yesterday ??
    []
  ).includes('other');
  try {
    const response = await (args.fetchImpl ?? fetch)(API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'anthropic-version': '2023-06-01',
        'x-api-key': args.config.apiKey,
      },
      body: JSON.stringify({
        model: selectedModel,
        max_tokens: args.config.maxOutputTokens,
        temperature: args.retryGuidance
          ? 0.2
          : args.promptVersion === DAILY_PLAN_V3_PROMPT_VERSION
            ? 0.7
            : 0,
        system:
          (args.promptVersion === DAILY_PLAN_V3_PROMPT_VERSION
            ? DAILY_PLAN_V3_SYSTEM_PROMPT
            : args.promptVersion === DAILY_PLAN_V2_1_PROMPT_VERSION
              ? DAILY_PLAN_V2_1_SYSTEM_PROMPT
              : args.promptVersion === DAILY_PLAN_V2_PROMPT_VERSION
                ? DAILY_PLAN_V2_SYSTEM_PROMPT
                : DAILY_PLAN_SYSTEM_PROMPT) +
          (otherTraining ? '\n\nTRAINED YESTERDAY ANSWER CONTRACT\n' + OTHER_TRAINING_MEANING : ''),
        messages: [
          {
            role: 'user',
            content: JSON.stringify({
              input: args.input,
              ...(args.promptVersion === DAILY_PLAN_V3_PROMPT_VERSION
                ? {
                    explanation_completion_check:
                      'Before calling the tool, count Why: 4 to 6 complete sentences and about 90 to 130 words (aim 105 to 115). Verify the first two sentences name the goal, and Why explicitly includes protein, carbs, vegetables, water and sleep, even on rest days. Include the carb portion and plate proportions from the client instructions. Match all stated targets and workout details to the structured output. If the text is too long, rewrite it; do not omit topics. Compare recent strength check-ins before claiming a strength gap.',
                  }
                : {}),
              ...(args.promptVersion === DAILY_PLAN_V3_PROMPT_VERSION
                ? {
                    unwell_guidance_rule:
                      'If input.output_constraints.unwell_guidance_required is true, Why MUST say that if pain or illness continues she can speak to a doctor or healthcare professional. Include this within the 4 to 6 sentences, alongside goal, steps/rest, protein, carbs, vegetables, water and sleep. unwell_guidance means this exact professional-advice topic was missing; add it now.',
                    body_recovery_rule:
                      'Choose workout.type only from input.output_constraints.workout_allowed_types. upper_body_recovery means do not choose upper_body_strength or full_body_strength; lower_body_recovery means do not choose lower_body_strength or full_body_strength. Rewrite Workout AND Why together. Mention a specific body part needing recovery or being sore ONLY if it is listed in input.output_constraints.body_parts_with_recovery_evidence. An empty list means no body-part recovery claims are supported. Other does not establish which muscles trained. For invented_body_recovery remove the unsupported body-part claim from Why and Workout; explain the choice using the actual goal, energy, sleep and preference instead. General recovery from sleep and nutrition is allowed.',
                    rest_target_rule:
                      'When workout.type is rest, workout.minutes must be 0 and workout.intensity must be low. Workout.text must explicitly say rest or recovery and must not contain workout, strength, interval, or high-intensity, even in a sentence saying to avoid them. Describe recovery positively. For validation_failure rest_target, correct all three fields together and ensure Why agrees with the rest choice. If input.output_constraints.rest_required is true, choose rest; otherwise a rest choice still follows these rules.',
                    step_target_rule:
                      'Use input.output_constraints.steps_min and steps_max as HARD bounds. Select a multiple of 500 inside them. Flat energy or barely rested must not exceed steps_max even for a full session. For poor_readiness_steps, lower the rejected target to within these bounds and update the explanation to match. Other is unspecified training, not evidence of higher readiness.',
                  }
                : {}),
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
                        ? "Revise the previous candidate to correct EVERY code in validation_failures in the SAME revision; validation_failure is the first code. Recheck every field before calling the tool. Return the complete nested submit_daily_plan structure required by the client prompt. Keep the recommendation personalized to the goal and readiness; never copy historical fixed mappings. Respect ALL numeric bounds in input.output_constraints. Keep headline at 3 to 6 words. Make Why five sentences, 105 to 115 words, naming her goal early and including protein, carbs, vegetables, water and sleep even on rest days. Keep Meals exact. Sleep.text must be Aim for N hours tonight. with N equal to sleep.hours. The failure why_length means the previous Why had the wrong number of sentences or words; expand or combine sentences to fix BOTH, without omitting nutrient groups or water. The failure goal_explanation means the opening did not name the goal or the explanation omitted one of protein, carbs, vegetables, water or sleep; include every one. The failure new_member_load or recent_training_load means minutes exceeded workout_max_minutes or intensity exceeded workout_allowed_intensity; reduce the plan to these bounds. The failure unsafe_language means remove EVERY exact term listed in validation_feedback.prohibited_terms from ALL fields, including Why. Replace good food with balanced meals, and should with can. Never repeat a prohibited phrase even to say to avoid it. Remove calories, calorie burn, grams, food judgement, guilt words or numeric weight/body discussion; naming her weight loss goal is allowed. The failure invented_missing_history means do not say she has not trained this week when there are no logs; describe only today's answers. The failure internal_copy means remove tracking/data/algorithm terminology. Missing water in Why must be fixed explicitly even when water is already in Meals. A validation_failure beginning why_missing_ names the exact missing topic: include that topic in Why itself, not just in Meals or Sleep. Follow input.output_constraints.why_outline so no topic is forgotten. Carbs must be included explicitly as a fist-sized portion even on rest days. unsupported_strength_gap means the recent strength count does not support claiming a gap; explain recovery instead. For why_portion_guidance keep ALL accepted numeric/type targets unchanged and refine ONLY Why: include protein with every meal, half the plate vegetables, a fist-sized carb portion and the exact goal-specific plate fraction in input.output_constraints.nutrition_guidance. Fit it into the existing length contract. For refinement_changed_targets restore the previous_candidate targets and alter only Why. For food_names remove EVERY name listed in validation_feedback.food_names; speak about protein, vegetables and carbs instead. Do not repeat the invalid candidate unchanged."
                        : "The previous candidate failed validation or did not have a complete tool input. Call submit_daily_plan exactly once with every required field and the required types. Produce a materially corrected candidate, not a near-copy. Never use an em dash in any field. Keep headline and sleep exactly as output_constraints require. Copy output_constraints.workout and output_constraints.steps only when they are non-null; otherwise follow the workout type, duration and step cap. Meals must use the exact fixed meal guidance required by the system prompt, within 140 characters. Never name specific foods or dishes. Why must include the same numeric Steps target returned in steps and explain the balanced nutrient guidance; connect both to today's saved answers and rest or workout choice. Keep exercise examples matched to the workout type and never invent history. Return all required tool fields.",
                    validation_feedback: args.retryGuidance.validationFeedback,
                    previous_candidate: args.retryGuidance.previousCandidate ?? null,
                    validation_failure: args.retryGuidance.validationCode ?? 'invalid_output',
                    validation_failures: args.retryGuidance.validationCodes ?? [
                      args.retryGuidance.validationCode ?? 'invalid_output',
                    ],
                    ...(args.promptVersion === DAILY_PLAN_V3_PROMPT_VERSION &&
                    typeof args.retryGuidance.previousCandidate?.headline === 'string'
                      ? {
                          headline_length_feedback: {
                            word_count: args.retryGuidance.previousCandidate.headline
                              .trim()
                              .split(/\s+/).length,
                            instruction:
                              'Return a headline of 3 to 6 whitespace-separated words. For headline_length, shorten or expand the headline itself; changing Why does not fix it.',
                          },
                        }
                      : {}),
                    ...(args.promptVersion === DAILY_PLAN_V3_PROMPT_VERSION &&
                    typeof args.retryGuidance.previousCandidate?.why === 'string'
                      ? {
                          why_length_feedback: {
                            word_count: args.retryGuidance.previousCandidate.why.trim().split(/\s+/)
                              .length,
                            sentence_count: (
                              args.retryGuidance.previousCandidate.why.match(/[.!?](?:\s|$)/g) ?? []
                            ).length,
                            instruction:
                              'Rewrite Why to 105–115 words in five complete sentences ending with punctuation. Correct both counts while retaining all required topics and matching the plan.',
                          },
                        }
                      : {}),
                  }
                : {}),
            }),
          },
        ],
        tools: [
          {
            name: TOOL_NAME,
            ...(args.promptVersion === DAILY_PLAN_V3_PROMPT_VERSION &&
            supportsStrictDailyTool(selectedModel)
              ? { strict: true }
              : {}),
            description:
              args.promptVersion === DAILY_PLAN_V3_PROMPT_VERSION
                ? 'Return the six nested client Daily Plan fields with matching numeric targets.'
                : isV2DailyPrompt(args.promptVersion ?? '')
                  ? 'Return the nine daily-plan v2 fields.'
                  : 'Return the six daily-plan v1 fields.',
            input_schema:
              args.promptVersion === DAILY_PLAN_V3_PROMPT_VERSION
                ? supportsStrictDailyTool(selectedModel)
                  ? strictV3ToolSchema(args.input)
                  : v3ToolSchema(args.input)
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
      return {
        ok: false,
        code: 'provider_rate_limited',
        model: selectedModel,
        latencyMs: Date.now() - started,
      };
    if (!response.ok)
      return {
        ok: false,
        code: 'provider_unavailable',
        formatCode: `provider_http_${response.status}`,
        model: selectedModel,
        latencyMs: Date.now() - started,
      };
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      return {
        ok: false,
        code: 'invalid_output',
        formatCode: 'invalid_json',
        model: selectedModel,
        latencyMs: Date.now() - started,
      };
    }
    const parsed = parse(body, args.promptVersion ?? DAILY_PLAN_PROMPT_VERSION);
    if (!parsed)
      return {
        ok: false,
        code: 'invalid_output',
        formatCode: formatFailure(body, args.promptVersion ?? DAILY_PLAN_PROMPT_VERSION),
        model: selectedModel,
        latencyMs: Date.now() - started,
      };
    return { ok: true, ...parsed, model: selectedModel, latencyMs: Date.now() - started };
  } catch {
    return {
      ok: false,
      code: timedOut ? 'provider_timeout' : 'provider_unavailable',
      model: selectedModel,
      latencyMs: Date.now() - started,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export function supportsStrictDailyTool(model: string) {
  return /^(?:claude-haiku-4-5|claude-sonnet-4-[5-9]|claude-opus-4-[5-9])(?:-|$)/.test(model);
}

/** Anthropic strict mode rejects min/max/multipleOf/maxLength. Enumerate our small
 * finite numeric choices instead, and keep text lengths in descriptions + validation.
 * https://platform.claude.com/docs/en/build-with-claude/structured-outputs
 */
export function strictV3ToolSchema(input: unknown) {
  const schema = v3ToolSchema(input);
  function convert(node: Record<string, any>): Record<string, any> {
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(node)) {
      if (['minimum', 'maximum', 'multipleOf', 'maxLength', 'pattern'].includes(key)) continue;
      if (key === 'properties')
        result[key] = Object.fromEntries(
          Object.entries(value).map(([name, child]) => [
            name,
            convert(child as Record<string, any>),
          ])
        );
      else result[key] = value;
    }
    if (typeof node.maxLength === 'number')
      result.description = `${node.description ?? ''} Maximum ${node.maxLength} characters.`.trim();
    if (
      node.type === 'integer' &&
      typeof node.minimum === 'number' &&
      typeof node.maximum === 'number'
    ) {
      const step = node.multipleOf ?? (node.maximum > 90 ? 500 : 5);
      result.enum = Array.from(
        { length: Math.floor((node.maximum - node.minimum) / step) + 1 },
        (_, i) => node.minimum + i * step
      );
    }
    return result;
  }
  const result = convert(schema);
  result.properties.why.description +=
    ' Five complete sentences, 105 to 115 words. Include the goal, the selected workout/rest and steps, protein every meal, half the plate vegetables, a fist-sized carb portion with the goal-specific plate fraction from input.output_constraints.nutrition_guidance, water and sleep. Include professional advice when unwell_guidance_required is true.';
  result.properties.headline.description += ' Use 3 to 6 words.';
  result.properties.meals.properties.text.enum = [2, 2.5, 3].map(
    (water) => `Log today's meals for feedback. Aim for ${water} litres of water.`
  );
  result.properties.sleep.properties.text.enum = [7, 7.5, 8, 8.5, 9].map(
    (hours) => `Aim for ${hours} hours tonight.`
  );
  return result;
}

export function v3ToolSchema(input: unknown) {
  const bounds = (
    input as {
      output_constraints?: {
        steps_min?: number;
        steps_max?: number;
        workout_allowed_types?: string[];
        workout_max_minutes?: number;
        workout_allowed_intensity?: string[];
        sleep_min_hours?: number;
      };
    } | null
  )?.output_constraints;
  const workout = V3_TOOL_SCHEMA.properties.workout;
  const allowedTypes = bounds?.workout_allowed_types;
  const allowedIntensity = bounds?.workout_allowed_intensity;
  const min = bounds?.steps_min;
  const max = bounds?.steps_max;
  const target =
    typeof min === 'number' &&
    typeof max === 'number' &&
    Number.isFinite(min) &&
    Number.isFinite(max) &&
    min >= 0 &&
    max <= 12000 &&
    max >= min
      ? {
          type: 'integer',
          minimum: Math.ceil(min / 500) * 500,
          maximum: Math.floor(max / 500) * 500,
          multipleOf: 500,
        }
      : V3_TOOL_SCHEMA.properties.steps.properties.target;
  return {
    ...V3_TOOL_SCHEMA,
    properties: {
      ...V3_TOOL_SCHEMA.properties,
      steps: { ...V3_TOOL_SCHEMA.properties.steps, properties: { target } },
      sleep: {
        ...V3_TOOL_SCHEMA.properties.sleep,
        properties: {
          ...V3_TOOL_SCHEMA.properties.sleep.properties,
          hours: {
            type: 'number',
            enum: [7, 7.5, 8, 8.5, 9].filter((hours) => hours >= (bounds?.sleep_min_hours ?? 7)),
          },
        },
      },
      workout: {
        ...workout,
        properties: {
          ...workout.properties,
          type: {
            ...workout.properties.type,
            enum: allowedTypes?.length
              ? workout.properties.type.enum.filter((type) => allowedTypes.includes(type))
              : workout.properties.type.enum,
          },
          minutes: {
            ...workout.properties.minutes,
            maximum:
              typeof bounds?.workout_max_minutes === 'number' ? bounds.workout_max_minutes : 90,
            multipleOf: 5,
          },
          intensity: {
            ...workout.properties.intensity,
            enum: allowedIntensity?.length
              ? workout.properties.intensity.enum.filter((type) => allowedIntensity.includes(type))
              : workout.properties.intensity.enum,
          },
        },
      },
    },
  };
}

const V3_TOOL_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    headline: { type: 'string', maxLength: 80, pattern: '^\\S+(?:\\s+\\S+){2,5}$' },
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
        water_litres: { type: 'number', enum: [2, 2.5, 3] },
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
  return isDailyPlanOutputV3(data);
}
