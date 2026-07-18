import { useQuery } from 'convex/react';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Check } from 'phosphor-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  AppState,
  Easing,
  Image,
  ImageBackground,
  TouchableOpacity,
  View,
} from 'react-native';

import { Text } from '~/components/ui/text';
import { api } from '~/convex/_generated/api';
import { colors } from '~/utils/constants';

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
  /*
   * Changing refreshToken forces Convex
   * to rerun the time-based query.
   */
  const [refreshToken, setRefreshToken] = useState(0);

  const dailyChallenge = useQuery(api.challengeCompletions.getTodayDailyChallenge, {
    refreshToken,
  });

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
      <View className="mx-5 mt-2 h-[184px] items-center justify-center rounded-[22px] bg-white">
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
        className="mx-5 mt-2 overflow-hidden rounded-[22px] bg-black"
        style={{
          height: 184,

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
          className="h-full w-full">
          <LinearGradient
            colors={[
              'rgba(0,0,0,0.08)',
              'rgba(0,0,0,0.12)',
              'rgba(0,0,0,0.45)',
              'rgba(0,0,0,0.82)',
            ]}
            locations={[0, 0.35, 0.7, 1]}
            className="h-full w-full px-3.5 pb-4 pt-3">
            <View className="flex-row items-center">
              <Image
                source={require('../../../assets/time.png')}
                resizeMode="contain"
                style={{
                  width: 15,
                  height: 15,
                }}
              />

              <Text className="ml-1.5 text-[11px] font-semibold text-white">Hang tight</Text>
            </View>

            <View className="flex-1" />

            <View className="mb-3">
              <Text className="text-[15px] font-extrabold text-white">Preparing Next Check-In</Text>

              <Text className="mt-0.5 text-[12px] font-medium text-white/90">
                You&apos;ll be notified when it&apos;s live
              </Text>
            </View>

            <TouchableOpacity
              disabled
              activeOpacity={1}
              style={{
                opacity: 0.45,
              }}
              className="h-[39px] w-full items-center justify-center rounded-[22px] bg-[#A9A9A9]">
              <Text className="text-[13px] font-bold text-[#262626]">Stay Tuned...</Text>
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

    router.push({
      pathname: '/challenge-view/[challengeId]',

      params: {
        challengeId: dailyChallenge._id,
      },
    });
  };

  const selectedDescription =
    dailyChallenge.shortDescription?.trim() ||
    (dailyChallenge.type === 'check_in'
      ? dailyChallenge.checkInDescription?.trim() || dailyChallenge.description
      : dailyChallenge.description);

  const isButtonDisabled = isCompleted || secondsRemaining <= 0;

  return (
    <View
      className="mx-5 mt-2 overflow-hidden rounded-[22px] bg-black"
      style={{
        height: 184,

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
        className="h-full w-full">
        <LinearGradient
          colors={['rgba(0,0,0,0.02)', 'rgba(0,0,0,0.08)', 'rgba(0,0,0,0.42)', 'rgba(0,0,0,0.84)']}
          locations={[0, 0.34, 0.68, 1]}
          className="h-full w-full px-3.5 pb-3 pt-3">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center">
              <Image
                source={require('../../../assets/time.png')}
                resizeMode="contain"
                style={{
                  width: 15,
                  height: 15,
                }}
              />

              <Text className="ml-1.5 text-[11px] font-semibold text-white">{timerText}</Text>
            </View>

            <View className="rounded-full bg-[#FF5A1F] px-2.5 py-1">
              <Text className="text-[11px] font-bold text-white">+{dailyChallenge.points} pts</Text>
            </View>
          </View>

          <View className="flex-1" />

          <View className="mb-2 flex-row items-end justify-between">
            <View className="flex-1 pr-2">
              <Text numberOfLines={1} className="text-[15px] font-extrabold text-white">
                {dailyChallenge.name}
              </Text>

              <Text numberOfLines={1} className="mt-0.5 text-[12px] font-medium text-white/90">
                {selectedDescription}
              </Text>
            </View>
            {dailyChallenge.communityDoneToday > 0 && (
              <Text className="text-right text-[12px] font-semibold leading-4 text-white">
                {dailyChallenge.communityDoneToday}{' '}
                {dailyChallenge.communityDoneToday > 1 ? 'Sweat Sisters' : 'Sweat Sister'}
                {'\n'}
                checked in
              </Text>
            )}
          </View>

          {/*
           * Extra height allows the pulse glow
           * to remain visible around the button.
           */}
          <View
            style={{
              height: 45,
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
                height: 39,
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
                  opacity: isButtonDisabled ? 0.55 : 1,
                }}
                className={`h-[39px] w-full items-center justify-center rounded-[22px] ${
                  isButtonDisabled ? 'bg-gray-200' : 'bg-white'
                }`}>
                <View className="flex-row items-center justify-center">
                  {isCompleted && <Check size={16} color="#555" weight="bold" />}

                  <Text
                    className={`text-[14px] font-extrabold ${
                      isCompleted
                        ? 'ml-1 text-gray-600'
                        : secondsRemaining <= 0
                          ? 'text-gray-500'
                          : 'text-[#161616]'
                    }`}>
                    {isCompleted
                      ? 'Check-In Completed'
                      : secondsRemaining <= 0
                        ? 'Challenge Ended'
                        : 'Check In Now'}
                  </Text>
                </View>
              </TouchableOpacity>
            </Animated.View>
          </View>
        </LinearGradient>
      </ImageBackground>
    </View>
  );
}
