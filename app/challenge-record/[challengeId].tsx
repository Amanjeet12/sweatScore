import { useQuery } from 'convex/react';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import * as FileSystem from 'expo-file-system';
import { Image } from 'expo-image';
import { useKeepAwake } from 'expo-keep-awake';
import { router, useLocalSearchParams } from 'expo-router';
import { CameraRotate, Record, X } from 'phosphor-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  AppState,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import ScreenLoading from '~/components/core/ScreenLoading';
import CompositeVideoPlayer from '~/components/core/dashboard/CompositeVideoPlayer';
import { useChallengeUploadQueue } from '~/components/providers/ChallengeUploadProvider';
import { ButtonText, LoadingButton } from '~/components/ui/button';
import { Switch } from '~/components/ui/switch';
import { Text } from '~/components/ui/text';
import { Textarea, TextareaInput } from '~/components/ui/textarea';
import { api } from '~/convex/_generated/api';
import { Id } from '~/convex/_generated/dataModel';
import { getErrorMessage } from '~/utils/error-message';

const COUNTDOWN_SECONDS = 5;
const MIN_STOP_RECORDING_SECONDS = 5;
const MAX_RECORDING_SECONDS = 60;

type RecordingState = 'pre-record' | 'countdown' | 'recording' | 'post-record';

