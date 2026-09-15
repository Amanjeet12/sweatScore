import { useMutation, useQuery } from 'convex/react';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import {
  ArrowRight,
  ArrowUpRight,
  LockSimple,
  Play,
  UploadSimple,
  VideoCamera,
  X,
} from 'phosphor-react-native';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackButton } from '~/components/core/BackButton';
import SafeAreaView from '~/components/core/SafeAreaView';
import ScreenLoading from '~/components/core/ScreenLoading';
import CommunityChallengeDetail from '~/components/core/challenges/CommunityChallengeDetail';
import { useChallengeUploadQueue } from '~/components/providers/ChallengeUploadProvider';
import { ButtonText, LoadingButton } from '~/components/ui/button';
import { Text } from '~/components/ui/text';
import { api } from '~/convex/_generated/api';
import type { Id } from '~/convex/_generated/dataModel';
import { useRetainedQueryResult } from '~/hooks/useRetainedQueryResult';
import { useSubscriptionGuard } from '~/hooks/useSubscriptionGuard';
import { useTabStore } from '~/store/useTabStore';
import { getErrorMessage } from '~/utils/error-message';

type CheckItOutLinkProps = {
  url?: string | null;
  isPro: boolean;
  onOpen: (url: string) => Promise<void>;
};

type CheckInMode = 'take_photo' | 'upload_photo' | 'record_video' | 'upload_video';

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
      onPress={async () => {
        await onOpen(url);
      }}
      className="mt-3 rounded-[20px] bg-white px-4 py-3.5">
      <View className="flex-row items-center justify-between">
        <Text
          style={{ fontFamily: 'Inter_600SemiBold' }}
          className="min-w-0 flex-1 pr-4 text-[10px] uppercase tracking-[1px] text-[#FF4B1F]">
          Bonus Content
        </Text>

        <View
          className="items-center justify-center rounded-full bg-[#FF5C35]"
          style={{ width: 40, height: 40 }}>
          {isPro ? (
            <ArrowUpRight size={19} color="#FFFFFF" weight="bold" />
          ) : (
            <LockSimple size={17} color="#FFFFFF" weight="bold" />
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function ChallengeViewScreen() {
  const insets = useSafeAreaInsets();
  const { challengeId } = useLocalSearchParams<{
    challengeId: string;
  }>();

  const [isPlaying, setIsPlaying] = useState(false);
  const [showCheckInOptions, setShowCheckInOptions] = useState(false);
  const [joiningCommunityChallenge, setJoiningCommunityChallenge] = useState(false);
  const [communityRefreshToken, setCommunityRefreshToken] = useState(() =>
    Math.floor(Date.now() / 60000)
  );

  const challenge = useQuery(api.challengeCompletions.getPublishedChallenge, {
    challengeId: challengeId as Id<'challenges'>,
  });
  const communityChallengeResult = useQuery(api.challengeCompletions.getCommunityChallengeDetails, {
    challengeId: challengeId as Id<'challenges'>,
    refreshToken: communityRefreshToken,
  });
  const communityChallenge = useRetainedQueryResult(communityChallengeResult, String(challengeId));
  const joinCommunityChallenge = useMutation(api.challengeCompletions.joinCommunityChallenge);

  const availableCheckIns = useQuery(
    api.challengeCompletions.getAvailableCheckIns,
    challenge?.type === 'check_in' ? { openedChallengeId: challengeId as Id<'challenges'> } : 'skip'
  );

  const selectedCheckIn = availableCheckIns?.find((item) => item.challengeId === challengeId);

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
    const interval = setInterval(() => {
      setCommunityRefreshToken(Math.floor(Date.now() / 60000));
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    player.pause();
    setIsPlaying(false);
    player.replace(selectedVideoUrl);
  }, [player, selectedVideoUrl]);

  const dailyLimitReached = challenge?.type !== 'check_in' && progress?.dailyLimitReached === true;

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

    if (isCheckIn) {
      setShowCheckInOptions(true);
      return;
    }

    router.push({
      pathname: '/challenge-record/[challengeId]',

      params: {
        challengeId: activeChallengeId,
      },
    });
  };

  const handleJoinCommunityChallenge = async () => {
    const allowed = requireSubscription({
      redirectTo: `/challenge-view/${challengeId}`,
      source: 'community_challenge_join',
    });
    if (!allowed) return;

    setJoiningCommunityChallenge(true);
    try {
      await joinCommunityChallenge({ challengeId: challengeId as Id<'challenges'> });
    } catch (error) {
      Alert.alert('Unable to join', getErrorMessage(error));
    } finally {
      setJoiningCommunityChallenge(false);
    }
  };

  const handleSelectCheckInMode = (checkInMode: CheckInMode) => {
    setShowCheckInOptions(false);
    router.push({
      pathname: '/challenge-record/[challengeId]',
      params: {
        challengeId: activeChallengeId,
        checkInMode,
      },
    });
  };

  const checkInOptions = [
    {
      mode: 'record_video' as const,
      label: 'Record video',
      description: 'Record your proof · 1 min max',
      icon: <VideoCamera size={21} color="#FF5C1A" />,
    },
    // {
    //   mode: 'take_photo' as const,
    //   label: 'Take photo',
    //   description: 'Use your camera',
    //   icon: <Camera size={21} color="#FF5C1A" />,
    // },
    // {
    //   mode: 'upload_photo' as const,
    //   label: 'Upload photo',
    //   description: 'Choose a saved photo',
    //   icon: <ImageSquare size={21} color="#FF5C1A" />,
    // },
    {
      mode: 'upload_video' as const,
      label: 'Upload video',
      description: 'Choose a saved video · 1 min max',
      icon: <UploadSimple size={21} color="#FF5C1A" />,
    },
  ];

  const renderActionButton = () => {
    if (hasFailedUpload) {
      return (
        <>
          <LoadingButton
            variant="solid"
            size="xl"
            action="primary"
            className="h-14 w-full rounded-[20px]"
            onPress={() => {
              safePausePlayer();

              const allowed = requireSubscription({
                redirectTo: `/challenge-view/${challengeId}`,
                source: 'challenge_retry_upload',
              });

              if (!allowed) return;
              retryChallengeUpload(activeChallengeId);
            }}>
            <ButtonText style={{ fontFamily: 'Inter_600SemiBold' }} className="text-lg text-white">
              Retry Upload
            </ButtonText>
          </LoadingButton>
          <Text className="mt-2 text-center font-body text-sm text-[#E5484D]">
            Upload failed. Tap retry and keep the app open while your video uploads.
          </Text>
        </>
      );
    }

    if (hasActiveUpload) {
      return (
        <>
          <LoadingButton
            variant="outline"
            size="xl"
            action="secondary"
            className="h-14 w-full rounded-[20px]"
            disabled>
            <ButtonText
              style={{ fontFamily: 'Inter_600SemiBold' }}
              className="text-lg text-[#838383]">
              Uploading...
            </ButtonText>
          </LoadingButton>
          <Text className="mt-2 text-center font-body text-sm text-[#838383]">
            Please keep the app open while your video uploads.
          </Text>
        </>
      );
    }

    if ((selectedCheckIn?.isLocked ?? challenge?.isLocked) && !isPro) {
      return (
        <>
          <LoadingButton
            variant="solid"
            size="xl"
            action="primary"
            className="h-14 w-full rounded-[20px]"
            onPress={() => {
              safePausePlayer();
              requireSubscription({
                redirectTo: `/challenge-view/${challengeId}`,
                source: 'challenge_locked',
              });
            }}>
            <View className="flex-row items-center gap-x-2">
              <LockSimple size={18} color="#FFFFFF" weight="bold" />
              <ButtonText
                style={{ fontFamily: 'Inter_600SemiBold' }}
                className="text-lg text-white">
                Unlock Duet
              </ButtonText>
            </View>
          </LoadingButton>
          <Text className="mt-2 text-center font-body text-sm text-[#838383]">
            This duet is for premium members
          </Text>
        </>
      );
    }

    if (cooldown?.completedToday) {
      return (
        <>
          <LoadingButton
            variant="outline"
            size="xl"
            action="secondary"
            className="h-14 w-full rounded-[20px]"
            disabled>
            <ButtonText
              style={{ fontFamily: 'Inter_600SemiBold' }}
              className="text-lg text-[#838383]">
              Completed Today
            </ButtonText>
          </LoadingButton>
          <Text className="mt-2 text-center font-body text-sm text-[#838383]">
            Come back tomorrow to try again!
          </Text>
        </>
      );
    }

    if (dailyLimitReached) {
      return (
        <>
          <LoadingButton
            variant="outline"
            size="xl"
            action="secondary"
            className="h-14 w-full rounded-[20px]"
            disabled>
            <ButtonText
              style={{ fontFamily: 'Inter_600SemiBold' }}
              className="text-lg text-[#838383]">
              Today&apos;s Limit Reached
            </ButtonText>
          </LoadingButton>
          <Text className="mt-2 text-center font-body text-sm text-[#838383]">
            You completed {dailyCompletionCount}/{dailyLimit} challenges today. Come back tomorrow.
          </Text>
        </>
      );
    }

    return (
      <LoadingButton
        variant="solid"
        size="xl"
        action="primary"
        className="h-14 w-full rounded-[20px]"
        onPress={handleStartChallenge}>
        <View className="flex-row items-center justify-center">
          <ButtonText style={{ fontFamily: 'Inter_600SemiBold' }} className="text-lg text-white">
            {isCheckIn ? 'Start Check-In' : `Let's Go`}
          </ButtonText>
        </View>
      </LoadingButton>
    );
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
              <Text
                style={{ fontFamily: 'Inter_700Bold' }}
                className="text-center text-lg text-[#1A1A1A]">
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

      {challenge?.isCommunityChallenge === true ? (
        communityChallenge === undefined ? (
          <ScreenLoading />
        ) : communityChallenge === null ? (
          <View className="flex-1 items-center justify-center">
            <Text className="text-base text-gray-500">Challenge not available</Text>
          </View>
        ) : (
          <CommunityChallengeDetail
            challenge={communityChallenge}
            joining={joiningCommunityChallenge}
            onJoin={handleJoinCommunityChallenge}
            onRecord={handleStartChallenge}
          />
        )
      ) : challenge === undefined ||
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
            paddingBottom: isCheckIn ? 20 : 40,
          }}>
          {/* Challenge video */}
          {selectedVideoUrl ? (
            <View
              className={isCheckIn ? 'relative mx-5 mt-3 overflow-hidden rounded-[24px]' : 'mt-4'}>
              {isPlaying ? (
                <VideoView
                  player={player}
                  style={{
                    width: '100%',
                    aspectRatio: isCheckIn ? 0.85 : 414 / 480,
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
                        aspectRatio: isCheckIn ? 0.85 : 414 / 480,
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
                          width: isCheckIn ? 56 : 64,
                          height: isCheckIn ? 56 : 64,
                          backgroundColor: isCheckIn ? '#FFFFFF' : 'rgba(26, 26, 26, 0.6)',
                        }}>
                        <Play size={28} color={isCheckIn ? '#FF5C35' : '#FFFFFF'} weight="fill" />
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              )}
              {isCheckIn ? (
                <View
                  pointerEvents="none"
                  className="absolute right-3 top-3 rounded-full bg-black/60 px-3 py-1.5"
                  style={{ zIndex: 2 }}>
                  <Text style={{ fontFamily: 'Inter_600SemiBold' }} className="text-xs text-white">
                    +{selectedCheckIn?.points ?? challenge.points}{' '}
                    {(selectedCheckIn?.points ?? challenge.points) === 1 ? 'pt' : 'pts'}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}

          {/* Normal challenge description */}
          {!isCheckIn ? (
            <View className="mt-6 px-8">
              <View className="rounded-[24px] px-4 py-4">
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
            <View className="px-5 pt-2.5">
              <View className="rounded-[24px] bg-white px-4 py-4">
                <Text
                  style={{ fontFamily: 'Inter_600SemiBold' }}
                  className="text-[10px] uppercase tracking-[1px] text-[#FF4B1F]">
                  Today&apos;s check-in
                </Text>
                <Text className="mt-1.5 font-body text-[13px] leading-[19px] text-[#77716D]">
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
          {!isCheckIn ? <View className="mt-6 px-8">{renderActionButton()}</View> : null}
        </ScrollView>
      )}

      {challenge &&
      isCheckIn &&
      cooldown !== undefined &&
      progress !== undefined &&
      availableCheckIns !== undefined ? (
        <View
          className="bg-white px-5 pb-2.5 pt-3"
          style={{
            borderTopWidth: 1,
            borderTopColor: '#EEEAE7',
          }}>
          {renderActionButton()}
        </View>
      ) : null}

      <Modal
        transparent
        animationType="slide"
        visible={showCheckInOptions}
        onRequestClose={() => setShowCheckInOptions(false)}>
        <View className="flex-1 justify-end">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close check-in options"
            style={[
              StyleSheet.absoluteFillObject,
              {
                backgroundColor: 'rgba(16, 12, 10, 0.68)',
              },
            ]}
            onPress={() => setShowCheckInOptions(false)}
          />

          <View
            className="rounded-t-[24px] bg-white px-5 pt-2"
            style={{ paddingBottom: Math.max(insets.bottom, 16) }}>
            <View className="mb-3 h-1 w-10 self-center rounded-full bg-[#CEC7C2]" />

            <View className="mb-4 flex-row items-start justify-between">
              <View className="min-w-0 flex-1 pr-4">
                <Text
                  style={{ fontFamily: 'Inter_600SemiBold' }}
                  className="text-[10px] uppercase tracking-[1px] text-[#FF4B1F]">
                  Today&apos;s check-in
                </Text>
                <Text
                  style={{ fontFamily: 'Inter_700Bold' }}
                  className="mt-1 text-[22px] leading-7 text-[#1A1A1A]">
                  How would you like to check in?
                </Text>
              </View>

              <TouchableOpacity
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel="Close"
                onPress={() => setShowCheckInOptions(false)}
                className="h-10 w-10 items-center justify-center rounded-full bg-[#F2EFED]">
                <X size={18} color="#77716D" weight="bold" />
              </TouchableOpacity>
            </View>

            <View className="overflow-hidden rounded-[24px]  ">
              {checkInOptions.map((option, index) => (
                <TouchableOpacity
                  key={option.mode}
                  activeOpacity={0.72}
                  accessibilityRole="button"
                  accessibilityLabel={`${option.label}. ${option.description}`}
                  onPress={() => handleSelectCheckInMode(option.mode)}
                  className="h-[74px] flex-row items-center px-3.5"
                  style={{
                    borderBottomWidth: index === checkInOptions.length - 1 ? 0 : 1,
                    borderBottomColor: '#EEE7E2',
                  }}>
                  <View className="mr-3 h-11 w-11 items-center justify-center rounded-[24px] bg-[#FFF0E8]">
                    {option.icon}
                  </View>
                  <View className="min-w-0 flex-1 pr-2">
                    <Text
                      style={{ fontFamily: 'Inter_600SemiBold' }}
                      className="text-sm text-[#1A1A1A]">
                      {option.label}
                    </Text>
                    <Text className="mt-0.5 font-body text-[11px] text-[#8A827D]">
                      {option.description}
                    </Text>
                  </View>
                  <ArrowRight size={16} color="#FF5C1A" weight="bold" style={{ marginLeft: 8 }} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
