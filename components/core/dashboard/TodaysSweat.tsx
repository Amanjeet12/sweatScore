import { convexQuery } from '@convex-dev/react-query';
import { useQuery as useTanstackQuery } from '@tanstack/react-query';
import { useQuery } from 'convex/react';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import {
  Info,
  LockSimple,
  CheckCircle,
  SneakerMove,
  Timer,
  Lightning,
} from 'phosphor-react-native';
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
import { useTabStore } from '~/store/useTabStore';
import { formatPoints } from '~/utils/formatter';
import { storage } from '~/utils/storage';
import { formatDateYYYYMMDD } from '~/utils/timezone';

import {
  DailyLimitReachedModal,
  SKIP_DAILY_LIMIT_POPUP_KEY,
} from './DailyLimitReachedModal';

export default function TodaysSweat({ refreshKey }: { refreshKey: number }) {
  const [showTooltip, setShowTooltip] = useState(false);
  const { isPro } = useRevenueCat();
  const currentTab = useTabStore((state) => state.currentTab);

  const formattedDate = useMemo(
    () => formatDateYYYYMMDD(new Date(), Intl.DateTimeFormat().resolvedOptions().timeZone),
    [refreshKey]
  );

  const { data: pointsForDate } = useTanstackQuery(
    convexQuery(api.activities.getPointsForDate, { date: formattedDate })
  );

  const { data: weekData } = useTanstackQuery(
    convexQuery(api.challengeCompletions.getUserCompletionsForWeek, {})
  );

  const pointsToday = useQuery(api.challengeCompletions.getPointsEarnedToday);

  // Today's moves count
  const todayMoves = weekData?.days?.find((d) => d.isToday)?.count ?? 0;

  // Daily-limit-reached popup: free users only, one shot per day, suppressible
  const [showDailyLimitModal, setShowDailyLimitModal] = useState(false);
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
  }, [pointsToday?.isCapped, pointsToday?.isPremium]);

  return (
    <View className="mx-screen-x rounded-card bg-white p-5" style={{ marginHorizontal: 20 }}>
      {/* Header row */}
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-x-2">
          <Text className="font-heading text-xl font-bold text-[#1A1A1A]">Today's Sweat</Text>
          <TouchableOpacity onPress={() => setShowTooltip(true)}>
            <Info size={20} color="#c7c7c7" weight="fill" />
          </TouchableOpacity>
        </View>

        {/* Points badge */}
        {pointsToday && (
          <View className="flex-row items-center gap-x-1 rounded-full bg-primary-500 px-3 py-1.5">
            {pointsToday.isCapped && <LockSimple size={14} color="#FFFFFF" weight="bold" />}
            <Text className="font-body text-xs font-semibold text-white">
              {pointsToday.isPremium
                ? `${pointsToday.earned > 0 ? '+' : ''}${pointsToday.earned} pts`
                : `${Math.min(pointsToday.earned, pointsToday.cap)} /${pointsToday.cap} pts`}
            </Text>
          </View>
        )}
      </View>

      {/* Three stat cards */}
      <View className="mt-4 flex-row gap-x-3">
        {/* Moves */}
        <View className="flex-1 items-center rounded-2xl bg-[#F5F5F5] py-4">
          <Text className="font-body text-sm text-[#838383]">Moves</Text>
          <View className="mt-1 flex-row items-center gap-x-1">
            <Image
              source={require('~/assets/icons/Flame.png')}
              style={{ width: 16, height: 16 }}
              contentFit="contain"
            />
            <Text className="font-body text-lg font-bold text-[#1A1A1A]">{todayMoves}</Text>
          </View>
        </View>

        {/* Active Time */}
        <View className="flex-1 items-center rounded-2xl bg-[#F5F5F5] py-4">
          <Text className="font-body text-sm text-[#838383]">Active Time</Text>
          <Text className="mt-1 font-body text-lg font-bold text-[#1A1A1A]">
            {pointsForDate?.totalZone2Minutes ?? 0} min
          </Text>
        </View>

        {/* Steps */}
        <View className="flex-1 items-center rounded-2xl bg-[#F5F5F5] py-4">
          <Text className="font-body text-sm text-[#838383]">Steps</Text>
          <Text className="mt-1 font-body text-lg font-bold text-[#1A1A1A]">
            {formatPoints(pointsForDate?.totalSteps ?? 0)}
          </Text>
        </View>
      </View>

      {/* Daily cap message — free users only */}
      {pointsToday?.isCapped && (
        <View className="mt-4 flex-row flex-wrap items-center justify-center">
          <Text className="font-body text-sm text-[#1A1A1A]">Daily cap reached. </Text>
          <TouchableOpacity
            onPress={() => router.push({ pathname: `/(tabs)/${currentTab}/paywall` as any })}>
            <Text className="font-body text-sm font-medium text-primary-500">
              Upgrade to keep earning →
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* How to Earn Points Modal */}
      <HowToEarnPointsModal
        isOpen={showTooltip}
        onClose={() => setShowTooltip(false)}
        cap={pointsToday?.cap ?? 10}
        isPremium={isPro}
        currentTab={currentTab}
      />

      {/* Daily limit reached modal — free users only, once per day */}
      <DailyLimitReachedModal
        showAlertDialog={showDailyLimitModal}
        handleClose={() => setShowDailyLimitModal(false)}
        handleUpgrade={() =>
          router.push({ pathname: `/(tabs)/${currentTab}/paywall` as any })
        }
        cap={pointsToday?.cap ?? 10}
      />
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
      icon: (
        <Image
          source={require('~/assets/icons/Check.png')}
          style={{ width: 20, height: 20 }}
          contentFit="contain"
        />
      ),
      title: 'Daily check-in',
      description: 'Open the app each day',
      points: '+1 pt',
    },
    {
      icon: (
        <Image
          source={require('~/assets/icons/Steps.png')}
          style={{ width: 20, height: 20 }}
          contentFit="contain"
        />
      ),
      title: 'Steps',
      description: 'Walk 1000 steps',
      points: '+1 pt',
    },
    {
      icon: (
        <Image
          source={require('~/assets/icons/Active Minutes.png')}
          style={{ width: 20, height: 20 }}
          contentFit="contain"
        />
      ),
      title: 'Active Minutes',
      description: 'Move for 5 minutes',
      points: '+1 pt',
    },
    {
      icon: (
        <Image
          source={require('~/assets/icons/Move With Us.png')}
          style={{ width: 20, height: 20 }}
          contentFit="contain"
        />
      ),
      title: 'Move With Us',
      description: 'Post a duet',
      points: '+5 pts',
    },
    {
      icon: (
        <Image
          source={require('~/assets/icons/Flame.png')}
          style={{ width: 20, height: 20 }}
          contentFit="contain"
        />
      ),
      title: 'Weekly Streak',
      description: 'Post a duet 5 days a week',
      points: '+10 pts',
    },
  ];

  return (
    <AlertDialog isOpen={isOpen} onClose={onClose} size="lg">
      <AlertDialogBackdrop />
      <AlertDialogContent style={{ borderRadius: 28 }}>
        {/* Close button */}
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
                <View className="mr-3">{row.icon}</View>
                <View className="flex-1">
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
