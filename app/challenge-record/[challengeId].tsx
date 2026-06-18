import { useMutation, useQuery } from 'convex/react';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import * as FileSystem from 'expo-file-system';
import { Image } from 'expo-image';
import { useKeepAwake } from 'expo-keep-awake';
import { router, useLocalSearchParams } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Record, X } from 'phosphor-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
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
import { ButtonText, LoadingButton } from '~/components/ui/button';
import { Switch } from '~/components/ui/switch';
import { Text } from '~/components/ui/text';
import { Textarea, TextareaInput } from '~/components/ui/textarea';
import { api } from '~/convex/_generated/api';
import { Id } from '~/convex/_generated/dataModel';
import { CatchPromise } from '~/utils/catch-promise';
import { getErrorMessage } from '~/utils/error-message';
import { storage } from '~/utils/storage';

const SCREEN_WIDTH = Dimensions.get('window').width;
const COUNTDOWN_SECONDS = 5;

type RecordingState = 'pre-record' | 'countdown' | 'recording' | 'post-record' | 'success';

export default function DuetRecordingScreen() {
  useKeepAwake(); // Prevent screen from sleeping during recording
  const { challengeId } = useLocalSearchParams<{ challengeId: string }>();
  const insets = useSafeAreaInsets();

  // State
  const [state, setState] = useState<RecordingState>('pre-record');
  const [countdownValue, setCountdownValue] = useState(COUNTDOWN_SECONDS);
  const [elapsed, setElapsed] = useState(0);
  const [recordedVideoUri, setRecordedVideoUri] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [allowRepost, setAllowRepost] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [videoReady, setVideoReady] = useState(false);
  const [showOffSyncModal, setShowOffSyncModal] = useState(false);

  // Refs
  const cameraRef = useRef<CameraView>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Permissions
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();

  // Data
  const challenge = useQuery(api.challengeCompletions.getPublishedChallenge, {
    challengeId: challengeId as Id<'challenges'>,
  });

  const generateUploadUrl = useMutation(api.upload.generateUploadUrl);
  const completeChallenge = useMutation(api.challengeCompletions.completeChallenge);

  // Video player for admin instructional video
  const player = useVideoPlayer(challenge?.instructionalVideoUrl ?? null, (p) => {
    p.loop = false;
  });

  // Use admin video's actual duration for progress bar, fall back to durationLimit
  const videoDuration = challenge?.videoDuration ?? challenge?.durationLimit ?? 300;

  // Detect when admin video is ready
  useEffect(() => {
    if (!player) return;
    const subscription = player.addListener('statusChange', (status) => {
      if (status.status === 'readyToPlay') {
        setVideoReady(true);
      }
    });
    return () => subscription.remove();
  }, [player]);

  // Track when video transitions to actually playing (after `play()` is called),
  // so the camera + progress timer wait for real playback rather than just
  // `readyToPlay` status. Slow networks can buffer between the two.
  const playingPromiseRef = useRef<{ resolve: () => void; resolved: boolean } | null>(null);
  useEffect(() => {
    if (!player) return;
    const sub = player.addListener('playingChange', ({ isPlaying }) => {
      if (isPlaying && playingPromiseRef.current && !playingPromiseRef.current.resolved) {
        playingPromiseRef.current.resolved = true;
        playingPromiseRef.current.resolve();
      }
    });
    return () => sub.remove();
  }, [player]);

  const waitForVideoPlaying = useCallback((timeoutMs: number): Promise<void> => {
    return new Promise((resolve) => {
      const handle = { resolve, resolved: false };
      playingPromiseRef.current = handle;
      setTimeout(() => {
        if (!handle.resolved) {
          handle.resolved = true;
          resolve();
        }
      }, timeoutMs);
    });
  }, []);

  // Request permissions on mount
  useEffect(() => {
    if (!cameraPermission?.granted) requestCameraPermission();
    if (!micPermission?.granted) requestMicPermission();
  }, []);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  // Delete the persistent recording on unmount if the user navigates away
  // without submitting. Avoids orphaned mp4s in documentDirectory.
  const recordedVideoUriRef = useRef<string | null>(null);
  useEffect(() => {
    recordedVideoUriRef.current = recordedVideoUri;
  }, [recordedVideoUri]);
  useEffect(() => {
    return () => {
      const uri = recordedVideoUriRef.current;
      if (uri && uri.startsWith(FileSystem.documentDirectory ?? '')) {
        FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
      }
    };
  }, []);

  // Abort recording if the app is backgrounded mid-record. Without this, iOS
  // suspends the camera and `recordAsync` resolves with a partial clip on
  // resume — the user could submit a short video for full points.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') return;
      // inactive | background — kill any in-flight recording or countdown
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
        if (player) player.pause();
        try {
          cameraRef.current?.stopRecording();
        } catch {
          // already stopped
        }
      } else if (state === 'countdown') {
        // mid-countdown background — reset to pre-record so user starts over
        setState('pre-record');
        setElapsed(0);
        setCountdownValue(COUNTDOWN_SECONDS);
      }
    });
    return () => sub.remove();
  }, [player, state]);

  const startCountdown = useCallback(() => {
    // If video not ready yet, wait for it
    if (!videoReady) {
      setState('countdown');
      setCountdownValue(COUNTDOWN_SECONDS);
      return; // useEffect below will trigger countdown once ready
    }

    setState('countdown');
    setCountdownValue(COUNTDOWN_SECONDS);

    let count = COUNTDOWN_SECONDS;
    countdownRef.current = setInterval(() => {
      count -= 1;
      setCountdownValue(count);
      if (count <= 0) {
        if (countdownRef.current) clearInterval(countdownRef.current);
        startRecording();
      }
    }, 1000);
  }, [videoReady]);

  // If we entered countdown before video was ready, start countdown once ready
  useEffect(() => {
    if (state === 'countdown' && videoReady && !countdownRef.current) {
      let count = COUNTDOWN_SECONDS;
      countdownRef.current = setInterval(() => {
        count -= 1;
        setCountdownValue(count);
        if (count <= 0) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          startRecording();
        }
      }, 1000);
    }
  }, [videoReady, state]);

  // Show off-sync warning the first time user lands on the post-record (Gbam)
  // screen, unless they previously opted out.
  useEffect(() => {
    if (state !== 'post-record') return;
    if (storage.getBoolean(OFF_SYNC_WARNING_KEY)) return;
    setShowOffSyncModal(true);
  }, [state]);

  const isRecordingRef = useRef(false);
  // Mark when recording was cancelled by app going background — used to
  // discard the partial video that recordAsync may resolve with.
  const cancelledByBackgroundRef = useRef(false);

  const stopRecording = useCallback(() => {
    if (!isRecordingRef.current) return;
    isRecordingRef.current = false;

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (player) player.pause();
    try {
      cameraRef.current?.stopRecording();
    } catch {
      // Camera may already have stopped
    }
  }, [player]);

  const startRecording = useCallback(async () => {
    if (!cameraRef.current) {
      console.log('[DuetRecord] No camera ref');
      return;
    }

    const duration = videoDuration;
    console.log('[DuetRecord] Starting recording, duration:', duration);

    setState('recording');
    setElapsed(0);
    isRecordingRef.current = true;

    // Restart admin video from beginning, then wait for actual playback to
    // begin before starting the camera and progress timer. Without this, slow
    // networks can buffer the video while the camera is already recording —
    // resulting in a desynced duet. 60s safety cap to prevent indefinite hang.
    if (player) {
      player.loop = false;
      player.currentTime = 0;
      const waiter = waitForVideoPlaying(60000);
      player.play();
      await waiter;
    }

    // Progress bar timer — display only.
    timerRef.current = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);

    try {
      const video = await cameraRef.current.recordAsync({
        maxDuration: duration,
      });

      // Recording finished
      isRecordingRef.current = false;
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (player) player.pause();

      // Discard only if recording was aborted by backgrounding the app —
      // native recordAsync stops at maxDuration on its own.
      const finishedNormally = !cancelledByBackgroundRef.current;
      cancelledByBackgroundRef.current = false;

      if (video?.uri && finishedNormally) {
        console.log('[DuetRecord] Got video URI, transitioning to post-record');
        // Move the recording out of the OS-cleanable cache directory into
        // documentDirectory so it survives until the user submits. Android
        // (and rarely iOS) can purge /cache/ under low storage / battery
        // saver, leaving the upload + preview to fail with "Directory ...
        // doesn't exist".
        try {
          const persistentUri = `${FileSystem.documentDirectory}duet-${Date.now()}.mp4`;
          await FileSystem.copyAsync({ from: video.uri, to: persistentUri });
          await FileSystem.deleteAsync(video.uri, { idempotent: true });
          console.log('[DuetRecord] Moved recording to persistent URI:', persistentUri);
          setRecordedVideoUri(persistentUri);
          setState('post-record');
        } catch (copyErr) {
          console.log('[DuetRecord] persist copy failed:', copyErr);
          setRecordedVideoUri(null);
          setElapsed(0);
          setState('pre-record');
          Alert.alert(
            'Recording failed',
            'Could not save the recording. Please try again.'
          );
        }
      } else {
        console.log('[DuetRecord] Discarding partial recording — duration:', duration);
        setRecordedVideoUri(null);
        setElapsed(0);
        setState('pre-record');
        Alert.alert(
          'Recording incomplete',
          'The recording was interrupted. Please try again without leaving the app.'
        );
      }
    } catch (err) {
      console.log('[DuetRecord] recordAsync error:', err);
      // Recording was cancelled
      isRecordingRef.current = false;
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      cancelledByBackgroundRef.current = false;
    }
  }, [videoDuration, player, waitForVideoPlaying]);

  const handleCancel = useCallback(() => {
    stopRecording();
    router.back();
  }, [stopRecording]);

  const handleStartOver = useCallback(() => {
    if (recordedVideoUri) {
      FileSystem.deleteAsync(recordedVideoUri, { idempotent: true }).catch(() => {});
    }
    setRecordedVideoUri(null);
    setCaption('');
    setAllowRepost(false);
    setElapsed(0);
    setUploadProgress(0);
    setState('pre-record');
    if (player) {
      player.pause();
      player.currentTime = 0;
    }
  }, [player, recordedVideoUri]);

  const uploadVideo = useCallback(
    async (videoUri: string): Promise<string | null> => {
      const [uploadErr, uploadUrl] = await CatchPromise(generateUploadUrl());
      if (uploadErr || !uploadUrl) return null;

      const uploadTask = FileSystem.createUploadTask(
        uploadUrl,
        videoUri,
        {
          fieldName: 'file',
          httpMethod: 'POST',
          uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
          headers: { 'Content-Type': 'video/mp4' },
        },
        ({ totalBytesSent, totalBytesExpectedToSend }) => {
          setUploadProgress(
            parseFloat((totalBytesSent / (totalBytesExpectedToSend || 1)).toFixed(2))
          );
        }
      );

      const uploadResult = await uploadTask.uploadAsync();
      return JSON.parse(uploadResult?.body ?? '{}').storageId ?? null;
    },
    [generateUploadUrl]
  );

  const handleSubmit = useCallback(async () => {
    if (!recordedVideoUri || !challenge) return;
    setIsSubmitting(true);
    setUploadProgress(0);

    try {
      const rawStorageId = await uploadVideo(recordedVideoUri);
      if (!rawStorageId) {
        Alert.alert('Upload failed', 'Could not upload your video. Please try again.');
        return;
      }

      const result = await completeChallenge({
        challengeId: challengeId as Id<'challenges'>,
        videoStorageId: rawStorageId as Id<'_storage'>,
        allowRepost,
        caption: caption.trim() || undefined,
      });

      if (result) {
        // Upload + completion succeeded — drop the local persistent copy.
        FileSystem.deleteAsync(recordedVideoUri, { idempotent: true }).catch(() => {});
        setState('success');
      }
    } catch (err) {
      Alert.alert('Unable to submit', getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  }, [
    recordedVideoUri,
    challenge,
    allowRepost,
    caption,
    challengeId,
    uploadVideo,
    completeChallenge,
  ]);

  // Loading / permissions check
  if (challenge === undefined) return <ScreenLoading />;
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
        className="flex-1 items-center justify-center bg-[#F9F9F9]"
        style={{ paddingTop: insets.top }}>
        <Text className="mb-4 text-center text-base text-[#313131]">
          Camera and microphone permissions are required to record your duet.
        </Text>
        <LoadingButton
          variant="solid"
          size="lg"
          action="primary"
          onPress={() => {
            requestCameraPermission();
            requestMicPermission();
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
  const progressPercent =
    state === 'recording' ? Math.min(100, (elapsed / videoDuration) * 100) : 0;

  // ─── LIVE STATES (pre-record, countdown, recording) ──────
  // Camera + Video rendered ONCE, overlays change per state
  if (isLiveState) {
    return (
      <View
        className="flex-1"
        style={{ backgroundColor: state === 'pre-record' ? '#F9F9F9' : '#000000' }}>
        {/* Top section */}
        <View style={{ paddingTop: insets.top }}>
          {state === 'pre-record' && (
            <Text className="mt-6 text-center font-heading text-xl font-bold text-[#1A1A1A]">
              {challenge.name}
            </Text>
          )}
        </View>

        {/* Cancel (X) overlay — pinned to outer flex-1 so iOS gets touches */}
        {(state === 'countdown' || state === 'recording') && (
          <TouchableOpacity
            onPress={handleCancel}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={{
              position: 'absolute',
              top: insets.top + 12,
              left: 16,
              zIndex: 20,
              padding: 8,
            }}>
            <X size={28} color="#FFFFFF" weight="bold" />
          </TouchableOpacity>
        )}

        {/* Persistent split view — never unmounts */}
        <View
          className="items-center justify-center"
          style={{ flex: state === 'pre-record' ? 0 : 1 }}>
          <View
            style={{
              width: SCREEN_WIDTH,
              height: SCREEN_WIDTH * 1.1,
              marginTop: state === 'pre-record' ? 16 : 0,
              position: 'relative',
            }}>
            {/* Progress bar — recording only */}
            {state === 'recording' && (
              <View
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: 4,
                  zIndex: 10,
                  backgroundColor: 'rgba(255,255,255,0.2)',
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

            <View style={{ width: SCREEN_WIDTH, height: SCREEN_WIDTH * 1.1, position: 'relative' }}>
              {/* Admin video — left half, absolutely positioned */}
              <View
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: SCREEN_WIDTH / 2,
                  height: SCREEN_WIDTH * 1.1,
                }}>
                {!videoReady && (
                  <View
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: '#1A1A1A',
                      zIndex: 10,
                    }}>
                    <ActivityIndicator size="large" color="#FF5C1A" />
                  </View>
                )}
                <VideoView
                  player={player}
                  style={{ width: SCREEN_WIDTH / 2, height: SCREEN_WIDTH * 1.1 }}
                  contentFit="cover"
                  nativeControls={false}
                />
              </View>

              {/* Camera — right half, absolutely positioned */}
              <View
                style={{
                  position: 'absolute',
                  top: 0,
                  left: SCREEN_WIDTH / 2,
                  width: SCREEN_WIDTH / 2,
                  height: SCREEN_WIDTH * 1.1,
                  overflow: 'hidden',
                }}>
                <CameraView
                  ref={cameraRef}
                  style={{ width: SCREEN_WIDTH / 2, height: SCREEN_WIDTH * 1.1 }}
                  facing="front"
                  mode="video"
                  ratio="16:9"
                  videoQuality="720p"
                  mute
                />
              </View>
            </View>

            {/* Countdown overlay */}
            {state === 'countdown' && (
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
                {!videoReady ? (
                  <ActivityIndicator size="large" color="#FF5C1A" />
                ) : (
                  <View
                    className="items-center justify-center rounded-full"
                    style={{ width: 80, height: 80, backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <Text className="font-heading text-4xl font-extrabold text-white">
                      {countdownValue}
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>
        </View>

        {/* Bottom section — pre-record only */}
        {state === 'pre-record' && (
          <View>
            <View className="mt-6 px-8">
              <Text className="text-center font-body text-base text-[#313131]">
                Position your phone so your full body is visible. Finish this duet for +
                {challenge.points} pts!
              </Text>
            </View>
            <View className="mt-6 px-8">
              <LoadingButton
                variant="solid"
                size="xl"
                action="primary"
                className="h-14 w-full"
                onPress={startCountdown}>
                <View className="flex-row items-center gap-x-2">
                  <Record size={20} color="#FFFFFF" weight="fill" />
                  <ButtonText className="text-lg font-bold text-white">Start Recording</ButtonText>
                </View>
              </LoadingButton>
            </View>
            <TouchableOpacity className="mt-4 items-center" onPress={handleCancel}>
              <Text className="font-body text-sm font-medium text-[#838383]">Cancel</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }

  // ─── POST-RECORD ("Gbam") ────────────────────────────────
  if (state === 'post-record') {
    return (
      <>
        <KeyboardAvoidingView
          className="flex-1 bg-[#F9F9F9]"
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
          <ScrollView
            contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled">
            {/* Emoji + Title */}
            <View className="mt-4 items-center">
              <Image
                source={require('~/assets/icons/Gbam.png')}
                style={{ width: 80, height: 80 }}
                contentFit="contain"
              />
              <Text className="mt-2 font-heading text-2xl font-extrabold text-[#1A1A1A]">
                Gbam. That's how it's done.
              </Text>
            </View>

            {/* Composite video preview */}
            {recordedVideoUri && challenge.instructionalVideoUrl && (
              <View className="mt-4">
                <CompositeVideoPlayer
                  adminVideoUrl={challenge.instructionalVideoUrl}
                  userVideoUrl={recordedVideoUri}
                  aspectRatio={1 / 1.1}
                  existingAdminPlayer={player}
                  mirrorUser
                />
              </View>
            )}

            {/* Caption input */}
            <View className="mx-6 mt-4">
              <Textarea size="xl" className="rounded-2xl bg-white">
                <TextareaInput
                  placeholder="Caption this...(optional)"
                  value={caption}
                  onChangeText={setCaption}
                  style={{ minHeight: 80, textAlignVertical: 'top', paddingTop: 12 }}
                />
              </Textarea>
            </View>

            {/* Repost toggle */}
            <View className="mx-6 mt-4 flex-row items-center justify-between rounded-2xl bg-white px-4 py-3">
              <Text className="flex-1 font-body text-sm text-[#313131]">
                Allow SweatScore to repost this
              </Text>
              <Text className="mr-2 font-body text-sm font-bold text-[#313131]">+3 pt</Text>
              <Switch value={allowRepost} onValueChange={setAllowRepost} />
            </View>

            {/* Submit CTA */}
            <View className="mt-6 px-6">
              {isSubmitting && uploadProgress > 0 && uploadProgress < 1 && (
                <View className="mb-3">
                  <View className="mb-1 flex-row items-center justify-between">
                    <Text className="font-body text-sm text-[#838383]">Uploading video...</Text>
                    <Text className="font-body text-sm font-semibold text-[#1A1A1A]">
                      {Math.round(uploadProgress * 100)}%
                    </Text>
                  </View>
                  <View className="h-2 w-full overflow-hidden rounded-full bg-[#EEEAE5]">
                    <View
                      className="h-full rounded-full bg-primary-500"
                      style={{ width: `${uploadProgress * 100}%` }}
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
                onPress={handleSubmit}>
                <ButtonText className="text-lg font-bold text-white">
                  Submit to earn {totalPoints} pts
                </ButtonText>
              </LoadingButton>
            </View>

            {/* Start over */}
            <TouchableOpacity className="mt-4 items-center" onPress={handleStartOver}>
              <Text className="font-body text-sm font-medium text-[#838383]">Start over</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
        <OffSyncWarningModal
          showAlertDialog={showOffSyncModal}
          handleClose={() => setShowOffSyncModal(false)}
        />
      </>
    );
  }

  // ─── SUCCESS ("Streak Updated!") ──────────────────────────
  return (
    <View
      className="flex-1 items-center justify-center bg-[#F9F9F9]"
      style={{ paddingTop: insets.top }}>
      <View className="items-center">
        <Image
          source={require('~/assets/icons/Live.png')}
          style={{ width: 100, height: 100 }}
          contentFit="contain"
        />
        <Text className="mt-4 font-heading text-2xl font-bold text-[#1A1A1A]">Streak Updated!</Text>
        <Text className="mt-2 px-12 text-center font-body text-sm text-[#313131]">
          Hold tight. Your video is processing now.{'\n'}We&apos;ll let you know once it&apos;s live
          in the community.
        </Text>
      </View>

      {/* Points badge */}
      <View className="mx-8 mt-6 flex-row items-center justify-center rounded-2xl bg-white px-6 py-4">
        <Text className="font-body text-base font-bold text-[#1A1A1A]">
          +{totalPoints} pts added to your score
        </Text>
        <Image
          source={require('~/assets/icons/Flame.png')}
          style={{ width: 20, height: 20, marginLeft: 8 }}
          contentFit="contain"
        />
      </View>

      {/* Done — go back to dashboard */}
      <View className="mt-8 px-8" style={{ width: '100%' }}>
        <LoadingButton
          variant="solid"
          size="xl"
          action="primary"
          className="h-14 w-full rounded-full"
          onPress={() => {
            router.dismissAll();
          }}>
          <ButtonText className="text-lg text-white" style={{ fontFamily: 'Inter_700Bold' }}>
            Got It
          </ButtonText>
        </LoadingButton>
      </View>
    </View>
  );
}
