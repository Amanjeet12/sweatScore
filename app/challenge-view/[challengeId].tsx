import { useQuery } from 'convex/react';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import {
  AppleLogo,
  Barbell,
  Drop,
  Footprints,
  LockSimple,
  PersonArmsSpread,
  Play,
  Pulse,
  Tree,
} from 'phosphor-react-native';
import { useCallback, useState } from 'react';
import { Linking, ScrollView, TouchableOpacity, View } from 'react-native';

import { BackButton } from '~/components/core/BackButton';
import SafeAreaView from '~/components/core/SafeAreaView';
import ScreenLoading from '~/components/core/ScreenLoading';
import { useChallengeUploadQueue } from '~/components/providers/ChallengeUploadProvider';
import { ButtonText, LoadingButton } from '~/components/ui/button';
import { Text } from '~/components/ui/text';
import { api } from '~/convex/_generated/api';
import { Id } from '~/convex/_generated/dataModel';
import { useSubscriptionGuard } from '~/hooks/useSubscriptionGuard';
import { useTabStore } from '~/store/useTabStore';
import { CHECK_IN_OPTIONS } from '~/utils/checkInOptions';
import type { CheckInOptionKey } from '~/utils/checkInOptions';

function CheckInOptionIcon({ option, selected }: { option: CheckInOptionKey; selected: boolean }) {
  const props = {
    size: 20,
    color: selected ? '#FFFFFF' : '#4A4A4A',
    weight: 'regular' as const,
  };

  switch (option) {
    case 'hydration':
      return <Drop {...props} />;
    case 'healthy_meal':
      return <AppleLogo {...props} />;
    case 'gym_visit':
      return <Barbell {...props} />;
    case 'fresh_air':
      return <Tree {...props} />;
    case 'stretch':
      return <PersonArmsSpread {...props} />;
    case 'steps':
      return <Footprints {...props} />;
    case 'workout':
      return <Pulse {...props} />;
  }
}

