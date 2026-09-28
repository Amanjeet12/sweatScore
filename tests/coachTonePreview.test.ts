// @ts-nocheck -- Bun-only Convex handler/provider fixtures.
import { expect, test } from 'bun:test';
import { COACH_DETAILS, COACH_TONES, COACH_TONE_SCOPES } from '../shared/coachFoundation';
import {
  effectiveTone,
  FICTIONAL_DAILY_SNAPSHOT,
  previewMealSampleConfig,
  previewQuotaAllows,
} from '../shared/coachTonePreview';
import { getToneContract, saveToneContract } from '../convex/coachFoundation';
import { reserve } from '../convex/coachTonePreviewStore';
import { runDailyTonePreview, runMealTonePreview } from '../convex/coachTonePreviewRunner';
import { compare } from '../convex/coachTonePreview';
import { validateDailyPlanOutput } from '../convex/coachDailyPolicy';

const config = { apiKey: 'fake', model: 'fake', maxOutputTokens: 1600, timeoutMs: 1000 };
const plan = {
  headline: 'Rest day, and that counts.',
  workout: 'No workout today. Keep your streak going by logging your meals, steps and sleep.',
  workoutExamples: [],
  workoutReason: 'Rest supports recovery today.',
  steps: '5,000 steps',
  stepsReason: 'Today is a rest day, so this target fits your answer.',
  sleep: 'Aim for 7 hours tonight. Keep your usual bedtime routine.',
  meals:
    'Try eggs with vegetables, aim for 2 litres of water and snap each meal for a portion check.',
  why: 'Rest matches your answer; 5,000 steps are a gentle target and eggs with vegetables are a practical meal option.',
};
const selection = { tone: 'calm_reassuring', detail: 'concise', scope: 'both' } as const;
const fakeStore = (admin: boolean, old = []) => {
  const rows = {
    users: [{ _id: 'admin', isAdmin: admin }],
    coachToneSettingsV1: [...old],
    coachTonePreviewAttemptsV1: [],
  };
  const writes = [];
  const ctx = {
    auth: { getUserIdentity: async () => ({ subject: 'admin' }) },
    db: {
      get: async (id) =>
        Object.values(rows)
          .flat()
          .find((x) => x._id === id) ?? null,
      insert: async (table, value) => {
        const id = `${table}_${rows[table].length + 1}`;
        rows[table].push({ _id: id, ...value });
        writes.push({ table, value });
        return id;
      },
      patch: async (id, value) => {
        const row = Object.values(rows)
          .flat()
          .find((item) => item._id === id);
        if (!row) throw new Error('Missing row');
        Object.assign(row, value);
      },
      query: (table) => {
        let found = [...(rows[table] ?? [])];
        const chain = {
          withIndex: (_name, callback) => {
            if (callback) {
              const checks = [];
              const q = {
                eq: (key, value) => {
                  checks.push([key, 'eq', value]);
                  return q;
                },
                gt: (key, value) => {
                  checks.push([key, 'gt', value]);
                  return q;
                },
              };
              callback(q);
              found = found.filter((row) =>
                checks.every(([key, op, value]) =>
                  op === 'eq' ? row[key] === value : row[key] > value
                )
              );
            }
            return chain;
          },
          order: (direction) => {
            if (direction === 'desc') found.reverse();
            return chain;
          },
          first: async () => found[0] ?? null,
          collect: async () => found,
        };
        return chain;
      },
    },
  };
  return { ctx, rows, writes };
};

test('every enumerated selector and scope has a constrained effective style', () => {
  expect(COACH_TONES).toHaveLength(3);
  expect(COACH_DETAILS).toHaveLength(2);
  expect(COACH_TONE_SCOPES).toHaveLength(3);
  for (const tone of COACH_TONES)
    for (const detail of COACH_DETAILS)
      for (const scope of COACH_TONE_SCOPES) {
        const chosen = { tone, detail, scope };
        expect(effectiveTone(chosen, 'daily_plan').tone).toBe(
          scope === 'meal_feedback' ? 'warm_direct' : tone
        );
        expect(effectiveTone(chosen, 'meal_feedback').tone).toBe(
          scope === 'daily_plan' ? 'warm_direct' : tone
        );
      }
  expect(
    effectiveTone(
      { tone: 'upbeat_encouraging', detail: 'concise', scope: 'daily_plan' },
      'meal_feedback',
      { tone: 'calm_reassuring', detail: 'standard' }
    )
  ).toEqual({ tone: 'calm_reassuring', detail: 'standard' });
});

