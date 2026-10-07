export enum ALL_TABS {
  DASHBOARD = 'dashboard',
  NOTIFICATIONS = 'notifications',
  SETTINGS = 'settings',
  REWARDS = 'rewards',
  WORKOUTS = 'workouts',
  HUB = 'hub',
  SHARE = 'share',
}

export enum PROFILE_FIELD {
  FULL_NAME = 'Name',
  BIRTHDATE = 'Birthdate',
}

export enum NOTIFICATION_TYPE {
  NEW_ACTIVITY_SUBMITTED = 'newActivitySubmitted',

  NEW_ACTIVITY_APPROVED = 'newActivityApproved',

  NEW_ACTIVITY_REJECTED = 'newActivityRejected',

  NEW_REWARD_CLAIMED = 'newRewardClaimed',

  NEW_REWARD_UNLOCKED_500 = 'newRewardUnlocked500',

  NEW_REWARD_UNLOCKED_250 = 'newRewardUnlocked250',

  NEW_REWARD_UNLOCKED_100 = 'newRewardUnlocked100',

  NEW_COMMENT_POSTED = 'newCommentPosted',
  NEW_POST_LIKED = 'newPostLiked',
  TODAY_PLAN_READY = 'todayPlanReady',
  TODAY_PLAN_QUESTIONS = 'todayPlanQuestions',
  CHALLENGE_STARTS_TOMORROW = 'challengeStartsTomorrow',
  WEEKLY_PROGRESS_PHOTO_DUE = 'weeklyProgressPhotoDue',
  NEW_MONTH = 'newMonth',

  NEW_ADMIN_POST = 'newAdminPost',

  NO_ACTIVITY_REMINDER = 'noActivityReminder',

  CHALLENGE_POST_LIVE = 'challengePostLive',

  VIDEO_FEED_LIVE = 'videoFeedLive',

  NEW_CHAT_MESSAGE = 'newChatMessage',
}

export interface PreviewData {
  description?: string;
  image?: PreviewDataImage;
  link?: string;
  title?: string;
}

export interface PreviewDataImage {
  height: number;
  url: string;
  width: number;
}

export interface Size {
  height: number;
  width: number;
}

export enum CHALLENGE_TYPE {
  STEPS = 'steps',
  SWEAT = 'sweat',
  POINTS = 'points',
  POWERBOOST = 'powerboost',
  REST = 'rest',
  DOUBLE = 'double',
}
