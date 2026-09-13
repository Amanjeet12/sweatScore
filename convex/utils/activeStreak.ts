/** Consecutive earned weeks ending this week or last week; an unfinished current week is allowed. */
export function countActiveWeeks(
  weeks: { weekStart: string; streakWeek: boolean }[],
  currentMonday: string
): number {
  const earned = new Set(weeks.filter((week) => week.streakWeek).map((week) => week.weekStart));
  const cursor = new Date(`${currentMonday}T00:00:00.000Z`);
  if (!earned.has(currentMonday)) cursor.setUTCDate(cursor.getUTCDate() - 7);
  let count = 0;
  while (earned.has(cursor.toISOString().slice(0, 10))) {
    count += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 7);
  }
  return count;
}