test('the two authorised preview photos use distinct storage identities', () => {
  const env = {
    COACH_PREVIEW_MEAL_BOWL_STORAGE_ID: 'bowl-id',
    COACH_PREVIEW_MEAL_FLATBREAD_STORAGE_ID: 'flatbread-id',
  };
  expect(previewMealSampleConfig('burrito_bowl', env)).toMatchObject({
    label: 'Burrito bowl',
    storageId: 'bowl-id',
  });
  expect(previewMealSampleConfig('chicken_flatbread', env)).toMatchObject({
    label: 'Chicken flatbread',
    storageId: 'flatbread-id',
  });
  expect(
    previewMealSampleConfig('burrito_bowl', { COACH_PREVIEW_MEAL_STORAGE_ID: 'legacy-id' })
      .storageId
  ).toBe('legacy-id');
});

test('member is denied tone read/save and preview reservation server-side', async () => {
  const s = fakeStore(false);
  await expect(getToneContract._handler(s.ctx, {})).rejects.toThrow('Admin required');
  await expect(
    saveToneContract._handler(s.ctx, { expectedVersion: 1, ...selection, action: 'save' })
  ).rejects.toThrow('Admin required');
  await expect(
    reserve._handler(s.ctx, {
      adminUserId: 'admin',
      kinds: ['daily_plan', 'daily_plan'],
      savedVersion: 1,
      selections: [selection, selection],
    })
  ).rejects.toThrow('Admin required');
  expect(s.writes).toHaveLength(0);
  let dispatched = false;
  await expect(
    compare._handler(
      {
        auth: s.ctx.auth,
        runQuery: async () => {
          throw new Error('Admin required');
        },
        runMutation: async () => {
          dispatched = true;
        },
      } as any,
      { selected: selection }
    )
  ).rejects.toThrow('Admin required');
  expect(dispatched).toBe(false);
});

test('stale concurrent save conflicts; restore makes an audited new version', async () => {
  const s = fakeStore(true);
  await saveToneContract._handler(s.ctx, { expectedVersion: 1, ...selection, action: 'save' });
  await expect(
    saveToneContract._handler(s.ctx, {
      expectedVersion: 1,
      tone: 'upbeat_encouraging',
      detail: 'standard',
      scope: 'daily_plan',
      action: 'save',
    })
  ).rejects.toThrow('Tone version changed');
  await saveToneContract._handler(s.ctx, { expectedVersion: 2, ...selection, action: 'restore' });
  expect(s.rows.coachToneSettingsV1.map((x) => x.version)).toEqual([2, 3]);
  expect(s.rows.coachToneSettingsV1[1]).toMatchObject({
    tone: 'warm_direct',
    detail: 'standard',
    scope: 'both',
    action: 'restore',
    adminUserId: 'admin',
    actorStatus: 'active_admin',
  });
  expect(s.rows.coachToneSettingsV1[1].createdAt).toBeGreaterThan(0);
});

test('new tone saves and previews use one style for both outputs', async () => {
  const s = fakeStore(true);
  await expect(
    saveToneContract._handler(s.ctx, {
      expectedVersion: 1,
      tone: 'upbeat_encouraging',
      detail: 'standard',
      scope: 'daily_plan',
      action: 'save',
    })
  ).rejects.toThrow('must apply to both');
  expect(s.writes).toHaveLength(0);
  await saveToneContract._handler(s.ctx, { expectedVersion: 1, ...selection, action: 'save' });
  expect(s.rows.coachToneSettingsV1[0].scope).toBe('both');
  await expect(
    compare._handler({ auth: s.ctx.auth } as any, {
      selected: { ...selection, scope: 'meal_feedback' },
    })
  ).rejects.toThrow('must apply to both');
});

test('preview quota is separate, transactional and limited to twelve provider attempts per hour', async () => {
  const s = fakeStore(true);
  await expect(
    reserve._handler(s.ctx, {
      adminUserId: 'admin',
      kinds: ['daily_plan', 'daily_plan'],
      savedVersion: 2,
      selections: [selection, selection],
    })
  ).rejects.toThrow('Tone version changed');
  expect(previewQuotaAllows(10, 2)).toBe(true);
  expect(previewQuotaAllows(10, 4)).toBe(false);
  for (let i = 0; i < 6; i++)
    await reserve._handler(s.ctx, {
      adminUserId: 'admin',
      kinds: ['daily_plan', 'daily_plan'],
      savedVersion: 1,
      selections: [selection, selection],
    });
  await expect(
    reserve._handler(s.ctx, {
      adminUserId: 'admin',
      kinds: ['meal_feedback', 'meal_feedback'],
      savedVersion: 1,
      selections: [selection, selection],
    })
  ).rejects.toThrow('Preview limit reached');
  expect(s.writes.every((x) => x.table === 'coachTonePreviewAttemptsV1')).toBe(true);
  expect(s.rows.coachTonePreviewAttemptsV1).toHaveLength(12);
});

