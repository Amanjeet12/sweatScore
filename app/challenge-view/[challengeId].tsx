import { useQuery } from 'convex/react';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { ArrowSquareOut, Lightbulb, LockSimple, Play, Pulse } from 'phosphor-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, Linking, ScrollView, TouchableOpacity, View } from 'react-native';

import { BackButton } from '~/components/core/BackButton';
import SafeAreaView from '~/components/core/SafeAreaView';
import ScreenLoading from '~/components/core/ScreenLoading';
import { useChallengeUploadQueue } from '~/components/providers/ChallengeUploadProvider';
import { ButtonText, LoadingButton } from '~/components/ui/button';
import { Text } from '~/components/ui/text';
import { api } from '~/convex/_generated/api';
import type { Id } from '~/convex/_generated/dataModel';
import { useSubscriptionGuard } from '~/hooks/useSubscriptionGuard';
import { useTabStore } from '~/store/useTabStore';

type CheckItOutLinkProps = {
  url?: string | null;
  isPro: boolean;
  onOpen: (url: string) => Promise<void>;
};

function CheckItOutLink({ url, isPro, onOpen }: CheckItOutLinkProps) {
  if (!url?.trim()) {
    return null;
  }

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={isPro ? 'Open bonus content' : 'Unlock bonus content'}
      accessibilityHint={
        isPro ? 'Opens the bonus content' : 'Opens the subscription screen to unlock bonus content'
      }
      onPress={() => {
        void onOpen(url);
      }}
      className="mt-5 flex-row items-center rounded-xl border border-[#FFC7B0] bg-[#FFF0E9] px-4 py-3">
      <View className="mr-3 h-9 w-9 items-center justify-center rounded-full bg-[#FF5C35]">
        {isPro ? (
          <Lightbulb size={18} color="#FFFFFF" weight="fill" />
        ) : (
          <LockSimple size={17} color="#FFFFFF" weight="bold" />
        )}
      </View>

      <View className="min-w-0 flex-1">
        <Text className="font-heading text-sm font-bold text-[#FF5C35]">Bonus Content</Text>

        <Text className="mt-0.5 font-body text-xs leading-4 text-[#6B625E]">
          {isPro ? 'Tap here to get it now' : 'Premium members only • Tap to unlock'}
        </Text>
      </View>

      {isPro ? (
        <ArrowSquareOut size={20} color="#FF5C35" weight="bold" />
      ) : (
        <LockSimple size={19} color="#FF5C35" weight="bold" />
      )}
    </TouchableOpacity>
  );
}

