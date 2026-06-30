import { convexQuery } from '@convex-dev/react-query';
import { useQuery as useTanstackQuery } from '@tanstack/react-query';
import { useQuery } from 'convex/react';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Check, LockSimple } from 'phosphor-react-native';
import { useEffect, useMemo, useState } from 'react';
import { TouchableOpacity, View } from 'react-native';

import {
  AlertDialog,
  AlertDialogBackdrop,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
} from '@/components/ui/alert-dialog';
import { Button, ButtonText } from '@/components/ui/button';
import { useRevenueCat } from '~/components/providers/RevenueCatProvider';
import { Text } from '~/components/ui/text';
import { api } from '~/convex/_generated/api';
import { useAuthStore } from '~/store/useAuthStore';
import { useTabStore } from '~/store/useTabStore';
import { storage } from '~/utils/storage';
import { formatDateYYYYMMDD } from '~/utils/timezone';

import { DailyLimitReachedModal, SKIP_DAILY_LIMIT_POPUP_KEY } from './DailyLimitReachedModal';

type Period = 'today' | 'week';

type SweatStats = {
  steps: number;
  activeMinutes: number;
  moves: number;
  points: number;
};

const TARGETS: Record<Period, Omit<SweatStats, 'points'>> = {
  today: {
    steps: 5000,
    activeMinutes: 50,
    moves: 1,
  },
  week: {
    steps: 35000,
    activeMinutes: 150,
    moves: 5,
  },
};

const emptyStats: SweatStats = {
  steps: 0,
  activeMinutes: 0,
  moves: 0,
  points: 0,
};

const formatNumber = (value: number) => {
  return new Intl.NumberFormat('en-US').format(Math.max(0, Math.floor(value || 0)));
};

const toNumber = (value: unknown) => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
};

const getTodayWeekIndex = () => {
  const day = new Date().getDay();
  return day === 0 ? 6 : day - 1;
};

function useTrackOverview(enabled: boolean) {
  return useQuery(api.track.queries.getTrackOverview, enabled ? {} : 'skip');
}

const getWeekStats = (overview: any): SweatStats => {
  const days = overview?.currentWeek?.days ?? [];

  return days.reduce(
    (total: SweatStats, day: any) => ({
      steps: total.steps + toNumber(day?.steps),
      activeMinutes: total.activeMinutes + toNumber(day?.activeMinutes ?? day?.zone2Minutes),
      moves: total.moves + toNumber(day?.moves),
      points: total.points + toNumber(day?.points),
    }),
    emptyStats
  );
};