test('exempted development attempts remain audited and do not count against the quota', async () => {
  const s = fakeStore(true);
  for (let i = 0; i < 6; i++)
    await reserve._handler(s.ctx, {
      adminUserId: 'admin',
      kinds: ['daily_plan', 'daily_plan'],
      savedVersion: 1,
      selections: [selection, selection],
    });
  for (const row of s.rows.coachTonePreviewAttemptsV1) row.quotaExemptedAt = Date.now();
  expect(s.rows.coachTonePreviewAttemptsV1).toHaveLength(12);
  await reserve._handler(s.ctx, {
    adminUserId: 'admin',
    kinds: ['daily_plan', 'daily_plan'],
    savedVersion: 1,
    selections: [selection, selection],
  });
  expect(s.rows.coachTonePreviewAttemptsV1).toHaveLength(14);
});

test('daily and meal previews use fictional inputs, actual image bytes and real validators', async () => {
  let dailyBody;
  const daily = await runDailyTonePreview({
    selection,
    config,
    fetchImpl: async (_url, init) => {
      dailyBody = JSON.parse(init.body);
      return new Response(
        JSON.stringify({
          content: [{ type: 'tool_use', name: 'submit_daily_plan', input: plan }],
          usage: { input_tokens: 80, output_tokens: 60 },
        }),
        { status: 200 }
      );
    },
  });
  expect(daily.ok).toBe(true);
  expect(dailyBody.messages[0].content).toContain('"day":"2026-01-15"');
  expect(dailyBody.messages[0].content).not.toContain('member_a');
  expect(dailyBody.messages[0].content).toContain('"tone":"calm_reassuring"');
  const imageBase64 = Buffer.from('fictional-authorised-sample').toString('base64');
  let mealBody;
  const meal = await runMealTonePreview({
    selection,
    config,
    imageBase64,
    mediaType: 'image/jpeg',
    fetchImpl: async (_url, init) => {
      mealBody = JSON.parse(init.body);
      return new Response(
        JSON.stringify({
          content: [
            {
              type: 'tool_use',
              name: 'submit_meal_check',
              input: {
                verdict: 'On point',
                feedback: 'A balanced visible plate. Keep that portion of greens next time.',
              },
            },
          ],
          usage: { input_tokens: 90, output_tokens: 40 },
        }),
        { status: 200 }
      );
    },
  });
  expect(meal.ok).toBe(true);
  expect(mealBody.messages[0].content[0].source.data).toBe(imageBase64);
  expect(mealBody.messages[0].content[1].text).toContain('"workout_logged_today":false');
  expect(() =>
    validateDailyPlanOutput(
      { ...plan, headline: 'Different fixed headline.' },
      structuredClone(FICTIONAL_DAILY_SNAPSHOT),
      '2026-01-15'
    )
  ).toThrow('invalid_output');
});

test('live preview accepts an explanation that repeats the canonical step target', async () => {
  const result = await runDailyTonePreview({
    selection,
    config,
    fetchImpl: async () =>
      new Response(
        JSON.stringify({
          content: [
            {
              type: 'tool_use',
              name: 'submit_daily_plan',
              input: {
                ...plan,
                stepsReason: 'Today is a rest day, so 5,000 steps fits your answer.',
              },
            },
          ],
        }),
        { status: 200 }
      ),
  });
  expect(result.ok).toBe(true);
});

test('daily preview repairs one invalid provider candidate without member state', async () => {
  let calls = 0;
  const result = await runDailyTonePreview({
    selection,
    config,
    fetchImpl: async (_url, init) => {
      calls++;
      const request = JSON.parse(init.body);
      expect(request.messages[0].content).not.toContain('member_a');
      if (calls === 2) {
        expect(request.messages[0].content).toContain('revision_instruction');
        expect(request.messages[0].content).toContain('Never use an em dash');
        expect(request.messages[0].content).toContain(
          'Why must include the same numeric Steps target'
        );
      }
      return new Response(
        JSON.stringify({
          content: [
            {
              type: 'tool_use',
              name: 'submit_daily_plan',
              input:
                calls === 1
                  ? { ...plan, why: 'Rest fits today and a simple meal can help.' }
                  : plan,
            },
          ],
        }),
        { status: 200 }
      );
    },
  });
  expect(calls).toBe(2);
  expect(result.ok).toBe(true);
});
