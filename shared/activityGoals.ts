// Existing activity chart goals: daily bars in Week, weekly in Month, monthly in Year.
export const ORANGE = '#F76B1C';
export const GREY = '#D9D9D9';

export const TARGETS = {
  week: {
    points: 10,
    steps: 5000,
    activeMinutes: 30,
    moves: 1,
  },

  month: {
    points: 125,
    steps: 35000,
    activeMinutes: 150,
    moves: 5,
  },

  year: {
    points: 500,
    steps: 140000,
    activeMinutes: 600,
    moves: 20,
  },
};

export function getBarColor(
  period: keyof typeof TARGETS,
  category: keyof (typeof TARGETS)['week'],
  value: number
): string {
  const target = TARGETS[period]?.[category];

  if (!target) {
    return value > 0 ? ORANGE : GREY;
  }

  return value >= target ? ORANGE : GREY;
}