export default function TodaysSweat({ refreshKey }: { refreshKey: number }) {
  const [period, setPeriod] = useState<Period>('today');
  const [showTooltip, setShowTooltip] = useState(false);
  const [showDailyLimitModal, setShowDailyLimitModal] = useState(false);

  const { isPro } = useRevenueCat();
  const currentTab = useTabStore((state) => state.currentTab);
  const currentUser = useAuthStore((state) => state.currentUser);
  const canLoadUserData = !!currentUser?._id;

  const overview = useTrackOverview(canLoadUserData);

  const formattedDate = useMemo(
    () => formatDateYYYYMMDD(new Date(), Intl.DateTimeFormat().resolvedOptions().timeZone),
    [refreshKey]
  );

  const { data: pointsForDate } = useTanstackQuery(
    convexQuery(api.activities.getPointsForDate, canLoadUserData ? { date: formattedDate } : 'skip')
  );

  const pointsToday = useQuery(
    api.challengeCompletions.getPointsEarnedToday,
    canLoadUserData ? {} : 'skip'
  );

  useEffect(() => {
    if (!pointsToday) return;
    if (pointsToday.isPremium) return;
    if (!pointsToday.isCapped) return;
    if (storage.getBoolean(SKIP_DAILY_LIMIT_POPUP_KEY)) return;

    const today = formatDateYYYYMMDD(new Date(), Intl.DateTimeFormat().resolvedOptions().timeZone);
    const shownKey = `daily_limit_popup_shown_${today}`;

    if (storage.getBoolean(shownKey)) return;

    storage.set(shownKey, true);
    setShowDailyLimitModal(true);
  }, [pointsToday]);

  const todayRow =
    overview?.currentWeek?.days?.find((day: any) => day?.isToday) ??
    overview?.currentWeek?.days?.[getTodayWeekIndex()];

  const hasPointsForDate = pointsForDate !== undefined;

  const todayStats: SweatStats = {
    steps: hasPointsForDate ? toNumber(pointsForDate?.totalSteps) : toNumber(todayRow?.steps),

    activeMinutes: hasPointsForDate
      ? toNumber(pointsForDate?.totalZone2Minutes)
      : toNumber(todayRow?.activeMinutes ?? todayRow?.zone2Minutes),

    moves: toNumber(todayRow?.moves),

    points: Math.max(toNumber(pointsToday?.earned), toNumber(todayRow?.points)),
  };

  const weekStats = overview ? getWeekStats(overview) : emptyStats;

  const selectedStats = period === 'today' ? todayStats : weekStats;
  const selectedTargets = period === 'today' ? TARGETS.today : TARGETS.week;

  const pointsBadgeText =
    period === 'today'
      ? pointsToday
        ? `${
            pointsToday.isPremium
              ? pointsToday.earned
              : Math.min(pointsToday.earned, pointsToday.cap)
          } pts`
        : '0 pts'
      : `${formatNumber(weekStats.points)} pts`;

  const isDailyCapped = period === 'today' && !!pointsToday?.isCapped;

  return (
    <View
      className="rounded-[26px] bg-white px-6 py-6"
      style={{
        marginHorizontal: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.06,
        shadowRadius: 18,
      }}>
      <Text className="mb-4 font-heading text-xl font-bold text-[#1A1A1A]" numberOfLines={1}>
        Your Activity
      </Text>

      <View className="flex-row items-center justify-between">
        <View className="flex-row rounded-2xl bg-[#EEEEEE] p-1">
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => setPeriod('today')}
            className="rounded-xl px-8 py-2.5"
            style={{
              backgroundColor: period === 'today' ? '#FFFFFF' : 'transparent',
              shadowColor: period === 'today' ? '#000' : 'transparent',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: period === 'today' ? 0.08 : 0,
              shadowRadius: 5,
              elevation: period === 'today' ? 2 : 0,
            }}>
            <Text
              className="font-body text-sm font-bold"
              style={{ color: period === 'today' ? '#FF4B1F' : '#8B8B8B' }}>
              Today
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => setPeriod('week')}
            className="rounded-xl px-8 py-2.5"
            style={{
              backgroundColor: period === 'week' ? '#FFFFFF' : 'transparent',
              shadowColor: period === 'week' ? '#000' : 'transparent',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: period === 'week' ? 0.08 : 0,
              shadowRadius: 5,
              elevation: period === 'week' ? 2 : 0,
            }}>
            <Text
              className="font-body text-sm font-bold"
              style={{ color: period === 'week' ? '#FF4B1F' : '#8B8B8B' }}>
              This Week
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => setShowTooltip(true)}
          className="flex-row items-center gap-x-1 rounded-full bg-[#FFECE4] px-4 py-2">
          {isDailyCapped && <LockSimple size={13} color="#FF4B1F" weight="bold" />}

          <Text className="font-heading text-sm font-extrabold text-[#FF4B1F]">
            {pointsBadgeText}
          </Text>
        </TouchableOpacity>
      </View>

      <View className="mt-6">
        <SweatProgressRow
          title="Steps"
          value={selectedStats.steps}
          target={selectedTargets.steps}
          completed={selectedStats.steps >= selectedTargets.steps}
          period={period}
          showDivider
        />

        <SweatProgressRow
          title="Active minutes"
          value={selectedStats.activeMinutes}
          target={selectedTargets.activeMinutes}
          completed={selectedStats.activeMinutes >= selectedTargets.activeMinutes}
          period={period}
          showDivider
        />

        <SweatProgressRow
          title="Progress Videos"
          value={selectedStats.moves}
          target={selectedTargets.moves}
          completed={selectedStats.moves >= selectedTargets.moves}
          period={period}
        />
      </View>

      {isDailyCapped && (
        <View className="mt-5 flex-row flex-wrap items-center justify-center">
          <Text className="font-body text-sm text-[#1A1A1A]">Daily cap reached. </Text>

          <TouchableOpacity
            onPress={() => router.push({ pathname: `/(tabs)/${currentTab}/paywall` as any })}>
            <Text className="font-body text-sm font-medium text-primary-500">
              Upgrade to keep earning →
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <HowToEarnPointsModal
        isOpen={showTooltip}
        onClose={() => setShowTooltip(false)}
        cap={pointsToday?.cap ?? 10}
        isPremium={isPro}
        currentTab={currentTab}
      />

      <DailyLimitReachedModal
        showAlertDialog={showDailyLimitModal}
        handleClose={() => setShowDailyLimitModal(false)}
        handleUpgrade={() => router.push({ pathname: `/(tabs)/${currentTab}/paywall` as any })}
        cap={pointsToday?.cap ?? 10}
      />
    </View>
  );
}

