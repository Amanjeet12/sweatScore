import { useMutation, useQuery } from 'convex/react';
import {
  CameraView,
  useCameraPermissions,
  useMicrophonePermissions,
} from 'expo-camera';
import * as FileSystem from 'expo-file-system';
import { Image } from 'expo-image';
import { useKeepAwake } from 'expo-keep-awake';
import { router, useLocalSearchParams } from 'expo-router';
import {
  CameraRotate,
  Record,
  X,
} from 'phosphor-react-native';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
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
import {
  OffSyncWarningModal,
  OFF_SYNC_WARNING_KEY,
} from '~/components/core/dashboard/OffSyncWarningModal';
import {
  ButtonText,
  LoadingButton,
} from '~/components/ui/button';
import { Switch } from '~/components/ui/switch';
import { Text } from '~/components/ui/text';
import {
  Textarea,
  TextareaInput,
} from '~/components/ui/textarea';
import { api } from '~/convex/_generated/api';
import { Id } from '~/convex/_generated/dataModel';
import { CatchPromise } from '~/utils/catch-promise';
import { getErrorMessage } from '~/utils/error-message';
import { storage } from '~/utils/storage';

const COUNTDOWN_SECONDS = 5;

type RecordingState =
  | 'pre-record'
  | 'countdown'
  | 'recording'
  | 'post-record'
  | 'success';

