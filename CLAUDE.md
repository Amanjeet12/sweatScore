# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Essential Commands

**Development:**
```bash
# Start development server
bun run start

# Platform-specific development
bun run ios    # iOS simulator
bun run android # Android emulator
bun run web    # Web browser

# Code quality
bun run lint   # ESLint + Prettier check
bun run format # Auto-fix ESLint + Prettier
```

**Convex Backend:**
```bash
# Deploy backend changes
bunx convex deploy

# Run functions locally
bunx convex dev

# Database operations
bunx convex import --table tableName data.jsonl
bunx convex run functionName
```

## Architecture Overview

SweatScore is a fitness gamification app built with **React Native + Expo** and **Convex** as the real-time backend. The app syncs with device health data (Apple Health/Google Fit) and transforms daily activity into points and leaderboards.

### Key Technologies
- **Frontend**: React Native (Expo SDK 52), Expo Router v4, NativeWind v4, Zustand
- **Backend**: Convex (real-time BaaS), Convex Auth (email OTP), nodemailer (SMTP)
- **Health Integration**: expo-health-connect (Android), react-native-health (iOS)
- **UI**: Custom Gluestack UI components with NativeWind styling

### Authentication Flow
1. **Email OTP**: 4-digit codes sent via SMTP (replaced Resend)
2. **Progressive Onboarding**: Profile → Goal → Permissions → Health sync
3. **Provider**: Custom `ResendOTP` in `convex/ResendOTP.ts` using internal email API

### Database Schema (Convex)

**Core Tables:**
- `users`: Profiles with health sync settings and admin flags
- `dailyActivities`: Daily steps/calories/exercise with manual entry approval system
- `monthlyLeaderboard`: Aggregated points by month for ranking
- `creators` + `creatorVideos`: Content creator workout videos
- `userCheckIns`: Daily login bonus tracking
- `claimedRewards`: Monthly reward redemption tracking

**Points Calculation:**
```typescript
// Server-side in convex/activities.ts
steps: Math.floor(steps / 1000) * 1        // 1 point per 1K steps
checkin: 1 point per day
```

### File Structure Patterns

**App Router (app/):**
```
(auth)/          # Onboarding flow screens
(tabs)/          # Main app with nested navigators
  dashboard/     # Home + user profiles
  hub/           # Creator videos
  notifications/ # Push notifications
  rewards/       # Points system
  settings/      # User settings + admin panel
activity/        # Modal for activity CRUD
creator/         # Modal for creator management
```

**Components (components/):**
```
core/            # Business logic components
  dashboard/     # Leaderboard, UserCard, etc.
  settings/      # MyActivities, EditProfileField
ui/              # Gluestack UI wrapper components
```

**Convex Backend (convex/):**
```
auth.ts          # Convex Auth configuration
ResendOTP.ts     # Email OTP provider (uses SMTP)
email.ts         # Internal SMTP action ("use node")
http.ts          # HTTP endpoints with basic auth
activities.ts    # Core activity CRUD
leaderboard.ts   # Monthly point aggregation
```

### State Management

**Global State (Zustand):**
- `useAuthStore`: User authentication and profile
- `useTabStore`: Tab navigation state persistence

**Server State:** Convex queries/mutations with React Query integration
**Local Storage:** MMKV for performance, SecureStore for auth tokens

### Health Data Sync Architecture

**Dual Mode Operation:**
- **Auto Sync**: Daily background sync from health apps (iOS/Android)
- **Manual Entry**: User-submitted activities requiring admin approval

**Sync Process:**
1. `useHealthSync` hook checks for missed days
2. Batch queries health APIs for date ranges
3. Validates and transforms data to common format
4. Upserts to `dailyActivities` with `synced: true`

**Manual Entry Approval:**
- Users submit activities with optional photo proof
- Admins review via `settings/admin/pending-approvals`
- Approved entries calculate points and update leaderboard

### Push Notifications

**Cron-Triggered Events:**
- Daily reminders (timezone-aware)
- Activity approval notifications
- Monthly reward unlock alerts

**Implementation:**
- `expo-notifications` for client-side handling
- `@convex-dev/expo-push-notifications` for server-side sending
- Deep linking to relevant screens via notification data

### Development Patterns

**Error Handling:**
```typescript
import { CatchPromise } from 'utils/catch-promise'
const [result, error] = await CatchPromise(asyncOperation())
```

**Type Safety:**
- Convex auto-generates types from schema
- Custom type definitions in `utils/types.ts`

**Styling:**
- NativeWind (Tailwind) for consistent utility classes
- Custom design system via Gluestack UI configuration

**Modal Patterns:**
- Activity/Creator editing uses modal presentation
- Consistent navigation patterns with `router.back()`

### Admin Features

**Access Control:**
- `isAdmin` flag in user profile enables admin routes
- Admin-only screens under `settings/admin/`

**Key Admin Functions:**
- User management and activity approval
- Creator/video content management
- Rewards banner configuration
- Pending approvals workflow

### Email System (SMTP)

**Internal Action:** `convex/email.ts` uses nodemailer with "use node"
**HTTP Endpoint:** `/api/send-email` with basic auth protection
**Environment Variables Required:**
```
SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM_NAME
BASIC_AUTH_USERNAME, BASIC_AUTH_PASSWORD
```

### Common Development Tasks

**Adding New Activity Types:**
1. Update points calculation in `convex/activities.ts`
2. Modify health sync logic in `hooks/useHealthSync.ts`
3. Update UI in `components/core/settings/MyActivities.tsx`

**Adding Admin Features:**
1. Create admin-only route under `app/(tabs)/dashboard/settings/admin/`
2. Add admin check in route component
3. Implement Convex mutations with user permission validation

**Modifying Leaderboard Logic:**
1. Update aggregation in `convex/leaderboard.ts`
2. Modify display components in `components/core/dashboard/`
3. Test with monthly cron job simulation


# Trigger.dev — see [TRIGGER_DEV.md](./TRIGGER_DEV.md) for full SDK reference
