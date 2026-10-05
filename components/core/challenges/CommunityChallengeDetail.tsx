import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { ArrowLeft, Play } from 'phosphor-react-native';
import { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrototypeButton } from '~/components/core/auth/PrototypeOnboarding';
import ParticipantAvatars from '~/components/core/challenges/ParticipantAvatars';
import { prototypeTypography as type } from '~/components/core/design/prototypeStyles';
import { Text } from '~/components/ui/text';

export default function CommunityChallengeDetail({
  challenge,
  joining,
  onJoin,
  onRecord,
  uploadState,
  onRetry,
}: {
  challenge: any;
  joining: boolean;
  onJoin: () => void;
  onRecord: () => void;
  uploadState?: 'failed' | 'active';
  onRetry?: () => void;
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
      <View
        style={{
          marginHorizontal: 22,
          marginBottom: 16,
          marginTop: 12,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to challenges"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/hub'))}
          className="h-11 w-11 items-center justify-center rounded-full border border-[#EBE6E2]">
          <ArrowLeft size={22} color="#2a2a2a" />
        </Pressable>
        <Text style={[type.challengeHeading, { flex: 1 }]}>{challenge.name}</Text>
        <View className="h-11 w-11" />
      </View>
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 22, paddingTop: 0, paddingBottom: 24 }}>
        {challenge.instructionalVideoUrl ? (
          <View className="relative overflow-hidden rounded-[16px] bg-[#E8E8E8]">
            <VideoView
              player={player}
              style={{ width: '100%', aspectRatio: 346 / 400 }}
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
                <View className="h-[52px] w-[52px] items-center justify-center rounded-full bg-black/45">
                  <Play size={21} color="#FFFFFF" weight="fill" />
                </View>
              </Pressable>
            ) : null}
          </View>
        ) : challenge.coverImageUrl ? (
          <Image
            source={{ uri: challenge.coverImageUrl }}
            contentFit="cover"
            style={{ width: '100%', aspectRatio: 346 / 400, borderRadius: 16 }}
          />
        ) : null}

        <View
          style={{
            marginTop: 14,
            flexDirection: 'row',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}>
          <Text style={type.caption}>{challenge.durationDays}-day challenge</Text>
          <ParticipantAvatars
            avatars={challenge.participantAvatars}
            count={challenge.participantCount}
            size={32}
          />
        </View>
        <Text style={[type.body, { marginTop: 14, color: '#2a2a2a' }]}>
          {challenge.description}
        </Text>

        {challenge.isJoined ? (
          <View style={{ marginTop: 22 }}>
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
                gap: 12,
              }}>
              <Text style={type.challengeProgress}>Your progress</Text>
              <Text style={type.challengeProgressValue}>
                {challenge.completedDays} of {challenge.durationDays} days
              </Text>
            </View>
            <View
              accessibilityRole="progressbar"
              accessibilityValue={{ min: 0, max: 100, now: progress }}
              accessibilityLabel="Challenge progress"
              className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#F0F0F0]">
              <View
                className="h-full rounded-full bg-[#FF5A1F]"
                style={{ width: `${progress}%` }}
              />
            </View>
            {!challenge.completionBankEligible && !challenge.completionBankAwarded ? (
              <Text style={[type.caption, { marginTop: 8, color: '#A65B45' }]}>
                Daily points remain available, but the completion bank is no longer eligible.
              </Text>
            ) : null}
            {challenge.completionBankAwarded ? (
              <Text
                style={[
                  type.caption,
                  { fontFamily: 'Inter_600SemiBold', marginTop: 8, color: '#21875F' },
                ]}>
                Completion bank earned
              </Text>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
      <View
        style={{
          backgroundColor: '#fff',
          paddingHorizontal: 22,
          paddingTop: 24,
          paddingBottom: Platform.OS === 'android' ? Math.max(insets.bottom, 24) : 24,
        }}>
        <PrototypeButton
          label={
            !challenge.isJoined
              ? challenge.status === 'ended'
                ? 'Challenge ended'
                : 'Join challenge'
              : uploadState === 'failed'
                ? 'Retry upload'
                : uploadState === 'active'
                  ? 'Uploading…'
                  : challenge.status === 'upcoming'
                    ? `Starts in ${challenge.daysUntilStart} ${challenge.daysUntilStart === 1 ? 'day' : 'days'}`
                    : challenge.status === 'ended'
                      ? 'Challenge ended'
                      : recordLabel
          }
          loading={!challenge.isJoined && joining}
          secondary={
            challenge.status === 'ended' ||
            (challenge.isJoined &&
              (challenge.status === 'upcoming' ||
                challenge.completedToday ||
                uploadState === 'active'))
          }
          disabled={
            challenge.status === 'ended' ||
            (challenge.isJoined &&
              (challenge.status === 'upcoming' ||
                challenge.completedToday ||
                uploadState === 'active'))
          }
          onPress={() => {
            player.pause();
            setIsPlaying(false);
            if (!challenge.isJoined) onJoin();
            else if (uploadState === 'failed') onRetry?.();
            else onRecord();
          }}
        />
        {challenge.isJoined && uploadState ? (
          <Text
            style={[
              uploadState === 'failed' ? type.error : type.caption,
              { marginTop: 8, textAlign: 'center' },
            ]}>
            {uploadState === 'failed'
              ? 'Upload failed. Tap retry and keep the app open while your video uploads.'
              : 'Please keep the app open while your video uploads.'}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
