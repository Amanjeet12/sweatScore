export type LeaderboardPeriod = 'month' | 'week' | 'today';

export function formatLocalDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export function getPeriodWindow(period: LeaderboardPeriod, now: Date) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const month = String(today.getMonth() + 1).padStart(2, '0');
  let start = today;

  if (period === 'month') {
    start = new Date(today.getFullYear(), today.getMonth(), 1);
  } else if (period === 'week') {
    const dayOfWeek = today.getDay();
    const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    start = new Date(today);
    start.setDate(today.getDate() - daysSinceMonday);
  }

  return {
    startDate: formatLocalDate(start),
    endDate: formatLocalDate(today),
    yearMonth: `${today.getFullYear()}-${month}`,
  };
}

export function getTimeLeft(period: LeaderboardPeriod, now: Date) {
  if (period === 'month') {
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const days = lastDay - now.getDate() + 1;

    return `${days} ${days === 1 ? 'day' : 'days'} left`;
  }

  if (period === 'week') {
    const dayOfWeek = now.getDay();
    const days = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;

    return `${days} ${days === 1 ? 'day' : 'days'} left`;
  }

  const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const minutesLeft = Math.max(1, Math.ceil((nextMidnight.getTime() - now.getTime()) / 60_000));
  const hours = Math.floor(minutesLeft / 60);
  const minutes = minutesLeft % 60;

  if (hours <= 0) return `${minutes} min left`;
  if (minutes === 0) return `${hours} ${hours === 1 ? 'hour' : 'hours'} left`;

  return `${hours}h ${minutes}m left`;
}
