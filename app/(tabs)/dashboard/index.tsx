import { useMutation, useQuery } from 'convex/react';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import {
  Barbell,
  Camera,
  Footprints,
  ForkKnife,
  Check,
  LockSimple,
  MoonStars,
  ShareNetwork,
} from 'phosphor-react-native';
import { useCallback, useEffect, useState } from 'react';
import {
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';

import { Avatar } from '~/components/core/Avatar';
import SafeAreaView from '~/components/core/SafeAreaView';
import ScreenLoading from '~/components/core/ScreenLoading';
import { PrototypeButton as CoachActionButton } from '~/components/core/auth/PrototypeOnboarding';
import CoachCheckInFlow from '~/components/core/dashboard/CoachCheckInFlow';
import TodayPlanSheet from '~/components/core/dashboard/TodayPlanSheet';
import TodayWeeklyStreak from '~/components/core/dashboard/TodayWeeklyStreak';
import { prototypeTypography as type } from '~/components/core/design/prototypeStyles';
import { useRevenueCat } from '~/components/providers/RevenueCatProvider';
import { Text } from '~/components/ui/text';
import { api } from '~/convex/_generated/api';
import { Id } from '~/convex/_generated/dataModel';
import { useCoachRouteGuard } from '~/hooks/useCoachRouteGuard';
import { useHealthSync } from '~/hooks/useHealthSync';
import { TARGETS } from '~/shared/activityGoals';
import { checkInPostRoute } from '~/shared/coachCheckInPresentation';
import { COACH_CATEGORIES, CoachCategory } from '~/shared/coachFoundation';
import {
  activityProgressFraction,
  bannerAvatarMembers,
  planBannerLabel,
  planBannerState,
  todayTiles,
  displayStepTarget,
  TODAY_PROGRESS_ROUTES,
  progressCardWeek,
} from '~/shared/coachToday';
import { pointsLabel } from '~/shared/pointsLabel';
import { useRefreshStore } from '~/store/useRefreshStore';

const ORANGE = '#E8541E';
const ICONS = { workout: Barbell, meals: ForkKnife, sleep: MoonStars, steps: Footprints } as const;
const LABELS = { workout: 'Workout', meals: 'Meals', sleep: 'Sleep', steps: 'Steps' } as const;
const TODAY_ROUTE = ['today'] as const;

function localRemaining(nextMidnightAt: number, now: number) {
  const seconds = Math.max(0, Math.ceil((nextMidnightAt - now) / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${String(minutes).padStart(2, '0')}m left`;
}
function photoDate(weekStart: string) {
  const [year, month, day] = weekStart.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

export default function TodayScreen() {
  const { accepted, decision } = useCoachRouteGuard(TODAY_ROUTE);
  const dayRefresh = decision ? Number(decision.day.replaceAll('-', '')) : 0;
  const currentUser = useQuery(api.users.current, accepted ? {} : 'skip');
  const plan = useQuery(
    api.revenueCatEntitlements.myPlan,
    accepted ? { refresh: dayRefresh } : 'skip'
  );
  const ensureStandaloneAssignments = useMutation(api.coachCheckIns.ensureStandaloneAssignments);
  const checkIns = useQuery(api.coachCheckIns.myToday, accepted ? { refresh: dayRefresh } : 'skip');
  const banner = useQuery(api.coachToday.myBanner, accepted ? { refresh: dayRefresh } : 'skip');
  const avatarMembers = bannerAvatarMembers(banner);
  const progress = useQuery(
    api.progressPhotos.getDashboard,
    accepted && plan?.access ? {} : 'skip'
  );
  const activity = useQuery(
    api.activities.getPointsForDate,
    accepted && decision ? { date: decision.day } : 'skip'
  );
  const streak = useQuery(
    api.challengeCompletions.getUserStreaksForMonth,
    accepted ? { refresh: dayRefresh } : 'skip'
  );
  const points = useQuery(
    api.challengeCompletions.getPointsEarnedToday,
    accepted ? { refresh: dayRefresh } : 'skip'
  );
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const [photoView, setPhotoView] = useState<'front' | 'side'>('front');
  const incrementRefreshKey = useRefreshStore((state) => state.incrementRefreshKey);
  const { syncAllMissedDays } = useHealthSync(
    currentUser?._id as Id<'users'>,
    undefined,
    currentUser?.birthdate
  );
  const [refreshing, setRefreshing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [activeSheet, setActiveSheet] = useState<'plan' | CoachCategory | null>(null);
  const planSheetOpen = activeSheet === 'plan';
  const [planContentHeight, setPlanContentHeight] = useState(0);
  const updatePlanHeight = useCallback((height: number) => {
    setPlanContentHeight((previous) => (Math.abs(previous - height) > 2 ? height : previous));
  }, []);
  const activeCheckIn = activeSheet === 'plan' ? null : activeSheet;
  const [restoreMessage, setRestoreMessage] = useState('');
  const { checkIn } = useLocalSearchParams<{ checkIn?: string }>();
  const [checkInExpanded, setCheckInExpanded] = useState(false);
  const [checkInPreferredHeight, setCheckInPreferredHeight] = useState(0);
  const { restorePermissions } = useRevenueCat();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (
      plan?.access &&
      !plan.plan &&
      checkIns?.status === 'no_plan' &&
      checkIns.assignments.length < 4
    )
      ensureStandaloneAssignments({}).catch(() => {});
  }, [
    plan?.access,
    plan?.plan,
    checkIns?.status,
    checkIns?.assignments.length,
    ensureStandaloneAssignments,
  ]);
  useEffect(() => {
    const selected = COACH_CATEGORIES.find((item) => item === checkIn);
    if (!selected || !plan?.access) return;
    setCheckInPreferredHeight(0);
    setActiveSheet(selected);
    router.setParams({ checkIn: undefined });
  }, [checkIn, plan?.access]);
  const bannerState = plan
    ? planBannerState({
        access: plan.access,
        requestStatus: plan.requestStatus,
        hasPlan: Boolean(plan.plan),
        canRetry: plan.canRetry,
      })
    : 'pending';
  const tiles = todayTiles(
    checkIns?.status === 'ready' || checkIns?.status === 'no_plan'
      ? checkIns.assignments
      : undefined
  );
  const stepAssignment = checkIns?.assignments.find((item) => item.category === 'steps');
  const stepTarget = displayStepTarget(stepAssignment);
  const activeMinuteTarget = TARGETS.week.activeMinutes;
  const firstName = currentUser?.name?.trim().split(' ')[0] || 'there';
  const hour = Number(
    new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      hourCycle: 'h23',
      timeZone: currentUser?.timezone || 'UTC',
    }).format(new Date(now))
  );
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const photos = progress?.photos ?? [];
  const firstPhoto = photos[0];
  const latestPhoto = photos.length > 1 ? photos[photos.length - 1] : undefined;
  const canLogProgress = Boolean(progress?.canLogCurrentWeek);
  const progressWeek = progressCardWeek(photos.length, canLogProgress);
  const canShareProgress = Boolean(firstPhoto?.frontUrl && latestPhoto?.frontUrl);
  const nextPhotoAvailable = Boolean(
    firstPhoto && !latestPhoto && progressWeek > 1 && canLogProgress
  );

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => {
      clearInterval(timer);
    };
  }, []);

  const openPlan = () => {
    if (bannerState === 'locked') return;
    setActiveSheet('plan');
  };
  const openTile = (category: CoachCategory) => {
    if (!plan?.access) return;
    setCheckInExpanded(false);
    setCheckInPreferredHeight(0);
    setActiveSheet(category);
  };
  const closeCheckIn = useCallback(() => {
    setActiveSheet(null);
    setCheckInExpanded(false);
    setCheckInPreferredHeight(0);
  }, []);
  const updateCheckInHeight = useCallback((height: number) => {
    setCheckInPreferredHeight((previous) => (Math.abs(previous - height) > 4 ? height : previous));
  }, []);
  const refresh = async () => {
    setRefreshing(true);
    try {
      await syncAllMissedDays();
      incrementRefreshKey();
    } finally {
      setRefreshing(false);
    }
  };
  if (!accepted || !decision || !currentUser || !plan) return <ScreenLoading />;
  return (
    <SafeAreaView
      className="flex-1 bg-white"
      style={
        Platform.OS === 'android'
          ? { paddingLeft: insets.left, paddingRight: insets.right }
          : undefined
      }>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingTop: Platform.OS === 'android' ? insets.top : 0,
          paddingBottom: 40 + insets.bottom,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
        <View className="mx-[22px] mb-10 mt-3 flex-row items-center justify-between">
          <View className="min-w-0 flex-1 pr-3">
            <Text style={type.caption}>
              Today · {points ? points.earned : '—'} {points?.earned === 1 ? 'pt' : 'pts'}
            </Text>
            <Text style={type.todayTitle} className="mt-1">
              {greeting}, {firstName}
            </Text>
          </View>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Open your profile and settings"
            onPress={() => router.push('/(tabs)/dashboard/settings')}
            className="min-h-11 min-w-11 items-center justify-center"
            style={{
              shadowColor: '#1E140A',
              shadowOpacity: 0.14,
              shadowRadius: 6,
              shadowOffset: { width: 0, height: 2 },
            }}>
            <Avatar uri={currentUser.image ?? undefined} size={44} name={currentUser.name} />
          </TouchableOpacity>
        </View>

        {streak ? (
          <TodayWeeklyStreak
            daysEarned={streak.currentWeekDays}
            target={streak.currentWeekTarget}
            refresh={dayRefresh}
          />
        ) : (
          <View className="mx-5 mb-4 rounded-[24px] bg-white p-5">
            <Text style={type.caption} accessibilityLiveRegion="polite">
              Weekly streak is loading.
            </Text>
          </View>
        )}

        <Text style={type.sectionHeading} className="mx-[22px] mb-3.5">
          Your plan
        </Text>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={`${planBannerLabel(bannerState)}. ${banner ? (banner.memberCount === 0 ? 'Be the first to check in' : `${banner.memberCount} sweat ${banner.memberCount === 1 ? 'sister' : 'sisters'} checked in today`) : 'Community check-ins unavailable'}`}
          accessibilityState={{ disabled: bannerState === 'locked' }}
          disabled={bannerState === 'locked'}
          activeOpacity={0.88}
          onPress={openPlan}
          className="mx-[22px] mb-10 overflow-hidden rounded-[22px] bg-[#3A3A40]"
          style={{ minHeight: 240 }}>
          <Image
            source={require('~/assets/backgrounds/today-plan-gym.jpg')}
            contentFit="cover"
            contentPosition={{ left: '50%', top: '40%' }}
            style={{ position: 'absolute', width: '100%', height: '100%' }}
            accessibilityIgnoresInvertColors
          />
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              bottom: 0,
              left: 0,
              backgroundColor: 'rgba(12,10,16,0.42)',
            }}
          />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.7)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={{ position: 'absolute', height: 170, right: 0, bottom: 0, left: 0 }}
          />
          <View
            style={{
              minHeight: 240,
              paddingHorizontal: 16,
              paddingVertical: 16,
              justifyContent: 'space-between',
            }}>
            <Text style={[type.supporting, { color: 'rgba(255,255,255,0.85)' }]}>
              {banner ? localRemaining(banner.nextMidnightAt, now) : 'Day timer unavailable'}
            </Text>
            <View className="flex-row items-end justify-between gap-3">
              <View className="min-w-0 flex-1">
                {avatarMembers.length ? (
                  <View className="mb-2 flex-row items-center" accessible={false}>
                    {avatarMembers.map((member, index) => (
                      <View
                        key={member.userId}
                        style={{
                          borderWidth: 2,
                          borderColor: 'white',
                          borderRadius: 18,
                          marginLeft: index ? -8 : 0,
                        }}>
                        <Avatar uri={member.imageUrl ?? undefined} name={member.name} size={28} />
                      </View>
                    ))}
                    {banner && banner.memberCount > 4 ? (
                      <View
                        className="items-center justify-center border-2 border-white bg-[#D7BBA4]"
                        style={{ width: 32, height: 32, borderRadius: 16, marginLeft: -8 }}>
                        <Text style={[type.smallCaption, { color: '#fff' }]}>
                          +{banner.memberCount - 4}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                ) : null}
                <Text style={[type.smallCaption, { color: '#fff' }]}>
                  {banner
                    ? banner.memberCount === 0
                      ? 'Be the first to check in'
                      : `${banner.memberCount} sweat ${banner.memberCount === 1 ? 'sister' : 'sisters'} checked in`
                    : 'Community check-ins unavailable'}
                </Text>
              </View>
              <View className="min-h-10 max-w-[48%] flex-row items-center justify-center rounded-full bg-white px-[26px] py-2">
                <Text
                  style={[type.bannerButton, { textAlign: 'center' }]}
                  className="min-w-0 shrink">
                  {bannerState === 'no_plan'
                    ? 'Get plan'
                    : bannerState === 'ready'
                      ? 'View plan'
                      : planBannerLabel(bannerState)}
                </Text>
              </View>
            </View>
          </View>
        </TouchableOpacity>

        {!plan.access ? (
          <View className="mx-5 mb-5 rounded-2xl bg-white p-4">
            <Text style={type.cardTitle}>Premium access is unavailable</Text>
            <Text style={type.supporting} className="mt-1">
              Your saved plan and check-ins remain private until a purchase is verified again.
            </Text>
            <CoachActionButton
              label="Restore purchases"
              loading={restoring}
              disabled={restoring || !restorePermissions}
              onPress={async () => {
                if (!restorePermissions) return;
                setRestoring(true);
                setRestoreMessage('');
                try {
                  const result = await restorePermissions();
                  setRestoreMessage(
                    result === 'active'
                      ? 'Purchase restored.'
                      : result === 'pending'
                        ? 'Verification is pending. Your access will update when it is verified.'
                        : 'No active purchase was found.'
                  );
                } catch {
                  setRestoreMessage('Restore failed. Please try again.');
                } finally {
                  setRestoring(false);
                }
              }}
              className="mt-3"
            />
            {restoreMessage ? (
              <Text style={type.supporting} className="mt-2">
                {restoreMessage}
              </Text>
            ) : null}
          </View>
        ) : null}

        <View className="mx-[22px] mb-10">
          <Text style={type.sectionHeading} className="mb-[18px]">
            Your check-ins
          </Text>
          <View className="gap-[18px]">
            {tiles.map((tile) => {
              const Icon = ICONS[tile.category];
              const inactive = tile.completed;
              const detail = !plan.access
                ? 'Premium access unavailable'
                : tile.category === 'workout' && !plan.plan
                  ? 'Log a workout'
                  : tile.category === 'meals'
                    ? `${tile.earned} of 3 logged`
                    : tile.category === 'sleep' && !plan.plan
                      ? '7 hours sleep'
                      : tile.category === 'steps'
                        ? `${new Intl.NumberFormat('en-US').format(activity?.totalSteps ?? 0)} / ${stepTarget ?? '10,000'} steps`
                        : (tile.assignment?.label ?? '');
              return (
                <TouchableOpacity
                  key={tile.category}
                  accessibilityRole="button"
                  accessibilityLabel={`${LABELS[tile.category]}, ${detail}${tile.category === 'meals' ? `, ${tile.earned} of 3 shared` : tile.completed ? ', completed' : ''}`}
                  accessibilityState={{ disabled: !plan.access }}
                  disabled={!plan.access}
                  onPress={() => openTile(tile.category)}
                  className="min-h-12 flex-row items-center">
                  <View
                    className="mr-[14px] h-12 w-12 items-center justify-center rounded-2xl"
                    style={{ backgroundColor: inactive ? '#F5F5F5' : '#FFF3EA' }}>
                    <Icon color={inactive ? '#B3B3B3' : ORANGE} size={24} />
                  </View>
                  <View className="min-w-0 flex-1 pr-3">
                    <Text
                      style={[type.compactCardTitle, { color: inactive ? '#8A8A8A' : '#2A2A2A' }]}>
                      {LABELS[tile.category]}
                    </Text>
                    <Text style={type.caption} className="mt-[1px]">
                      {detail}
                    </Text>
                  </View>
                  <View className="h-[26px] w-[26px] items-center justify-center rounded-full border-[1.5px] border-[#D9D9D9]">
                    {inactive ? <Check size={17} color="#8A8A8A" /> : null}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View className="mx-[22px] mb-[52px] overflow-hidden rounded-[22px] bg-[#2A2A2E] p-5">
          <Image
            source={require('~/assets/backgrounds/today-activity-equipment.jpg')}
            contentFit="cover"
            contentPosition={{ left: '70%', top: '50%' }}
            style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }}
            accessibilityIgnoresInvertColors
          />
          <LinearGradient
            colors={['rgba(14,12,12,0.84)', 'rgba(14,12,12,0.68)', 'rgba(14,12,12,0.46)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
          />
          <Text style={[type.sectionHeading, { color: '#fff' }]}>Your activity</Text>
          {activity ? (
            <>
              <View
                className="mt-[18px] flex-row items-center gap-4"
                accessible
                accessibilityLabel={`${activity.totalZone2Minutes} of ${activeMinuteTarget} active minutes, ${activity.zone2Points} points`}>
                <View className="h-[116px] w-[116px] items-center justify-center">
                  <Svg
                    width={116}
                    height={116}
                    style={{ position: 'absolute' }}
                    viewBox="0 0 116 116">
                    <Circle
                      cx={58}
                      cy={58}
                      r={46}
                      stroke="rgba(255,255,255,0.16)"
                      strokeWidth={10}
                      fill="none"
                    />
                    <Circle
                      cx={58}
                      cy={58}
                      r={46}
                      stroke="#FFD9B8"
                      strokeWidth={10}
                      fill="none"
                      strokeLinecap="round"
                      strokeDasharray={2 * Math.PI * 46}
                      strokeDashoffset={
                        2 *
                        Math.PI *
                        46 *
                        (1 -
                          activityProgressFraction(activity.totalZone2Minutes, activeMinuteTarget))
                      }
                      rotation={-90}
                      origin="58, 58"
                    />
                  </Svg>
                  <Text style={type.activityMetric}>{activity.totalZone2Minutes}</Text>
                  <Text style={[type.smallCaption, { color: 'rgba(255,255,255,0.7)' }]}>mins</Text>
                </View>
                <View className="min-w-0 flex-1">
                  <Text style={[type.compactCardTitle, { color: '#fff' }]}>Active minutes</Text>
                  <Text style={[type.caption, { color: 'rgba(255,255,255,0.7)' }]} className="mt-1">
                    {activity.totalZone2Minutes} / {activeMinuteTarget} mins
                  </Text>
                  <Text style={[type.caption, { color: '#FFD9B8' }]} className="mt-2">
                    {activity.zone2Points} {pointsLabel(activity.zone2Points)}
                  </Text>
                </View>
              </View>
            </>
          ) : (
            <Text style={[type.supporting, { color: 'rgba(255,255,255,0.8)' }]} className="mt-4">
              Activity is unavailable right now.
            </Text>
          )}
        </View>

        <View className="mx-[22px]">
          <View className="flex-row items-center justify-between">
            <Text style={type.sectionHeading}>Your progress</Text>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="See all progress"
              onPress={() => router.push(TODAY_PROGRESS_ROUTES.seeAll)}>
              <Text style={[type.supporting, { color: '#F05831' }]}>See all</Text>
            </TouchableOpacity>
          </View>

          <View className="mb-5 mt-4 flex-row gap-7">
            {(['front', 'side'] as const).map((view) => (
              <TouchableOpacity
                key={view}
                accessibilityRole="tab"
                accessibilityState={{ selected: photoView === view }}
                onPress={() => setPhotoView(view)}
                className="min-h-11 justify-center border-b-2"
                style={{ borderColor: photoView === view ? ORANGE : 'transparent' }}>
                <Text
                  style={[
                    type.photoTab,
                    {
                      color: photoView === view ? ORANGE : '#6F6F6F',
                      fontFamily: photoView === view ? 'Inter_600SemiBold' : 'Inter_400Regular',
                    },
                  ]}>
                  {view === 'front' ? 'Front view' : 'Side view'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {!plan.access ? (
            <View className="rounded-2xl bg-[#F5F3F1] p-5">
              <LockSimple color={ORANGE} />
              <Text style={type.supporting} className="mt-2">
                Progress comparison is locked while Premium access is unavailable.
              </Text>
            </View>
          ) : !progress ? (
            <Text
              style={[type.supporting, { color: '#77716D', textAlign: 'center' }]}
              className="py-8">
              Progress photos are loading.
            </Text>
          ) : (
            <>
              <View className="flex-row justify-between gap-3">
                {[firstPhoto, latestPhoto].map((photo, index) => (
                  <View
                    key={index}
                    accessible
                    accessibilityLabel={
                      photo
                        ? `Week ${index === 0 ? 1 : photos.length} progress photo, ${photoDate(photo.weekStart)}`
                        : index === 0 || nextPhotoAvailable
                          ? `Week ${index === 0 ? 1 : progressWeek}, add a photo`
                          : 'Next progress comparison unlocks after Week 1'
                    }
                    className="flex-1 overflow-hidden rounded-[22px]"
                    style={{
                      aspectRatio: 0.71,
                      backgroundColor: index === 0 ? '#FFF9F6' : '#F3F0ED',
                    }}>
                    {(photoView === 'front' ? photo?.frontUrl : photo?.sideUrl) ? (
                      <Image
                        source={{
                          uri:
                            (photoView === 'front' ? photo?.frontUrl : photo?.sideUrl) ?? undefined,
                        }}
                        contentFit="cover"
                        style={{ width: '100%', height: '100%' }}
                      />
                    ) : (
                      <View className="flex-1 items-center justify-center p-3">
                        {index === 0 || nextPhotoAvailable ? (
                          <Camera color={ORANGE} size={30} />
                        ) : (
                          <LockSimple color={ORANGE} size={27} />
                        )}
                        {index === 0 || nextPhotoAvailable ? (
                          <>
                            {index !== 0 ? (
                              <Text
                                style={[type.compactCardTitle, { textAlign: 'center' }]}
                                className="mt-3">
                                Week {progressWeek}
                              </Text>
                            ) : null}
                            <Text
                              style={[type.smallCaption, { color: '#77716D', textAlign: 'center' }]}
                              className="mt-1">
                              {photo ? 'Photo unavailable' : 'Add a photo'}
                            </Text>
                          </>
                        ) : (
                          <Text
                            style={[type.smallCaption, { color: '#817A76', textAlign: 'center' }]}
                            className="mt-3">
                            Unlocks after Week 1
                          </Text>
                        )}
                      </View>
                    )}
                    {photo ? (
                      <LinearGradient
                        colors={['transparent', 'rgba(0,0,0,0.55)']}
                        style={{
                          position: 'absolute',
                          bottom: 0,
                          left: 0,
                          right: 0,
                          paddingHorizontal: 14,
                          paddingBottom: 14,
                          paddingTop: 40,
                        }}>
                        <Text style={[type.compactCardTitle, { color: '#fff' }]}>
                          Week {index === 0 ? 1 : photos.length}
                        </Text>
                        <Text style={[type.smallCaption, { color: 'rgba(255,255,255,0.8)' }]}>
                          {photoDate(photo.weekStart)}
                        </Text>
                      </LinearGradient>
                    ) : null}
                  </View>
                ))}
              </View>
              <View className="mt-5 flex-row justify-between">
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={
                    canLogProgress
                      ? `Log Week ${progressWeek} photo`
                      : 'Progress photo already logged this week'
                  }
                  accessibilityState={{ disabled: !canLogProgress }}
                  disabled={!canLogProgress}
                  onPress={() => router.push(TODAY_PROGRESS_ROUTES.log)}
                  className="min-h-11 flex-1 flex-row items-center justify-center p-2"
                  style={{ opacity: canLogProgress ? 1 : 0.45 }}>
                  <Camera size={20} color={ORANGE} />
                  <Text style={type.compactAction} className="ml-2">
                    {canLogProgress ? `Log Week ${progressWeek}` : `Week ${progressWeek} logged`}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Share or save progress comparison"
                  accessibilityState={{ disabled: !canShareProgress }}
                  disabled={!canShareProgress}
                  onPress={() => router.push(TODAY_PROGRESS_ROUTES.share as any)}
                  className="min-h-11 flex-1 flex-row items-center justify-center p-2"
                  style={{ opacity: canShareProgress ? 1 : 0.45 }}>
                  <ShareNetwork size={20} color={ORANGE} />
                  <Text style={type.compactAction} className="ml-2">
                    Share / Save
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </ScrollView>
      {/* One native host avoids overlapping iOS presentation/dismissal transitions. */}
      <Modal
        visible={activeSheet !== null}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={closeCheckIn}>
        <View className="flex-1 justify-end bg-black/45" accessibilityViewIsModal>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={planSheetOpen ? 'Dismiss today’s plan' : 'Dismiss check-in'}
            activeOpacity={1}
            onPress={closeCheckIn}
            style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
          />
          <View
            className="overflow-hidden rounded-t-[28px] bg-white"
            style={{
              maxHeight: screenHeight - insets.top - 12,
              height: planSheetOpen
                ? Math.min(
                    screenHeight - insets.top - 12,
                    screenHeight * 0.92,
                    planContentHeight
                      ? Math.max(320, planContentHeight + insets.bottom)
                      : screenHeight * 0.92
                  )
                : checkInExpanded
                  ? '88%'
                  : Math.min(
                      Math.max(checkInPreferredHeight + insets.bottom, 360),
                      screenHeight - insets.top - 20
                    ),
              paddingBottom: insets.bottom,
            }}>
            {planSheetOpen ? (
              <TodayPlanSheet
                onContentHeight={updatePlanHeight}
                firstName={firstName}
                plan={plan}
                checkIns={checkIns}
                onClose={closeCheckIn}
                onCheckIn={openTile}
              />
            ) : activeCheckIn ? (
              <CoachCheckInFlow
                key={activeCheckIn}
                category={activeCheckIn}
                initialToday={checkIns?.day === decision.day ? checkIns : undefined}
                initialCurrentUser={currentUser}
                onClose={closeCheckIn}
                onCaptured={() => {
                  const selected = activeCheckIn;
                  closeCheckIn();
                  router.push(checkInPostRoute(selected));
                }}
                onExpandedChange={setCheckInExpanded}
                onPreferredHeightChange={updateCheckInHeight}
                onOpenPlan={() => {
                  setCheckInExpanded(false);
                  setCheckInPreferredHeight(0);
                  setActiveSheet('plan');
                }}
              />
            ) : null}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
