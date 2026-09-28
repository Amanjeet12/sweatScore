'use node';

import { getAuthUserId } from '@convex-dev/auth/server';
import { ConvexError, v } from 'convex/values';
import { action } from './_generated/server';
import { api, internal } from './_generated/api';
import { Id } from './_generated/dataModel';
import { detail, tone, toneScope } from './coachFoundationValidators';
import { providerConfig } from './coachDailyProvider';
import { runDailyTonePreview, runMealTonePreview } from './coachTonePreviewRunner';
import { ToneSelection, effectiveTone, previewMealSampleConfig } from '../shared/coachTonePreview';
import { DEFAULT_COACH_TONE } from '../shared/coachFoundation';
import { DAILY_PLAN_V2_PROMPT_VERSION } from './coachDailyPromptV2';
import { MEAL_PROMPT_VERSION } from './coachMealPrompt';

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;
type DailyPreview = Awaited<ReturnType<typeof runDailyTonePreview>>;
type MealPreview = Awaited<ReturnType<typeof runMealTonePreview>>;
type PreviewResponse =
  | { status: 'unavailable'; reason: string }
  | {
      status: 'ready';
      currentVersion: number;
      promptVersions: { daily: string; meal: string };
      sampleMeal: { key: 'burrito_bowl' | 'chicken_flatbread'; label: string; imageUrl?: string };
      daily: { current: DailyPreview; selected: DailyPreview };
      meal:
        | { status: 'ready'; current: MealPreview; selected: MealPreview }
        | { status: 'unavailable'; reason: string };
    };

export const compare = action({
  args: {
    selected: v.object({ tone, detail, scope: toneScope }),
    sampleMeal: v.optional(v.union(v.literal('burrito_bowl'), v.literal('chicken_flatbread'))),
  },
  handler: async (ctx, { selected, sampleMeal }): Promise<PreviewResponse> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError('Admin required');
    if (selected.scope !== 'both') throw new ConvexError('Preview selection must apply to both');
    // The public query itself checks current admin role. The reservation also
    // checks it transactionally before any provider request is dispatched.
    const current: ToneSelection & { version: number } = await ctx.runQuery(
      api.coachFoundation.getToneContract,
      {}
    );
    const history = await ctx.runQuery(api.coachFoundation.getToneHistory, {});
    const config = providerConfig(DAILY_PLAN_V2_PROMPT_VERSION);
    if (!config)
      return { status: 'unavailable' as const, reason: 'Provider configuration is unavailable.' };

    const sampleConfig = previewMealSampleConfig(sampleMeal ?? 'burrito_bowl', {
      COACH_PREVIEW_MEAL_BOWL_STORAGE_ID: process.env.COACH_PREVIEW_MEAL_BOWL_STORAGE_ID,
      COACH_PREVIEW_MEAL_FLATBREAD_STORAGE_ID: process.env.COACH_PREVIEW_MEAL_FLATBREAD_STORAGE_ID,
      COACH_PREVIEW_MEAL_STORAGE_ID: process.env.COACH_PREVIEW_MEAL_STORAGE_ID,
    });
    const sampleKey = sampleConfig.key;
    const sampleLabel = sampleConfig.label;
    const imageId = sampleConfig.storageId;
    let sample: Blob | null = null;
    if (imageId) {
      try {
        sample = await ctx.storage.get(imageId as Id<'_storage'>);
      } catch {
        // A missing or invalid authorised sample disables only meal preview.
      }
    }
    const mealType = sample?.type;
    const mealAvailable = Boolean(
      sample &&
      IMAGE_TYPES.includes(mealType as (typeof IMAGE_TYPES)[number]) &&
      sample.size <= 5_000_000
    );
    const mealUnavailableReason = imageId
      ? `The ${sampleLabel.toLowerCase()} sample is unavailable or unsupported.`
      : `The ${sampleLabel.toLowerCase()} sample has not been configured.`;
    const kinds = mealAvailable
      ? (['daily_plan', 'daily_plan', 'meal_feedback', 'meal_feedback'] as const)
      : (['daily_plan', 'daily_plan'] as const);
    const ids = await ctx.runMutation(internal.coachTonePreviewStore.reserve, {
      adminUserId: userId,
      kinds: [...kinds],
      savedVersion: current.version,
      selections: [{ tone: current.tone, detail: current.detail, scope: current.scope }, selected],
    });
    const currentSelection: ToneSelection = {
      tone: current.tone,
      detail: current.detail,
      scope: current.scope,
    };
    const selections = [currentSelection, selected] as const;
    const previousFor = (kind: 'daily_plan' | 'meal_feedback') => {
      const previous = history.find(
        (setting) =>
          setting.version < current.version && (setting.scope === kind || setting.scope === 'both')
      );
      return previous
        ? { tone: previous.tone, detail: previous.detail }
        : { tone: DEFAULT_COACH_TONE.tone, detail: DEFAULT_COACH_TONE.detail };
    };
    const dailyPrior = previousFor('daily_plan');
    const mealPrior = previousFor('meal_feedback');
    const dailyCurrent = effectiveTone(currentSelection, 'daily_plan', dailyPrior);
    const mealCurrent = effectiveTone(currentSelection, 'meal_feedback', mealPrior);
    const daily = [];
    const meal = [];
    for (let index = 0; index < 2; index++) {
      const result = await runDailyTonePreview({
        selection: selections[index],
        priorStyle: index === 0 ? dailyPrior : dailyCurrent,
        config,
      });
      await ctx.runMutation(internal.coachTonePreviewStore.finish, {
        adminUserId: userId,
        attemptId: ids[index],
        status: result.ok ? 'ready' : 'failed',
        errorCode: result.ok ? undefined : result.code,
        inputTokens: result.ok ? result.inputTokens : undefined,
        outputTokens: result.ok ? result.outputTokens : undefined,
        latencyMs: result.latencyMs,
      });
      daily.push(result);
    }
    if (mealAvailable && sample) {
      const imageBase64 = Buffer.from(await sample.arrayBuffer()).toString('base64');
      for (let index = 0; index < 2; index++) {
        const result = await runMealTonePreview({
          selection: selections[index],
          priorStyle: index === 0 ? mealPrior : mealCurrent,
          config,
          imageBase64,
          mediaType: mealType as (typeof IMAGE_TYPES)[number],
        });
        await ctx.runMutation(internal.coachTonePreviewStore.finish, {
          adminUserId: userId,
          attemptId: ids[index + 2],
          status: result.ok ? 'ready' : 'failed',
          errorCode: result.ok ? undefined : result.code,
          inputTokens: result.ok ? result.inputTokens : undefined,
          outputTokens: result.ok ? result.outputTokens : undefined,
          latencyMs: result.latencyMs,
        });
        meal.push(result);
      }
    }
    return {
      status: 'ready' as const,
      currentVersion: current.version,
      promptVersions: { daily: DAILY_PLAN_V2_PROMPT_VERSION, meal: MEAL_PROMPT_VERSION },
      sampleMeal: {
        key: sampleKey,
        label: sampleLabel,
        imageUrl:
          mealAvailable && imageId
            ? ((await ctx.storage.getUrl(imageId as Id<'_storage'>)) ?? undefined)
            : undefined,
      },
      daily: { current: daily[0]!, selected: daily[1]! },
      meal: mealAvailable
        ? { status: 'ready' as const, current: meal[0]!, selected: meal[1]! }
        : { status: 'unavailable' as const, reason: mealUnavailableReason },
    };
  },
});
