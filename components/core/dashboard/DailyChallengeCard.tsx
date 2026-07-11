import { useQuery } from 'convex/react';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { CheckCircle, Clock } from 'phosphor-react-native';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ImageBackground,
  TouchableOpacity,
  View,
} from 'react-native';

import { Text } from '~/components/ui/text';
import { api } from '~/convex/_generated/api';
import { colors } from '~/utils/constants';

function formatRemainingTime(seconds: number) {
  if (seconds <= 0) return 'Ended';

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

  useEffect(() => {
    if (!dailyChallenge?.secondsRemaining) {
      setSecondsRemaining(0);
      return;
    }

    setSecondsRemaining(dailyChallenge.secondsRemaining);

    const interval = setInterval(() => {
      setSecondsRemaining((previous) => Math.max(0, previous - 1));
    }, 1000);

    return () => clearInterval(interval);
  }, [dailyChallenge?.secondsRemaining]);

  const timerText = useMemo(
    () => formatRemainingTime(secondsRemaining),
    [secondsRemaining]
  );

  // Query is still loading
  if (dailyChallenge === undefined) {
    return (
      <View className="mx-5 mt-2 h-[184px] items-center justify-center rounded-[22px] bg-white">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  // No daily challenge has been set
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
              className="h-[39px] w-full items-center justify-center rounded-[11px] bg-[#A9A9A9]">
              <Text className="text-[13px] font-bold text-[#262626]">
                Stay Tuned...
              </Text>
            </TouchableOpacity>
          </LinearGradient>
        </ImageBackground>
      </View>
    );
  }

  const isCompleted = dailyChallenge.userCompletedToday;

  const handleAcceptChallenge = () => {
    if (isCompleted) return;

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
        source={{ uri: dailyChallenge.coverImageUrl ?? undefined }}
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
                <Clock size={10} color="#F97316" weight="bold" />
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

            <Text
              numberOfLines={1}
              className="text-[12px] font-semibold text-white">
              {dailyChallenge.communityDoneToday ?? 0} Done Today
            </Text>
          </View>

          <TouchableOpacity
            activeOpacity={0.85}
            disabled={isCompleted}
            onPress={handleAcceptChallenge}
            className={`h-[39px] w-full items-center justify-center rounded-[11px] ${
              isCompleted ? 'bg-gray-200' : 'bg-white'
            }`}>
            <View className="flex-row items-center justify-center">
              {isCompleted && (
                <CheckCircle size={16} color="#555" weight="fill" />
              )}

              <Text
                className={`text-[14px] font-extrabold ${
                  isCompleted
                    ? 'ml-1 text-gray-600'
                    : 'text-[#161616]'
                }`}>
                {isCompleted
                  ? 'Challenge completed'
                  : 'Accept Challenge'}
              </Text>
            </View>
          </TouchableOpacity>
        </LinearGradient>
      </ImageBackground>
    </View>
  );
}