export default function ChallengeViewScreen() {
  const { challengeId } = useLocalSearchParams<{ challengeId: string }>();
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedCheckInOption, setSelectedCheckInOption] = useState<CheckInOptionKey>('workout');

  const challenge = useQuery(api.challengeCompletions.getPublishedChallenge, {
    challengeId: challengeId as Id<'challenges'>,
  });

  const cooldown = useQuery(api.challengeCompletions.getChallengeCooldown, {
    challengeId: challengeId as Id<'challenges'>,
  });

  const progress = useQuery(api.challengeCompletions.getChallengeProgress, {
    challengeId: challengeId as Id<'challenges'>,
  });

  const { isPro, requireSubscription } = useSubscriptionGuard();
  const currentTab = useTabStore((state) => state.currentTab);

  const { getJobForChallenge, retryChallengeUpload } = useChallengeUploadQueue();

  const uploadJob = getJobForChallenge(challengeId ?? '');
  const hasFailedUpload = uploadJob?.status === 'failed';
  const hasActiveUpload =
    uploadJob?.status === 'queued' ||
    uploadJob?.status === 'uploading' ||
    uploadJob?.status === 'finalizing';

  const player = useVideoPlayer(challenge?.instructionalVideoUrl ?? null, (p) => {
    p.loop = false;
  });

  const dailyLimitReached = progress?.dailyLimitReached === true;
  const dailyLimit = progress?.dailyLimit ?? 5;
  const dailyCompletionCount = progress?.dailyCompletionCount ?? 0;

  const challengeType = challenge?.type ?? 'challenge';
  const isCheckIn = challengeType === 'check_in';
  const selectedDescription = challenge
    ? isCheckIn
      ? challenge.checkInDescription?.trim() || challenge.description
      : challenge.description
    : '';

  const handlePlay = useCallback(() => {
    if (player) {
      player.play();
      setIsPlaying(true);
    }
  }, [player]);

  const safePausePlayer = useCallback(() => {
    try {
      player?.pause();
    } catch {}
    setIsPlaying(false);
  }, [player]);

  useFocusEffect(
    useCallback(() => {
      return () => {
        safePausePlayer();
      };
    }, [safePausePlayer])
  );

  return (
    <SafeAreaView className="flex-1 bg-[#F9F9F9]">
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitleAlign: 'center',
          title: '',
          headerTitle: () =>
            challenge ? (
              <Text className="text-center font-heading text-lg font-bold text-[#1A1A1A]">
                {challenge.name}
              </Text>
            ) : null,
          headerShadowVisible: false,
          headerStyle: { backgroundColor: '#F9F9F9' },
          headerLeft: () => <BackButton fallbackHref={`/(tabs)/${currentTab}` as any} />,
        }}
      />

      {challenge === undefined || cooldown === undefined || progress === undefined ? (
        <ScreenLoading />
      ) : challenge === null ? (
        <View className="flex-1 items-center justify-center">
          <Text className="text-base text-gray-500">Challenge not available</Text>
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40 }}>
          <View className="mt-4">
            {isPlaying ? (
              <VideoView
                player={player}
                style={{
                  width: '100%',
                  aspectRatio: 414 / 480,
                }}
                contentFit="cover"
                allowsFullscreen
                allowsPictureInPicture={false}
              />
            ) : (
              <TouchableOpacity onPress={handlePlay} activeOpacity={0.9}>
                <View className="relative overflow-hidden">
                  <VideoView
                    player={player}
                    pointerEvents="none"
                    style={{
                      width: '100%',
                      aspectRatio: 414 / 480,
                    }}
                    contentFit="cover"
                    nativeControls={false}
                    allowsFullscreen={false}
                    allowsPictureInPicture={false}
                  />

                  <View
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                    <View
                      className="items-center justify-center rounded-full"
                      style={{
                        width: 64,
                        height: 64,
                        backgroundColor: 'rgba(26, 26, 26, 0.6)',
                      }}>
                      <Play size={28} color="#FFFFFF" weight="fill" />
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            )}
          </View>

          {!isCheckIn ? (
            <View className="mt-6 px-8">
              <Text className="text-center font-body text-base text-[#313131]">
                {selectedDescription}
              </Text>
            </View>
          ) : null}

          {isCheckIn ? (
            <View className="mt-6 px-5">
              <Text className="text-center font-heading text-lg font-bold text-[#1A1A1A]">
                What are you checking in for?
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                className="mt-3"
                contentContainerStyle={{ gap: 10, paddingRight: 20 }}>
                {CHECK_IN_OPTIONS.map((option) => {
                  const selected = option.key === selectedCheckInOption;
                  return (
                    <TouchableOpacity
                      key={option.key}
                      activeOpacity={0.8}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      accessibilityLabel={option.label}
                      onPress={() => setSelectedCheckInOption(option.key)}
                      className="flex-row items-center rounded-full px-4 py-3"
                      style={{
                        borderWidth: 1.5,
                        borderColor: selected ? '#FF5C35' : '#E3DEDA',
                        backgroundColor: selected ? '#FF5C35' : '#FFFFFF',
                      }}>
                      <View className="mr-2">
                        <CheckInOptionIcon option={option.key} selected={selected} />
                      </View>
                      <Text
                        className="font-body text-sm font-bold"
                        style={{ color: selected ? '#FFFFFF' : '#313131' }}>
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              <View className="mt-4 px-4 py-2">
                <Text className="text-center font-body text-sm leading-5 text-[#4F4F4F]">
                  {
                    CHECK_IN_OPTIONS.find((option) => option.key === selectedCheckInOption)
                      ?.description
                  }
                </Text>
              </View>
            </View>
          ) : null}

          {challenge.youtubeUrl && (
            <TouchableOpacity
              className="mt-4 flex-row items-center justify-center gap-x-1"
              onPress={() => Linking.openURL(challenge.youtubeUrl!)}>
              {/* <Play size={16} color="#FF5C1A" weight="fill" /> */}
              <Text className="font-body text-sm font-bold text-primary-500">Check It Out</Text>
            </TouchableOpacity>
          )}

          <View className="mt-6 px-8">
            {hasFailedUpload ? (
              <>
                <LoadingButton
                  variant="solid"
                  size="xl"
                  action="primary"
                  className="h-14 w-full"
                  onPress={() => {
                    safePausePlayer();
                    if (
                      !requireSubscription({
                        redirectTo: `/challenge-view/${challengeId}`,
                        source: 'challenge_retry_upload',
                      })
                    )
                      return;
                    retryChallengeUpload(challengeId);
                  }}>
                  <ButtonText className="text-lg font-bold text-white">Retry Upload</ButtonText>
                </LoadingButton>

                <Text className="mt-2 text-center font-body text-sm text-[#E5484D]">
                  Upload failed. Tap retry and keep the app open while your video uploads.
                </Text>
              </>
            ) : hasActiveUpload ? (
              <>
                <LoadingButton
                  variant="outline"
                  size="xl"
                  action="secondary"
                  className="h-14 w-full"
                  disabled>
                  <ButtonText className="text-lg font-bold text-[#838383]">Uploading...</ButtonText>
                </LoadingButton>

                <Text className="mt-2 text-center font-body text-sm text-[#838383]">
                  Please keep the app open while your video uploads.
                </Text>
              </>
            ) : challenge.isLocked && !isPro ? (
              <>
                <LoadingButton
                  variant="solid"
                  size="xl"
                  action="primary"
                  className="h-14 w-full"
                  onPress={() => {
                    safePausePlayer();
                    requireSubscription({
                      redirectTo: `/challenge-view/${challengeId}`,
                      source: 'challenge_locked',
                    });
                  }}>
                  <View className="flex-row items-center gap-x-2">
                    <LockSimple size={18} color="#FFFFFF" weight="bold" />
                    <ButtonText className="text-lg font-bold text-white">Unlock Duet</ButtonText>
                  </View>
                </LoadingButton>

                <Text className="mt-2 text-center font-body text-sm text-[#838383]">
                  This duet is for premium members
                </Text>
              </>
            ) : cooldown.completedToday ? (
              <>
                <LoadingButton
                  variant="outline"
                  size="xl"
                  action="secondary"
                  className="h-14 w-full"
                  disabled>
                  <ButtonText className="text-lg font-bold text-[#838383]">
                    Completed Today
                  </ButtonText>
                </LoadingButton>

                <Text className="mt-2 text-center font-body text-sm text-[#838383]">
                  Come back tomorrow to try again!
                </Text>
              </>
            ) : dailyLimitReached ? (
              <>
                <LoadingButton
                  variant="outline"
                  size="xl"
                  action="secondary"
                  className="h-14 w-full"
                  disabled>
                  <ButtonText className="text-lg font-bold text-[#838383]">
                    Today&apos;s Limit Reached
                  </ButtonText>
                </LoadingButton>

                <Text className="mt-2 text-center font-body text-sm text-[#838383]">
                  You completed {dailyCompletionCount}/{dailyLimit} challenges today. Come back
                  tomorrow.
                </Text>
              </>
            ) : (
              <>
                <LoadingButton
                  variant="solid"
                  size="xl"
                  action="primary"
                  className="h-14 w-full"
                  onPress={() => {
                    safePausePlayer();
                    if (
                      !requireSubscription({
                        redirectTo: `/challenge-view/${challengeId}`,
                        source: isCheckIn ? 'challenge_check_in' : 'challenge_record_video',
                      })
                    )
                      return;
                    router.push({
                      pathname: '/challenge-record/[challengeId]',
                      params: {
                        challengeId,
                        ...(isCheckIn ? { checkInOption: selectedCheckInOption } : {}),
                      },
                    });
                  }}>
                  <ButtonText className="text-lg font-bold text-white">Let’s Go</ButtonText>
                </LoadingButton>

                {/* <Text className="mt-2 text-center font-body text-sm text-[#838383]">
                  {dailyCompletionCount}/{dailyLimit} Challenge videos recorded today.
                </Text> */}
              </>
            )}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
