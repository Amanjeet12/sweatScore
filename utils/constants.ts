import AppleHealthKit, { HealthKitPermissions } from 'react-native-health';

export const colors = {
  primary: '#FF5C1A',
  accent: '#FF5C1A',
  gold: '#ffd700',
  silver: '#c0c0c0',
  bronze: '#cd7f32',
  success: '#008000',
  error: '#FF0000',
  secondary: '#65c6eb',
  warning: '#FFA500',
  background: '#F9F9F9',
  nearBlack: '#1A1A1A',
  darkCharcoal: '#313131',
  warmBrown: '#838383',
  cardWhite: '#FFFFFF',
  progressTrack: '#EEEAE5',
};

export const activityGoals = [
  'Rebuild my routine',
  'Get stronger',
  'Feel more confident',
  'Ease some stress',
  'Make fitness fun again',
  'Stay accountable',
];

export const motivationQuotes = {
  rank1: [
    "You're #1. The math is mathing. The glow is glowing. Keep that crown tight. 👑🔥",
    "Top of the board and top-tier effort. You didn't come to play — you came to collect. ⚡📈",
    "#1 energy only. But don't blink — they're coming for that top spot. 👀⏳",
    "This ain't luck — it's logged steps and showed-up days. Keep leading, queen. 🚶‍♀️✨",
    "You're number one. Just in case no one said it today — I'm proud of you. 💛👏",
  ],
  top3: [
    "Top 3? Say less. You're clearly that girl. ✨📊",
    "There's effort in that leaderboard glow. You've got it. 🔥💃",
    "You're top 3 right now. The finish line isn't even the point — this moment is. ⏱🌟",
    "You're in the top 3 — and it's giving 'I keep promises to myself.' 💪💫",
    'Close enough to #1 to feel the heat. Stay in your lane and keep cooking. 🍳🏁',
  ],
  top10: [
    'Top 10 status = earned. Keep stacking those small wins. 🧱🏆',
    "You're not just moving — you're making moves. Top 10 and climbing. 🚶‍♀️➡️🚀",
    "This is what 'quietly doing the work' looks like. You're in the top 10, sis. 🤫⚡",
    "Top 10. You're more consistent than half the internet. 📲🔥",
    "Still holding top 10. You're not just talking about it — you're being about it. 🧠💥",
  ],
  outsideTop10: [
    "Some weeks you lead. Some weeks you just don't quit. Both matter. ❤️⏳",
    "You're still here. Still trying. Still pushing. That counts more than you know. 🔄💥",
    'Slow progress > no progress. Keep choosing yourself. 🧘‍♀️🌱',
    "You don't need to catch up. You just need to not give up. 💡🚶‍♀️",
    'Still here. Still showing up. That matters more than you think. 🛠️',
    "You're not out of the game — you're just in the part that takes grit. ⚙️",
    "If today's all you've got in you — that's still something. Use it. 📍",
    "Quiet effort still counts. You don't have to go big — just don't go missing. 👣",
    "This isn't about motivation. It's about showing up — even when it's boring, hard, or slow. ⏳",
  ],
};

export const leaderboardThreshold = 10;

export const healthPermissions = {
  permissions: {
    read: [
      AppleHealthKit.Constants.Permissions.StepCount,
      AppleHealthKit.Constants.Permissions.HeartRate,
    ],
    write: [],
  },
} as HealthKitPermissions;

export const healthPermissionsAndroid = [
  { accessType: 'read' as const, recordType: 'Steps' as const },
  { accessType: 'read' as const, recordType: 'HeartRate' as const },
];

export const externalLinks = {
  whatsappSupport: 'https://wa.me/447495584972',
  startEarningPoints:
    'https://support.sweatscore.com/en/help/articles/4312979-droplet-how-to-earn-sweat-points',
  rewardsPage: 'https://sweatscore.com/rewards',
  requestPayout: 'https://forms.gle/WKzPRCk5DTKsAxnK7',
};

export const rankToCashMapping: Record<number, number> = {
  1: 230,
  2: 180,
  3: 140,
  4: 110,
  5: 90,
  6: 70,
  7: 60,
  8: 50,
  9: 40,
  10: 30,
};
