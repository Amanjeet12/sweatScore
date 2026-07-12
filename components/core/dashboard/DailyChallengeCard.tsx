import { useQuery } from 'convex/react';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Check, Clock } from 'phosphor-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
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
  const dailyChallenge = useQuery(
    api.challengeCompletions.getTodayDailyChallenge
  );

  const [secondsRemaining, setSecondsRemaining] = useState(0);

  /*
   * One animated value controls both:
   * - Button scale
   * - Orange glow around the button
   */
  const pulseAnimation = useRef(new Animated.Value(0)).current;
  const pulseLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  const isCompleted = dailyChallenge?.userCompletedToday ?? false;
  const shouldAnimate =
    dailyChallenge !== undefined &&
    dailyChallenge !== null &&
    !isCompleted;

  useEffect(() => {
    if (!dailyChallenge?.secondsRemaining) {
      setSecondsRemaining(0);
      return;
    }

    setSecondsRemaining(dailyChallenge.secondsRemaining);

    const interval = setInterval(() => {
      setSecondsRemaining((previous) => Math.max(0, previous - 1));
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, [dailyChallenge?.secondsRemaining]);

  /*
   * Start pulse while the daily check-in is incomplete.
   * Stop and reset immediately after completion.
   */
  useEffect(() => {
    pulseLoopRef.current?.stop();
    pulseLoopRef.current = null;

    if (!shouldAnimate) {
      pulseAnimation.stopAnimation();
      pulseAnimation.setValue(0);
      return;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnimation, {
          toValue: 1,
          duration: 1540,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnimation, {
          toValue: 0,
          duration: 660,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    pulseLoopRef.current = animation;
    animation.start();

    return () => {
      animation.stop();
      pulseAnimation.setValue(0);
    };
  }, [pulseAnimation, shouldAnimate]);

  const timerText = useMemo(
    () => formatRemainingTime(secondsRemaining),
    [secondsRemaining]
  );

  const buttonScale = pulseAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.015],
  });

  const glowScale = pulseAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.08],
  });

  const glowOpacity = pulseAnimation.interpolate({
    inputRange: [0, 0.7, 1],
    outputRange: [0.45, 0.12, 0],
  });

  if (dailyChallenge === undefined) {
    return (
      <View className="mx-5 mt-2 h-[184px] items-center justify-center rounded-[22px] bg-white">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

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
              'rgba(0,0,0,0.18)',
              'rgba(0,0,0,0.08)',
              'rgba(0,0,0,0.72)',
            ]}
            locations={[0, 0.45, 1]}
            className="h-full w-full px-3.5 pb-4 pt-3">
            <View className="flex-row items-center">
              <View className="h-4 w-4 items-center justify-center rounded-full bg-white">
                <Clock size={10} color="#1A1A1A" weight="bold" />
              </View>

              <Text className="ml-1.5 text-[11px] font-semibold text-white">
                Hang tight
              </Text>
            </View>

            <View className="flex-1" />

            <View className="mb-3">
              <Text className="text-[15px] font-extrabold text-white">
                Preparing Next Check-In
              </Text>

              <Text className="mt-0.5 text-[12px] font-medium text-white/90">
                You&apos;ll be notified when it&apos;s live
              </Text>
            </View>

            <TouchableOpacity
              disabled
              activeOpacity={1}
              className="h-[39px] w-full items-center justify-center rounded-[22px] bg-[#A9A9A9]">
              <Text className="text-[13px] font-bold text-[#262626]">
                Stay Tuned...
              </Text>
            </TouchableOpacity>
          </LinearGradient>
        </ImageBackground>
      </View>
    );
  }

  const handleAcceptChallenge = () => {
    if (isCompleted) {
      return;
    }

    router.push({
      pathname: '/challenge-view/[challengeId]',
      params: {
        challengeId: dailyChallenge._id,
      },
    });
  };

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
          colors={[
            'rgba(0,0,0,0.08)',
            'rgba(0,0,0,0.18)',
            'rgba(0,0,0,0.68)',
          ]}
          locations={[0, 0.45, 1]}
          className="h-full w-full px-3.5 pb-4 pt-3">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center">
              <View className="h-4 w-4 items-center justify-center rounded-full bg-white">
                <Clock size={10} color="#979696" weight="bold" />
              </View>

              <Text className="ml-1.5 text-[11px] font-semibold text-white">
                {timerText}
              </Text>
            </View>

            <View className="rounded-full bg-[#FF5A1F] px-2.5 py-1">
              <Text className="text-[11px] font-bold text-white">
                +{dailyChallenge.points} pts
              </Text>
            </View>
          </View>

          <View className="flex-1" />

          <View className="mb-3 flex-row items-end justify-between">
            <View className="flex-1 pr-2">
              <Text
                numberOfLines={1}
                className="text-[15px] font-extrabold text-white">
                {dailyChallenge.name}
              </Text>

              <Text
                numberOfLines={1}
                className="mt-0.5 text-[12px] font-medium text-white/90">
                {dailyChallenge.shortDescription ||
                  dailyChallenge.description}
              </Text>
            </View>

            {dailyChallenge.communityDoneToday > 0 && (
              <Text className="text-right text-[12px] font-semibold leading-4 text-white">
                {dailyChallenge.communityDoneToday} Sweat Sisters{'\n'}
                checked in
              </Text>
            )}
          </View>

          <View
            style={{
              height: 39,
              width: '100%',
              position: 'relative',
            }}>
            {shouldAnimate && (
              <Animated.View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  top: -2,
                  right: -2,
                  bottom: -2,
                  left: -2,
                  borderRadius: 24,
                  backgroundColor: '#F0621F',
                  opacity: glowOpacity,
                  transform: [
                    {
                      scale: glowScale,
                    },
                  ],
                }}
              />
            )}

            <Animated.View
              style={{
                height: 39,
                width: '100%',
                transform: [
                  {
                    scale: shouldAnimate ? buttonScale : 1,
                  },
                ],
              }}>
              <TouchableOpacity
                activeOpacity={0.85}
                disabled={isCompleted}
                onPress={handleAcceptChallenge}
                className={`h-[39px] w-full items-center justify-center rounded-[22px] ${
                  isCompleted ? 'bg-gray-200' : 'bg-white'
                }`}>
                <View className="flex-row items-center justify-center">
                  {isCompleted && (
                    <Check size={16} color="#555" weight="bold" />
                  )}

                  <Text
                    className={`text-[14px] font-extrabold ${
                      isCompleted
                        ? 'ml-1 text-gray-600'
                        : 'text-[#161616]'
                    }`}>
                    {isCompleted
                      ? 'Check-In Completed'
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