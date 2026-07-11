import { useQuery } from 'convex/react';
import { Audio } from 'expo-av';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import * as FileSystem from 'expo-file-system';
import { Image } from 'expo-image';
import { useKeepAwake } from 'expo-keep-awake';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
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
import { useVideoPlayer, VideoView } from 'expo-video';
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
const MIN_STOP_RECORDING_SECONDS = 30;
const MAX_RECORDING_SECONDS = 60;
const RECORDING_VIDEO_QUALITY = '720p';
const RECORDING_VIDEO_BITRATE = 2_500_000;
const RECORDING_MAX_FILE_SIZE_BYTES = 80 * 1024 * 1024;
const EARLY_NATIVE_STOP_GRACE_SECONDS = 1;

const DEFAULT_CAPTION_TEMPLATES = [
  'Round {round} of {exercise} done 🔥',
  'Round {round} in the bag 💪',
  'Round {round} of {exercise} complete ✅',
  'Round {round} done and dusted 🙌',
  'Round {round} locked in 🔒',
  'Round {round} of {exercise} finished 💥',
  'Round {round} complete, no excuses 🔥',
  "Round {round} done, who's next? 👀",
  'Round {round} of {exercise} smashed 💪',
  'Keeping the streak alive with Round {round} 🔥',
  'Round {round} in the bag 🎯',
  'Round {round} done, still showing up 👊',
  "That's Round {round} in the bag ✅",
  'Smashed Round {round} 🙌',
  'Boom, Round {round} done 💥',
  'Still here, Round {round} finished 👊',
  'Round {round} and counting 📈',
  'Knocked out Round {round} today 🥊',
  'Consistency check: Round {round} complete 🔥',
  'Feeling strong after Round {round} 💪',
  'Round {round} in the books 📖',
  'Showed up for Round {round} today ✅',
];

const FIRST_ATTEMPT_VIDEO_URL =
  'https://beloved-stoat-88.convex.cloud/api/storage/e2f45d18-715b-4342-83ca-aef8407ae8f3';

type RecordingState = 'pre-record' | 'countdown' | 'recording' | 'post-record';

function getDefaultCaption(round?: number, exerciseName?: string) {
  const currentRound = round ?? 1;
  const exercise = exerciseName?.trim() || 'this exercise';

  const randomIndex = Math.floor(Math.random() * DEFAULT_CAPTION_TEMPLATES.length);

  return DEFAULT_CAPTION_TEMPLATES[randomIndex]
    .replace(/\{round\}/g, String(currentRound))
    .replace(/\{exercise\}/g, exercise);
}

