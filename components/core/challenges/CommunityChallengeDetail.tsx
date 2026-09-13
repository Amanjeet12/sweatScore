import { useVideoPlayer, VideoView } from 'expo-video';
import { Camera, Play } from 'phosphor-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

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
    <ScrollView
      className="flex-1 bg-[#F9F9F9]"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 36 }}>
      <View className="mb-4 mt-2 flex-row items-center justify-between">
        <Text
          style={{ fontFamily: 'Inter_600SemiBold' }}
          className="text-[10px] uppercase tracking-[1px] text-[#FF4B1F]">
          {challenge.durationDays}-day challenge
        </Text>
        <View className="rounded-[20px] bg-[#FFF1E9] px-3 py-2">
          <Text style={{ fontFamily: 'Inter_600SemiBold' }} className="text-xs text-[#FF5C35]">
            {challenge.status === 'upcoming'
              ? `Starts in ${challenge.daysUntilStart}d`
              : challenge.status === 'ended'
                ? 'Ended'
                : `Day ${Math.max(1, challenge.currentDay)}`}
          </Text>
        </View>
      </View>

      {challenge.instructionalVideoUrl ? (
        <View className="relative overflow-hidden rounded-[24px] bg-[#DCC1B1]">
          <VideoView
            player={player}
            style={{ width: '100%', aspectRatio: 1.28 }}
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
              <View className="h-16 w-16 items-center justify-center rounded-full bg-white">
                <Play size={25} color="#FF5C35" weight="fill" />
              </View>
            </Pressable>
          ) : null}

          {challenge.videoDuration ? (
            <View className="absolute bottom-3 left-3 rounded-[20px] bg-black/65 px-3 py-2">
              <Text style={{ fontFamily: 'Inter_600SemiBold' }} className="text-[10px] text-white">
                Form guide · {Math.round(challenge.videoDuration)} sec
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

      <View className="mt-4 flex-row items-center justify-between">
        <Text
          style={{ fontFamily: 'Inter_600SemiBold' }}
          className="text-[10px] uppercase tracking-[1px] text-[#FF4B1F]">
          {challenge.durationDays}-day challenge
        </Text>
        <Text style={{ fontFamily: 'Inter_600SemiBold' }} className="text-sm text-[#77716D]">
          {challenge.totalAvailablePoints} pts
        </Text>
      </View>

      <Text
        style={{ fontFamily: 'Inter_700Bold' }}
        className="mt-3 text-[24px] leading-[30px] text-[#1A1A1A]">
        {challenge.name}
      </Text>
      <Text className="mt-2 font-body text-sm leading-[21px] text-[#77716D]">
        {challenge.description}
      </Text>

      <View className="mt-5 flex-row items-center justify-between rounded-[24px] bg-white px-4 py-4">
        <ParticipantAvatars
          avatars={challenge.participantAvatars}
          count={challenge.participantCount}
          size={34}
        />
        <View className="ml-3 min-w-0 flex-1">
          <Text style={{ fontFamily: 'Inter_600SemiBold' }} className="text-xs text-[#313131]">
            {challenge.participantCount} {challenge.participantCount === 1 ? 'member' : 'members'}
          </Text>
          <Text className="font-body text-[10px] text-[#77716D]">in this challenge</Text>
        </View>
      </View>

      {challenge.isJoined ? (
        <View className="mt-4 rounded-[24px] bg-white px-4 py-4">
          <View className="flex-row items-center justify-between">
            <Text className="font-body text-xs text-[#77716D]">Your progress</Text>
            <Text style={{ fontFamily: 'Inter_600SemiBold' }} className="text-xs text-[#313131]">
              Day {challenge.completedDays} of {challenge.durationDays}
            </Text>
          </View>
          <View className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#E5DFDB]">
            <View className="h-full rounded-full bg-[#FF5C35]" style={{ width: `${progress}%` }} />
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

      {!challenge.isJoined ? (
        <Pressable
          onPress={onJoin}
          disabled={joining || challenge.status === 'ended'}
          className="mt-4 h-14 flex-row items-center justify-center rounded-[20px] bg-[#FF5C35]">
          {joining ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={{ fontFamily: 'Inter_600SemiBold' }} className="text-base text-white">
              Join challenge
            </Text>
          )}
        </Pressable>
      ) : challenge.status === 'upcoming' ? (
        <View className="mt-4 h-14 items-center justify-center rounded-[24px] bg-[#E8E3DF]">
          <Text style={{ fontFamily: 'Inter_600SemiBold' }} className="text-sm text-[#77716D]">
            Starts in {challenge.daysUntilStart} days
          </Text>
        </View>
      ) : challenge.status === 'ended' ? (
        <View className="mt-4 h-14 items-center justify-center rounded-[24px] bg-[#E8E3DF]">
          <Text style={{ fontFamily: 'Inter_600SemiBold' }} className="text-sm text-[#77716D]">
            Challenge ended
          </Text>
        </View>
      ) : (
        <Pressable
          onPress={onRecord}
          disabled={challenge.completedToday}
          className={`mt-4 h-14 flex-row items-center justify-center rounded-[20px] ${
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
    </ScrollView>
  );
}