export default function DuetRecordingScreen() {
  useKeepAwake();

  const { challengeId } =
    useLocalSearchParams<{
      challengeId: string;
    }>();

  const insets = useSafeAreaInsets();

  const [state, setState] =
    useState<RecordingState>('pre-record');

  const [countdownValue, setCountdownValue] =
    useState(COUNTDOWN_SECONDS);

  const [elapsed, setElapsed] = useState(0);

  const [recordedVideoUri, setRecordedVideoUri] =
    useState<string | null>(null);

  const [caption, setCaption] = useState('');

  const [allowRepost, setAllowRepost] =
    useState(false);

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const [uploadProgress, setUploadProgress] =
    useState(0);

  const [
    showOffSyncModal,
    setShowOffSyncModal,
  ] = useState(false);

  const [cameraFacing, setCameraFacing] =
    useState<'front' | 'back'>('front');

  const cameraRef = useRef<CameraView>(null);

  const timerRef =
    useRef<ReturnType<typeof setInterval> | null>(
      null
    );

  const countdownRef =
    useRef<ReturnType<typeof setInterval> | null>(
      null
    );

  const isRecordingRef = useRef(false);

  const cancelledByBackgroundRef =
    useRef(false);

  const cancelledByUserRef = useRef(false);

  const recordedVideoUriRef =
    useRef<string | null>(null);

  const [
    cameraPermission,
    requestCameraPermission,
  ] = useCameraPermissions();

  const [
    micPermission,
    requestMicPermission,
  ] = useMicrophonePermissions();

  const challenge = useQuery(
    api.challengeCompletions.getPublishedChallenge,
    {
      challengeId:
        challengeId as Id<'challenges'>,
    }
  );

  const progress = useQuery(
    api.challengeCompletions.getChallengeProgress,
    {
      challengeId:
        challengeId as Id<'challenges'>,
    }
  );

  const generateUploadUrl = useMutation(
    api.upload.generateUploadUrl
  );

  const completeChallenge = useMutation(
    api.challengeCompletions.completeChallenge
  );

  const videoDuration =
    challenge?.videoDuration ??
    challenge?.durationLimit ??
    300;

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
    recordedVideoUriRef.current =
      recordedVideoUri;
  }, [recordedVideoUri]);

  useEffect(() => {
    return () => {
      const uri = recordedVideoUriRef.current;

      if (
        uri &&
        uri.startsWith(
          FileSystem.documentDirectory ?? ''
        )
      ) {
        FileSystem.deleteAsync(uri, {
          idempotent: true,
        }).catch(() => {});
      }
    };
  }, []);

  useEffect(() => {
    if (state !== 'post-record') return;

    if (
      storage.getBoolean(
        OFF_SYNC_WARNING_KEY
      )
    ) {
      return;
    }

    setShowOffSyncModal(true);
  }, [state]);

  useEffect(() => {
    const subscription =
      AppState.addEventListener(
        'change',
        (nextState) => {
          if (nextState === 'active') return;

          if (countdownRef.current) {
            clearInterval(
              countdownRef.current
            );

            countdownRef.current = null;
          }

          if (isRecordingRef.current) {
            cancelledByBackgroundRef.current =
              true;

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
            setCountdownValue(
              COUNTDOWN_SECONDS
            );
          }
        }
      );

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

  const startRecording =
    useCallback(async () => {
      if (!cameraRef.current) {
        console.log(
          '[ChallengeRecord] Camera not ready'
        );

        setState('pre-record');
        return;
      }

      setState('recording');
      setElapsed(0);

      cancelledByUserRef.current = false;
      cancelledByBackgroundRef.current =
        false;

      isRecordingRef.current = true;

      timerRef.current = setInterval(() => {
        setElapsed((previous) => previous + 1);
      }, 1000);

      try {
        const video =
          await cameraRef.current.recordAsync({
            maxDuration: videoDuration,
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

        const finishedNormally =
          !cancelledByBackgroundRef.current;

        cancelledByBackgroundRef.current =
          false;

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
          const persistentUri =
            `${FileSystem.documentDirectory}` +
            `challenge-${Date.now()}.mp4`;

          await FileSystem.copyAsync({
            from: video.uri,
            to: persistentUri,
          });

          await FileSystem.deleteAsync(
            video.uri,
            {
              idempotent: true,
            }
          );

          recordedVideoUriRef.current =
            persistentUri;

          setRecordedVideoUri(persistentUri);
          setState('post-record');
        } catch (error) {
          console.log(
            '[ChallengeRecord] Save failed:',
            error
          );

          setRecordedVideoUri(null);
          setElapsed(0);
          setState('pre-record');

          Alert.alert(
            'Recording failed',
            'Could not save the recording. Please try again.'
          );
        }
      } catch (error) {
        if (cancelledByUserRef.current) {
          cancelledByUserRef.current = false;
          return;
        }

        console.log(
          '[ChallengeRecord] Recording error:',
          error
        );

        isRecordingRef.current = false;

        cancelledByBackgroundRef.current =
          false;

        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }

        setElapsed(0);
        setState('pre-record');
      }
    }, [videoDuration]);

  const startCountdown = useCallback(() => {
    if (countdownRef.current) return;

    setState('countdown');
    setCountdownValue(COUNTDOWN_SECONDS);

    let count = COUNTDOWN_SECONDS;

    countdownRef.current = setInterval(() => {
      count -= 1;
      setCountdownValue(count);

      if (count <= 0) {
        if (countdownRef.current) {
          clearInterval(
            countdownRef.current
          );

          countdownRef.current = null;
        }

        void startRecording();
      }
    }, 1000);
  }, [startRecording]);

  const handleSwitchCamera = useCallback(() => {
    if (isRecordingRef.current) return;

    setCameraFacing((current) =>
      current === 'front' ? 'back' : 'front'
    );
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

  const handleStartOver =
    useCallback(() => {
      if (recordedVideoUri) {
        FileSystem.deleteAsync(
          recordedVideoUri,
          {
            idempotent: true,
          }
        ).catch(() => {});
      }

      recordedVideoUriRef.current = null;

      setRecordedVideoUri(null);
      setCaption('');
      setAllowRepost(false);
      setElapsed(0);
      setUploadProgress(0);
      setCountdownValue(COUNTDOWN_SECONDS);
      setState('pre-record');
    }, [recordedVideoUri]);

  const uploadVideo = useCallback(
    async (
      videoUri: string
    ): Promise<string | null> => {
      const [uploadError, uploadUrl] =
        await CatchPromise(
          generateUploadUrl()
        );

      if (uploadError || !uploadUrl) {
        return null;
      }

      const uploadTask =
        FileSystem.createUploadTask(
          uploadUrl,
          videoUri,
          {
            fieldName: 'file',
            httpMethod: 'POST',
            uploadType:
              FileSystem
                .FileSystemUploadType
                .BINARY_CONTENT,
            headers: {
              'Content-Type': 'video/mp4',
            },
          },
          ({
            totalBytesSent,
            totalBytesExpectedToSend,
          }) => {
            const expectedBytes =
              totalBytesExpectedToSend || 1;

            setUploadProgress(
              Number(
                (
                  totalBytesSent /
                  expectedBytes
                ).toFixed(2)
              )
            );
          }
        );

      const result =
        await uploadTask.uploadAsync();

      if (!result?.body) return null;

      try {
        const parsed = JSON.parse(result.body);

        return parsed.storageId ?? null;
      } catch {
        return null;
      }
    },
    [generateUploadUrl]
  );

  const handleSubmit = useCallback(async () => {
    if (
      !recordedVideoUri ||
      !challenge ||
      isSubmitting
    ) {
      return;
    }

    setIsSubmitting(true);
    setUploadProgress(0);

    try {
      const storageId =
        await uploadVideo(recordedVideoUri);

      if (!storageId) {
        Alert.alert(
          'Upload failed',
          'Could not upload your video. Please try again.'
        );

        return;
      }

      const result =
        await completeChallenge({
          challengeId:
            challengeId as Id<'challenges'>,

          videoStorageId:
            storageId as Id<'_storage'>,

          allowRepost,

          caption:
            caption.trim() || undefined,
        });

      if (result) {
        FileSystem.deleteAsync(
          recordedVideoUri,
          {
            idempotent: true,
          }
        ).catch(() => {});

        recordedVideoUriRef.current = null;

        setState('success');
      }
    } catch (error) {
      Alert.alert(
        'Unable to submit',
        getErrorMessage(error)
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [
    recordedVideoUri,
    challenge,
    isSubmitting,
    uploadVideo,
    completeChallenge,
    challengeId,
    allowRepost,
    caption,
  ]);

  if (challenge === undefined) {
    return <ScreenLoading />;
  }

  if (challenge === null) {
    return (
      <View className="flex-1 items-center justify-center bg-[#F9F9F9]">
        <Text className="text-base text-gray-500">
          Challenge not available
        </Text>
      </View>
    );
  }

  if (
    !cameraPermission?.granted ||
    !micPermission?.granted
  ) {
    return (
      <View
        className="flex-1 items-center justify-center bg-[#F9F9F9] px-8"
        style={{ paddingTop: insets.top }}
      >
        <Text className="mb-4 text-center text-base text-[#313131]">
          Camera and microphone permissions
          are required to record your
          challenge.
        </Text>

        <LoadingButton
          variant="solid"
          size="lg"
          action="primary"
          onPress={async () => {
            await requestCameraPermission();
            await requestMicPermission();
          }}
        >
          <ButtonText>
            Grant Permissions
          </ButtonText>
        </LoadingButton>

        <TouchableOpacity
          className="mt-4"
          onPress={() => router.back()}
        >
          <Text className="font-body text-sm font-medium text-[#838383]">
            Cancel
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  const totalPoints =
    challenge.points +
    (allowRepost ? 3 : 0);

  const isLiveState =
    state === 'pre-record' ||
    state === 'countdown' ||
    state === 'recording';

  const progressPercent =
    state === 'recording'
      ? Math.min(
          100,
          (elapsed / videoDuration) * 100
        )
      : 0;

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
              backgroundColor:
                state === 'pre-record'
                  ? 'rgba(0,0,0,0.18)'
                  : 'rgba(0,0,0,0.08)',
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
              backgroundColor:
                'rgba(0,0,0,0.45)',
            }}
          >
            <CameraRotate
              size={26}
              color="#FFFFFF"
              weight="bold"
            />
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
              backgroundColor:
                'rgba(255,255,255,0.3)',
            }}
          >
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
            }}
          >
            <Text className="font-heading text-xl font-bold text-white">
              Day{' '}
              {progress?.nextAttemptNumber ??
                1}
            </Text>
          </View>
        )}

        {(state === 'countdown' ||
          state === 'recording') && (
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
              backgroundColor:
                'rgba(0,0,0,0.35)',
            }}
          >
            <X
              size={28}
              color="#FFFFFF"
              weight="bold"
            />
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
            ]}
          >
            <View
              className="items-center justify-center rounded-full"
              style={{
                width: 90,
                height: 90,
                backgroundColor:
                  'rgba(0,0,0,0.55)',
              }}
            >
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
              backgroundColor:
                'rgba(0,0,0,0.45)',
              paddingHorizontal: 14,
              paddingVertical: 7,
            }}
          >
            <Text className="font-body text-sm font-bold text-white">
              Recording {elapsed}s
            </Text>
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
            }}
          >
            <View
              style={{
                borderRadius: 20,
                backgroundColor:
                  'rgba(0,0,0,0.48)',
                padding: 18,
              }}
            >
              <Text className="text-center font-body text-base text-white">
                Position your phone so your
                full body is visible. Complete
                this challenge for +
                {challenge.points} pts!
              </Text>

              <LoadingButton
                variant="solid"
                size="xl"
                action="primary"
                className="mt-5 h-14 w-full"
                onPress={startCountdown}
              >
                <View className="flex-row items-center gap-x-2">
                  <Record
                    size={20}
                    color="#FFFFFF"
                    weight="fill"
                  />

                  <ButtonText className="text-lg font-bold text-white">
                    Start Recording
                  </ButtonText>
                </View>
              </LoadingButton>

              <TouchableOpacity
                className="mt-4 items-center"
                onPress={handleCancel}
              >
                <Text className="font-body text-sm font-medium text-white">
                  Cancel
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    );
  }

  if (state === 'post-record') {
    return (
      <>
        <KeyboardAvoidingView
          className="flex-1 bg-[#F9F9F9]"
          behavior={
            Platform.OS === 'ios'
              ? 'padding'
              : 'height'
          }
          keyboardVerticalOffset={
            Platform.OS === 'ios' ? 0 : 20
          }
        >
          <ScrollView
            contentContainerStyle={{
              paddingTop: insets.top + 16,
              paddingBottom: 40,
            }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View className="mt-4 items-center">
              <Image
                source={require('~/assets/icons/Gbam.png')}
                style={{
                  width: 80,
                  height: 80,
                }}
                contentFit="contain"
              />

              <Text className="mt-2 text-center font-heading text-2xl font-extrabold text-[#1A1A1A]">
                Gbam. That&apos;s how it&apos;s
                done.
              </Text>
            </View>

            {recordedVideoUri &&
              challenge.instructionalVideoUrl && (
                <View className="mt-4">
                  <CompositeVideoPlayer
                    leftVideoUrl={
                      progress?.day1VideoUrl ??
                      challenge.instructionalVideoUrl
                    }
                    rightVideoUrl={
                      recordedVideoUri
                    }
                    mirrorRight={false}
                  />
                </View>
              )}

            <View className="mx-6 mt-4">
              <Textarea
                size="xl"
                className="rounded-2xl bg-white"
              >
                <TextareaInput
                  placeholder="Caption this...(optional)"
                  value={caption}
                  onChangeText={setCaption}
                  style={{
                    minHeight: 80,
                    textAlignVertical: 'top',
                    paddingTop: 12,
                  }}
                />
              </Textarea>
            </View>

            <View className="mx-6 mt-4 flex-row items-center justify-between rounded-2xl bg-white px-4 py-3">
              <Text className="flex-1 font-body text-sm text-[#313131]">
                Allow SweatScore to repost this
              </Text>

              <Text className="mr-2 font-body text-sm font-bold text-[#313131]">
                +3 pt
              </Text>

              <Switch
                value={allowRepost}
                onValueChange={setAllowRepost}
              />
            </View>

            <View className="mt-6 px-6">
              {isSubmitting &&
                uploadProgress > 0 &&
                uploadProgress < 1 && (
                  <View className="mb-3">
                    <View className="mb-1 flex-row items-center justify-between">
                      <Text className="font-body text-sm text-[#838383]">
                        Uploading video...
                      </Text>

                      <Text className="font-body text-sm font-semibold text-[#1A1A1A]">
                        {Math.round(
                          uploadProgress * 100
                        )}
                        %
                      </Text>
                    </View>

                    <View className="h-2 w-full overflow-hidden rounded-full bg-[#EEEAE5]">
                      <View
                        className="h-full rounded-full bg-primary-500"
                        style={{
                          width: `${
                            uploadProgress * 100
                          }%`,
                        }}
                      />
                    </View>
                  </View>
                )}

              <LoadingButton
                variant="solid"
                size="xl"
                action="primary"
                className="h-14 w-full"
                loading={isSubmitting}
                disabled={isSubmitting}
                onPress={handleSubmit}
              >
                <ButtonText className="text-lg font-bold text-white">
                  Submit to earn {totalPoints}{' '}
                  pts
                </ButtonText>
              </LoadingButton>
            </View>

            <TouchableOpacity
              className="mt-4 items-center"
              disabled={isSubmitting}
              onPress={handleStartOver}
            >
              <Text className="font-body text-sm font-medium text-[#838383]">
                Start over
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>

        <OffSyncWarningModal
          showAlertDialog={showOffSyncModal}
          handleClose={() =>
            setShowOffSyncModal(false)
          }
        />
      </>
    );
  }

  return (
    <View
      className="flex-1 items-center justify-center bg-[#F9F9F9]"
      style={{ paddingTop: insets.top }}
    >
      <View className="items-center">
        <Image
          source={require('~/assets/icons/Live.png')}
          style={{
            width: 100,
            height: 100,
          }}
          contentFit="contain"
        />

        <Text className="mt-4 font-heading text-2xl font-bold text-[#1A1A1A]">
          Streak Updated!
        </Text>

        <Text className="mt-2 px-12 text-center font-body text-sm text-[#313131]">
          Hold tight. Your video is processing
          now.{'\n'}
          We&apos;ll let you know once it&apos;s
          live in the community.
        </Text>
      </View>

      <View className="mx-8 mt-6 flex-row items-center justify-center rounded-2xl bg-white px-6 py-4">
        <Text className="font-body text-base font-bold text-[#1A1A1A]">
          +{totalPoints} pts added to your score
        </Text>

        <Image
          source={require('~/assets/icons/Flame.png')}
          style={{
            width: 20,
            height: 20,
            marginLeft: 8,
          }}
          contentFit="contain"
        />
      </View>

      <View
        className="mt-8 px-8"
        style={{ width: '100%' }}
      >
        <LoadingButton
          variant="solid"
          size="xl"
          action="primary"
          className="h-14 w-full rounded-full"
          onPress={() => {
            router.dismissAll();
          }}
        >
          <ButtonText
            className="text-lg text-white"
            style={{
              fontFamily: 'Inter_700Bold',
            }}
          >
            Got It
          </ButtonText>
        </LoadingButton>
      </View>
    </View>
  );
}