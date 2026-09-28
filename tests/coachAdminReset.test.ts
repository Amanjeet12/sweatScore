// @ts-nocheck -- Bun test runtime fixture.
import { describe, expect, test } from 'bun:test';
import { resetMyTodayPlanForTesting } from '../convex/coachFoundation';

function fixture({ admin = true, pending = false, proof = false } = {}) {
  const day = new Date().toISOString().slice(0, 10);
  const rows: Record<string, any[]> = {
    users: [{ _id: 'admin', isAdmin: admin, timezone: 'UTC' }],
    coachOnboardingV1: [
      {
        _id: 'state',
        userId: 'admin',
        stage: 'complete',
        dailyDraftDay: day,
        dailyDraft: { sleep: 'old' },
        firstPlanRequestId: 'request',
        dailyAnswerId: 'answer',
      },
    ],
    coachPlanRequestsV1: [
      { _id: 'request', userId: 'admin', day, status: pending ? 'pending' : 'ready' },
    ],
    coachPlanRevisionsV1: [{ _id: 'revision', userId: 'admin', day }],
    coachAssignmentsV1: [{ _id: 'assignment', userId: 'admin', day }],
    coachDailyAnswersV1: [{ _id: 'answer', userId: 'admin', day }],
    coachProofSubmissionsV1: proof ? [{ _id: 'proof', userId: 'admin', day }] : [],
  };
  const ctx = {
    auth: { getUserIdentity: async () => ({ subject: 'admin' }) },
    db: {
      get: async (id: string) =>
        Object.values(rows)
          .flat()
          .find((row) => row._id === id) ?? null,
      query: (table: string) => ({
        withIndex: (_: string, select: (q: any) => any) => {
          const filters: Record<string, any> = {};
          const q = {
            eq: (key: string, value: any) => {
              filters[key] = value;
              return q;
            },
          };
          select(q);
          return {
            take: async (limit: number) =>
              (rows[table] ?? [])
                .filter((row) =>
                  Object.entries(filters).every(([key, value]) => row[key] === value)
                )
                .slice(0, limit),
            unique: async () =>
              (rows[table] ?? []).find((row) =>
                Object.entries(filters).every(([key, value]) => row[key] === value)
              ) ?? null,
          };
        },
      }),
      delete: async (id: string) => {
        for (const key of Object.keys(rows)) rows[key] = rows[key].filter((row) => row._id !== id);
      },
      patch: async (id: string, value: any) =>
        Object.assign(
          Object.values(rows)
            .flat()
            .find((row) => row._id === id),
          value
        ),
    },
  };
  return { ctx, rows, day };
}

const run = (ctx: any) => resetMyTodayPlanForTesting._handler(ctx, {});
describe('development admin daily plan reset', () => {
  test('clears only the admin daily plan chain and returns to daily questions', async () => {
    const original = process.env.CONVEX_CLOUD_URL;
    process.env.CONVEX_CLOUD_URL = 'https://beloved-stoat-88.convex.cloud';
    try {
      const { ctx, rows } = fixture();
      expect((await run(ctx)).plansDeleted).toBe(1);
      expect(rows.coachPlanRequestsV1).toHaveLength(0);
      expect(rows.coachPlanRevisionsV1).toHaveLength(0);
      expect(rows.coachAssignmentsV1).toHaveLength(0);
      expect(rows.coachDailyAnswersV1).toHaveLength(0);
      expect(rows.coachOnboardingV1[0].stage).toBe('daily');
      expect(rows.coachOnboardingV1[0].firstPlanRequestId).toBeUndefined();
    } finally {
      process.env.CONVEX_CLOUD_URL = original;
    }
  });
  test('rejects non-admin, pending generation and existing proof before deleting', async () => {
    const original = process.env.CONVEX_CLOUD_URL;
    process.env.CONVEX_CLOUD_URL = 'https://beloved-stoat-88.convex.cloud';
    try {
      for (const options of [{ admin: false }, { pending: true }, { proof: true }]) {
        const { ctx, rows } = fixture(options);
        await expect(run(ctx)).rejects.toThrow();
        expect(rows.coachPlanRevisionsV1).toHaveLength(1);
      }
    } finally {
      process.env.CONVEX_CLOUD_URL = original;
    }
  });
  test('rejects another deployment', async () => {
    const original = process.env.CONVEX_CLOUD_URL;
    process.env.CONVEX_CLOUD_URL = 'https://production.convex.cloud';
    try {
      await expect(run(fixture().ctx)).rejects.toThrow();
    } finally {
      process.env.CONVEX_CLOUD_URL = original;
    }
  });
});
