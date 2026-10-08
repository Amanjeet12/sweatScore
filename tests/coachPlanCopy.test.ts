import { expect, test } from 'bun:test';

import { cleanDailyPlanCopy } from '../shared/coachPlanCopy';

test('daily plan copy removes AI quotation marks and dashes but preserves contractions', () => {
  expect(cleanDailyPlanCopy('“You’ve got this today!”')).toBe('You’ve got this today!');
  expect(cleanDailyPlanCopy('Rest today."')).toBe('Rest today.');
  expect(cleanDailyPlanCopy("You're ready — keep it steady.")).toBe(
    "You're ready, keep it steady."
  );
  expect(cleanDailyPlanCopy('Aim for 2.5 litres of water.')).toBe('Aim for 2.5 litres of water.');
});
