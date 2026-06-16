# SweatScore Technical Document

**Version:** 1.0
**Last Updated:** January 2026
**Purpose:** Complete technical reference for project

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Technology Stack](#2-technology-stack)
3. [Architecture Overview](#3-architecture-overview)
4. [Directory Structure](#4-directory-structure)
5. [Database Schema](#5-database-schema)
6. [Authentication System](#6-authentication-system)
7. [Core Features & Business Logic](#7-core-features--business-logic)
8. [Health Data Integration](#8-health-data-integration)
9. [State Management](#9-state-management)
10. [Navigation & Routing](#10-navigation--routing)
11. [Component Architecture](#11-component-architecture)
12. [Backend Functions (Convex)](#12-backend-functions-convex)
13. [Push Notifications](#13-push-notifications)
14. [Scheduled Jobs (Crons)](#14-scheduled-jobs-crons)
15. [Design System](#15-design-system)
16. [Environment Configuration](#16-environment-configuration)
17. [Development Workflow](#17-development-workflow)
18. [Testing Strategy](#18-testing-strategy)
19. [Deployment Process](#19-deployment-process)
20. [Third-Party Integrations](#20-third-party-integrations)
21. [Admin Features](#21-admin-features)
22. [Known Issues & Technical Debt](#22-known-issues--technical-debt)
23. [Onboarding Checklist](#23-onboarding-checklist)

---

## 1. Project Overview

### What is SweatScore?

SweatScore is a fitness gamification mobile application that transforms daily physical activity into a competitive, rewarding experience. The app syncs with device health data (Apple Health on iOS, Google Health Connect on Android) and converts activity metrics into points that fuel real-time leaderboards.

### Key Value Propositions

- **Health Sync**: Automatic synchronization with native health apps
- **Gamification**: Points system, leaderboards, daily missions, rewards
- **Social Features**: Feed, comments, likes, creator workout videos
- **Premium Features**: RevenueCat-powered subscriptions

### Target Platforms

| Platform | Technology | Health Integration |
|----------|------------|-------------------|
| iOS | React Native (Expo) | Apple HealthKit via `react-native-health` |
| Android | React Native (Expo) | Health Connect via `expo-health-connect` |
| Web | React Native Web | No health sync (manual entry only) |

---

## 2. Technology Stack

### Frontend

| Technology | Version | Purpose |
|------------|---------|---------|
| React Native | 0.76.9 | Cross-platform mobile framework |
| Expo | SDK 52 | Development platform & build tooling |
| Expo Router | v4 | File-based navigation |
| NativeWind | v4 | Tailwind CSS for React Native |
| Zustand | 4.5.1 | Global state management |
| Gluestack UI | Latest | Component library |
| TypeScript | 5.3.3 | Type safety |

### Backend

| Technology | Purpose |
|------------|---------|
| Convex | Real-time BaaS (database, functions, auth) |
| Convex Auth | Email OTP authentication |
| Nodemailer | SMTP email delivery |

### Integrations

| Service | Purpose |
|---------|---------|
| RevenueCat | In-app purchases & subscriptions |
| Expo Notifications | Push notification delivery |
| MailerLite | Newsletter/email marketing |
| YouTube | Creator workout video embedding |

### Development Tools

| Tool | Purpose |
|------|---------|
| Bun | Package manager & runtime |
| ESLint | Code linting |
| Prettier | Code formatting |
| EAS | Expo Application Services (builds) |

---

## 3. Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Mobile App (Expo)                        │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐│
│  │  Screens │  │Components│  │  Hooks   │  │ State (Zustand)  ││
│  │(app/*)   │  │(core/ui) │  │          │  │                  ││
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────────┬─────────┘│
│       │             │             │                  │          │
│       └─────────────┴─────────────┴──────────────────┘          │
│                              │                                  │
│  ┌───────────────────────────┴───────────────────────────────┐ │
│  │                    Convex React Client                     │ │
│  │           (useQuery, useMutation, useAction)               │ │
│  └───────────────────────────┬───────────────────────────────┘ │
└──────────────────────────────┼──────────────────────────────────┘
                               │ WebSocket (Real-time)
┌──────────────────────────────┼──────────────────────────────────┐
│                        Convex Backend                           │
├──────────────────────────────┼──────────────────────────────────┤
│  ┌───────────────────────────┴───────────────────────────────┐ │
│  │              Queries / Mutations / Actions                 │ │
│  └───────────────────────────┬───────────────────────────────┘ │
│                              │                                  │
│  ┌──────────────┐  ┌─────────┴────────┐  ┌──────────────────┐  │
│  │   Cron Jobs  │  │ Database (Tables)│  │  File Storage    │  │
│  └──────────────┘  └──────────────────┘  └──────────────────┘  │
│                              │                                  │
│  ┌───────────────────────────┴───────────────────────────────┐ │
│  │               HTTP Endpoints / Actions                     │ │
│  │          (Email, External API calls, Webhooks)             │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                               │
            ┌──────────────────┼──────────────────┐
            │                  │                  │
    ┌───────┴───────┐  ┌───────┴───────┐  ┌──────┴──────┐
    │    SMTP       │  │  RevenueCat   │  │ MailerLite  │
    │   (Email)     │  │ (Payments)    │  │ (Marketing) │
    └───────────────┘  └───────────────┘  └─────────────┘
```

### Data Flow

1. **Health Sync Flow**:
   ```
   Device Health App → useHealthSync Hook → Convex syncHealthData →
   dailyActivities Table → monthlyLeaderboard Aggregation
   ```

2. **Manual Activity Flow**:
   ```
   User Input → submitActivity Mutation → dailyActivities (reviewStatus: pending) →
   Admin Review → approveActivity/rejectActivity → Points Calculation
   ```

3. **Authentication Flow**:
   ```
   Email Entry → ResendOTP (4-digit code) → SMTP Delivery →
   User Verification → Convex Auth Session → App Access
   ```

---

## 4. Directory Structure

```
sweatscore-app/
├── app/                          # Expo Router screens (file-based routing)
│   ├── (auth)/                   # Authentication/onboarding flow
│   │   ├── email.tsx             # Email entry
│   │   ├── verify.tsx            # OTP verification
│   │   ├── setup-profile.tsx     # Profile creation
│   │   ├── setup-activity-goal.tsx # Goal selection
│   │   ├── ask-health-permission.tsx # Health permissions
│   │   └── ask-push-permission.tsx # Push permissions
│   ├── (tabs)/                   # Main tabbed interface
│   │   ├── _layout.tsx           # Tab navigation config
│   │   ├── dashboard/            # Home/leaderboard tab
│   │   │   ├── index.tsx         # Main dashboard
│   │   │   ├── workouts.tsx      # Workout history
│   │   │   ├── user/[userId].tsx # User profile view
│   │   │   ├── paywall.tsx       # Premium upsell
│   │   │   └── settings/         # Settings screens
│   │   │       ├── index.tsx     # Settings main
│   │   │       ├── profile/      # Profile editing
│   │   │       └── admin/        # Admin-only screens
│   │   ├── share/                # Social feed tab
│   │   ├── hub/                  # Creator workouts tab
│   │   ├── rewards/              # Rewards/challenges tab
│   │   └── notifications/        # Notifications tab
│   ├── activity/                 # Activity modal screens
│   │   ├── new.tsx               # Create activity
│   │   └── edit.tsx              # Edit activity
│   ├── posts/                    # Post modal screens
│   ├── creator/                  # Creator management modals
│   ├── creator-video/            # Video management modals
│   ├── legals/                   # Legal document screens
│   ├── _layout.tsx               # Root layout (providers)
│   └── index.tsx                 # Entry redirect
│
├── components/                   # Reusable components
│   ├── ui/                       # Gluestack UI primitives
│   │   ├── button/               # Button variants
│   │   ├── text/                 # Typography
│   │   ├── input/                # Form inputs
│   │   ├── avatar/               # User avatars
│   │   ├── spinner/              # Loading states
│   │   ├── toast/                # Notifications
│   │   └── gluestack-ui-provider/ # Theme provider
│   ├── core/                     # Business logic components
│   │   ├── dashboard/            # Leaderboard, cards
│   │   ├── rewards/              # Reward badges
│   │   ├── settings/             # Settings components
│   │   ├── user/                 # User profile components
│   │   ├── creators/             # Creator hub components
│   │   ├── posts/                # Social feed components
│   │   └── admin/                # Admin components
│   └── providers/                # Context providers
│       └── RevenueCatProvider.tsx
│
├── convex/                       # Backend (serverless functions)
│   ├── _generated/               # Auto-generated types
│   ├── schema.ts                 # Database schema
│   ├── auth.ts                   # Authentication config
│   ├── users.ts                  # User functions
│   ├── activities.ts             # Activity CRUD & sync
│   ├── leaderboard.ts            # Ranking calculations
│   ├── posts.ts                  # Social features
│   ├── notifications.ts          # Push notification logic
│   ├── crons.ts                  # Scheduled jobs
│   ├── email.ts                  # Email sending (nodemailer)
│   ├── http.ts                   # HTTP endpoints
│   └── services/                 # External integrations
│
├── hooks/                        # Custom React hooks
│   ├── useHealthSync.ts          # Health data synchronization
│   ├── useHealthData.ts          # Health data retrieval
│   ├── usePushNotifications.ts   # Push notification handling
│   └── useActivateUser.ts        # User activity tracking
│
├── store/                        # Zustand state stores
│   ├── useAuthStore.ts           # Authentication state
│   ├── useTabStore.ts            # Tab navigation state
│   └── useRefreshStore.ts        # Data refresh triggers
│
├── utils/                        # Utility functions
│   ├── types.ts                  # TypeScript types/enums
│   ├── constants.ts              # App constants
│   ├── formatter.ts              # Date/number formatting
│   ├── helpers.ts                # General helpers
│   ├── timezone.ts               # Timezone utilities
│   ├── storage.ts                # MMKV storage wrapper
│   └── cn.ts                     # Classname utility
│
├── assets/                       # Static assets
│   ├── images/                   # App images
│   └── fonts/                    # Custom fonts (Poppins)
│
└── Configuration Files
    ├── app.config.ts             # Expo configuration
    ├── tailwind.config.js        # Tailwind/NativeWind config
    ├── tsconfig.json             # TypeScript config
    ├── eas.json                  # EAS Build config
    └── package.json              # Dependencies
```

---

## 5. Database Schema

### Core Tables

#### `users` - User Profiles

```typescript
{
  // Identity
  name: string,              // Display name
  email: string,             // Unique email
  phone?: string,            // Optional phone
  birthdate?: string,        // For age-based HR calculations
  image?: Id<"_storage">,    // Profile picture (storage reference)

  // Flags
  isAdmin: boolean,          // Admin access
  isAnonymous: boolean,      // Anonymous user
  isPremium: boolean,        // Premium subscription
  onboarded: boolean,        // Completed onboarding

  // Settings
  timezone?: string,         // User timezone (e.g., "America/New_York")
  activityGoal?: string,     // Selected fitness goal
  autoSyncEnabled: boolean,  // Auto health sync enabled
  commentNotificationEnabled: boolean,

  // Device
  appVersion?: string,       // Installed app version
  platform?: string,         // "ios" | "android" | "web"
  expoPushToken?: string,    // Push notification token

  // Activity tracking
  lastSyncDate?: string,     // Last health sync date
  lastActiveAt?: number,     // Last app open timestamp

  // Integrations
  countryCode?: string,
  enduranceZoneLoginUrl?: string,
  enduranceZoneIdentifier?: string,
  enduranceZoneLevel?: string,
}

// Indexes
- by_email: [email]
- by_is_admin: [isAdmin]
- by_onboarded: [onboarded]
- by_is_premium: [isPremium]
- by_notification_enabled: [commentNotificationEnabled]
```

#### `dailyActivities` - Activity Records

```typescript
{
  userId: Id<"users">,
  date: string,              // "YYYY-MM-DD" format

  // Metrics
  steps: number,             // Total steps
  zone2Minutes: number,      // Minutes in Zone 2 HR
  stepsTill11am?: number,    // Steps before 11am (for missions)

  // Points
  points: number,            // Calculated points
  displayTotalPoints?: number,
  missionPoints?: number,    // Bonus mission points

  // Sync status
  synced: boolean,           // true = auto-synced, false = manual

  // Review (for manual entries)
  reviewStatus?: "approved" | "rejected",
  reviewedBy?: Id<"users">,
  reviewedAt?: number,
  image?: Id<"_storage">,    // Proof image for manual entries
}

// Indexes
- by_user_date: [userId, date]
- by_user: [userId]
- by_user_date_synced: [userId, date, synced]
- by_date: [date]
- by_review_status_synced: [reviewStatus, synced]
```

#### `monthlyLeaderboard` - Rankings

```typescript
{
  userId: Id<"users">,
  yearMonth: string,         // "YYYY-MM" format
  totalPoints: number,       // Actual earned points
  displayTotalPoints: number, // Points shown in rankings
  rank?: number,             // Position on leaderboard
}

// Indexes
- by_year_month_and_points: [yearMonth, totalPoints]
- by_year_month_display_points_total_points: [yearMonth, displayTotalPoints, totalPoints]
- by_year_month_and_rank: [yearMonth, rank]
- by_user_and_year_month: [userId, yearMonth]
```

### Social Tables

#### `posts` - Feed Posts

```typescript
{
  userId: Id<"users">,
  createdAt: number,         // Timestamp
  body?: string,             // Post text
  media?: string,            // Media URL
  mediaWidth?: number,
  mediaHeight?: number,
  isPinned: boolean,         // Admin pinned post
}
```

#### `postComments` - Comments

```typescript
{
  postId: Id<"posts">,
  userId: Id<"users">,
  createdAt: number,
  body: string,
}
```

#### `postLikes` - Reactions

```typescript
{
  postId: Id<"posts">,
  userId: Id<"users">,
  likeIcon: "heart" | "fire" | "clap",
  createdAt: number,
}
```

### Content Tables

#### `creators` - Workout Creators

```typescript
{
  userId: Id<"users">,       // Associated user account
  name: string,
  posterImage?: Id<"_storage">,
  description?: string,
  isActive: boolean,
  sortOrder?: number,
}
```

#### `creatorVideos` - Workout Videos

```typescript
{
  creatorId: Id<"creators">,
  title: string,
  subtitle?: string,
  youtubeUrl: string,
  order?: number,
  isActive: boolean,
  description?: string,
  difficulty?: "easy" | "medium" | "hard",
  equipment?: string,
  category?: string,
}
```

### Engagement Tables

#### `userCheckIns` - Daily Bonuses

```typescript
{
  userId: Id<"users">,
  date: string,              // "YYYY-MM-DD"
  points: number,            // Check-in bonus points
}
```

#### `dailyChallengesList` - Mission Definitions

```typescript
{
  day: number,               // 1-31 (day of month)
  challengeType: "steps" | "sweat" | "points" | "powerboost" | "rest" | "double",
  target?: number,           // Target value for challenge
  bonusPoints?: number,
  pushCopy?: string,         // Push notification text
  inAppCopy?: string,        // In-app display text
}
```

#### `claimedRewards` - Reward Claims

```typescript
{
  userId: Id<"users">,
  yearMonth: string,         // "YYYY-MM"
  claimedPoints: number,
  totalEntries?: number,
}
```

### System Tables

#### `featureFlags` - Feature Toggles

```typescript
{
  userId: Id<"users">,
  featureFlag: "mission",    // Feature name
  enabled: boolean,
}
```

#### `blockedUsers` - User Blocks

```typescript
{
  userId: Id<"users">,
  blockedUserId: Id<"users">,
  createdAt: number,
  description?: string,
}
```

---

## 6. Authentication System

### Overview

SweatScore uses **Convex Auth** with email OTP (One-Time Password) authentication. No passwords are stored; users authenticate via 4-digit codes sent to their email.

### Auth Flow Diagram

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Email     │ ──> │  Generate   │ ──> │  Send via   │
│   Entry     │     │  4-digit    │     │   SMTP      │
│             │     │   OTP       │     │             │
└─────────────┘     └─────────────┘     └─────────────┘
                                              │
                                              ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Main      │ <── │  Create     │ <── │   Verify    │
│   App       │     │  Session    │     │   OTP       │
│             │     │             │     │             │
└─────────────┘     └─────────────┘     └─────────────┘
```

### Implementation Files

| File | Purpose |
|------|---------|
| `convex/auth.ts` | Auth configuration, providers setup |
| `convex/auth.config.ts` | Auth runtime configuration |
| `convex/ResendOTP.ts` | Production OTP provider |
| `convex/TestOTP.ts` | Development test provider |
| `convex/email.ts` | SMTP email sending action |
| `convex/emailTemplates.ts` | Email HTML templates |

### OTP Provider (ResendOTP.ts)

```typescript
// Key configuration
- Code length: 4 digits
- Expiration: 15 minutes (900,000 ms)
- Delivery: HTTP POST to internal email endpoint

// Flow
1. generateCode() → Create 4-digit numeric code
2. Store code with expiration in authOtpTokens table
3. sendCode() → POST to /api/send-email with basic auth
4. verifyCode() → Validate code against stored token
```

### Email Delivery (email.ts)

```typescript
// Uses nodemailer with "use node" directive
export const sendEmail = internalAction({
  args: { to, subject, html },
  handler: async (ctx, args) => {
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      auth: { user: SMTP_USER, pass: SMTP_PASSWORD }
    });
    await transporter.sendMail({ from, to, subject, html });
  }
});
```

### Session Management

- Sessions managed by Convex Auth
- Tokens stored in Expo Secure Store
- Session auto-refresh on app foreground
- Logout clears local storage and Convex session

### Onboarding Flow

After email verification, new users complete:

1. **Profile Setup** (`setup-profile.tsx`)
   - Name entry
   - Profile picture (optional)

2. **Goal Selection** (`setup-activity-goal.tsx`)
   - Activity goal choice
   - Sets baseline expectations

3. **Health Permissions** (`ask-health-permission.tsx`)
   - Request HealthKit/Health Connect access
   - Required for auto-sync

4. **Push Permissions** (`ask-push-permission.tsx`)
   - Request notification permissions
   - Register Expo push token

---

## 7. Core Features & Business Logic

### 7.1 Points System

#### Calculation Formula

```typescript
// Location: convex/activities.ts

function calculatePoints(steps: number, zone2Minutes: number): number {
  const stepsPoints = Math.floor(steps / 1000);     // 1 point per 1,000 steps
  const zone2Points = Math.floor(zone2Minutes / 5); // 1 point per 5 min Zone 2
  return stepsPoints + zone2Points;
}

// Examples:
// 10,000 steps + 30 min Zone 2 = 10 + 6 = 16 points
// 5,000 steps + 0 min Zone 2 = 5 + 0 = 5 points
```

#### Zone 2 Heart Rate Calculation

```typescript
// Age-based max heart rate
const maxHR = 220 - age;

// Zone 2 range (60-70% of max HR)
const zone2Min = maxHR * 0.6;
const zone2Max = maxHR * 0.7;

// Example: 30-year-old
// Max HR: 190 bpm
// Zone 2: 114-133 bpm
```

### 7.2 Daily Missions

#### Challenge Types

| Type | Description | Bonus Calculation |
|------|-------------|-------------------|
| `steps` | Hit step target | Points if target reached |
| `sweat` | Zone 2 minutes target | Points if target reached |
| `points` | Total points target | Points if target reached |
| `powerboost` | Steps before 11am | Bonus for early activity |
| `rest` | No activity required | Free bonus points |
| `double` | Double daily points | 2x multiplier |

#### Mission Assignment

Missions are defined in `dailyChallengesList` table, mapped by day of month (1-31).

```typescript
// Example mission data
{
  day: 15,
  challengeType: "steps",
  target: 10000,
  bonusPoints: 5,
  pushCopy: "Hit 10K steps today for bonus points!",
  inAppCopy: "Walk 10,000 steps to earn 5 bonus points"
}
```

### 7.3 Leaderboard

#### Monthly Aggregation

```typescript
// Location: convex/leaderboard.ts

// Aggregates points from:
// 1. dailyActivities (synced or approved)
// 2. userCheckIns (daily bonus)
// 3. missionPoints (completed missions)

// Ranking uses displayTotalPoints for tie-breaking
// Updates via hourly cron on 1st of month
```

#### Reward Thresholds

| Points | Unlock |
|--------|--------|
| 100 | Bronze reward tier |
| 250 | Silver reward tier |
| 500 | Gold reward tier |

#### Rank Cash Mapping

| Rank | Cash Prize |
|------|------------|
| 1 | $230 |
| 2 | $130 |
| 3 | $100 |
| 4 | $80 |
| 5 | $60 |
| 6-10 | $30-$50 |

### 7.4 Manual Activity Submission

#### Approval Workflow

```
User submits activity (with optional photo proof)
           │
           ▼
┌─────────────────────┐
│  reviewStatus:      │
│  "pending"          │
│  synced: false      │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Admin reviews via  │
│  admin/pending-     │
│  approvals          │
└──────────┬──────────┘
           │
     ┌─────┴─────┐
     │           │
     ▼           ▼
┌─────────┐ ┌─────────┐
│ Approved│ │ Rejected│
│ → Points│ │ → No    │
│ counted │ │ points  │
└─────────┘ └─────────┘
```

---

## 8. Health Data Integration

### Platform Implementations

#### iOS (Apple HealthKit)

```typescript
// Library: react-native-health
// File: hooks/useHealthData.ts, hooks/useHealthSync.ts

// Permissions required:
- Steps (read)
- Heart Rate (read)
- Active Energy (read)

// Data retrieval:
AppleHealthKit.getStepCount({ startDate, endDate })
AppleHealthKit.getHeartRateSamples({ startDate, endDate })
```

#### Android (Health Connect)

```typescript
// Library: expo-health-connect
// File: hooks/useHealthData.ts, hooks/useHealthSync.ts

// Permissions required:
- Steps (read)
- Heart Rate (read)
- Active Energy Burned (read)

// Data retrieval:
HealthConnect.readRecords('Steps', { startTime, endTime })
HealthConnect.readRecords('HeartRate', { startTime, endTime })
```

### Sync Process

```typescript
// File: hooks/useHealthSync.ts

async function syncAllMissedDays(userId: string) {
  // 1. Get missed days from server
  const missedDays = await getMissedDaysForSync(userId);

  // 2. For each missed day, fetch health data
  const healthData = await Promise.all(
    missedDays.map(date => getHealthDataForDate(date))
  );

  // 3. Batch sync to server
  await syncHealthData(userId, healthData);
}
```

### Zone 2 Detection Algorithm

```typescript
function calculateZone2Minutes(heartRateSamples: HeartRateSample[], age: number): number {
  const maxHR = 220 - age;
  const zone2Min = maxHR * 0.6;
  const zone2Max = maxHR * 0.7;

  let zone2Seconds = 0;

  for (let i = 0; i < samples.length - 1; i++) {
    const hr = samples[i].value;
    const duration = samples[i + 1].timestamp - samples[i].timestamp;

    if (hr >= zone2Min && hr <= zone2Max) {
      zone2Seconds += duration;
    }
  }

  return Math.floor(zone2Seconds / 60);
}
```

---

## 9. State Management

### Zustand Stores

#### useAuthStore

```typescript
// File: store/useAuthStore.ts

interface AuthState {
  currentUser: User | null;
  setCurrentUser: (user: User) => void;
  setCurrentUserImage: (imageUrl: string) => void;
}

// Usage
const { currentUser, setCurrentUser } = useAuthStore();

// Side effects:
// - Setting user also logs into RevenueCat for subscriptions
```

#### useTabStore

```typescript
// File: store/useTabStore.ts

interface TabState {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
}

// Persists selected tab across sessions
```

#### useRefreshStore

```typescript
// File: store/useRefreshStore.ts

interface RefreshState {
  refreshKey: number;
  incrementRefreshKey: () => void;
}

// Used to force component remounts when data changes
```

### Server State (Convex)

```typescript
// Queries - Real-time subscriptions
const user = useQuery(api.users.current);
const leaderboard = useQuery(api.leaderboard.getMonthly, { yearMonth });

// Mutations - Data modifications
const updateProfile = useMutation(api.users.updateProfile);
await updateProfile({ name: "New Name" });

// Actions - External effects
const sendEmail = useAction(api.email.sendEmail);
```

### Local Storage (MMKV)

```typescript
// File: utils/storage.ts

// Fast synchronous storage for non-sensitive data
storeData("lastViewedTab", "dashboard");
const tab = getData("lastViewedTab");
removeData("lastViewedTab");
```

---

## 10. Navigation & Routing

### Expo Router Structure

SweatScore uses Expo Router v4 with file-based routing.

#### Route Groups

| Group | Purpose | Auth Required |
|-------|---------|---------------|
| `(auth)` | Onboarding flow | No |
| `(tabs)` | Main app tabs | Yes |
| `activity` | Activity modals | Yes |
| `posts` | Post modals | Yes |
| `creator` | Creator modals | Yes (Admin) |
| `legals` | Legal documents | No |

#### Tab Navigation

```typescript
// File: app/(tabs)/_layout.tsx

<Tabs>
  <Tabs.Screen name="dashboard" />  // Home/Leaderboard
  <Tabs.Screen name="share" />      // Social Feed
  <Tabs.Screen name="hub" />        // Creator Workouts
  <Tabs.Screen name="rewards" />    // Challenges/Rewards
  <Tabs.Screen name="notifications" /> // Rankings
</Tabs>
```

#### Dynamic Routes

```typescript
// User profile: /dashboard/user/[userId]
// Accessed via: router.push(`/dashboard/user/${userId}`)

// Creator detail: /hub/creators/[creatorId]
// Video player: /hub/creators/videos/[videoId]
```

#### Modal Presentation

```typescript
// Activity modals use presentation: "modal"
// Access via: router.push("/activity/new")
// Dismiss via: router.back()
```

### Navigation Patterns

```typescript
import { useRouter } from 'expo-router';

const router = useRouter();

// Navigate forward
router.push('/dashboard/settings');

// Navigate with params
router.push({
  pathname: '/dashboard/user/[userId]',
  params: { userId: '123' }
});

// Go back
router.back();

// Replace current screen
router.replace('/dashboard');
```

---

## 11. Component Architecture

### Component Hierarchy

```
┌─────────────────────────────────────────────┐
│              Screen (app/*.tsx)              │
│  ┌─────────────────────────────────────────┐│
│  │           SafeAreaView                  ││
│  │  ┌───────────────────────────────────┐  ││
│  │  │        Core Components            │  ││
│  │  │  (Leaderboard, UserCard, etc.)    │  ││
│  │  │  ┌─────────────────────────────┐  │  ││
│  │  │  │      UI Components         │  │  ││
│  │  │  │  (Button, Text, Avatar)    │  │  ││
│  │  │  └─────────────────────────────┘  │  ││
│  │  └───────────────────────────────────┘  ││
│  └─────────────────────────────────────────┘│
└─────────────────────────────────────────────┘
```

### UI Components (Primitives)

Located in `components/ui/`, these wrap Gluestack UI with NativeWind styling.

```typescript
// Button example
import { Button, ButtonText } from '~/components/ui/button';

<Button action="primary" size="lg" onPress={handlePress}>
  <ButtonText>Click Me</ButtonText>
</Button>

// Available UI components:
// - button, text, input, textarea
// - avatar, icon, checkbox, switch
// - spinner, toast, tooltip
// - box, alert-dialog
```

### Core Components (Business Logic)

Located in `components/core/`, these implement SweatScore-specific features.

```typescript
// Leaderboard component
import { Leaderboard } from '~/components/core/dashboard/Leaderboard';

<Leaderboard
  data={leaderboardData}
  currentUserId={userId}
  onUserPress={handleUserPress}
/>

// Key core components:
// Dashboard: Leaderboard, UserCard, MyCard, SwipeableMissionCard
// User: Profile, Activities
// Posts: Row, FeaturedRow, CommentRow
// Creators: Row, VideoRow, StartWorkoutPopup
// Admin: UserRow
```

### Provider Components

```typescript
// Root layout providers (app/_layout.tsx)

<ConvexProvider client={convex}>
  <RevenueCatProvider>
    <GluestackUIProvider>
      <ToastProvider>
        {children}
      </ToastProvider>
    </GluestackUIProvider>
  </RevenueCatProvider>
</ConvexProvider>
```

---

## 12. Backend Functions (Convex)

### Function Types

| Type | Use Case | Example |
|------|----------|---------|
| Query | Read data (real-time) | `api.users.current` |
| Mutation | Write data | `api.activities.submitActivity` |
| Action | External calls | `api.email.sendEmail` |
| Internal | Server-to-server | `internal.activities.upsertDailyActivity` |
| HTTP | Webhooks | `/api/send-email` |

### Key Queries

```typescript
// Users
api.users.current                    // Get authenticated user
api.users.getById                    // Get user by ID

// Activities
api.activities.getMyActivities       // User's activity history
api.activities.getDailyActivity      // Specific day's activity
api.activities.getMissedDaysForSync  // Days needing sync

// Leaderboard
api.leaderboard.getMonthly           // Monthly rankings
api.leaderboard.getUserRank          // User's current rank

// Posts
api.posts.list                       // Feed posts
api.posts.getById                    // Single post with comments

// Creators
api.creators.list                    // All creators
api.creatorVideos.listByCreator      // Creator's videos
```

### Key Mutations

```typescript
// Activities
api.activities.syncHealthData        // Batch sync from health apps
api.activities.submitActivity        // Manual activity submission
api.activities.approveActivity       // Admin approval
api.activities.rejectActivity        // Admin rejection

// Users
api.users.updateProfile              // Update profile fields
api.users.updateExpoPushToken        // Register push token
api.users.updateActivityGoal         // Set fitness goal

// Posts
api.posts.create                     // Create post
api.posts.addComment                 // Add comment
api.posts.like                       // Like/react to post

// Admin
api.admin.deleteUser                 // Remove user
api.admin.toggleAdmin                // Toggle admin status
```

### Key Actions

```typescript
// Email
api.email.sendEmail                  // Send via SMTP (internal)

// External
api.services.enduranceZone.sync      // Third-party sync

// Notifications
api.pushNotification.send            // Send push notification
```

---

## 13. Push Notifications

### Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   App Startup   │ ──> │ Register Expo   │ ──> │ Store Token in  │
│                 │     │ Push Token      │     │ Convex          │
└─────────────────┘     └─────────────────┘     └─────────────────┘

┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ Convex Cron/    │ ──> │ @convex-dev/    │ ──> │  Expo Push      │
│ Mutation        │     │ expo-push-      │     │  Service        │
│                 │     │ notifications   │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                       │
                                                       ▼
                                               ┌─────────────────┐
                                               │  User Device    │
                                               │  (iOS/Android)  │
                                               └─────────────────┘
```

### Implementation

```typescript
// File: hooks/usePushNotifications.ts

export function usePushNotifications() {
  useEffect(() => {
    // 1. Register for push token
    const token = await Notifications.getExpoPushTokenAsync();

    // 2. Store token in Convex
    await updateExpoPushToken(token.data);

    // 3. Setup notification listeners
    Notifications.addNotificationReceivedListener(handleNotification);
    Notifications.addNotificationResponseReceivedListener(handleResponse);
  }, []);
}
```

### Notification Types

| Type | Trigger | Deep Link |
|------|---------|-----------|
| `newActivitySubmitted` | Manual activity submitted | Admin pending approvals |
| `newActivityApproved` | Activity approved | User activities |
| `newActivityRejected` | Activity rejected | User activities |
| `newRewardUnlocked100/250/500` | Reward milestone | Rewards screen |
| `newCommentPosted` | Comment on user's post | Post detail |
| `newAdminPost` | Admin post created | Feed |
| `noActivityReminder` | No activity today (9pm) | Dashboard |

### Sending Notifications

```typescript
// File: convex/pushNotification.ts

async function sendPushNotification(
  userId: Id<"users">,
  title: string,
  body: string,
  data: { type: NotificationType; [key: string]: any }
) {
  const user = await ctx.db.get(userId);
  if (!user?.expoPushToken) return;

  await sendPushNotificationToUser(ctx, {
    userId,
    notification: { title, body, data }
  });
}
```

---

## 14. Scheduled Jobs (Crons)

### Cron Configuration

```typescript
// File: convex/crons.ts

crons.interval(
  "hourly engagement notifications",
  { minutes: 60 },
  api.notifications.processNotifications
);

crons.interval(
  "update monthly leaderboard (1st of month)",
  { minutes: 60 },
  api.leaderboard.updateMonthlyLeaderboardForAllUsers
);

crons.interval(
  "upgrade users to premium (1st of month)",
  { minutes: 60 },
  api.leaderboard.upgradeUserToPremium
);
```

### Job Details

#### Engagement Notifications (Hourly)

- Checks users who haven't logged activity today
- Sends reminder at 9pm user's local time
- Timezone-aware calculation
- Respects notification preferences

#### Leaderboard Update (1st of Month, Hourly)

- Aggregates all points from previous month
- Calculates rankings by displayTotalPoints
- Updates rank field for all users
- Only runs on 1st of month

#### Premium Upgrade (1st of Month, Hourly)

- Identifies users in top 10 of previous month
- Updates isPremium flag
- Triggers reward notifications
- Only runs on 1st of month

---

## 15. Design System

### Color Palette

```javascript
// File: tailwind.config.js

colors: {
  primary: '#F58503',      // Orange - main brand color
  secondary: '#65c6eb',    // Light blue
  accent: '#ff6f61',       // Red

  // Rank colors
  gold: '#ffd700',         // 1st place
  silver: '#c0c0c0',       // 2nd place
  bronze: '#cd7f32',       // 3rd place

  // Status colors
  success: '#008000',
  error: '#FF0000',
  warning: '#FFA500',

  // Background
  paper: '#FFF9F5',        // Off-white
  black: '#1C1B1F',
}
```

### Typography

```javascript
fontFamily: {
  heading: ['Poppins-Bold'],
  body: ['Poppins-Regular'],
  mono: ['RobotoMono-Regular'],
}

// Custom sizes
fontSize: {
  '2xs': '10px',  // Extra small
  // Standard Tailwind sizes
}

// Custom weights
fontWeight: {
  extrablack: '950',
  // Standard weights
}
```

### Shadows

```javascript
// Hard shadows (for cards, buttons)
boxShadow: {
  'hard-1': '-2px 2px 8px rgba(0,0,0,0.1)',
  'hard-2': '-4px 4px 8px rgba(0,0,0,0.15)',
  // ... more variants
}

// Soft shadows (for elevated elements)
boxShadow: {
  'soft-1': '0px 0px 10px rgba(0,0,0,0.1)',
  // ... more variants
}
```

### Platform-Specific Styling

```typescript
// File extensions for platform targeting:
// Component.tsx       - Shared
// Component.ios.tsx   - iOS only
// Component.android.tsx - Android only
// Component.web.tsx   - Web only

// Example: Gluestack provider
// gluestack-ui-provider/index.tsx     - Native
// gluestack-ui-provider/index.web.tsx - Web
```

---

## 16. Environment Configuration

Environment variables are split across three places: the app's `.env.local` (client-side, `EXPO_PUBLIC_*`), the Convex dashboard (server-side secrets used by Convex functions), and the Trigger.dev dashboard (background-job secrets). The annotated template lives at `.env.example`.

### Client-side (`.env.local`)

```bash
# Convex
CONVEX_DEPLOYMENT=dev:your-deployment-slug
EXPO_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud

# Test-account login (App Store / Play Store reviewers)
EXPO_PUBLIC_TEST_ACCOUNT_EMAIL=reviewer@example.com

# RevenueCat (public keys, intentionally client-visible)
EXPO_PUBLIC_REVENUECAT_IOS_API_KEY=appl_xxxxx
EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY=goog_xxxxx

# Facebook App ID — required by react-native-share for Instagram/Facebook Stories
EXPO_PUBLIC_FB_APP_ID=1234567890

# Build-time only — path to Firebase google-services.json for Android builds
GOOGLE_SERVICES_JSON=/absolute/path/to/google-services.json
```

### Convex backend (server-side, dashboard or CLI)

```bash
# Transactional email (Nodemailer + SMTP)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=user@example.com
SMTP_PASSWORD=your-password
SMTP_FROM=noreply@sweatscore.com
SMTP_FROM_NAME=SweatScore

# Internal HTTP endpoint basic auth (e.g., /api/send-email)
BASIC_AUTH_USERNAME=admin
BASIC_AUTH_PASSWORD=secure-password

# Marketing email
MAILERLITE_API_KEY=ml_xxxxx

# Heart-rate zone calculation service
ENDURANCE_ZONE_API_HOST=https://api.endurance-zone.example.com
ENDURANCE_ZONE_API_KEY=ez_xxxxx

# Trigger.dev integration (Convex → Trigger.dev)
TRIGGER_SECRET=tr_xxxxx
TRIGGER_SECRET_KEY=tr_xxxxx

# Test-account reviewer bypass
TEST_ACCOUNT_EMAIL=reviewer@example.com
TEST_ACCOUNT_OTP=1234

# Convex's own HTTP site URL (used by Trigger.dev callbacks)
CONVEX_SITE_URL=https://your-deployment.convex.site
```

Manage via:

```bash
bunx convex env set SMTP_HOST smtp.example.com
bunx convex env list
bunx convex env remove SOME_KEY
```

### Trigger.dev project

Set in the Trigger.dev dashboard for the corresponding project (`proj_bmfdlpnfxvqfdgyalvvn`).

```bash
TRIGGER_SECRET=tr_xxxxx
FFMPEG_PATH=/usr/bin/ffmpeg     # provided by aptGet build extension
CONVEX_SITE_URL=https://your-deployment.convex.site
```

### Build Configuration (eas.json)

```json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "env": {
        "EXPO_PUBLIC_CONVEX_URL": "https://dev-deployment.convex.cloud"
      }
    },
    "preview": {
      "distribution": "internal",
      "env": {
        "EXPO_PUBLIC_CONVEX_URL": "https://staging-deployment.convex.cloud"
      }
    },
    "production": {
      "env": {
        "EXPO_PUBLIC_CONVEX_URL": "https://prod-deployment.convex.cloud"
      }
    }
  }
}
```

---

## 17. Development Workflow

### Getting Started

```bash
# 1. Clone repository
git clone <repo-url>
cd sweatscore-app

# 2. Install dependencies
bun install

# 3. Setup environment
cp .env.example .env.local
# Edit .env.local with your values

# 4. Start Convex dev server (separate terminal)
bunx convex dev

# 5. Start Expo dev server
bun run start
```

### Running on Devices

```bash
# iOS Simulator
bun run ios

# Android Emulator
bun run android

# Web Browser
bun run web

# Physical device
# Scan QR code from Expo dev server
```

### Code Quality

```bash
# Run linting
bun run lint

# Auto-fix linting issues
bun run format

# Type checking
bunx tsc --noEmit
```

### Backend Development

```bash
# Start Convex dev server
bunx convex dev

# Deploy to production
bunx convex deploy

# Run specific function
bunx convex run api.users.current

# View logs
bunx convex logs

# Import data
bunx convex import --table users data.jsonl
```

### Git Workflow

```bash
# Feature branch
git checkout -b feature/new-feature

# Commit changes
git add .
git commit -m "feat: add new feature"

# Push and create PR
git push origin feature/new-feature
```

---

## 18. Testing Strategy

### Manual Testing

The project uses manual testing as the primary QA approach.

#### iOS Testing (TestFlight)

```bash
# 1. Build production build
eas build --platform ios --profile production

# 2. Submit to App Store Connect
eas submit --platform ios

# 3. In App Store Connect:
#    - Navigate to TestFlight
#    - Add internal/external testers
#    - Testers download via TestFlight app
```

#### Android Testing (Preview APK)

```bash
# 1. Build preview build (generates APK)
eas build --platform android --profile preview

# 2. Download APK from Expo dashboard
#    - Go to https://expo.dev
#    - Navigate to your project builds
#    - Download the .apk file

# 3. Install APK on test devices
#    - Transfer APK to device
#    - Enable "Install from unknown sources" if needed
#    - Install and test
```

### Code Quality Checks

- **TypeScript** - Compile-time type checking
- **ESLint** - Static code analysis
- **Prettier** - Code formatting

---

## 19. Deployment Process

### iOS Deployment

```bash
# 1. Build for TestFlight
eas build --platform ios --profile production

# 2. Submit to App Store Connect
eas submit --platform ios

# 3. In App Store Connect:
#    - Add release notes
#    - Submit for review
```

### Android Deployment

```bash
# 1. Build AAB for production
eas build --platform android --profile production

# 2. Download the .aab file from Expo dashboard
#    - Go to https://expo.dev
#    - Navigate to your project builds
#    - Download the production .aab file

# 3. Manually upload to Google Play Console
#    - Go to Google Play Console
#    - Select SweatScore app
#    - Go to Production > Create new release
#    - Upload the .aab file
#    - Add release notes
#    - Submit for review
```

### Convex Deployment

```bash
# Deploy backend changes
bunx convex deploy

# Note: Convex deployments are instant
# No downtime, automatic rollback on errors
```

### Version Management

```json
// File: app.json

{
  "expo": {
    "version": "1.0.5",  // Update only if current version is already released
    // ...
  }
}
```

**Version Update Rules:**
- Only increment `version` in `app.json` if the current version has already been released to stores
- Build numbers are managed automatically by EAS Build
- Use semantic versioning (MAJOR.MINOR.PATCH)

---

## 20. Third-Party Integrations

### RevenueCat (Subscriptions)

```typescript
// File: components/providers/RevenueCatProvider.tsx

// Setup
Purchases.configure({
  apiKey: Platform.OS === 'ios'
    ? REVENUECAT_APPLE_API_KEY
    : REVENUECAT_GOOGLE_API_KEY
});

// Login user (after auth)
await Purchases.logIn(userId);

// Check subscription status
const customerInfo = await Purchases.getCustomerInfo();
const isPremium = customerInfo.entitlements.active['premium'];

// Purchase
const offerings = await Purchases.getOfferings();
await Purchases.purchasePackage(offerings.current.monthly);
```

### MailerLite (Email Marketing)

```typescript
// File: convex/mailerlite.ts

// Add subscriber
await fetch('https://api.mailerlite.com/api/v2/subscribers', {
  method: 'POST',
  headers: {
    'X-MailerLite-ApiKey': MAILERLITE_API_KEY,
  },
  body: JSON.stringify({ email, name }),
});
```

### YouTube (Video Embedding)

```typescript
// Creator videos embed YouTube URLs
// Format: https://www.youtube.com/watch?v=VIDEO_ID

// Display using WebView or YouTube iframe API
```

### Apple HealthKit (iOS) and Google Health Connect (Android)

```typescript
// File: hooks/useHealthSync.ts

// iOS: react-native-health
AppleHealthKit.initHealthKit(healthPermissions, callback);
AppleHealthKit.getDailyStepCountSamples({ startDate, endDate }, callback);

// Android: react-native-health-connect + expo-health-connect
await initialize();
await requestPermission(healthPermissionsAndroid);
const steps = await readRecords('Steps', { timeRangeFilter: { ... } });
```

Permissions requested: `READ_STEPS`, `READ_HEART_RATE` (both platforms). The heart-rate permission is required to compute "Active Minutes" via the Endurance Zone API.

### Expo Push Notifications

```typescript
// Client: components/providers — registers ExpoPushToken on login
// Server: convex/pushNotification.ts uses @convex-dev/expo-push-notifications
//         to fan out to all of a user's registered tokens.
```

No FCM / APNs direct integration — both platforms are proxied through Expo's push service. Android still requires a `google-services.json` (referenced by `app.config.ts` via `GOOGLE_SERVICES_JSON`) so the FCM bridge inside Expo's runtime works.

### Trigger.dev (Background Jobs)

```typescript
// File: trigger/merge-videos.ts, trigger/backfill-thumbnails.ts, etc.
import { task } from '@trigger.dev/sdk/v3';

export const mergeVideos = task({
  id: 'merge-videos',
  run: async (payload) => { /* ffmpeg-based composition */ },
});

// Triggered from Convex actions via @trigger.dev/sdk
```

Build extension installs `ffmpeg` (`aptGet({ packages: ['ffmpeg'] })` in `trigger.config.ts`). Project id is `proj_bmfdlpnfxvqfdgyalvvn`.

### Endurance Zone API (Heart-Rate Zones)

```typescript
// File: convex/services/enduranceZone.ts
// Computes a user's personalized cardio heart-rate zone from age,
// resting HR, and a country-localized formula. Used by Active
// Minutes points calculation.
```

External REST API, called server-side from Convex actions. Country codes are mapped from ISO-3166 region codes via a static table in the service file.

### Facebook / Instagram Stories Sharing

```typescript
// File: utils/share.ts
// react-native-share with Social.InstagramStories / Social.FacebookStories
// requires a Facebook App ID set via EXPO_PUBLIC_FB_APP_ID.
```

Configured in `app.json` under the `react-native-share` plugin (`fb`, `instagram`, `instagram-stories`, `facebook-stories`, `tiktoksharesdk` on iOS; Instagram/Facebook/TikTok packages on Android).

### Nodemailer + SMTP (Transactional Email)

```typescript
// File: convex/email.ts ("use node" action)
// Sends OTP emails and other transactional mail via Nodemailer.
// Exposed as a Convex internal action and also as a basic-auth-protected
// HTTP endpoint at /api/send-email (see convex/http.ts).
```

SMTP credentials are server-side only (Convex env vars). The Convex Auth OTP provider (`convex/ResendOTP.ts`) calls into this action.

---

## 21. Admin Features

### Admin Access

```typescript
// Admin flag in user profile
if (user.isAdmin) {
  // Show admin routes
}

// Server-side validation
export const adminOnlyMutation = mutation({
  handler: async (ctx) => {
    const user = await ctx.db.get(userId);
    if (!user?.isAdmin) {
      throw new Error('Unauthorized');
    }
    // Admin logic
  }
});
```

### Admin Routes

| Route | Purpose |
|-------|---------|
| `/settings/admin` | Admin dashboard |
| `/settings/admin/users` | User management |
| `/settings/admin/pending-approvals` | Review manual activities |
| `/settings/admin/creator-hub` | Manage creators |
| `/settings/admin/creator/[id]` | Edit creator |
| `/settings/admin/rewards-banner` | Configure rewards banner |

### Admin Capabilities

1. **User Management**
   - View all users
   - Toggle admin status
   - Delete users
   - View user activities

2. **Activity Approval**
   - Review pending manual activities
   - Approve with points calculation
   - Reject with notification

3. **Content Management**
   - Create/edit creators
   - Add/remove workout videos
   - Pin posts to feed
   - Update rewards banner

---

## 22. Known Issues & Technical Debt

### Current Issues

| Issue | Location | Severity |
|-------|----------|----------|
| `@ts-ignore` in modal screens | Various modals | Low |
| Health sync batch size | useHealthSync.ts | Medium |
| No offline support | App-wide | Medium |
| Limited error boundaries | App-wide | Low |

### Technical Debt

1. **Testing Coverage**
   - No automated tests
   - Manual testing only
   - Recommend adding Jest + RTL

2. **Error Handling**
   - Inconsistent error handling
   - Missing error boundaries
   - Recommend centralized error handling

3. **Performance**
   - Large leaderboard lists need virtualization
   - Image optimization needed
   - Bundle size monitoring

4. **Code Quality**
   - Some inline styles
   - Inconsistent naming conventions
   - Could benefit from more code splitting

### Recommended Improvements

1. Add comprehensive test suite
2. Implement error boundaries
3. Add offline support with data caching
4. Implement list virtualization
5. Add bundle size monitoring
6. Standardize error handling

---

## 23. Onboarding Checklist

### New Developer Checklist

- [ ] Clone repository and install dependencies
- [ ] Set up environment variables
- [ ] Run Convex dev server locally
- [ ] Run app on simulator/emulator
- [ ] Review database schema (`convex/schema.ts`)
- [ ] Review root layout (`app/_layout.tsx`)
- [ ] Review tab navigation (`app/(tabs)/_layout.tsx`)
- [ ] Review auth flow (`convex/auth.ts`, `app/(auth)/*`)
- [ ] Review core business logic (`convex/activities.ts`)
- [ ] Review health sync (`hooks/useHealthSync.ts`)
- [ ] Review state management (`store/*`)
- [ ] Complete one small bug fix or feature
- [ ] Deploy a test change to Convex

### Key Files to Read First

1. `convex/schema.ts` - Understand data structure
2. `app/_layout.tsx` - App initialization
3. `app/(tabs)/_layout.tsx` - Navigation structure
4. `convex/auth.ts` - Authentication
5. `convex/activities.ts` - Core business logic
6. `hooks/useHealthSync.ts` - Health data sync
7. `utils/constants.ts` - Business constants
8. `store/useAuthStore.ts` - State management
9. `components/core/dashboard/Leaderboard.tsx` - UI patterns
10. `convex/crons.ts` - Background jobs

### Resources

- [Expo Documentation](https://docs.expo.dev/)
- [Convex Documentation](https://docs.convex.dev/)
- [NativeWind Documentation](https://www.nativewind.dev/)
- [Gluestack UI Documentation](https://gluestack.io/)
- [RevenueCat Documentation](https://docs.revenuecat.com/)

---

## Document Maintenance

This document should be updated when:

- New features are added
- Database schema changes
- Authentication flow changes
- New third-party integrations added
- Deployment process changes

**Last Updated By:** Technical Documentation
**Review Schedule:** Quarterly or upon major releases