function SweatProgressRow({
  title,
  value,
  target,
  completed,
  period,
  showDivider,
}: {
  title: string;
  value: number;
  target: number;
  completed: boolean;
  period: Period;
  showDivider?: boolean;
}) {
  const safeTarget = Math.max(1, target);
  const progress = Math.min(100, (value / safeTarget) * 100);

  return (
    <View className={showDivider ? 'mb-3.5 pb-3.5' : ''}>
      <View className="flex-row items-center">
        <View
          className="mr-4 items-center justify-center rounded-full"
          style={{
            width: 32,
            height: 32,
            backgroundColor: completed ? '#FFECE4' : '#F1F1F1',
          }}>
          {completed &&
            (period === 'week' ? (
              <Check size={18} color="#FF4B1F" weight="bold" />
            ) : (
              <Image
                source={require('~/assets/icons/Flame.png')}
                style={{ width: 16, height: 16 }}
                contentFit="contain"
              />
            ))}
        </View>

        <View className="flex-1">
          <View className="flex-row items-center justify-between">
            <Text className="font-body text-sm font-bold text-[#1A1A1A]">{title}</Text>

            <View className="flex-row items-center">
              <Text
                className="font-heading text-lg font-extrabold"
                style={{
                  color: completed ? '#FF4B1F' : '#111111',
                }}>
                {formatNumber(value)}
              </Text>

              <Text className="font-heading text-sm font-extrabold text-[#B9BDC3]">
                {' '}
                / {formatNumber(target)}
              </Text>
            </View>
          </View>

          <View className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#EFEFEF]">
            <View
              className="h-full rounded-full"
              style={{
                width: `${progress}%`,
                backgroundColor: completed ? '#FF5C1A' : '#FFC3A4',
              }}
            />
          </View>
        </View>
      </View>
    </View>
  );
}

function HowToEarnPointsModal({
  isOpen,
  onClose,
  cap,
  isPremium,
  currentTab,
}: {
  isOpen: boolean;
  onClose: () => void;
  cap: number;
  isPremium: boolean;
  currentTab: string;
}) {
  const rows = [
    {
      icon: require('~/assets/icons/Check.png'),
      title: 'Daily check-in',
      description: 'Open the app each day',
      points: '+1 pt',
    },
    {
      icon: require('~/assets/icons/Steps.png'),
      title: 'Steps',
      description: 'Walk 1000 steps',
      points: '+1 pt',
    },
    {
      icon: require('~/assets/icons/Active Minutes.png'),
      title: 'Active Minutes',
      description: 'Move for 5 minutes',
      points: '+1 pt',
    },
    {
      icon: require('~/assets/icons/Move With Us.png'),
      title: 'Progress Video',
      description: 'Record a progress video',
      points: '+10 pts',
    },
    {
      icon: require('~/assets/icons/Flame.png'),
      title: 'Weekly Streak',
      description: 'Hit a target 5 days this week',
      points: '+10 pts',
    },
  ];

  return (
    <AlertDialog isOpen={isOpen} onClose={onClose} size="lg">
      <AlertDialogBackdrop />

      <AlertDialogContent style={{ borderRadius: 28 }}>
        <TouchableOpacity
          onPress={onClose}
          className="absolute right-3 top-3 z-10 items-center justify-center rounded-full bg-gray-200"
          style={{ width: 28, height: 28 }}>
          <Text className="text-sm text-[#838383]">✕</Text>
        </TouchableOpacity>

        <AlertDialogHeader>
          <View className="w-full items-center">
            <Image
              source={require('~/assets/icons/Earn.png')}
              style={{ width: 50, height: 50 }}
              contentFit="contain"
            />

            <Text className="mt-3 font-heading text-xl font-bold text-[#1A1A1A]">
              How to Earn Points
            </Text>

            <Text className="mt-1 text-center font-body text-sm text-[#313131]">
              Every activity adds points to your monthly score.
            </Text>
          </View>
        </AlertDialogHeader>

        <AlertDialogBody className="mt-4">
          <View className="gap-y-3">
            {rows.map((row, index) => (
              <View
                key={index}
                className="flex-row items-center rounded-2xl bg-[#F9F9F9] px-4 py-3">
                <Image source={row.icon} style={{ width: 20, height: 20 }} contentFit="contain" />

                <View className="ml-3 flex-1">
                  <Text className="font-body text-sm font-bold text-[#1A1A1A]">{row.title}</Text>
                  <Text className="font-body text-xs text-[#838383]">{row.description}</Text>
                </View>

                <Text className="font-body text-sm font-bold text-[#1A1A1A]">{row.points}</Text>
              </View>
            ))}
          </View>
        </AlertDialogBody>

        <AlertDialogFooter className="mt-4">
          <View className="w-full">
            <Button
              variant="solid"
              size="xl"
              action="primary"
              className="h-14 w-full"
              onPress={onClose}>
              <ButtonText className="text-base font-bold text-white">Got It</ButtonText>
            </Button>

            {!isPremium && (
              <Text className="mt-3 text-center font-body text-sm text-[#313131]">
                Free members have a {cap} pts daily sweat limit.{' '}
                <Text
                  className="text-sm font-medium text-primary-500"
                  onPress={() => {
                    onClose();
                    router.push({ pathname: `/(tabs)/${currentTab}/paywall` as any });
                  }}>
                  Upgrade for unlimited earning
                </Text>
              </Text>
            )}
          </View>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}