export default function DuetRecordingScreen() {
  useKeepAwake();

  const { challengeId } = useLocalSearchParams<{
    challengeId: string;
  }>();

  const insets = useSafeAreaInsets();

  const [state, setState] = useState<RecordingState>('pre-record');
  const [countdownValue, setCountdownValue] = useState(COUNTDOWN_SECONDS);
  const [elapsed, setElapsed] = useState(0);
  const [recordedVideoUri, setRecordedVideoUri] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [allowRepost, setAllowRepost] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<'front' | 'back'>('front');

  const cameraRef = useRef<CameraView>(null);
  const postRecordScrollRef = useRef<ScrollView>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isRecordingRef = useRef(false);
  const cancelledByBackgroundRef = useRef(false);
  const cancelledByUserRef = useRef(false);
  const preserveRecordedVideoOnUnmountRef = useRef(false);
  const recordedVideoUriRef = useRef<string | null>(null);

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();

  const challenge = useQuery(api.challengeCompletions.getPublishedChallenge, {
    challengeId: challengeId as Id<'challenges'>,
  });

  const progress = useQuery(api.challengeCompletions.getChallengeProgress, {
    challengeId: challengeId as Id<'challenges'>,
  });

  const { enqueueChallengeUpload, getJobForChallenge } = useChallengeUploadQueue();
  const existingUploadJob = getJobForChallenge(challengeId ?? '');

  useEffect(() => {
    if (!cameraPermission?.granted) {
      requestCameraPermission();
    }

    if (!micPermission?.granted) {
      requestMicPermission();
    }
  }, [
    cameraPermission?.granted,
    micPermission?.granted,
    requestCameraPermission,
    requestMicPermission,
  ]);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    recordedVideoUriRef.current = recordedVideoUri;
  }, [recordedVideoUri]);

  useEffect(() => {
    return () => {
      const uri = recordedVideoUriRef.current;

      if (
        uri &&
        !preserveRecordedVideoOnUnmountRef.current &&
        uri.startsWith(FileSystem.documentDirectory ?? '')
      ) {
        FileSystem.deleteAsync(uri, {
          idempotent: true,
        }).catch(() => {});
      }
    };
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') return;

      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }

      if (isRecordingRef.current) {
        cancelledByBackgroundRef.current = true;
        isRecordingRef.current = false;

        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }

        try {
          cameraRef.current?.stopRecording();
        } catch {
          // Recording is already stopped.
        }

        return;
      }

      if (state === 'countdown') {
        setState('pre-record');
        setElapsed(0);
        setCountdownValue(COUNTDOWN_SECONDS);
      }
    });

    return () => subscription.remove();
  }, [state]);

  const stopRecording = useCallback(() => {
    if (!isRecordingRef.current) return;

    isRecordingRef.current = false;

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    try {
      cameraRef.current?.stopRecording();
    } catch {
      // Camera may already be stopped.
    }
  }, []);

  const startRecording = useCallback(async () => {
    if (!cameraRef.current) {
      setState('pre-record');
      return;
    }

    setState('recording');
    setElapsed(0);

    cancelledByUserRef.current = false;
    cancelledByBackgroundRef.current = false;
    isRecordingRef.current = true;

    timerRef.current = setInterval(() => {
      setElapsed((previous) => previous + 1);
    }, 1000);

    try {
      const video = await cameraRef.current.recordAsync({
        maxDuration: MAX_RECORDING_SECONDS,
      });

      isRecordingRef.current = false;

      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      if (cancelledByUserRef.current) {
        cancelledByUserRef.current = false;

        if (video?.uri) {
          FileSystem.deleteAsync(video.uri, {
            idempotent: true,
          }).catch(() => {});
        }

        return;
      }

      const finishedNormally = !cancelledByBackgroundRef.current;
      cancelledByBackgroundRef.current = false;

      if (!video?.uri || !finishedNormally) {
        setRecordedVideoUri(null);
        setElapsed(0);
        setState('pre-record');

        Alert.alert(
          'Recording incomplete',
          'The recording was interrupted. Please try again without leaving the app.'
        );

        return;
      }

      try {
        const persistentUri = `${FileSystem.documentDirectory}challenge-${Date.now()}.mp4`;

        await FileSystem.copyAsync({
          from: video.uri,
          to: persistentUri,
        });

        await FileSystem.deleteAsync(video.uri, {
          idempotent: true,
        });

        recordedVideoUriRef.current = persistentUri;
        setRecordedVideoUri(persistentUri);
        setState('post-record');
      } catch {
        setRecordedVideoUri(null);
        setElapsed(0);
        setState('pre-record');

        Alert.alert('Recording failed', 'Could not save the recording. Please try again.');
      }
    } catch {
      if (cancelledByUserRef.current) {
        cancelledByUserRef.current = false;
        return;
      }

      isRecordingRef.current = false;
      cancelledByBackgroundRef.current = false;

      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      setElapsed(0);
      setState('pre-record');
    }
  }, []);

  const startCountdown = useCallback(() => {
    if (existingUploadJob) {
      Alert.alert(
        existingUploadJob.status === 'failed' ? 'Upload paused' : 'Upload in progress',
        existingUploadJob.status === 'failed'
          ? 'This challenge already has a paused upload. Please retry it first.'
          : 'This challenge is already uploading in the background.'
      );
      return;
    }

    if (countdownRef.current) return;

    setState('countdown');
    setCountdownValue(COUNTDOWN_SECONDS);

    let count = COUNTDOWN_SECONDS;

    countdownRef.current = setInterval(() => {
      count -= 1;
      setCountdownValue(count);

      if (count <= 0) {
        if (countdownRef.current) {
          clearInterval(countdownRef.current);
          countdownRef.current = null;
        }

        void startRecording();
      }
    }, 1000);
  }, [existingUploadJob, startRecording]);

  const handleSwitchCamera = useCallback(() => {
    if (isRecordingRef.current) return;

    setCameraFacing((current) => (current === 'front' ? 'back' : 'front'));
  }, []);

  const handleCancel = useCallback(() => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }

    if (isRecordingRef.current) {
      cancelledByUserRef.current = true;
    }

    stopRecording();
    router.back();
  }, [stopRecording]);

  const handleStartOver = useCallback(() => {
    if (recordedVideoUri) {
      FileSystem.deleteAsync(recordedVideoUri, {
        idempotent: true,
      }).catch(() => {});
    }

    recordedVideoUriRef.current = null;
    preserveRecordedVideoOnUnmountRef.current = false;

    setRecordedVideoUri(null);
    setCaption('');
    setAllowRepost(true);
    setElapsed(0);
    setCountdownValue(COUNTDOWN_SECONDS);
    setState('pre-record');
  }, [recordedVideoUri]);

  const handleSubmit = useCallback(async () => {
    if (!recordedVideoUri || !challenge || isSubmitting) {
      return;
    }

    const trimmedCaption = caption.trim();

    if (!trimmedCaption) {
      Alert.alert('Caption required', 'Please add a caption before submitting your video.');
      return;
    }

    setIsSubmitting(true);

    try {
      await enqueueChallengeUpload({
        challengeId,
        videoUri: recordedVideoUri,
        allowRepost,
        caption: trimmedCaption,
      });

      preserveRecordedVideoOnUnmountRef.current = true;
      recordedVideoUriRef.current = null;

      router.dismissAll();
      router.replace('/(tabs)/dashboard');
    } catch (error) {
      Alert.alert('Unable to submit', getErrorMessage(error));
      setIsSubmitting(false);
    }
  }, [
    recordedVideoUri,
    challenge,
    isSubmitting,
    enqueueChallengeUpload,
    challengeId,
    allowRepost,
    caption,
  ]);

  const handleCaptionFocus = useCallback(() => {
    setTimeout(() => {
      postRecordScrollRef.current?.scrollToEnd({
        animated: true,
      });
    }, 250);
  }, []);

  if (challenge === undefined) {
    return <ScreenLoading />;
  }

  if (challenge === null) {
    return (
      <View className="flex-1 items-center justify-center bg-[#F9F9F9]">
        <Text className="text-base text-gray-500">Challenge not available</Text>
      </View>
    );
  }

  if (!cameraPermission?.granted || !micPermission?.granted) {
    return (
      <View
        className="flex-1 items-center justify-center bg-[#F9F9F9] px-8"
        style={{ paddingTop: insets.top }}>
        <Text className="mb-4 text-center text-base text-[#313131]">
          Camera and microphone permissions are required to record your challenge.
        </Text>

        <LoadingButton
          variant="solid"
          size="lg"
          action="primary"
          onPress={async () => {
            await requestCameraPermission();
            await requestMicPermission();
          }}>
          <ButtonText>Grant Permissions</ButtonText>
        </LoadingButton>

        <TouchableOpacity className="mt-4" onPress={() => router.back()}>
          <Text className="font-body text-sm font-medium text-[#838383]">Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const totalPoints = challenge.points + (allowRepost ? 3 : 0);
  const isLiveState = state === 'pre-record' || state === 'countdown' || state === 'recording';
  const isCaptionMissing = !caption.trim();

  const progressPercent =
    state === 'recording' ? Math.min(100, (elapsed / MAX_RECORDING_SECONDS) * 100) : 0;

  const canStopRecording = state === 'recording' && elapsed >= MIN_STOP_RECORDING_SECONDS;

  if (isLiveState) {
    return (
      <View className="flex-1 bg-black">
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFillObject}
          facing={cameraFacing}
          mode="video"
          videoQuality="720p"
        />

        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFillObject,
            {
              backgroundColor: state === 'pre-record' ? 'rgba(0,0,0,0.18)' : 'rgba(0,0,0,0.08)',
            },
          ]}
        />

        {state === 'pre-record' && (
          <TouchableOpacity
            onPress={handleSwitchCamera}
            hitSlop={{
              top: 12,
              bottom: 12,
              left: 12,
              right: 12,
            }}
            style={{
              position: 'absolute',
              top: insets.top + 14,
              right: 16,
              zIndex: 30,
              width: 46,
              height: 46,
              borderRadius: 23,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(0,0,0,0.45)',
            }}>
            <CameraRotate size={26} color="#FFFFFF" weight="bold" />
          </TouchableOpacity>
        )}

        {state === 'recording' && (
          <View
            style={{
              position: 'absolute',
              top: insets.top,
              left: 0,
              right: 0,
              height: 4,
              backgroundColor: 'rgba(255,255,255,0.3)',
            }}>
            <View
              style={{
                height: '100%',
                width: `${progressPercent}%`,
                backgroundColor: '#FF5C1A',
              }}
            />
          </View>
        )}

        {state === 'pre-record' && (
          <View
            style={{
              position: 'absolute',
              top: insets.top + 20,
              left: 0,
              right: 0,
              alignItems: 'center',
            }}>
            <Text className="font-heading text-xl font-bold text-white">
              Day {progress?.nextAttemptNumber ?? 1}
            </Text>
          </View>
        )}

        {(state === 'countdown' || state === 'recording' || state === 'pre-record') && (
          <TouchableOpacity
            onPress={handleCancel}
            hitSlop={{
              top: 12,
              bottom: 12,
              left: 12,
              right: 12,
            }}
            style={{
              position: 'absolute',
              top: insets.top + 14,
              left: 16,
              zIndex: 20,
              padding: 8,
              borderRadius: 999,
              backgroundColor: 'rgba(0,0,0,0.35)',
            }}>
            <X size={28} color="#FFFFFF" weight="bold" />
          </TouchableOpacity>
        )}

        {state === 'countdown' && (
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFillObject,
              {
                alignItems: 'center',
                justifyContent: 'center',
              },
            ]}>
            <View
              className="items-center justify-center rounded-full"
              style={{
                width: 90,
                height: 90,
                backgroundColor: 'rgba(0,0,0,0.55)',
              }}>
              <Text className="font-heading text-4xl font-extrabold text-white">
                {countdownValue}
              </Text>
            </View>
          </View>
        )}

        {state === 'recording' && (
          <View
            style={{
              position: 'absolute',
              top: insets.top + 16,
              alignSelf: 'center',
              borderRadius: 999,
              backgroundColor: 'rgba(0,0,0,0.45)',
              paddingHorizontal: 14,
              paddingVertical: 7,
            }}>
            <Text className="font-body text-sm font-bold text-white">Recording {elapsed}s</Text>
          </View>
        )}

        {canStopRecording && (
          <View
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: insets.bottom + 20,
              paddingHorizontal: 24,
            }}>
            <LoadingButton
              variant="solid"
              size="xl"
              action="negative"
              className="h-14 w-full"
              onPress={stopRecording}>
              <ButtonText className="text-lg font-bold text-white">Stop Recording</ButtonText>
            </LoadingButton>
          </View>
        )}

        {state === 'pre-record' && (
          <View
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: insets.bottom + 20,
              paddingHorizontal: 24,
            }}>
            <LoadingButton
              variant="solid"
              size="xl"
              action="primary"
              className="mt-5 h-14 w-full"
              onPress={startCountdown}>
              <View className="flex-row items-center gap-x-2">
                <Record size={20} color="#FFFFFF" weight="fill" />
                <ButtonText className="text-lg font-bold text-white">Start Recording</ButtonText>
              </View>
            </LoadingButton>
          </View>
        )}
      </View>
    );
  }

  if (state === 'post-record') {
    return (
      <KeyboardAvoidingView
        className="flex-1 bg-[#F6F6F6]"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}>
        <ScrollView
          ref={postRecordScrollRef}
          contentContainerStyle={{
            paddingTop: insets.top + 14,
            paddingBottom: insets.bottom + 120,
          }}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          keyboardShouldPersistTaps="handled">
          <View className="px-5">
            <View className="items-center">
              <View
                className="items-center justify-center rounded-full bg-white"
                style={{
                  width: 82,
                  height: 82,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 8 },
                  shadowOpacity: 0.08,
                  shadowRadius: 14,
                  elevation: 3,
                }}>
                <Image
                  source={require('~/assets/icons/Gbam.png')}
                  style={{
                    width: 62,
                    height: 62,
                  }}
                  contentFit="contain"
                />
              </View>

              <Text className="mt-3 text-center font-heading text-2xl font-extrabold text-[#1A1A1A]">
                Gbam. That&apos;s how it&apos;s done.
              </Text>

              <Text className="mt-1 text-center font-body text-sm text-[#686868]">
                Review your video, add a caption, then submit your day.
              </Text>
            </View>
          </View>

          {recordedVideoUri && challenge.instructionalVideoUrl && (
            <View className="mx-5 mt-5 overflow-hidden rounded-3xl bg-white">
              <CompositeVideoPlayer
                leftVideoUrl={progress?.day1VideoUrl ?? challenge.instructionalVideoUrl}
                rightVideoUrl={recordedVideoUri}
                mirrorRight={false}
              />
            </View>
          )}

          <View
            className="mx-5 mt-5 rounded-3xl bg-white px-4 py-4"
            style={{
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.05,
              shadowRadius: 12,
              elevation: 2,
            }}>
            <View className="mb-2 flex-row items-center justify-between">
              <Text className="font-body text-sm font-bold text-[#1F1F1F]">Caption *</Text>

              <Text className="font-body text-xs text-[#838383]">{caption.trim().length}/150</Text>
            </View>

            <Textarea size="xl" className="rounded-2xl border border-[#E7E7E7] bg-[#FAFAFA]">
              <TextareaInput
                placeholder="Share a progress update..."
                value={caption}
                maxLength={150}
                onFocus={handleCaptionFocus}
                onChangeText={setCaption}
                style={{
                  minHeight: 104,
                  textAlignVertical: 'top',
                  paddingTop: 12,
                }}
              />
            </Textarea>

            {isCaptionMissing && (
              <Text className="mt-2 font-body text-xs font-medium text-[#E5484D]">
                Caption is required before submitting.
              </Text>
            )}
          </View>

          <View className="mx-5 mt-4 flex-row items-center justify-between rounded-3xl bg-white px-4 py-4">
            <View className="flex-1 pr-3">
              <Text className="font-body text-sm font-bold text-[#1F1F1F]">
                Allow SweatScore to repost this
              </Text>

              <Text className="mt-1 font-body text-xs text-[#838383]">
                Keep this on to earn 3 extra points.
              </Text>
            </View>

            <View className="mr-3 rounded-full bg-[#FFF1EA] px-3 py-1">
              <Text className="font-body text-xs font-bold text-[#FF5C1A]">+3 pt</Text>
            </View>

            <Switch value={allowRepost} onValueChange={setAllowRepost} />
          </View>

          <View className="mt-6 px-5">
            <LoadingButton
              variant="solid"
              size="xl"
              action="primary"
              className="h-14 w-full"
              loading={isSubmitting}
              disabled={isSubmitting || isCaptionMissing}
              onPress={handleSubmit}>
              <ButtonText className="text-lg font-bold text-white">
                Submit Day {progress?.nextAttemptNumber} for {totalPoints} pts
              </ButtonText>
            </LoadingButton>

            <Text className="mt-2 text-center font-body text-sm text-[#838383]">
              We&apos;ll finish uploading while you keep using the app.
            </Text>
          </View>

          <TouchableOpacity
            className="mt-5 items-center"
            disabled={isSubmitting}
            onPress={handleStartOver}>
            <Text className="font-body text-sm font-semibold text-[#6F6F6F]">Record again</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return null;
}
