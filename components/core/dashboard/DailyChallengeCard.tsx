import { useQuery } from 'convex/react';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { ArrowRight, Check } from 'phosphor-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  AppState,
  Easing,
  ImageBackground,
  Platform,
  TouchableOpacity,
  View,
} from 'react-native';

import { Avatar } from '~/components/core/Avatar';
import { Text } from '~/components/ui/text';
import { api } from '~/convex/_generated/api';
import { useSubscriptionGuard } from '~/hooks/useSubscriptionGuard';
import { colors } from '~/utils/constants';

const CHECK_IN_PLACEHOLDERS = [
  { initial: 'A', color: '#C96B4B' },
  { initial: 'M', color: '#8347B8' },
  { initial: 'S', color: '#2E987D' },
  { initial: 'T', color: '#DE5D91' },
];

function formatRemainingTime(seconds: number) {
  if (seconds <= 0) {
    return 'Ended';
  }

  const hours = Math.floor(seconds / 3600);

  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours} hour${hours > 1 ? 's' : ''} left`;
  }

  return `${minutes} min${minutes !== 1 ? 's' : ''} left`;
}

export default function DailyChallengeCard() {
  const { requireSubscription } = useSubscriptionGuard();

  /*
   * Changing refreshToken forces Convex
   * to rerun the time-based query.
   */
  const [refreshToken, setRefreshToken] = useState(0);

  const dailyChallenge = useQuery(api.challengeCompletions.getTodayDailyChallenge, {
    refreshToken,
  });
  const currentUser = useQuery(api.users.current);

  const [secondsRemaining, setSecondsRemaining] = useState(0);

  /*
   * Controls:
   *
   * 1. Button scale.
   * 2. Orange glow scale.
   * 3. Orange glow opacity.
   */
  const pulseAnimation = useRef(new Animated.Value(0)).current;

  const pulseLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  const isCompleted = dailyChallenge?.userCompletedToday ?? false;

  const shouldAnimate =
    dailyChallenge !== undefined && dailyChallenge !== null && !isCompleted && secondsRemaining > 0;

  /*
   * Keep countdown aligned with the actual
   * daily challenge ending timestamp.
   */
  useEffect(() => {
    if (!dailyChallenge) {
      setSecondsRemaining(0);
      return;
    }

    const endAt = dailyChallenge.dailyEndAt;

    if (!endAt) {
      setSecondsRemaining(dailyChallenge.secondsRemaining ?? 0);

      return;
    }

    const updateRemainingTime = () => {
      const remaining = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));

      setSecondsRemaining(remaining);
    };

    updateRemainingTime();

    const interval = setInterval(updateRemainingTime, 1000);

    return () => {
      clearInterval(interval);
    };
  }, [dailyChallenge?._id, dailyChallenge?.dailyEndAt, dailyChallenge?.secondsRemaining]);

  /*
   * Refresh shortly after the exact
   * expiration time.
   */
  useEffect(() => {
    if (!dailyChallenge?.dailyEndAt) {
      return undefined;
    }

    const delayUntilExpiry = Math.max(0, dailyChallenge.dailyEndAt - Date.now() + 1000);

    const timeout = setTimeout(() => {
      setRefreshToken((previous) => previous + 1);
    }, delayUntilExpiry);

    return () => {
      clearTimeout(timeout);
    };
  }, [dailyChallenge?._id, dailyChallenge?.dailyEndAt]);

  /*
   * Refresh when returning from the
   * background because JavaScript timers
   * may have paused.
   */
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        setRefreshToken((previous) => previous + 1);
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  /*
   * Moderate pulse animation.
   *
   * Visible enough to attract attention,
   * but not large enough to distort the card.
   */
  useEffect(() => {
    pulseLoopRef.current?.stop();
    pulseLoopRef.current = null;

    if (!shouldAnimate) {
      pulseAnimation.stopAnimation();
      pulseAnimation.setValue(0);

      return undefined;
    }

    pulseAnimation.setValue(0);

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnimation, {
          toValue: 1,
          duration: 850,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),

        Animated.timing(pulseAnimation, {
          toValue: 0,
          duration: 650,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    pulseLoopRef.current = animation;

    animation.start();

    return () => {
      animation.stop();
      pulseLoopRef.current = null;
      pulseAnimation.setValue(0);
    };
  }, [pulseAnimation, shouldAnimate]);

  const timerText = useMemo(() => formatRemainingTime(secondsRemaining), [secondsRemaining]);

  /*
   * Visible but controlled scale change.
   */
  const buttonScale = pulseAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.03],
  });

  const glowScale = pulseAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.12],
  });

  const glowOpacity = pulseAnimation.interpolate({
    inputRange: [0, 0.6, 1],
    outputRange: [0.55, 0.25, 0],
  });

  if (dailyChallenge === undefined) {
    return (
      <View className="mx-5 h-[310px] items-center justify-center rounded-[28px] bg-white">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  /*
   * No active challenge.
   */
  if (dailyChallenge === null) {
    return (
      <View
        className="mx-5 overflow-hidden rounded-[28px] bg-black"
        style={{
          height: 310,

          shadowColor: '#000',

          shadowOffset: {
            width: 0,
            height: 8,
          },

          shadowOpacity: 0.16,
          shadowRadius: 12,
          elevation: 5,
        }}>
        <ImageBackground
          source={require('~/assets/backgrounds/swbg.png')}
          resizeMode="cover"
          className={Platform.OS === 'ios' ? undefined : 'h-full w-full'}
          style={Platform.OS === 'ios' ? { flex: 1, width: '100%' } : undefined}>
          <LinearGradient
            colors={[
              'rgba(0,0,0,0.08)',
              'rgba(0,0,0,0.12)',
              'rgba(0,0,0,0.45)',
              'rgba(0,0,0,0.82)',
            ]}
            locations={[0, 0.35, 0.7, 1]}
            className={Platform.OS === 'ios' ? undefined : 'h-full w-full px-5 pb-5 pt-5'}
            style={
              Platform.OS === 'ios'
                ? {
                    flex: 1,
                    width: '100%',
                    paddingHorizontal: 20,
                    paddingTop: 20,
                    paddingBottom: 20,
                  }
                : undefined
            }>
            <Text className="font-heading text-[11px] font-extrabold tracking-[1px] text-white">
              TODAY&apos;S CHECK-IN
            </Text>

            <View className="flex-1" />

            <View className="mb-5">
              <Text
                className="text-[27px] font-extrabold text-white"
                style={Platform.OS === 'ios' ? { fontFamily: 'Inter_700Bold' } : undefined}>
                Preparing Next Check-In
              </Text>

              <Text
                className="mt-2 text-[14px] font-medium text-white/90"
                style={Platform.OS === 'ios' ? { fontFamily: 'Inter_500Medium' } : undefined}>
                You&apos;ll be notified when it&apos;s live
              </Text>
            </View>

            <TouchableOpacity
              disabled
              activeOpacity={1}
              style={{
                opacity: 0.45,
              }}
              className="h-[52px] w-full items-center justify-center rounded-[18px] bg-[#A9A9A9]">
              <Text
                className="text-[13px] font-bold text-[#262626]"
                style={Platform.OS === 'ios' ? { fontFamily: 'Inter_700Bold' } : undefined}>
                Stay Tuned...
              </Text>
            </TouchableOpacity>
          </LinearGradient>
        </ImageBackground>
      </View>
    );
  }

  const handleAcceptChallenge = () => {
    if (isCompleted || secondsRemaining <= 0) {
      return;
    }

    const redirectTo = `/challenge-view/${dailyChallenge._id}`;

    if (!requireSubscription({ redirectTo, source: 'daily_challenge_lets_go' })) {
      return;
    }

    router.push({
      pathname: '/challenge-view/[challengeId]',

      params: {
        challengeId: dailyChallenge._id,
      },
    });
  };

  const isButtonDisabled = isCompleted || secondsRemaining <= 0;
  const backendCheckInUsers = dailyChallenge.recentCheckInUsers ?? [];
  const includesCurrentUser = backendCheckInUsers.some(
    (user) => String(user.userId) === String(currentUser?._id)
  );
  const currentUserCheckIn =
    isCompleted && currentUser && !includesCurrentUser
      ? {
          userId: currentUser._id,
          imageUrl: currentUser.image,
          initial: currentUser.name?.trim().charAt(0).toUpperCase() || '?',
        }
      : null;
  const recentCheckInUsers = [
    ...backendCheckInUsers,
    ...(currentUserCheckIn ? [currentUserCheckIn] : []),
  ].slice(0, 4);
  const placeholderUsers = CHECK_IN_PLACEHOLDERS.slice(
    0,
    Math.max(0, 4 - recentCheckInUsers.length)
  );
  const actualCheckInCount = Math.max(dailyChallenge.actualCheckInCount ?? 0, isCompleted ? 1 : 0);
  const displayedCompletionCount = 5 + actualCheckInCount;

  return (
    <View
      className="mx-5 overflow-hidden rounded-[28px] bg-black"
      style={{
        height: 310,

        shadowColor: '#000',

        shadowOffset: {
          width: 0,
          height: 8,
        },

        shadowOpacity: 0.16,
        shadowRadius: 12,
        elevation: 5,
      }}>
      <ImageBackground
        source={{
          uri: dailyChallenge.coverImageUrl ?? undefined,
        }}
        resizeMode="cover"
        className={Platform.OS === 'ios' ? undefined : 'h-full w-full'}
        style={Platform.OS === 'ios' ? { flex: 1, width: '100%' } : undefined}>
        <LinearGradient
          colors={['rgba(0,0,0,0.78)', 'rgba(0,0,0,0.52)', 'rgba(0,0,0,0.08)']}
          locations={[0, 0.48, 1]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          className={Platform.OS === 'ios' ? undefined : 'h-full w-full px-5 pb-4 pt-5'}
          style={
            Platform.OS === 'ios'
              ? {
                  flex: 1,
                  width: '100%',
                  paddingHorizontal: 20,
                  paddingTop: 20,
                  paddingBottom: 16,
                }
              : undefined
          }>
          <View className="flex-row items-start justify-between">
            <Text className="font-heading text-[11px] font-extrabold tracking-[1px] text-white">
              TODAY&apos;S CHECK-IN
            </Text>

            <View className="rounded-full bg-black/65 px-3 py-1.5">
              <Text
                className="text-[12px] font-bold text-white"
                style={Platform.OS === 'ios' ? { fontFamily: 'Inter_700Bold' } : undefined}>
                +{dailyChallenge.points} pts
              </Text>
            </View>
          </View>

          <View className="flex-1" />

          <View className="mb-4">
            <View className="pr-2">
              <Text
                numberOfLines={1}
                className="text-[28px] font-extrabold leading-[34px] text-white"
                style={Platform.OS === 'ios' ? { fontFamily: 'Inter_700Bold' } : undefined}>
                {dailyChallenge.name}
              </Text>

              <Text
                numberOfLines={1}
                className="mt-1 text-[14px] font-medium text-white/90"
                style={Platform.OS === 'ios' ? { fontFamily: 'Inter_500Medium' } : undefined}>
                Follow along with this routine.
              </Text>
            </View>

            <View className="mt-4 flex-row items-center">
              <View className="flex-row">
                {recentCheckInUsers.map((user, index) => (
                  <View
                    key={String(user.userId)}
                    className="rounded-full border-2 border-white"
                    style={{ marginLeft: index === 0 ? 0 : -9 }}>
                    <Avatar uri={user.imageUrl ?? undefined} name={user.initial} size={30} />
                  </View>
                ))}
                {placeholderUsers.map((user, index) => (
                  <View
                    key={`placeholder-${user.initial}`}
                    className="h-[34px] w-[34px] items-center justify-center rounded-full border-2 border-white"
                    style={{
                      marginLeft: recentCheckInUsers.length === 0 && index === 0 ? 0 : -9,
                      backgroundColor: user.color,
                    }}>
                    <Text className="font-heading text-[12px] font-bold text-white">
                      {user.initial}
                    </Text>
                  </View>
                ))}
              </View>
              <Text className="ml-3 flex-shrink text-[12px] font-semibold text-white">
                {displayedCompletionCount} members completed
              </Text>
            </View>
          </View>

          {/*
           * Extra height allows the pulse glow
           * to remain visible around the button.
           */}
          <View
            style={{
              height: 56,
              width: '100%',
              position: 'relative',
              justifyContent: 'center',
              overflow: 'visible',
            }}>
            {shouldAnimate && (
              <>
                <Animated.View
                  pointerEvents="none"
                  style={{
                    position: 'absolute',

                    top: 1,
                    right: -3,
                    bottom: 1,
                    left: -3,

                    borderRadius: 27,

                    backgroundColor: '#FF5A1F',

                    opacity: glowOpacity,

                    transform: [
                      {
                        scale: glowScale,
                      },
                    ],
                  }}
                />

                <Animated.View
                  pointerEvents="none"
                  style={{
                    position: 'absolute',

                    top: 2,
                    right: -1,
                    bottom: 2,
                    left: -1,

                    borderRadius: 25,

                    borderWidth: 1.5,

                    borderColor: '#FF7A3D',

                    opacity: glowOpacity,

                    transform: [
                      {
                        scale: glowScale,
                      },
                    ],
                  }}
                />
              </>
            )}

            <Animated.View
              style={{
                height: 52,
                width: '100%',
                alignSelf: 'center',

                transform: [
                  {
                    scale: shouldAnimate ? buttonScale : 1,
                  },
                ],
              }}>
              <TouchableOpacity
                activeOpacity={0.85}
                disabled={isButtonDisabled}
                onPress={handleAcceptChallenge}
                style={{
                  opacity: 1,
                }}
                className={`h-[52px] w-full items-center justify-center rounded-[18px] ${
                  isButtonDisabled ? 'bg-gray-200' : 'bg-white'
                }`}>
                <View className="flex-row items-center justify-center">
                  {isCompleted && <Check size={17} color="#16A34A" weight="bold" />}

                  <Text
                    className={`text-[14px] font-extrabold ${
                      isCompleted
                        ? 'ml-1 text-[#161616]'
                        : secondsRemaining <= 0
                          ? 'text-gray-500'
                          : 'text-[#161616]'
                    }`}
                    style={Platform.OS === 'ios' ? { fontFamily: 'Inter_700Bold' } : undefined}>
                    {isCompleted
                      ? `${dailyChallenge.name} Complete!`
                      : secondsRemaining <= 0
                        ? 'Challenge Ended'
                        : `Let's Go`}
                  </Text>
                  {!isCompleted && secondsRemaining > 0 ? (
                    <ArrowRight
                      size={18}
                      color="#161616"
                      weight="bold"
                      style={{ marginLeft: 18 }}
                    />
                  ) : null}
                </View>
              </TouchableOpacity>
            </Animated.View>
          </View>

          <Text className="mt-1 text-center font-body text-[11px] text-white/75">{timerText}</Text>
        </LinearGradient>
      </ImageBackground>
    </View>
  );
}
