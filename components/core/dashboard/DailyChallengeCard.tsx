import { useQuery } from 'convex/react';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Check, Clock } from 'phosphor-react-native';
import { useEffect, useMemo, useState } from 'react';
import type { RefObject } from 'react';
import { AppState, ImageBackground, Platform, TouchableOpacity, View } from 'react-native';

import { Avatar } from '~/components/core/Avatar';
import { Text } from '~/components/ui/text';
import { api } from '~/convex/_generated/api';
import { useSubscriptionGuard } from '~/hooks/useSubscriptionGuard';
import { useAuthStore } from '~/store/useAuthStore';
import { getData, storeData } from '~/utils/storage';

const DAILY_CHALLENGE_CACHE_KEY = 'daily_challenge_card_cache';
const SWEAT_BADGES = [
  { letter: 'S', color: '#C96B4B' },
  { letter: 'W', color: '#8347B8' },
  { letter: 'E', color: '#2E987D' },
  { letter: 'A', color: '#DE5D91' },
  { letter: 'T', color: '#B9343A' },
];

function formatRemainingTime(seconds: number) {
  if (seconds <= 0) return 'Ended';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours} hour${hours === 1 ? '' : 's'} left`;
  return `${minutes} min${minutes === 1 ? '' : 's'} left`;
}

export default function DailyChallengeCard({ tourTargetRef }: { tourTargetRef?: RefObject<View> }) {
  const { requireSubscription } = useSubscriptionGuard();
  const authenticatedUserId = useAuthStore((state) => state.currentUser?._id);
  const cacheKey = `${DAILY_CHALLENGE_CACHE_KEY}_${authenticatedUserId ?? 'user'}`;
  const [refreshToken, setRefreshToken] = useState(0);
  const queryResult = useQuery(api.challengeCompletions.getTodayDailyChallenge, { refreshToken });
  const [cached, setCached] = useState<typeof queryResult>(() => {
    const stored = getData(cacheKey) as { date?: string; challenge?: typeof queryResult } | null;
    return stored?.date === new Date().toDateString() ? stored.challenge : undefined;
  });
  const challenge = queryResult === undefined ? cached : queryResult;
  const [secondsRemaining, setSecondsRemaining] = useState(0);

  useEffect(() => {
    const stored = getData(cacheKey) as { date?: string; challenge?: typeof queryResult } | null;
    setCached(stored?.date === new Date().toDateString() ? stored.challenge : undefined);
  }, [cacheKey]);

  useEffect(() => {
    if (queryResult === undefined) return;
    setCached(queryResult);
    storeData(cacheKey, { date: new Date().toDateString(), challenge: queryResult });
  }, [cacheKey, queryResult]);

  useEffect(() => {
    if (!challenge) {
      setSecondsRemaining(0);
      return;
    }
    const update = () =>
      setSecondsRemaining(
        challenge.dailyEndAt
          ? Math.max(0, Math.ceil((challenge.dailyEndAt - Date.now()) / 1000))
          : (challenge.secondsRemaining ?? 0)
      );
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [challenge?._id, challenge?.dailyEndAt, challenge?.secondsRemaining]);

  useEffect(() => {
    if (!challenge?.dailyEndAt) return;
    const delay = Math.max(0, challenge.dailyEndAt - Date.now() + 1000);
    const timeout = setTimeout(() => setRefreshToken((value) => value + 1), delay);
    return () => clearTimeout(timeout);
  }, [challenge?._id, challenge?.dailyEndAt]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') setRefreshToken((value) => value + 1);
    });
    return () => subscription.remove();
  }, []);

  const timerText = useMemo(() => formatRemainingTime(secondsRemaining), [secondsRemaining]);

  if (challenge === undefined) {
    return (
      <View
        ref={tourTargetRef}
        collapsable={false}
        className="mx-5 h-[240px] overflow-hidden rounded-[30px] bg-[#D9D2CE]">
        <View className="h-full px-5 py-5">
          <View className="h-3 w-32 rounded-full bg-white/60" />
          <View className="flex-1" />
          <View className="h-8 w-48 rounded-[14px] bg-white/55" />
          <View className="mt-3 h-8 w-56 rounded-full bg-white/45" />
        </View>
      </View>
    );
  }

  if (challenge === null) {
    return (
      <View
        ref={tourTargetRef}
        collapsable={false}
        className="mx-5 h-[240px] overflow-hidden rounded-[30px] bg-[#302822] px-5 py-5">
        <View className="flex-1" />
        <Text className="font-heading text-[26px] font-semibold text-white">
          Preparing Next Check-In
        </Text>
        <Text className="mt-2 font-body text-sm text-white/80">
          You&apos;ll be notified when it&apos;s live
        </Text>
      </View>
    );
  }

  const isCompleted = challenge.userCompletedToday ?? false;
  const disabled = isCompleted || secondsRemaining <= 0;
  const count = Math.max(challenge.actualCheckInCount ?? 0, isCompleted ? 1 : 0);
  const recentCheckInUsers = (challenge.recentCheckInUsers ?? []).slice(0, SWEAT_BADGES.length);
  const remainingBadges = SWEAT_BADGES.slice(recentCheckInUsers.length);

  const fastTrack = () => {
    if (disabled) return;
    const redirectTo = `/challenge-record/${challenge._id}`;
    if (!requireSubscription({ redirectTo, source: 'today_featured_check_in' })) return;
    router.push({
      pathname: '/challenge-record/[challengeId]',
      params: { challengeId: challenge._id, checkInMode: 'record_video' },
    });
  };

  return (
    <View ref={tourTargetRef} collapsable={false} className="mx-5">
      <TouchableOpacity
        activeOpacity={disabled ? 1 : 0.88}
        disabled={disabled}
        onPress={fastTrack}
        accessibilityRole="button"
        accessibilityLabel={
          isCompleted
            ? 'Today check-in completed'
            : disabled
              ? 'Today check-in ended'
              : `Record ${challenge.name}`
        }
        className="h-[240px] overflow-hidden rounded-[30px] bg-black">
        <ImageBackground
          source={{ uri: challenge.coverImageUrl ?? undefined }}
          resizeMode="cover"
          className={Platform.OS === 'ios' ? undefined : 'h-full w-full'}
          style={Platform.OS === 'ios' ? { flex: 1, width: '100%' } : undefined}>
          <LinearGradient
            colors={['rgba(0,0,0,0.76)', 'rgba(0,0,0,0.40)', 'rgba(0,0,0,0.08)']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            className={Platform.OS === 'ios' ? undefined : 'h-full w-full px-5 py-5'}
            style={Platform.OS === 'ios' ? { flex: 1, width: '100%', padding: 20 } : undefined}>
            <View className="flex-row items-center gap-x-3">
              <View className="min-w-0 flex-1 flex-row items-center">
                <Clock size={14} color="#FFFFFF" />
                <Text className="ml-1.5 font-heading text-[11px] font-semibold lowercase tracking-[0.8px] text-white">
                  {timerText}
                </Text>
              </View>
            </View>

            <View className="flex-1" />
            <Text
              numberOfLines={2}
              className="font-heading text-[28px] font-semibold leading-[34px] text-white">
              {challenge.name}
            </Text>
            <Text numberOfLines={1} className="mt-1 font-body text-sm text-white/90">
              {challenge.shortDescription}
            </Text>
            <View className="mt-4 flex-row items-center">
              <View
                className="flex-row"
                accessibilityLabel={`${recentCheckInUsers.length} check-in avatars shown`}>
                {recentCheckInUsers.map((user, index) => (
                  <View
                    key={String(user.userId)}
                    className="rounded-full border-2 border-white"
                    style={{ marginLeft: index === 0 ? 0 : -9 }}>
                    <Avatar uri={user.imageUrl ?? undefined} name={user.initial} size={32} />
                  </View>
                ))}
                {remainingBadges.map(({ letter, color }, index) => (
                  <View
                    key={letter}
                    className="h-9 w-9 items-center justify-center rounded-full border-2 border-white"
                    style={{
                      backgroundColor: color,
                      marginLeft: recentCheckInUsers.length === 0 && index === 0 ? 0 : -9,
                    }}>
                    <Text className="font-heading text-sm font-semibold text-white">{letter}</Text>
                  </View>
                ))}
              </View>
              <View className="ml-3 min-w-0 flex-1 flex-row items-center">
                {isCompleted ? <Check size={14} color="#FFFFFF" weight="bold" /> : null}
                <Text
                  numberOfLines={2}
                  className={`${isCompleted ? 'ml-1.5 ' : ''}min-w-0 flex-1 font-body text-xs leading-4 text-white`}>
                  {count > 0
                    ? `${count} ${count === 1 ? 'sister' : 'sisters'} checked in today`
                    : 'Be the first to check-in'}
                </Text>
              </View>
            </View>
          </LinearGradient>
        </ImageBackground>
      </TouchableOpacity>
    </View>
  );
}
