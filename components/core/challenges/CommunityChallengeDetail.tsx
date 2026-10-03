import { router } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { ArrowLeft, Camera, Play } from 'phosphor-react-native';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import ParticipantAvatars from '~/components/core/challenges/ParticipantAvatars';
import { Text } from '~/components/ui/text';

export default function CommunityChallengeDetail({
  challenge,
  joining,
  onJoin,
  onRecord,
}: {
  challenge: any;
  joining: boolean;
  onJoin: () => void;
  onRecord: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [isPlaying, setIsPlaying] = useState(false);
  const player = useVideoPlayer(challenge.instructionalVideoUrl, (instance) => {
    instance.loop = false;
  });

  useEffect(() => {
    setIsPlaying(false);
    player.pause();
    player.replace(challenge.instructionalVideoUrl);
  }, [challenge.instructionalVideoUrl, player]);

  const progress = Math.min(
    100,
    challenge.durationDays > 0 ? (challenge.completedDays / challenge.durationDays) * 100 : 0
  );
  const recordLabel = challenge.completedToday
    ? 'Completed today'
    : `Record today’s ${challenge.name.replace(/challenge/i, '').trim() || 'challenge'}`;

  return (
    <View className="flex-1 bg-white">
      <View className="mx-5 mb-4 mt-3 flex-row items-center justify-between">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to challenges"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/hub'))}
          className="h-11 w-11 items-center justify-center rounded-full border border-[#E5E5E5]">
          <ArrowLeft size={22} color="#252525" />
        </Pressable>
        <Text
          numberOfLines={1}
          className="mx-3 min-w-0 flex-1 text-center font-heading text-lg font-semibold text-[#252525]">
          {challenge.name}
        </Text>
        <View className="h-11 w-11" />
      </View>
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 0, paddingBottom: 24 }}>
        {challenge.instructionalVideoUrl ? (
          <View className="relative overflow-hidden rounded-[16px] bg-[#E8E8E8]">
            <VideoView
              player={player}
              style={{ width: '100%', aspectRatio: 0.87 }}
              contentFit="cover"
              nativeControls={isPlaying}
              allowsFullscreen
              allowsPictureInPicture={false}
            />
            {!isPlaying ? (
              <Pressable
                onPress={() => {
                  player.play();
                  setIsPlaying(true);
                }}
                style={StyleSheet.absoluteFillObject}
                className="items-center justify-center">
                <View className="h-14 w-14 items-center justify-center rounded-full bg-black/50">
                  <Play size={21} color="#FFFFFF" weight="fill" />
                </View>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        <View className="mt-4 flex-row items-center justify-between gap-x-3">
          <Text className="font-body text-sm text-[#777777]">
            {challenge.durationDays}-day challenge
          </Text>
          <ParticipantAvatars
            avatars={challenge.participantAvatars}
            count={challenge.participantCount}
            size={28}
          />
        </View>
        <Text className="mt-4 font-body text-base leading-6 text-[#252525]">
          {challenge.description}
        </Text>

        {challenge.isJoined ? (
          <View className="mt-4 rounded-[24px] bg-white px-4 py-4">
            <View className="flex-row items-center justify-between">
              <Text className="font-body text-xs text-[#77716D]">Your progress</Text>
              <Text style={{ fontFamily: 'Inter_600SemiBold' }} className="text-xs text-[#313131]">
                {challenge.completedDays} of {challenge.durationDays}
              </Text>
            </View>
            <View className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#E5DFDB]">
              <View
                className="h-full rounded-full bg-[#FF5C35]"
                style={{ width: `${progress}%` }}
              />
            </View>
            {!challenge.completionBankEligible && !challenge.completionBankAwarded ? (
              <Text className="mt-2 font-body text-[10px] text-[#A65B45]">
                Daily points remain available, but the completion bank is no longer eligible.
              </Text>
            ) : null}
            {challenge.completionBankAwarded ? (
              <Text
                style={{ fontFamily: 'Inter_600SemiBold' }}
                className="mt-2 text-[10px] text-[#21875F]">
                Completion bank earned
              </Text>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
      <View
        className="bg-white px-5 pt-3"
        style={{ paddingBottom: Platform.OS === 'android' ? Math.max(insets.bottom, 12) : 12 }}>
        {!challenge.isJoined ? (
          <TouchableOpacity
            accessibilityRole="button"
            activeOpacity={0.88}
            onPress={onJoin}
            disabled={joining || challenge.status === 'ended'}
            className="min-h-14 flex-row items-center justify-center gap-2 rounded-[18px] bg-[#FF5C35] px-5">
            {joining ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text className="font-heading text-base font-semibold text-white">
                Join challenge
              </Text>
            )}
          </TouchableOpacity>
        ) : challenge.status === 'upcoming' ? (
          <View
            accessibilityRole="button"
            accessibilityState={{ disabled: true }}
            className="h-14 items-center justify-center rounded-full border border-[#E2E2E2] bg-white">
            <Text style={{ fontFamily: 'Inter_600SemiBold' }} className="text-base text-[#919191]">
              Starts in {challenge.daysUntilStart} {challenge.daysUntilStart === 1 ? 'day' : 'days'}
            </Text>
          </View>
        ) : challenge.status === 'ended' ? (
          <View className="h-14 items-center justify-center rounded-full bg-[#E8E3DF]">
            <Text style={{ fontFamily: 'Inter_600SemiBold' }} className="text-sm text-[#77716D]">
              Challenge ended
            </Text>
          </View>
        ) : (
          <Pressable
            onPress={onRecord}
            disabled={challenge.completedToday}
            className={`h-14 flex-row items-center justify-center rounded-full ${
              challenge.completedToday ? 'bg-[#E8E3DF]' : 'bg-[#FF5C35]'
            }`}>
            <Camera
              size={18}
              color={challenge.completedToday ? '#77716D' : '#FFFFFF'}
              weight="bold"
            />
            <Text
              style={{ fontFamily: 'Inter_600SemiBold' }}
              className={`ml-2 text-sm ${
                challenge.completedToday ? 'text-[#77716D]' : 'text-white'
              }`}>
              {recordLabel}
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
