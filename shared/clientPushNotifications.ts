export const clientNotificationContents = {
  newAdminPost: {
    title: 'Someone just posted in the community 🙌',
    body: "Come and see what's new 💛",
  },
  newPostLiked: { title: '{userName} liked your post ❤️', body: 'Tap to see it 👀' },
  todayPlanQuestions: {
    title: "Let's prepare today's plan, sis ✨",
    body: "Answer today's questions to get your plan 🧡",
  },
  todayPlanReady: {
    title: "Today's plan is ready, sis ✨",
    body: "Tap in to see what's on the menu 🧡",
  },
  challengeStartsTomorrow: {
    title: 'New challenge starts tomorrow 🚀',
    body: "Get in on the fun. There's points to be earned ✨",
  },
  weeklyProgressPhotoDue: {
    title: 'Time for your weekly progress log',
    body: 'Watch your transformation build over time 🧡',
  },
  newMonth: { title: "It's a new month 🌟", body: "Fresh start. Let's earn those points 🔥" },
} as const;
export type ClientNotificationType = keyof typeof clientNotificationContents;

export function localNotificationClock(now: number, timezone: string) {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(now);
    const get = (key: string) => parts.find((part) => part.type === key)!.value;
    const date = `${get('year')}-${get('month')}-${get('day')}`;
    const midnight = new Date(`${date}T00:00:00Z`);
    const weekday = midnight.getUTCDay();
    const monday = new Date(midnight);
    monday.setUTCDate(monday.getUTCDate() - (weekday === 0 ? 6 : weekday - 1));
    const tomorrow = new Date(midnight);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    return {
      date,
      hour: Number(get('hour')),
      minute: Number(get('minute')),
      weekday,
      weekStart: monday.toISOString().slice(0, 10),
      tomorrow: tomorrow.toISOString().slice(0, 10),
    };
  } catch {
    return null;
  }
}

export function commentNotificationPreview(body: string) {
  return (
    body
      .split(/\r?\n/)[0]
      .replace(/[\u0000-\u001f\u007f]/g, ' ')
      .trim()
      .slice(0, 180) || 'Tap to see the comment 💬'
  );
}
