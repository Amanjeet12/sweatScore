// @ts-nocheck -- Bun test-only presentation fixtures.
import { describe, expect, test } from 'bun:test';

import { checkInGuide } from '../shared/coachCheckInPresentation';

const detailsV2 = {
  workoutExamples: ['wall push-ups', 'seated rows'],
  workoutReason: 'Your legs can recover while you use your upper body.',
  stepsReason: 'This target fits your lighter day.',
};

describe('plan-derived check-in presentation', () => {
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
