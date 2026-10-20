// @ts-ignore -- Bun runtime types are not installed in the app TypeScript environment.
import { describe, expect, test } from 'bun:test';

import { cacheSystemPrompt, promptCacheUsage } from '../convex/anthropicPromptCache';
import { CLIENT_PLAN_UPDATE } from '../convex/coachClientUpdate';
import {
  DAILY_PLAN_V3_PROMPT_VERSION,
  DAILY_PLAN_V3_SYSTEM_PROMPT,
} from '../convex/coachDailyPromptV3';
import { generateDailyPlan } from '../convex/coachDailyProvider';
import { MEAL_SYSTEM_PROMPT, CLIENT_MEAL_UPDATE } from '../convex/coachMealPromptV2';
import { analyzeMealPhoto } from '../convex/coachMealProvider';

describe('Anthropic prompt caching', () => {
  test('preserves text bytes and order, marks only the last system block, and does not mutate inputs', () => {
    const blocks = [
      { type: 'text' as const, text: 'First\n\nexact instructions.' },
      { type: 'text' as const, text: 'Last instructions.' },
    ];
    const cached = cacheSystemPrompt(blocks);
    expect(cached.map((block) => block.text)).toEqual(blocks.map((block) => block.text));
    expect(cached[0].cache_control).toBeUndefined();
    expect(cached[1].cache_control).toEqual({ type: 'ephemeral', ttl: '5m' });
    expect(blocks[1]).not.toHaveProperty('cache_control');
    expect(cacheSystemPrompt('Exact single prompt.')[0].text).toBe('Exact single prompt.');
    expect(cacheSystemPrompt([])).toEqual([]);
  });

  test('token totals include cache reads and writes without changing legacy usage accounting', () => {
    expect(promptCacheUsage({ input_tokens: 100, output_tokens: 20 })).toEqual({
      uncachedInputTokens: 100,
      outputTokens: 20,
      cacheReadInputTokens: 0,
      cacheCreationInputTokens: 0,
      totalInputTokens: 100,
    });
    expect(
      promptCacheUsage({
        input_tokens: 100,
        cache_read_input_tokens: 4500,
        cache_creation_input_tokens: 200,
        output_tokens: 20,
      })?.totalInputTokens
    ).toBe(4800);
    expect(
      promptCacheUsage({ input_tokens: 0, cache_read_input_tokens: 4096 })?.totalInputTokens
    ).toBe(4096);
    expect(promptCacheUsage({ input_tokens: -1 })).toBeUndefined();
    expect(promptCacheUsage(undefined)).toBeUndefined();
  });

  test('daily requests retain model, sampling, bounds and fresh personal answers outside the cache', async () => {
    const requests: Record<string, any>[] = [];
    const config = {
      apiKey: 'test-key',
      model: 'claude-haiku-4-5-20251001',
      maxOutputTokens: 2400,
      timeoutMs: 1000,
    };
    for (const energy of ['flat', 'full']) {
      await generateDailyPlan({
        config,
        promptVersion: DAILY_PLAN_V3_PROMPT_VERSION,
        input: {
          today: { energy },
          output_constraints: {
            steps_min: 3000,
            steps_max: 7000,
            workout_allowed_types: ['walking'],
            workout_max_minutes: 25,
            workout_allowed_intensity: ['low'],
            sleep_min_hours: 7,
          },
        },
        style: { tone: 'warm_direct', detail: 'standard' },
        fetchImpl: async (_url, init) => {
          requests.push(JSON.parse(String(init?.body)));
          return new Response('', { status: 429 });
        },
      });
    }
    const [first, second] = requests;
    expect(first.system).toEqual(second.system);
    expect(first.system[0]).toEqual({
      type: 'text',
      text: DAILY_PLAN_V3_SYSTEM_PROMPT + CLIENT_PLAN_UPDATE,
      cache_control: { type: 'ephemeral', ttl: '5m' },
    });
    expect(first.model).toBe(config.model);
    expect(first.temperature).toBe(0.7);
    expect(first.max_tokens).toBe(2400);
    expect(first.tools).toEqual(second.tools);
    expect(first.messages).not.toEqual(second.messages);
    expect(JSON.parse(first.messages[0].content).input.today.energy).toBe('flat');
    expect(JSON.parse(second.messages[0].content).input.today.energy).toBe('full');
    expect(JSON.stringify(first.messages)).not.toContain('cache_control');
    expect(first).not.toHaveProperty('cache_control');
  });

  test('meal cache never includes the changing photo, plate description or member feedback', async () => {
    const requests: Record<string, any>[] = [];
    for (const photo of ['photo-one', 'photo-two']) {
      await analyzeMealPhoto({
        imageBase64: photo,
        mediaType: 'image/jpeg',
        goal: 'recomp',
        plateDescription: photo,
        memberFeedback: [{ correction: photo }],
        workoutLoggedToday: false,
        style: { tone: 'warm_direct', detail: 'standard' },
        config: {
          apiKey: 'test-key',
          model: 'claude-haiku-4-5-20251001',
          maxOutputTokens: 2400,
          timeoutMs: 1000,
        },
        fetchImpl: async (_url, init) => {
          requests.push(JSON.parse(String(init?.body)));
          return new Response('', { status: 429 });
        },
      });
    }
    const [first, second] = requests;
    expect(first.system).toEqual(second.system);
    expect(first.system[0].text).toBe(MEAL_SYSTEM_PROMPT + CLIENT_MEAL_UPDATE);
    expect(first.system[0]).not.toHaveProperty('cache_control');
    expect(first.system.at(-1).cache_control).toEqual({ type: 'ephemeral', ttl: '5m' });
    expect(first.temperature).toBe(0);
    expect(first.max_tokens).toBe(2400);
    expect(first.tools).toEqual(second.tools);
    expect(first.messages[0].content[0].source.data).toBe('photo-one');
    expect(second.messages[0].content[0].source.data).toBe('photo-two');
    expect(JSON.stringify(first.messages)).not.toContain('cache_control');
  });
});

