// @ts-nocheck -- Bun test-only presentation fixtures.
import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

import { canStartCoachLivePhoto, checkInGuide } from '../shared/coachCheckInPresentation';
import { COACH_CATEGORIES } from '../shared/coachFoundation';

const detailsV2 = {
  workoutExamples: ['wall push-ups', 'seated rows'],
  workoutReason: 'Your legs can recover while you use your upper body.',
  stepsReason: 'This target fits your lighter day.',
};

describe('plan-derived check-in presentation', () => {
  test('all four eligible categories use one live-camera entry rule', () => {
    for (const category of COACH_CATEGORIES) {
      expect(
        canStartCoachLivePhoto(
          category,
          'details',
          'ready',
          { mandatory: true, consumedCount: 0 },
          false
        )
      ).toBe(true);
      expect(
        canStartCoachLivePhoto(
          category,
          'post',
          'ready',
          { mandatory: true, consumedCount: 0 },
          false
        )
      ).toBe(false);
      expect(
        canStartCoachLivePhoto(
          category,
          'details',
          'locked',
          { mandatory: true, consumedCount: 0 },
          false
        )
      ).toBe(false);
      expect(
        canStartCoachLivePhoto(
          category,
          'details',
          'ready',
          { mandatory: true, consumedCount: 0 },
          true
        )
      ).toBe(false);
      expect(
        canStartCoachLivePhoto(
          category,
          'details',
          'ready',
          { mandatory: false, consumedCount: 0 },
          false
        )
      ).toBe(false);
    }
    expect(
      canStartCoachLivePhoto(
        'workout',
        'details',
        'ready',
        { mandatory: true, consumedCount: 1 },
        false
      )
    ).toBe(false);
    expect(
      canStartCoachLivePhoto(
        'sleep',
        'details',
        'ready',
        { mandatory: true, consumedCount: 1 },
        false
      )
    ).toBe(false);
    expect(
      canStartCoachLivePhoto(
        'steps',
        'details',
        'ready',
        { mandatory: true, consumedCount: 1 },
        false
      )
    ).toBe(false);
    expect(
      canStartCoachLivePhoto(
        'meals',
        'details',
        'ready',
        { mandatory: true, consumedCount: 2 },
        false
      )
    ).toBe(true);
    expect(
      canStartCoachLivePhoto(
        'meals',
        'details',
        'ready',
        { mandatory: true, consumedCount: 3 },
        false
      )
    ).toBe(false);
  });

  test('one shared camera row replaces redundant footer actions without changing posting', () => {
    const source = readFileSync(
      new URL('../components/core/dashboard/CoachCheckInFlow.tsx', import.meta.url),
      'utf8'
    );
    expect(source.match(/>\s*Take live photo\s*</g)).toHaveLength(1);
    expect(source).toContain('Use the in-app camera');
    expect(source).toContain('onPress={start}');
    expect(source).toContain('canStartCoachLivePhoto(');
    expect(source).not.toContain('Start live proof');
    expect(source).not.toContain('Cancel capture');
    expect(source).not.toContain('Cancel camera');
    expect(source).toContain('accessibilityLabel="Close check-in"');
    expect(source).toContain('onPress={closeSheet}');
    expect(source).toContain('Linking.openURL(workoutSearch.url)');
    expect(source).toContain("category === 'meals'");
    expect(source).toContain('placeholder="Add a caption"');
    expect(source).toContain('Retake photo');
    expect(source).toContain('publishProof');
    expect(source).toContain('publishMeal');
    expect(source).not.toContain('api.coachCheckIns.cancel');
    expect(source).toContain("if (mode === 'details' && !closing.current) onCaptured?.()");
  });
  test('separates a v2 workout into title, suggested moves and reason', () => {
    const guide = checkInGuide('workout', {
      label: '20-minute upper body workout',
      recommendation: 'Long combined provider copy',
      detailsV2,
    });
    expect(guide.title).toBe('20-minute upper body workout');
    expect(guide.recommendation).toBeNull();
    expect(guide.examples).toEqual(['wall push-ups', 'seated rows']);
    expect(guide.reason).toContain('legs can recover');
  });

  test('keeps a started submission pinned after a plan refresh', () => {
    const guide = checkInGuide(
      'workout',
      {
        label: '30-minute lower body workout',
        recommendation: 'New plan',
        detailsV2: { ...detailsV2, workoutExamples: ['chair squats'] },
      },
      {
        label: '20-minute upper body workout',
        recommendation: 'Original plan',
        detailsV2,
      }
    );
    expect(guide.title).toBe('20-minute upper body workout');
    expect(guide.examples).toEqual(['wall push-ups', 'seated rows']);
  });

  test('renders historical v1 text and retains the canonical step target', () => {
    expect(
      checkInGuide('workout', { label: 'Rest today', recommendation: 'Take a rest day.' })
        .recommendation
    ).toBe('Take a rest day.');
    const steps = checkInGuide('steps', {
      label: '5,000 steps',
      recommendation: 'A longer step recommendation',
      stepTarget: 5000,
      detailsV2,
    });
    expect(steps.title).toBe('5,000 steps');
    expect(steps.stepTarget).toBe(5000);
    expect(steps.reason).toBe(detailsV2.stepsReason);
  });
});