function SingleVideoPreview({ videoUrl }: { videoUrl: string }) {
  const player = useVideoPlayer(videoUrl, (videoPlayer) => {
    videoPlayer.loop = false;
    videoPlayer.volume = 0;
  });

  return (
    <View
      style={{
        width: '100%',
        aspectRatio: 4 / 5, // Smaller height than 9 / 16
        backgroundColor: '#000',
      }}>
      <VideoView
        player={player}
        style={{
          width: '100%',
          height: '100%',
        }}
        contentFit="cover"
        nativeControls
      />
    </View>
  );
}

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
  const maxRecordingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const elapsedRef = useRef(0);
  const recordingStartedAtRef = useRef<number | null>(null);
  const isRecordingRef = useRef(false);
  const cancelledByBackgroundRef = useRef(false);
  const cancelledByUserRef = useRef(false);
  const manualStopRequestedRef = useRef(false);
  const preserveRecordedVideoOnUnmountRef = useRef(false);
  const recordedVideoUriRef = useRef<string | null>(null);
  const countdownSoundRef = useRef<Audio.Sound | null>(null);
  const countdownSoundLoadingPromiseRef = useRef<Promise<Audio.Sound | null> | null>(null);
  const countdownSoundPlaybackTokenRef = useRef(0);

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
  const dailyLimitReached = progress?.dailyLimitReached === true;
  const dailyLimit = progress?.dailyLimit ?? 5;

  const debugRecordingState = useCallback(
    (label: string) => {
      console.log(`[RecordingDebug] ${label}`, {
        state,
        elapsed,
        elapsedRef: elapsedRef.current,
        countdownValue,
        recordedVideoUri,
        caption,
        allowRepost,
        isSubmitting,
        cameraFacing,
        timerActive: !!timerRef.current,
        countdownActive: !!countdownRef.current,
        maxRecordingTimeoutActive: !!maxRecordingTimeoutRef.current,
        recordingStartedAtRef: recordingStartedAtRef.current,
        isRecordingRef: isRecordingRef.current,
        cancelledByBackgroundRef: cancelledByBackgroundRef.current,
        cancelledByUserRef: cancelledByUserRef.current,
        manualStopRequestedRef: manualStopRequestedRef.current,
        preserveRecordedVideoOnUnmountRef: preserveRecordedVideoOnUnmountRef.current,
        recordedVideoUriRef: recordedVideoUriRef.current,
        countdownSoundLoaded: !!countdownSoundRef.current,
      });
    },
    [
      state,
      elapsed,
      countdownValue,
      recordedVideoUri,
      caption,
      allowRepost,
      isSubmitting,
      cameraFacing,
    ]
  );

  useEffect(() => {
    elapsedRef.current = elapsed;
  }, [elapsed]);

  useEffect(() => {
    recordedVideoUriRef.current = recordedVideoUri;
  }, [recordedVideoUri]);

  const ensureCountdownSound = useCallback(async () => {
    if (countdownSoundRef.current) {
      return countdownSoundRef.current;
    }

    if (countdownSoundLoadingPromiseRef.current) {
      return countdownSoundLoadingPromiseRef.current;
    }

    countdownSoundLoadingPromiseRef.current = (async () => {
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
        });

        const { sound } = await Audio.Sound.createAsync(require('../../assets/beep.mp3'), {
          shouldPlay: false,
          volume: 1,
        });

        countdownSoundRef.current = sound;
        console.log('[RecordingDebug] countdown sound loaded');
        return sound;
      } catch (error) {
        console.log('[RecordingDebug] countdown sound failed', error);
        return null;
      } finally {
        countdownSoundLoadingPromiseRef.current = null;
      }
    })();

    return countdownSoundLoadingPromiseRef.current;
  }, []);

  const cleanupRecordingRefs = useCallback((reason: string) => {
    console.log(`[RecordingDebug] cleanupRecordingRefs: ${reason}`, {
      elapsedRef: elapsedRef.current,
      timerActive: !!timerRef.current,
      countdownActive: !!countdownRef.current,
      maxRecordingTimeoutActive: !!maxRecordingTimeoutRef.current,
      isRecordingRef: isRecordingRef.current,
      cancelledByBackgroundRef: cancelledByBackgroundRef.current,
      cancelledByUserRef: cancelledByUserRef.current,
      manualStopRequestedRef: manualStopRequestedRef.current,
      recordedVideoUriRef: recordedVideoUriRef.current,
    });

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }

    if (maxRecordingTimeoutRef.current) {
      clearTimeout(maxRecordingTimeoutRef.current);
      maxRecordingTimeoutRef.current = null;
    }

    countdownSoundPlaybackTokenRef.current += 1;
    countdownSoundRef.current?.stopAsync().catch(() => {});

    if (isRecordingRef.current) {
      cancelledByUserRef.current = true;
      isRecordingRef.current = false;

      try {
        cameraRef.current?.stopRecording();
      } catch {
        // Recording already stopped.
      }
    }

    manualStopRequestedRef.current = false;
    recordingStartedAtRef.current = null;
    cancelledByBackgroundRef.current = false;
  }, []);

  useFocusEffect(
    useCallback(() => {
      console.log('[RecordingDebug] screen focused');

      return () => {
        cleanupRecordingRefs('screen blur/unfocus');
      };
    }, [cleanupRecordingRefs])
  );

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
      console.log('[RecordingDebug] screen unmount cleanup', {
        timerActive: !!timerRef.current,
        countdownActive: !!countdownRef.current,
        isRecordingRef: isRecordingRef.current,
        recordedVideoUriRef: recordedVideoUriRef.current,
      });

      cleanupRecordingRefs('screen unmount');
    };
  }, [cleanupRecordingRefs]);

  useEffect(() => {
    return () => {
      const uri = recordedVideoUriRef.current;

      console.log('[RecordingDebug] temp video cleanup check', {
        uri,
        preserveRecordedVideoOnUnmountRef: preserveRecordedVideoOnUnmountRef.current,
      });

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
      console.log('[RecordingDebug] AppState changed', {
        nextState,
        elapsedRef: elapsedRef.current,
        isRecordingRef: isRecordingRef.current,
        countdownActive: !!countdownRef.current,
        timerActive: !!timerRef.current,
        maxRecordingTimeoutActive: !!maxRecordingTimeoutRef.current,
      });

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

        if (maxRecordingTimeoutRef.current) {
          clearTimeout(maxRecordingTimeoutRef.current);
          maxRecordingTimeoutRef.current = null;
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

  useEffect(() => {
    let isMounted = true;

    const loadCountdownSound = async () => {
      const sound = await ensureCountdownSound();

      if (!isMounted && sound) {
        await sound.unloadAsync();
        countdownSoundRef.current = null;
      }
    };

    loadCountdownSound().catch(() => {});

    return () => {
      isMounted = false;
      countdownSoundRef.current?.unloadAsync().catch(() => {});
      countdownSoundRef.current = null;
      console.log('[RecordingDebug] countdown sound unloaded');
    };
  }, [ensureCountdownSound]);

  const stopRecording = useCallback(() => {
    console.log('[RecordingDebug] stopRecording called', {
      elapsedRef: elapsedRef.current,
      isRecordingRef: isRecordingRef.current,
    });

    if (!isRecordingRef.current) return;

    if (elapsedRef.current < MIN_STOP_RECORDING_SECONDS) {
      console.log('[RecordingDebug] stopRecording ignored before minimum seconds', {
        elapsedRef: elapsedRef.current,
        minimum: MIN_STOP_RECORDING_SECONDS,
      });
      return;
    }

    isRecordingRef.current = false;
    manualStopRequestedRef.current = true;

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (maxRecordingTimeoutRef.current) {
      clearTimeout(maxRecordingTimeoutRef.current);
      maxRecordingTimeoutRef.current = null;
    }

    try {
      cameraRef.current?.stopRecording();
    } catch {
      // Camera may already be stopped.
    }
  }, []);

  const startRecording = useCallback(async () => {
    console.log('[RecordingDebug] startRecording called', {
      hasCameraRef: !!cameraRef.current,
      challengeId,
    });

    if (!cameraRef.current) {
      setState('pre-record');
      return;
    }

    setState('recording');
    setElapsed(0);
    elapsedRef.current = 0;

    cancelledByUserRef.current = false;
    cancelledByBackgroundRef.current = false;
    manualStopRequestedRef.current = false;
    recordingStartedAtRef.current = Date.now();
    isRecordingRef.current = true;

    console.log('[RecordingDebug] recording refs initialized', {
      isRecordingRef: isRecordingRef.current,
      cancelledByUserRef: cancelledByUserRef.current,
      cancelledByBackgroundRef: cancelledByBackgroundRef.current,
      manualStopRequestedRef: manualStopRequestedRef.current,
      recordingStartedAtRef: recordingStartedAtRef.current,
      appMaxDuration: MAX_RECORDING_SECONDS,
      nativeMaxDuration: null,
      videoQuality: RECORDING_VIDEO_QUALITY,
      videoBitrate: RECORDING_VIDEO_BITRATE,
      maxFileSize: RECORDING_MAX_FILE_SIZE_BYTES,
    });

    timerRef.current = setInterval(() => {
      setElapsed((previous) => {
        const next = previous + 1;
        elapsedRef.current = next;
        console.log('[RecordingDebug] tick', { elapsed: next });
        return next;
      });
    }, 1000);

    maxRecordingTimeoutRef.current = setTimeout(() => {
      console.log('[RecordingDebug] max recording duration reached', {
        elapsedRef: elapsedRef.current,
        isRecordingRef: isRecordingRef.current,
      });

      if (!isRecordingRef.current) return;

      isRecordingRef.current = false;

      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      try {
        cameraRef.current?.stopRecording();
      } catch {
        // Camera may already be stopped by the native maxDuration limit.
      }
    }, MAX_RECORDING_SECONDS * 1000);

    try {
      const video = await cameraRef.current.recordAsync({
        maxFileSize: RECORDING_MAX_FILE_SIZE_BYTES,
      });

      const recordedDurationSeconds = recordingStartedAtRef.current
        ? (Date.now() - recordingStartedAtRef.current) / 1000
        : elapsedRef.current;
      const wasManualStop = manualStopRequestedRef.current;
      let videoSizeBytes: number | null = null;

      if (video?.uri) {
        try {
          const videoInfo = await FileSystem.getInfoAsync(video.uri, { size: true });
          videoSizeBytes = videoInfo.exists ? videoInfo.size : null;
        } catch (error) {
          console.log('[RecordingDebug] video info failed', error);
        }
      }

      console.log('[RecordingDebug] recordAsync finished', {
        videoUri: video?.uri,
        videoSizeBytes,
        elapsedRef: elapsedRef.current,
        recordedDurationSeconds,
        isRecordingRef: isRecordingRef.current,
        cancelledByUserRef: cancelledByUserRef.current,
        cancelledByBackgroundRef: cancelledByBackgroundRef.current,
        manualStopRequestedRef: manualStopRequestedRef.current,
      });

      isRecordingRef.current = false;
      recordingStartedAtRef.current = null;
      manualStopRequestedRef.current = false;

      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      if (maxRecordingTimeoutRef.current) {
        clearTimeout(maxRecordingTimeoutRef.current);
        maxRecordingTimeoutRef.current = null;
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
      const endedBeforeMaxDuration =
        !wasManualStop &&
        recordedDurationSeconds < MAX_RECORDING_SECONDS - EARLY_NATIVE_STOP_GRACE_SECONDS;

      if (!video?.uri || !finishedNormally) {
        setRecordedVideoUri(null);
        setElapsed(0);
        elapsedRef.current = 0;
        setState('pre-record');

        Alert.alert(
          'Recording incomplete',
          'The recording was interrupted. Please try again without leaving the app.'
        );

        return;
      }

      if (endedBeforeMaxDuration) {
        FileSystem.deleteAsync(video.uri, {
          idempotent: true,
        }).catch(() => {});

        setRecordedVideoUri(null);
        setElapsed(0);
        elapsedRef.current = 0;
        setState('pre-record');

        Alert.alert(
          'Recording stopped early',
          `The camera stopped after ${Math.max(
            1,
            Math.round(recordedDurationSeconds)
          )}s before the 60s limit. Please try again.`
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

        console.log('[RecordingDebug] video copied to persistent uri', {
          persistentUri,
          elapsedRef: elapsedRef.current,
        });

        recordedVideoUriRef.current = persistentUri;
        setRecordedVideoUri(persistentUri);
        setCaption(
          getDefaultCaption(progress?.nextAttemptNumber, challenge?.name ?? 'this exercise')
        );
        setState('post-record');
      } catch (error) {
        console.log('[RecordingDebug] video save failed', error);

        setRecordedVideoUri(null);
        setElapsed(0);
        elapsedRef.current = 0;
        setState('pre-record');

        Alert.alert('Recording failed', 'Could not save the recording. Please try again.');
      }
    } catch (error) {
      console.log('[RecordingDebug] recordAsync error', {
        error,
        elapsedRef: elapsedRef.current,
        cancelledByUserRef: cancelledByUserRef.current,
        cancelledByBackgroundRef: cancelledByBackgroundRef.current,
      });

      if (cancelledByUserRef.current) {
        cancelledByUserRef.current = false;
        manualStopRequestedRef.current = false;
        recordingStartedAtRef.current = null;
        return;
      }

      isRecordingRef.current = false;
      manualStopRequestedRef.current = false;
      recordingStartedAtRef.current = null;
      cancelledByBackgroundRef.current = false;

      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      if (maxRecordingTimeoutRef.current) {
        clearTimeout(maxRecordingTimeoutRef.current);
        maxRecordingTimeoutRef.current = null;
      }

      setElapsed(0);
      elapsedRef.current = 0;
      setState('pre-record');
    }
  }, [challenge?.name, challengeId, progress?.nextAttemptNumber]);

  const playCountdownSound = useCallback(
    async (playbackToken: number) => {
      try {
        const sound = await ensureCountdownSound();

        if (!sound || playbackToken !== countdownSoundPlaybackTokenRef.current) return;

        await sound.stopAsync();
        await sound.setPositionAsync(0);

        if (playbackToken !== countdownSoundPlaybackTokenRef.current) return;

        await sound.playAsync();
      } catch (error) {
        console.log('[RecordingDebug] countdown sound play failed', error);
      }
    },
    [ensureCountdownSound]
  );

  const startCountdown = useCallback(() => {
    if (dailyLimitReached) {
      Alert.alert(
        'Daily limit reached',
        `You have reached your limit for today. You can complete up to ${dailyLimit} challenges per day.`
      );
      return;
    }
    debugRecordingState('startCountdown pressed');

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

    const countdownPlaybackToken = countdownSoundPlaybackTokenRef.current + 1;
    countdownSoundPlaybackTokenRef.current = countdownPlaybackToken;
    playCountdownSound(countdownPlaybackToken).catch(() => {});

    let count = COUNTDOWN_SECONDS;

    countdownRef.current = setInterval(() => {
      count -= 1;
      setCountdownValue(count);
      console.log('[RecordingDebug] countdown tick', { count });

      if (count <= 0) {
        if (countdownRef.current) {
          clearInterval(countdownRef.current);
          countdownRef.current = null;
        }

        countdownSoundPlaybackTokenRef.current += 1;
        countdownSoundRef.current?.stopAsync().catch(() => {});
        startRecording().catch(() => {});
      }
    }, 1000);
  }, [
    debugRecordingState,
    dailyLimit,
    dailyLimitReached,
    existingUploadJob,
    playCountdownSound,
    startRecording,
  ]);

  const handleSwitchCamera = useCallback(() => {
    if (isRecordingRef.current) return;

    setCameraFacing((current) => (current === 'front' ? 'back' : 'front'));
  }, []);

  const handleCancel = useCallback(() => {
    debugRecordingState('handleCancel called');
    cleanupRecordingRefs('handleCancel');
    router.back();
  }, [cleanupRecordingRefs, debugRecordingState]);

  const handleStartOver = useCallback(() => {
    debugRecordingState('handleStartOver called');
    cleanupRecordingRefs('handleStartOver');

    if (recordedVideoUri) {
      FileSystem.deleteAsync(recordedVideoUri, {
        idempotent: true,
      }).catch(() => {});
    }

    recordedVideoUriRef.current = null;
    preserveRecordedVideoOnUnmountRef.current = false;
    cancelledByUserRef.current = false;
    cancelledByBackgroundRef.current = false;
    manualStopRequestedRef.current = false;
    recordingStartedAtRef.current = null;
    isRecordingRef.current = false;
    elapsedRef.current = 0;

    setRecordedVideoUri(null);
    setCaption('');
    setAllowRepost(true);
    setElapsed(0);
    setCountdownValue(COUNTDOWN_SECONDS);
    setIsSubmitting(false);
    setState('pre-record');
  }, [cleanupRecordingRefs, debugRecordingState, recordedVideoUri]);

  const handleSubmit = useCallback(async () => {
    debugRecordingState('handleSubmit called');

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
    debugRecordingState,
  ]);

  const handleCaptionFocus = useCallback(() => {
    setTimeout(() => {
      postRecordScrollRef.current?.scrollToEnd({
        animated: true,
      });
    }, 250);
  }, []);

  const isCheckIn = challenge?.dailyChallengeType === 'check_in';

  if (challenge === undefined || progress === undefined) {
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
          videoQuality={RECORDING_VIDEO_QUALITY}
          videoBitrate={RECORDING_VIDEO_BITRATE}
          mute={true}
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
              Round {progress?.nextAttemptNumber ?? 1}
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
              action="primary"
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
            {dailyLimitReached && (
              <Text className="mb-3 text-center font-body text-sm font-semibold text-white">
                You reached your limit for today. Come back tomorrow.
              </Text>
            )}

            <LoadingButton
              variant="solid"
              size="xl"
              action="primary"
              className="mt-5 h-14 w-full"
              disabled={dailyLimitReached}
              onPress={startCountdown}>
              <View className="flex-row items-center gap-x-2">
                <Record size={20} color="#FFFFFF" weight="fill" />
                <ButtonText className="text-lg font-bold text-white">
                  {dailyLimitReached ? 'Daily Limit Reached' : 'Start Recording'}
                </ButtonText>
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
                className="items-center justify-center rounded-full"
                style={{
                  width: 82,
                  height: 82,
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

              <Text className="mt-3 text-center font-heading text-2xl font-extrabold text-[#000]">
                Gbam. You did that!
              </Text>

              <Text className="mt-1 text-center font-body text-sm text-[#686868]">
                Review your video then submit your progress
              </Text>
            </View>
          </View>

          {recordedVideoUri && (
            <View className="mx-5 mt-5 overflow-hidden rounded-3xl bg-black">
              {isCheckIn ? (
                <SingleVideoPreview videoUrl={recordedVideoUri} />
              ) : challenge.instructionalVideoUrl ? (
                <CompositeVideoPlayer
                  leftVideoUrl={
                    progress?.day1VideoUrl ||
                    FIRST_ATTEMPT_VIDEO_URL ||
                    challenge.instructionalVideoUrl
                  }
                  rightVideoUrl={recordedVideoUri}
                  mirrorRight={false}
                />
              ) : null}
            </View>
          )}

          <View
            className="mx-5 mt-5 rounded-3xl bg-white px-4 py-4"
            style={{
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.05,
              shadowRadius: 12,
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
                Submit Round {progress?.nextAttemptNumber} for {totalPoints} pts
              </ButtonText>
            </LoadingButton>
            <Text className="mt-1 text-center font-body text-sm font-semibold text-[#6F6F6F]">
              Keep the app open while your video uploads
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