test('daily provider persists total processed input when Anthropic reports cache hits', async () => {
  const output = {
    headline: 'Steady progress today.',
    workout: 'Gentle movement.',
    steps: '8,000 steps',
    meals: 'Log meals.',
    sleep: 'Rest tonight.',
    why: 'A steady day.',
  };
  const result = await generateDailyPlan({
    config: {
      apiKey: 'test',
      model: 'claude-haiku-4-5-20251001',
      maxOutputTokens: 1600,
      timeoutMs: 1000,
    },
    input: {},
    style: { tone: 'warm_direct', detail: 'standard' },
    fetchImpl: async () =>
      new Response(
        JSON.stringify({
          content: [{ type: 'tool_use', name: 'submit_daily_plan', input: output }],
          usage: {
            input_tokens: 100,
            cache_read_input_tokens: 4200,
            cache_creation_input_tokens: 50,
            output_tokens: 200,
          },
        }),
        { status: 200 }
      ),
  });
  expect(result).toMatchObject({ ok: true, output, inputTokens: 4350, outputTokens: 200 });
});

test('meal retry accounting includes cache reads and writes from both attempts', async () => {
  let calls = 0;
  const result = await analyzeMealPhoto({
    imageBase64: 'actual-photo',
    mediaType: 'image/jpeg',
    goal: 'recomp',
    workoutLoggedToday: false,
    style: { tone: 'warm_direct', detail: 'standard' },
    config: {
      apiKey: 'test',
      model: 'claude-haiku-4-5-20251001',
      maxOutputTokens: 2400,
      timeoutMs: 1000,
    },
    fetchImpl: async () => {
      calls++;
      return new Response(
        JSON.stringify({
          content: [
            {
              type: 'tool_use',
              name: 'submit_meal_check',
              input:
                calls === 1
                  ? { invalid: true }
                  : {
                      verdict: 'On point',
                      feedback:
                        'Your protein and vegetables look balanced. For body recomp, these portions support your recovery.',
                    },
            },
          ],
          usage: {
            input_tokens: 100,
            cache_creation_input_tokens: calls === 1 ? 4200 : 0,
            cache_read_input_tokens: calls === 2 ? 4200 : 0,
            output_tokens: 50,
          },
        }),
        { status: 200 }
      );
    },
  });
  expect(calls).toBe(2);
  expect(result).toMatchObject({ ok: true, inputTokens: 8600, outputTokens: 100 });
});
