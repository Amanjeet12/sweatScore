import { authTables } from '@convex-dev/auth/server';
import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

const schema = defineSchema({
  ...authTables,
  users: defineTable({
    name: v.optional(v.string()),
    image: v.optional(v.id('_storage')),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    birthdate: v.optional(v.number()),
    expoPushToken: v.optional(v.string()),
    onboarded: v.optional(v.boolean()),
    isAdmin: v.optional(v.boolean()),
    timezone: v.optional(v.string()),
    lastSyncDate: v.optional(v.number()),
    activityGoal: v.optional(v.string()),
    notificationEnabled: v.optional(v.boolean()),
    commentNotificationEnabled: v.optional(v.boolean()),
    autoSyncEnabled: v.optional(v.boolean()),
    lastActiveAt: v.optional(v.number()),
    platform: v.optional(v.string()),
    appVersion: v.optional(v.string()),
    isPremium: v.optional(v.boolean()),
    enduranceZoneLoginUrl: v.optional(v.string()),
    enduranceZoneIdentifier: v.optional(v.string()),
    enduranceZoneLevel: v.optional(
      v.union(
        v.literal('Basic'),
        v.literal('Basic Plus'),
        v.literal('Premium'),
        v.literal('Premium Plus')
      )
    ),
    countryCode: v.optional(v.string()),
  })
    .index('email', ['email'])
    .index('isAdmin', ['isAdmin'])
    .index('notificationEnabled', ['notificationEnabled'])
    .index('onboarded', ['onboarded'])
    .index('isPremium', ['isPremium']),
  dailyActivities: defineTable({
    userId: v.id('users'),
    date: v.string(), // YYYY-MM-DD format
    steps: v.number(),
    zone2Minutes: v.optional(v.number()), // Minutes spent in Zone 2 or above
    points: v.number(), // Calculated based on activity metrics
    stepsTill11am: v.optional(v.number()),
    displayTotalPoints: v.optional(v.number()),
    missionPoints: v.optional(v.number()),
    synced: v.boolean(), // Whether this was synced from health app or manually entered
    reviewedBy: v.optional(v.id('users')), // The user who approved the activity
    reviewedAt: v.optional(v.number()), // The timestamp when the activity was approved
    reviewStatus: v.optional(v.union(v.literal('approved'), v.literal('rejected'))), // The status of the approval
    image: v.optional(v.id('_storage')),
  })
    .index('by_user_date', ['userId', 'date'])
    .index('by_user', ['userId'])
    .index('by_user_date_synced', ['userId', 'date', 'synced'])
    .index('by_date', ['date'])
    .index('by_review_status_synced', ['reviewStatus', 'synced']),
  monthlyLeaderboard: defineTable({
    userId: v.id('users'),
    yearMonth: v.string(), // YYYY-MM format
    totalPoints: v.number(),
    displayTotalPoints: v.optional(v.number()),
    rank: v.optional(v.number()),
  })
    .index('by_year_month_and_points', ['yearMonth', 'totalPoints'])
    .index('by_year_month_display_points_total_points', [
      'yearMonth',
      'displayTotalPoints',
      'totalPoints',
    ])
    .index('by_year_month_and_rank', ['yearMonth', 'rank'])
    .index('by_user_and_year_month', ['userId', 'yearMonth']),
  creators: defineTable({
    userId: v.id('users'),
    name: v.string(),
    posterImage: v.optional(v.id('_storage')),
    description: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    sortOrder: v.optional(v.number()),
    isPremium: v.optional(v.boolean()),
  }).index('by_sort_order', ['sortOrder']),
  creatorVideos: defineTable({
    creatorId: v.id('creators'),
    title: v.string(),
    subtitle: v.string(),
    youtubeUrl: v.string(),
    order: v.number(),
    isActive: v.optional(v.boolean()),
    description: v.optional(v.string()),
    difficulty: v.optional(v.union(v.literal('easy'), v.literal('medium'), v.literal('hard'))),
    equipment: v.optional(v.string()),
    category: v.optional(v.string()),
  }),
  userCheckIns: defineTable({
    userId: v.id('users'),
    date: v.string(), // YYYY-MM-DD format
    points: v.number(),
  })
    .index('by_user_date', ['userId', 'date'])
    .index('by_user', ['userId'])
    .index('by_date', ['date']),
  notificationHistory: defineTable({
    userId: v.id('users'),
    date: v.string(), // YYYY-MM-DD format
    notificationType: v.string(),
    notificationBody: v.string(),
  })
    .index('by_user_date', ['userId', 'date'])
    .index('by_user', ['userId'])
    .index('by_user_date_notification_type', ['userId', 'date', 'notificationType']),
  claimedRewards: defineTable({
    userId: v.id('users'),
    yearMonth: v.string(), // YYYY-MM format
    claimedPoints: v.number(),
    totalEntries: v.number(),
  }).index('by_user_and_year_month', ['userId', 'yearMonth']),
  rewardsBannerImage: defineTable({
    image: v.id('_storage'),
    title: v.optional(v.string()),
    targetPoints: v.optional(v.number()),
  }),
  posts: defineTable({
    userId: v.id('users'),
    createdAt: v.number(),
    body: v.string(),
    media: v.optional(v.union(v.id('_storage'), v.null())),
    mediaWidth: v.optional(v.union(v.number(), v.null())),
    mediaHeight: v.optional(v.union(v.number(), v.null())),
    mediaType: v.optional(v.string()),
    mediaThumbnail: v.optional(v.union(v.id('_storage'), v.null())),
    isPinned: v.optional(v.boolean()),
    challengeId: v.optional(v.id('challenges')),
    challengeCompletionId: v.optional(v.id('challengeCompletions')),
  })
    .index('by_user', ['userId'])
    .index('by_pinned', ['isPinned']),
  postComments: defineTable({
    postId: v.id('posts'),
    userId: v.id('users'),
    createdAt: v.number(),
    body: v.string(),
  })
    .index('by_post', ['postId'])
    .index('by_post_user', ['postId', 'userId']),
  postLikes: defineTable({
    postId: v.id('posts'),
    userId: v.id('users'),
    likeIcon: v.optional(v.union(v.literal('heart'), v.literal('fire'), v.literal('clap'))),
    createdAt: v.number(),
  })
    .index('by_post', ['postId'])
    .index('by_post_user', ['postId', 'userId']),
  postReports: defineTable({
    postId: v.id('posts'),
    userId: v.id('users'),
    createdAt: v.number(),
    description: v.optional(v.string()),
  })
    .index('by_post', ['postId'])
    .index('by_post_user', ['postId', 'userId']),
  blockedUsers: defineTable({
    userId: v.id('users'),
    blockedUserId: v.id('users'),
    createdAt: v.number(),
    description: v.optional(v.string()),
  })
    .index('by_user', ['userId'])
    .index('by_blocked_user', ['blockedUserId'])
    .index('by_user_blocked_user', ['userId', 'blockedUserId']),
  commentReports: defineTable({
    commentId: v.id('postComments'),
    userId: v.id('users'),
    createdAt: v.number(),
    description: v.optional(v.string()),
  })
    .index('by_comment', ['commentId'])
    .index('by_comment_user', ['commentId', 'userId']),
  dailyChallengesList: defineTable({
    day: v.number(), // 1-31
    challengeType: v.union(
      v.literal('steps'),
      v.literal('sweat'),
      v.literal('points'),
      v.literal('powerboost'),
      v.literal('rest'),
      v.literal('double')
    ),
    target: v.optional(v.number()),
    bonusPoints: v.optional(v.number()),
    pushCopy: v.string(),
    inAppCopy: v.string(),
  }).index('by_day', ['day']),
  challenges: defineTable({
    name: v.string(),
    description: v.string(),
    createdBy: v.string(),
    coverImage: v.id('_storage'),
    instructionalVideo: v.id('_storage'),
    videoDuration: v.optional(v.number()), // Actual video runtime in seconds
    youtubeUrl: v.optional(v.string()),
    points: v.number(),
    durationLimit: v.number(),
    tag: v.string(),
    isLocked: v.boolean(),
    endDate: v.optional(v.string()),
    isPublished: v.boolean(),
    createdByUserId: v.id('users'),
    totalCompletions: v.optional(v.number()),
    isDailyChallenge: v.optional(v.boolean()),
    dailyStartAt: v.optional(v.number()),
    dailyEndAt: v.optional(v.number()),
    shortDescription: v.optional(v.string()),
    type: v.optional(v.union(v.literal('challenge'), v.literal('check_in'))),
    checkInDescription: v.optional(v.string()),
    dailyChallengeType: v.optional(v.union(v.literal('challenge'), v.literal('check_in'))),
  })
    .index('by_daily_challenge', ['isDailyChallenge'])
    .index('by_published', ['isPublished'])
    .index('by_tag', ['tag'])
    .index('by_endDate', ['endDate']),
  challengeCompletions: defineTable({
    userId: v.id('users'),
    challengeId: v.id('challenges'),
    date: v.string(),
    pointsEarned: v.number(),

    // User's personal uploaded video
    videoStorageId: v.optional(v.id('_storage')),

    // Generated transformation/composite video
    compositeVideoStorageId: v.optional(v.id('_storage')),
    thumbnailStorageId: v.optional(v.id('_storage')),

    // New transformation tracking fields
    attemptNumber: v.optional(v.number()),
    day1CompletionId: v.optional(v.id('challengeCompletions')),
    comparisonBaseVideoStorageId: v.optional(v.id('_storage')),
    comparisonMode: v.optional(v.union(v.literal('day1_baseline'), v.literal('day1_vs_current'))),

    allowRepost: v.optional(v.boolean()),
    caption: v.optional(v.string()),
    removed: v.optional(v.boolean()),
    dailyWindowStartAt: v.optional(v.number()),
  })
    .index('by_user_date', ['userId', 'date'])
    .index('by_user_challenge_date', ['userId', 'challengeId', 'date'])
    .index('by_challenge_date', ['challengeId', 'date'])
    .index('by_user_challenge_window', ['userId', 'challengeId', 'dailyWindowStartAt'])
    .index('by_user', ['userId']),

  appConfig: defineTable({
    key: v.string(),
    value: v.string(),
  }).index('by_key', ['key']),
  featureFlags: defineTable({
    userId: v.id('users'),
    featureFlag: v.union(v.literal('mission')),
    enabled: v.boolean(),
  }).index('by_user_feature_flag', ['userId', 'featureFlag']),
  trackDaily: defineTable({
    userId: v.id('users'),
    date: v.string(),
    yearMonth: v.string(),
    yearWeek: v.string(),
    steps: v.number(),
    activeMinutes: v.number(),
    moves: v.number(),
    points: v.number(),
    targetMet: v.boolean(),
    updatedAt: v.number(),
    dailyCheckIns: v.optional(v.number()),
  })
    .index('by_user_date', ['userId', 'date'])
    .index('by_user_yearWeek', ['userId', 'yearWeek'])
    .index('by_user_yearMonth', ['userId', 'yearMonth']),
  trackWeekly: defineTable({
    userId: v.id('users'),
    yearWeek: v.string(),
    weekStart: v.string(),
    yearMonthOfStart: v.string(),
    year: v.string(),
    steps: v.number(),
    activeMinutes: v.number(),
    moves: v.number(),
    points: v.number(),
    daysMet: v.number(),
    targetDaysGoal: v.number(),
    streakWeek: v.boolean(),
    updatedAt: v.number(),
  })
    .index('by_user_yearWeek', ['userId', 'yearWeek'])
    .index('by_user_weekStart', ['userId', 'weekStart'])
    .index('by_user_yearMonthOfStart', ['userId', 'yearMonthOfStart']),
  trackMonthly: defineTable({
    userId: v.id('users'),
    yearMonth: v.string(),
    year: v.string(),
    steps: v.number(),
    activeMinutes: v.number(),
    moves: v.number(),
    points: v.number(),
    updatedAt: v.number(),
  })
    .index('by_user_yearMonth', ['userId', 'yearMonth'])
    .index('by_user_year', ['userId', 'year']),
  trackLifetime: defineTable({
    userId: v.id('users'),
    steps: v.number(),
    activeMinutes: v.number(),
    moves: v.number(),
    points: v.number(),
    longestWeeklyStreak: v.number(),
    currentWeeklyStreak: v.number(),
    firstActiveDate: v.optional(v.string()),
    lastActiveDate: v.optional(v.string()),
    updatedAt: v.number(),
  }).index('by_user', ['userId']),
  appVersionConfig: defineTable({
    platform: v.union(v.literal('ios'), v.literal('android')),
    latestVersion: v.string(),
    minVersion: v.string(),
    storeUrl: v.string(),
    updatedAt: v.number(),
  }).index('by_platform', ['platform']),
});

export default schema;