export default function ChallengeViewScreen() {
  const { challengeId } = useLocalSearchParams<{
    challengeId: string;
  }>();

  const [isPlaying, setIsPlaying] = useState(false);

  const [selectedCheckInId, setSelectedCheckInId] = useState<Id<'challenges'> | null>(null);

  const challenge = useQuery(api.challengeCompletions.getPublishedChallenge, {
    challengeId: challengeId as Id<'challenges'>,
  });

  const availableCheckIns = useQuery(
    api.challengeCompletions.getAvailableCheckIns,
    challenge?.type === 'check_in' ? { openedChallengeId: challengeId as Id<'challenges'> } : 'skip'
  );

  const selectedCheckIn = useMemo(() => {
    if (!availableCheckIns?.length) return undefined;
    return (
      availableCheckIns.find((item) => item.challengeId === selectedCheckInId) ??
      availableCheckIns.find((item) => item.challengeId === challengeId) ??
      availableCheckIns[0]
    );
  }, [availableCheckIns, challengeId, selectedCheckInId]);

  const activeChallengeId = selectedCheckIn?.challengeId ?? (challengeId as Id<'challenges'>);

  const cooldown = useQuery(api.challengeCompletions.getChallengeCooldown, {
    challengeId: activeChallengeId,
  });

  const progress = useQuery(api.challengeCompletions.getChallengeProgress, {
    challengeId: activeChallengeId,
  });

  const { isPro, requireSubscription } = useSubscriptionGuard();

  const currentTab = useTabStore((state) => state.currentTab);

  const { getJobForChallenge, retryChallengeUpload } = useChallengeUploadQueue();

  const uploadJob = getJobForChallenge(activeChallengeId);

  const hasFailedUpload = uploadJob?.status === 'failed';

  const hasActiveUpload =
    uploadJob?.status === 'queued' ||
    uploadJob?.status === 'uploading' ||
    uploadJob?.status === 'finalizing';

  const selectedVideoUrl =
    selectedCheckIn?.instructionalVideoUrl ?? challenge?.instructionalVideoUrl ?? null;

  const player = useVideoPlayer(selectedVideoUrl, (videoPlayer) => {
    videoPlayer.loop = false;
  });

  useEffect(() => {
    if (!availableCheckIns?.length) {
      setSelectedCheckInId(null);
      return;
    }
    if (!availableCheckIns.some((item) => item.challengeId === selectedCheckInId)) {
      const opened = availableCheckIns.find((item) => item.challengeId === challengeId);
      setSelectedCheckInId(opened?.challengeId ?? availableCheckIns[0].challengeId);
    }
  }, [availableCheckIns, challengeId, selectedCheckInId]);

  useEffect(() => {
    player.pause();
    setIsPlaying(false);
    player.replace(selectedVideoUrl);
  }, [player, selectedVideoUrl]);

  const dailyLimitReached = progress?.dailyLimitReached === true;

  const dailyLimit = progress?.dailyLimit ?? 5;

  const dailyCompletionCount = progress?.dailyCompletionCount ?? 0;

  const challengeType = challenge?.type ?? 'challenge';

  const isCheckIn = challengeType === 'check_in';

  const selectedDescription = challenge?.description ?? '';

  const handlePlay = useCallback(() => {
    if (!player) {
      return;
    }

    player.play();
    setIsPlaying(true);
  }, [player]);

  const safePausePlayer = useCallback(() => {
    try {
      player?.pause();
    } catch (error) {
      if (__DEV__) {
        console.warn('Unable to pause challenge video:', error);
      }
    }

    setIsPlaying(false);
  }, [player]);

  useFocusEffect(
    useCallback(() => {
      return () => {
        safePausePlayer();
      };
    }, [safePausePlayer])
  );

  /*
   * Premium Bonus Content
   *
   * Free user:
   * - Does NOT open the external link
   * - Opens subscription/paywall instead
   *
   * Paid/trial user:
   * - Opens the external link normally
   */
  const handleOpenBonusContent = useCallback(
    async (url: string) => {
      const allowed = requireSubscription({
        redirectTo: `/challenge-view/${challengeId}`,
        source: 'challenge_bonus_content',
      });

      if (!allowed) {
        return;
      }

      try {
        await Linking.openURL(url);
      } catch (error) {
        console.error('Unable to open challenge bonus content:', error);
      }
    },
    [challengeId, requireSubscription]
  );

  const handleStartChallenge = () => {
    safePausePlayer();

    const hasSubscription = requireSubscription({
      redirectTo: `/challenge-view/${challengeId}`,
      source: isCheckIn ? 'challenge_check_in' : 'challenge_record_video',
    });

    if (!hasSubscription) {
      return;
    }

    router.push({
      pathname: '/challenge-record/[challengeId]',

      params: {
        challengeId: activeChallengeId,
      },
    });
  };

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
                {selectedCheckIn?.name ?? challenge.name}
              </Text>
            ) : null,
          headerShadowVisible: false,
          headerStyle: {
            backgroundColor: '#F9F9F9',
          },
          headerLeft: () => <BackButton fallbackHref={`/(tabs)/${currentTab}` as any} />,
        }}
      />

      {challenge === undefined ||
      cooldown === undefined ||
      progress === undefined ||
      (challenge?.type === 'check_in' && availableCheckIns === undefined) ? (
        <ScreenLoading />
      ) : challenge === null ? (
        <View className="flex-1 items-center justify-center">
          <Text className="text-base text-gray-500">Challenge not available</Text>
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingBottom: 40,
          }}>
          {/* Challenge video */}
          {selectedVideoUrl ? (
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
                        right: 0,
                        bottom: 0,
                        left: 0,
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
          ) : null}

          {/* Normal challenge description */}
          {!isCheckIn ? (
            <View className="mt-6 px-8">
              <View className="rounded-xl px-4 py-4 shadow-sm">
                <Text className="text-center font-body text-base leading-6 text-[#313131]">
                  {selectedDescription}
                </Text>
              </View>

              <CheckItOutLink
                url={challenge.youtubeUrl}
                isPro={isPro}
                onOpen={handleOpenBonusContent}
              />
            </View>
          ) : null}

          {/* Check-in options and description */}
          {isCheckIn ? (
            <View className="mt-6 px-5">
              <Text className="text-center font-heading text-lg font-bold text-[#1A1A1A]">
                What&apos;s today&apos;s check-in?
              </Text>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                className="mt-3"
                contentContainerStyle={{
                  gap: 10,
                  paddingRight: 20,
                }}>
                {(availableCheckIns ?? []).map((item) => {
                  const selected = item.challengeId === selectedCheckIn?.challengeId;

                  return (
                    <TouchableOpacity
                      key={item.categoryId}
                      activeOpacity={0.8}
                      accessibilityRole="radio"
                      accessibilityState={{
                        selected,
                      }}
                      accessibilityLabel={item.categoryName}
                      onPress={() => {
                        safePausePlayer();
                        setSelectedCheckInId(item.challengeId);
                      }}
                      className="flex-row items-center rounded-full px-4 py-3"
                      style={{
                        borderWidth: 2,
                        borderColor: selected ? '#FF5C35' : '#E3DEDA',
                        // backgroundColor: selected ? '#FF5C35' : '#FFFFFF',
                      }}>
                      <View className="mr-2">
                        {item.categoryIconUrl ? (
                          <Image
                            source={{ uri: item.categoryIconUrl }}
                            className="h-6 w-6 rounded"
                          />
                        ) : item.categoryEmoji ? (
                          <Text className="text-lg">{item.categoryEmoji}</Text>
                        ) : (
                          <Pulse size={20} color={selected ? '#FFFFFF' : '#4A4A4A'} />
                        )}
                      </View>

                      <Text
                        className="font-body text-sm font-bold"
                        style={{
                          color: '#313131',
                        }}>
                        {item.categoryName}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <View className="mt-4 rounded-xl bg-white px-4 py-4 shadow-sm">
                <Text className="text-center font-body text-sm leading-5 text-[#4F4F4F]">
                  {selectedCheckIn?.categoryDescription ??
                    challenge.checkInDescription?.trim() ??
                    challenge.description}
                </Text>
              </View>

              <CheckItOutLink
                url={selectedCheckIn ? selectedCheckIn.youtubeUrl : challenge.youtubeUrl}
                isPro={isPro}
                onOpen={handleOpenBonusContent}
              />
            </View>
          ) : null}

          {/* Action button */}
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

                    const allowed = requireSubscription({
                      redirectTo: `/challenge-view/${challengeId}`,
                      source: 'challenge_retry_upload',
                    });

                    if (!allowed) {
                      return;
                    }

                    retryChallengeUpload(activeChallengeId);
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
            ) : (selectedCheckIn?.isLocked ?? challenge.isLocked) && !isPro ? (
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
              <LoadingButton
                variant="solid"
                size="xl"
                action="primary"
                className="h-14 w-full"
                onPress={handleStartChallenge}>
                <ButtonText className="text-lg font-bold text-white">
                  {isCheckIn ? 'Check In Now' : `Let's Go`}
                </ButtonText>
              </LoadingButton>
            )}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
