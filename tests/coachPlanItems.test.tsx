// @ts-nocheck -- Render the shared native layout with inert host elements; no device or backend writes.
import { expect, mock, test } from 'bun:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const host =
  (tag) =>
  ({ children, onPress, disabled, ...props }) =>
    React.createElement(tag, { 'data-disabled': disabled }, children);
mock.module('react-native', () => ({
  View: host('div'),
  TouchableOpacity: host('button'),
  Alert: { alert: () => {} },
  Linking: { openURL: async () => {} },
}));
mock.module('../components/ui/text', () => ({ Text: host('span') }));
mock.module('../components/core/design/prototypeStyles', () => ({ prototypeTypography: {} }));
mock.module('phosphor-react-native', () =>
  Object.fromEntries(
    [
      'Barbell',
      'Check',
      'Footprints',
      'ForkKnife',
      'MoonStars',
      'MagnifyingGlass',
      'YoutubeLogo',
    ].map((name) => [name, () => React.createElement('i', { 'data-icon': name })])
  )
);
const { default: CoachPlanItems } = await import('../components/core/dashboard/CoachPlanItems');
const plan = {
  stepTarget: 9000,
  output: {
    headline: 'Good day to push a little.',
    workout: '45-minute full body strength workout. An individual explanation.',
    steps: 'A longer steps explanation.',
    meals: 'Chicken with vegetables, 2 litres of water.',
    sleep: 'Aim for 7 hours again tonight. Another explanation.',
    why: 'Overall explanation belongs after YouTube.',
  },
};
const checkIns = {
  status: 'ready',
  assignments: [
    { category: 'workout', label: '45-minute full body strength workout', consumedCount: 0 },
    { category: 'steps', consumedCount: 1 },
    { category: 'meals', consumedCount: 1 },
    { category: 'sleep', consumedCount: 0 },
  ],
};
const render = (saved, current = checkIns) =>
  renderToStaticMarkup(
    React.createElement(CoachPlanItems, { plan: saved, checkIns: current, onCheckIn: () => {} })
  );

test('shared plan shows four short recommendations and indicators, then YouTube', () => {
  const html = render(plan);
  const positions = ['Workout', 'Steps', 'Meals', 'Sleep', 'Find your workout on YouTube'].map(
    (text) => html.indexOf(text)
  );
  expect(positions.every((n) => n >= 0)).toBe(true);
  expect(positions).toEqual([...positions].sort((a, b) => a - b));
  expect(html).toContain('9,000 steps');
  expect(html).toContain('Chicken with vegetables, 2 litres of water.');
  expect(html.match(/data-icon="Check"/g)).toHaveLength(2);
  for (const removed of [
    'Not logged yet',
    'Logged today',
    'An individual explanation',
    'Another explanation',
    'A longer steps explanation',
  ]) {
    expect(html).not.toContain(removed);
  }
});

test('a refreshed recommendation preserves existing check marks', () => {
  const pendingHtml = render(plan);
  const refreshedHtml = render({
    ...plan,
    stepTarget: 6500,
    output: { ...plan.output, sleep: 'Aim for 8 hours tonight. Reason for change.' },
  });
  expect(pendingHtml).toContain('9,000 steps');
  expect(refreshedHtml).toContain('6,500 steps');
  expect(refreshedHtml).toContain('Aim for 8 hours tonight.');
  expect(refreshedHtml).not.toContain('Reason for change');
  expect(refreshedHtml.match(/data-icon="Check"/g)).toHaveLength(2);
});
