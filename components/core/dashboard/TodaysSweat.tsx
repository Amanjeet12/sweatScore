import { convexQuery } from '@convex-dev/react-query';
import { useQuery as useTanstackQuery } from '@tanstack/react-query';
import { useQuery } from 'convex/react';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Check, LockSimple, X } from 'phosphor-react-native';
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
    convexQuery(
      api.activities.getPointsForDate,
      canLoadUserData
        ? {
            date: formattedDate,
          }
        : 'skip'
    )
  );

  const pointsToday = useQuery(
    api.challengeCompletions.getPointsEarnedToday,
    canLoadUserData ? {} : 'skip'
  );

  useEffect(() => {
    if (!pointsToday) return;
    if (pointsToday.isPremium) return;
    if (!pointsToday.isCapped) return;

    if (storage.getBoolean(SKIP_DAILY_LIMIT_POPUP_KEY)) {
      return;
    }

    const today = formatDateYYYYMMDD(new Date(), Intl.DateTimeFormat().resolvedOptions().timeZone);

    const shownKey = `daily_limit_popup_shown_${today}`;

    if (storage.getBoolean(shownKey)) {
      return;
    }

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
        shadowOffset: {
          width: 0,
          height: 8,
        },
        shadowOpacity: 0.06,
        shadowRadius: 18,
      }}>
      <Text className="mb-4 font-heading text-xl font-bold text-[#1A1A1A]" numberOfLines={1}>
        Your Activity
      </Text>

      <View className="flex-row items-center">
        {/* Period tabs */}
        <View className="mr-3 h-10 flex-1 flex-row rounded-full bg-[#EEEEEE] p-1">
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => setPeriod('today')}
            className="flex-1 items-center justify-center rounded-full"
            style={{
              backgroundColor: period === 'today' ? '#FFFFFF' : 'transparent',
              shadowColor: period === 'today' ? '#000000' : 'transparent',
              shadowOffset: {
                width: 0,
                height: 2,
              },
              shadowOpacity: period === 'today' ? 0.12 : 0,
              shadowRadius: 4,
              elevation: period === 'today' ? 2 : 0,
            }}>
            <Text
              numberOfLines={1}
              className="font-body text-[12px] font-bold"
              style={{
                color: period === 'today' ? '#FF4B1F' : '#8B8B8B',
              }}>
              Today
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => setPeriod('week')}
            className="flex-1 items-center justify-center rounded-full"
            style={{
              backgroundColor: period === 'week' ? '#FFFFFF' : 'transparent',
              shadowColor: period === 'week' ? '#000000' : 'transparent',
              shadowOffset: {
                width: 0,
                height: 2,
              },
              shadowOpacity: period === 'week' ? 0.12 : 0,
              shadowRadius: 4,
              elevation: period === 'week' ? 2 : 0,
            }}>
            <Text
              numberOfLines={1}
              className="font-body text-[12px] font-bold"
              style={{
                color: period === 'week' ? '#FF4B1F' : '#8B8B8B',
              }}>
              This Week
            </Text>
          </TouchableOpacity>
        </View>

        {/* Points badge */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => setShowTooltip(true)}
          className="h-10 flex-row items-center justify-center rounded-full bg-[#FFECE4] px-3"
          style={{
            minWidth: 60,
            flexShrink: 0,
          }}>
          {isDailyCapped && (
            <LockSimple size={13} color="#FF4B1F" weight="bold" style={{ marginRight: 4 }} />
          )}

          <Text
            numberOfLines={1}
            className="font-heading text-[12px] font-extrabold text-[#FF4B1F]">
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
          title="Active Minutes"
          value={selectedStats.activeMinutes}
          target={selectedTargets.activeMinutes}
          completed={selectedStats.activeMinutes >= selectedTargets.activeMinutes}
          period={period}
          showDivider
        />

        <SweatProgressRow
          title="Daily Check-Ins"
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
            onPress={() =>
              router.push({
                pathname: `/(tabs)/${currentTab}/paywall` as any,
              })
            }>
            <Text className="font-body text-sm font-medium text-primary-500">
              Upgrade to keep earning →
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <HowToEarnPointsModal isOpen={showTooltip} onClose={() => setShowTooltip(false)} />

      <DailyLimitReachedModal
        showAlertDialog={showDailyLimitModal}
        handleClose={() => setShowDailyLimitModal(false)}
        handleUpgrade={() =>
          router.push({
            pathname: `/(tabs)/${currentTab}/paywall` as any,
          })
        }
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
                style={{
                  width: 16,
                  height: 16,
                }}
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

function HowToEarnPointsModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const rows = [
    {
      icon: require('~/assets/icons/Steps.png'),
      title: 'Steps',
      description: 'Walk 1000 steps',
      points: '1 pt',
    },
    {
      icon: require('~/assets/icons/Active Minutes.png'),
      title: 'Active Minutes',
      description: 'Move for 5 minutes',
      points: '1 pt',
    },
    {
      icon: require('~/assets/icons/Check.png'),
      title: 'Daily Check-in',
      description: 'Check in to the app',
      points: '5+ pts',
    },
    {
      icon: require('~/assets/icons/Move With Us.png'),
      title: 'Challenges',
      description: 'Complete a challenge',
      points: '5+ pts',
    },
    {
      icon: require('~/assets/icons/Flame.png'),
      title: 'Weekly Streak',
      description: 'Hit a target 5 days this week',
      points: '10 pts',
    },
  ];

  return (
    <AlertDialog isOpen={isOpen} onClose={onClose} size="lg">
      <AlertDialogBackdrop
        style={{
          backgroundColor: 'rgba(0,0,0,0.42)',
        }}
      />

      <AlertDialogContent
        className="border border-[#E8E8E8] bg-white p-0"
        style={{
          width: '88%',
          maxWidth: 360,
          borderRadius: 24,
          overflow: 'hidden',

          shadowColor: '#000',

          shadowOffset: {
            width: 0,
            height: 12,
          },

          shadowOpacity: 0.18,
          shadowRadius: 20,
          elevation: 12,
        }}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={onClose}
          className="absolute right-4 top-4 z-20 items-center justify-center rounded-full bg-[#DADADA]"
          style={{
            width: 25,
            height: 25,
          }}>
          <X size={16} color="#FFFFFF" weight="bold" />
        </TouchableOpacity>

        <View className="px-3.5 pb-4 pt-8">
          <AlertDialogHeader className="p-0">
            <View className="w-full items-center">
              <Image
                source={require('~/assets/icons/Earn.png')}
                style={{
                  width: 48,
                  height: 48,
                }}
                contentFit="contain"
              />

              <Text className="mt-3 text-center font-heading text-[18px] font-extrabold text-[#1A1A1A]">
                How to Earn Points
              </Text>

              <Text className="mt-2 max-w-[250px] text-center font-body text-[14px] leading-5 text-[#4D4D4D]">
                Every activity adds points to your monthly score.
              </Text>
            </View>
          </AlertDialogHeader>

          <AlertDialogBody className="mt-4 p-0">
            <View className="gap-y-2">
              {rows.map((row) => (
                <View
                  key={row.title}
                  className="flex-row items-center rounded-[17px] bg-[#F8F8F8] px-3.5"
                  style={{
                    minHeight: 59,
                  }}>
                  <View
                    className="items-center justify-center"
                    style={{
                      width: 25,
                    }}>
                    <Image
                      source={row.icon}
                      style={{
                        width: 19,
                        height: 19,
                      }}
                      contentFit="contain"
                    />
                  </View>

                  <View className="ml-2.5 flex-1 pr-2">
                    <Text className="font-body text-[14px] font-extrabold text-[#272727]">
                      {row.title}
                    </Text>

                    <Text numberOfLines={1} className="mt-0.5 font-body text-[11px] text-[#545454]">
                      {row.description}
                    </Text>
                  </View>

                  <Text className="font-heading text-[14px] font-extrabold text-[#272727]">
                    {row.points}
                  </Text>
                </View>
              ))}
            </View>
          </AlertDialogBody>

          <AlertDialogFooter className="mt-3 p-0">
            <Button
              variant="solid"
              size="xl"
              action="primary"
              className="h-[39px] w-full rounded-full bg-[#FF551F]"
              onPress={onClose}>
              <ButtonText className="font-heading text-[13px] font-extrabold text-white">
                Got It
              </ButtonText>
            </Button>
          </AlertDialogFooter>
        </View>
      </AlertDialogContent>
    </AlertDialog>
  );
}
