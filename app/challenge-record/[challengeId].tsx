import { useQuery } from 'convex/react';
import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from 'expo-av';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import * as FileSystem from 'expo-file-system';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useKeepAwake } from 'expo-keep-awake';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import {
  ArrowRight,
  Camera,
  CameraRotate,
  ImageSquare,
  Microphone,
  MicrophoneSlash,
  Record,
  UploadSimple,
  VideoCamera,
  X,
} from 'phosphor-react-native';
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
import { useSubscriptionGuard } from '~/hooks/useSubscriptionGuard';
import {
  BACKGROUND_MUSIC_VOLUME,
  BackgroundMusicTrack,
  getRandomBackgroundMusicTrack,
} from '~/utils/backgroundMusic';
import { getErrorMessage } from '~/utils/error-message';

const COUNTDOWN_SECONDS = 5;
const MIN_STOP_RECORDING_SECONDS = 1;
const MAX_RECORDING_SECONDS = 60;

const RECORDING_VIDEO_QUALITY = '720p';
const RECORDING_VIDEO_BITRATE = 2_500_000;
const RECORDING_MAX_FILE_SIZE_BYTES = 80 * 1024 * 1024;

const EARLY_NATIVE_STOP_GRACE_SECONDS = 1;

const DEFAULT_CAPTION_TEMPLATES = [
  'Day {round} of {exercise} done 🔥',
  'Day {round} in the bag 💪',
  'Day {round} of {exercise} complete ✅',
  'Day {round} done and dusted 🙌',
  'Day {round} locked in 🔒',
  'Day {round} of {exercise} finished 💥',
  'Day {round} complete, no excuses 🔥',
  "Day {round} done, who's next? 👀",
  'Day {round} of {exercise} smashed 💪',
  'Keeping the streak alive with Day {round} 🔥',
  'Day {round} in the bag 🎯',
  'Day {round} done, still showing up 👊',
  "That's Day {round} in the bag ✅",
  'Smashed Day {round} 🙌',
  'Boom, Day {round} done 💥',
  'Still here, Day {round} finished 👊',
  'Day {round} and counting 📈',
  'Knocked out Day {round} today 🥊',
  'Consistency check: Day {round} complete 🔥',
  'Feeling strong after Day {round} 💪',
  'Day {round} in the books 📖',
  'Showed up for Day {round} today ✅',
];

const CHECK_IN_CAPTION_TEMPLATES = [
  'Showed up for myself today 👌🏾',
  'No excuses, just did it ✅',
  'Consistency is my love language ❤️',
  'Future me is already thanking me 👌🏾',
  'Progress over perfection, always ✌🏾',
  'Another one in the bag ✅',
  'Sweat now, glow later ✨',
  'Doing it for my future self 💯',
  'Momentum looks good on me 💅🏿',
  'Still here, still showing up 🔥',
  'Earning my peace one habit at a time 🧘🏾‍♀️',
  'Watch me stay consistent ✌🏾',
  'Quietly becoming that girl 👑',
  "Nobody's coming to do it for me, so... 🤷🏾‍♀️",
  "Adding this to the list of things I said I'd do and actually did 👊🏾",
  "Plot twist: I'm the discipline now 🙌🏾",
  'Not a highlight reel. Just a woman keeping her word. 💪🏾',
  'Doing boring things consistently until they get impressive 😎',
  "I don't always feel like it. I do it anyway ✊🏾",
];

const FIRST_ATTEMPT_VIDEO_URL =
  'https://beloved-stoat-88.convex.cloud/api/storage/181e19bd-40b7-4ec0-b512-68137ab49e1e';

type RecordingState = 'pre-record' | 'countdown' | 'recording' | 'post-record';
type CheckInMode = 'take_photo' | 'upload_photo' | 'record_video' | 'upload_video';

function getDefaultCaption(round?: number, exerciseName?: string) {
  const currentRound = round ?? 1;

  const exercise = exerciseName?.trim() || 'this exercise';

  const randomIndex = Math.floor(Math.random() * DEFAULT_CAPTION_TEMPLATES.length);

  return DEFAULT_CAPTION_TEMPLATES[randomIndex]
    .replace(/\{round\}/g, String(currentRound))
    .replace(/\{exercise\}/g, exercise);
}

function getCheckInCaption() {
  const randomIndex = Math.floor(Math.random() * CHECK_IN_CAPTION_TEMPLATES.length);

  return CHECK_IN_CAPTION_TEMPLATES[randomIndex];
}

function SingleVideoPreview({
  videoUrl,
  musicTrack,
}: {
  videoUrl: string;
  musicTrack?: BackgroundMusicTrack;
}) {
  const player = useVideoPlayer(videoUrl, (videoPlayer) => {
    videoPlayer.loop = false;
    videoPlayer.volume = musicTrack ? 0 : 1;
  });

  useEffect(() => {
    if (!musicTrack) return;
    let disposed = false;
    let sound: Audio.Sound | null = null;

    Audio.Sound.createAsync(musicTrack.source, {
      shouldPlay: false,
      isLooping: true,
      volume: BACKGROUND_MUSIC_VOLUME,
    }).then(({ sound: loadedSound }) => {
      if (disposed) {
        loadedSound.unloadAsync().catch(() => {});
        return;
      }
      sound = loadedSound;
    });

    const playingSubscription = player.addListener('playingChange', ({ isPlaying }) => {
      if (!sound) return;
      if (isPlaying) {
        sound
          .setPositionAsync(Math.max(0, player.currentTime * 1000))
          .then(() => sound?.playAsync());
      } else {
        sound.pauseAsync().catch(() => {});
      }
    });

    return () => {
      disposed = true;
      playingSubscription.remove();
      sound?.stopAsync().catch(() => {});
      sound?.unloadAsync().catch(() => {});
    };
  }, [musicTrack, player]);

  return (
    <View
      style={{
        width: '100%',
        aspectRatio: 4 / 5,
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

  const { challengeId, checkInMode } = useLocalSearchParams<{
    challengeId: string;
    checkInMode?: CheckInMode;
  }>();
  const { requireSubscription } = useSubscriptionGuard();
  const challengeRedirectTo = `/challenge-view/${challengeId}`;

  const insets = useSafeAreaInsets();

  const [state, setState] = useState<RecordingState>('pre-record');

  const [countdownValue, setCountdownValue] = useState(COUNTDOWN_SECONDS);

  const [elapsed, setElapsed] = useState(0);

  const [recordedVideoUri, setRecordedVideoUri] = useState<string | null>(null);
  const [selectedMediaType, setSelectedMediaType] = useState<'image' | 'video'>('video');
  const [checkInSubmissionType, setCheckInSubmissionType] = useState<
    'live_video' | 'uploaded_video' | 'photo'
  >('live_video');
  const [selectedMediaDimensions, setSelectedMediaDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [selectedMimeType, setSelectedMimeType] = useState('video/mp4');
  const [isVideoRecorderOpen, setIsVideoRecorderOpen] = useState(false);
  const [isCheckInAudioMuted, setIsCheckInAudioMuted] = useState(false);

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

  const countdownSoundPlaybackTokenRef = useRef(0);
  const handledCheckInModeRef = useRef(false);
  const [selectedMusicTrack, setSelectedMusicTrack] = useState<BackgroundMusicTrack | null>(null);
  const selectedMusicTrackRef = useRef<BackgroundMusicTrack | null>(null);
  const backgroundMusicRef = useRef<Audio.Sound | null>(null);
  const backgroundMusicLoadingPromiseRef = useRef<Promise<Audio.Sound | null> | null>(null);

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  const [micPermission, requestMicPermission] = useMicrophonePermissions();

  const challenge = useQuery(api.challengeCompletions.getPublishedChallenge, {
    challengeId: challengeId as Id<'challenges'>,
  });

  const progress = useQuery(api.challengeCompletions.getChallengeProgress, {
    challengeId: challengeId as Id<'challenges'>,
  });

  const isCheckIn = challenge?.type === 'check_in';

  const selectMusicTrackForSession = useCallback(() => {
    if (selectedMusicTrackRef.current) return selectedMusicTrackRef.current;
    const track = getRandomBackgroundMusicTrack();
    selectedMusicTrackRef.current = track;
    setSelectedMusicTrack(track);
    return track;
  }, []);

  const ensureBackgroundMusicLoaded = useCallback(async () => {
    if (backgroundMusicRef.current) return backgroundMusicRef.current;
    if (backgroundMusicLoadingPromiseRef.current) return backgroundMusicLoadingPromiseRef.current;
    const track = selectedMusicTrackRef.current;
    if (!track) return null;

    backgroundMusicLoadingPromiseRef.current = (async () => {
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
        });
        const { sound } = await Audio.Sound.createAsync(track.source, {
          shouldPlay: false,
          isLooping: true,
          volume: BACKGROUND_MUSIC_VOLUME,
        });
        backgroundMusicRef.current = sound;
        return sound;
      } finally {
        backgroundMusicLoadingPromiseRef.current = null;
      }
    })();
    return backgroundMusicLoadingPromiseRef.current;
  }, []);

  const stopBackgroundMusic = useCallback(async () => {
    const sound = backgroundMusicRef.current;
    if (!sound) return;
    try {
      await sound.stopAsync();
      await sound.setPositionAsync(0);
    } catch {}
  }, []);

  const startBackgroundMusic = useCallback(async () => {
    const sound = await ensureBackgroundMusicLoaded();
    if (!sound) return;
    await sound.stopAsync();
    await sound.setPositionAsync(0);
    await sound.playAsync();
  }, [ensureBackgroundMusicLoaded]);

  const unloadBackgroundMusic = useCallback(async () => {
    const sound = backgroundMusicRef.current;
    backgroundMusicRef.current = null;
    if (!sound) return;
    try {
      await sound.stopAsync();
      await sound.unloadAsync();
    } catch {}
  }, []);

  const { enqueueChallengeUpload, getJobForChallenge } = useChallengeUploadQueue();

  const existingUploadJob = getJobForChallenge(challengeId ?? '');

  const dailyLimitReached = progress?.dailyLimitReached === true;

  const dailyLimit = progress?.dailyLimit ?? 3;

  useEffect(() => {
    if (!challenge) {
      return;
    }

    setAllowRepost(challenge.type !== 'check_in');
    if (challenge.type !== 'check_in') {
      selectMusicTrackForSession();
      ensureBackgroundMusicLoaded().catch(() => {});
    }
  }, [challengeId, challenge?.type, ensureBackgroundMusicLoaded, selectMusicTrackForSession]);

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

  const stopCountdownSound = useCallback(async () => {
    const sound = countdownSoundRef.current;
    countdownSoundRef.current = null;

    if (!sound) return;

    try {
      await sound.stopAsync();
    } catch {
      // Sound may already have completed.
    }

    try {
      await sound.unloadAsync();
    } catch {
      // Sound may already be unloaded.
    }
  }, []);

  const cleanupRecordingRefs = useCallback(
    (reason: string) => {
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

      stopCountdownSound().catch(() => {});
      stopBackgroundMusic().catch(() => {});

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
    },
    [stopBackgroundMusic, stopCountdownSound]
  );

  useFocusEffect(
    useCallback(() => {
      console.log('[RecordingDebug] screen focused');

      return () => {
        cleanupRecordingRefs('screen blur/unfocus');
      };
    }, [cleanupRecordingRefs])
  );

  useEffect(() => {
    if (challenge?.type === 'check_in' && !isVideoRecorderOpen) {
      return;
    }

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
    challenge?.type,
    isVideoRecorderOpen,
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
      unloadBackgroundMusic().catch(() => {});
    };
  }, [cleanupRecordingRefs, unloadBackgroundMusic]);

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

      if (nextState === 'active') {
        return;
      }

      stopBackgroundMusic().catch(() => {});

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
          // Recording already stopped.
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
  }, [state, stopBackgroundMusic]);

  const stopRecording = useCallback(() => {
    stopBackgroundMusic().catch(() => {});
    console.log('[RecordingDebug] stopRecording called', {
      elapsedRef: elapsedRef.current,

      isRecordingRef: isRecordingRef.current,
    });

    if (!isRecordingRef.current) {
      return;
    }

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
  }, [stopBackgroundMusic]);

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

        console.log('[RecordingDebug] tick', {
          elapsed: next,
        });

        return next;
      });
    }, 1000);

    maxRecordingTimeoutRef.current = setTimeout(() => {
      console.log('[RecordingDebug] max recording duration reached', {
        elapsedRef: elapsedRef.current,

        isRecordingRef: isRecordingRef.current,
      });

      if (!isRecordingRef.current) {
        return;
      }

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
    }, MAX_RECORDING_SECONDS * 1000);

    try {
      if (!isCheckIn) {
        await startBackgroundMusic();
      }
      const video = await cameraRef.current.recordAsync({
        maxFileSize: RECORDING_MAX_FILE_SIZE_BYTES,
      });

      const recordedDurationSeconds = recordingStartedAtRef.current
        ? (Date.now() - recordingStartedAtRef.current) / 1000
        : elapsedRef.current;
      await stopBackgroundMusic();

      const wasManualStop = manualStopRequestedRef.current;

      let videoSizeBytes: number | null = null;

      if (video?.uri) {
        try {
          const videoInfo = await FileSystem.getInfoAsync(video.uri, {
            size: true,
          });

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
        setSelectedMediaType('video');
        setCheckInSubmissionType('live_video');
        setSelectedMediaDimensions(null);
        setSelectedMimeType('video/mp4');

        setCaption(
          isCheckIn
            ? getCheckInCaption()
            : getDefaultCaption(progress?.nextAttemptNumber, challenge?.name ?? 'this exercise')
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
      await stopBackgroundMusic();
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
  }, [
    challenge?.name,
    challengeId,
    isCheckIn,
    progress?.nextAttemptNumber,
    startBackgroundMusic,
    stopBackgroundMusic,
  ]);

  const playCountdownSound = useCallback(
    async (playbackToken: number) => {
      try {
        await stopCountdownSound();

        if (playbackToken !== countdownSoundPlaybackTokenRef.current) {
          return;
        }

        await Audio.setIsEnabledAsync(true);
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          interruptionModeIOS: InterruptionModeIOS.DoNotMix,
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
          shouldDuckAndroid: false,
          playThroughEarpieceAndroid: false,
        });

        if (playbackToken !== countdownSoundPlaybackTokenRef.current) {
          return;
        }

        const { sound, status } = await Audio.Sound.createAsync(require('../../assets/beep.mp3'), {
          shouldPlay: true,
          isLooping: false,
          positionMillis: 0,
          volume: 1,
        });

        if (playbackToken !== countdownSoundPlaybackTokenRef.current) {
          await sound.unloadAsync();
          return;
        }

        countdownSoundRef.current = sound;

        console.log('[RecordingDebug] countdown sound started', {
          isLoaded: status.isLoaded,
          isPlaying: status.isLoaded ? status.isPlaying : false,
          durationMillis: status.isLoaded ? status.durationMillis : undefined,
        });
      } catch (error) {
        console.log('[RecordingDebug] countdown sound play failed', error);
      }
    },
    [stopCountdownSound]
  );

  const startCountdown = useCallback(() => {
    if (
      !requireSubscription({
        redirectTo: challengeRedirectTo,
        source: isCheckIn ? 'challenge_check_in' : 'challenge_record_video',
      })
    )
      return;

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

    if (countdownRef.current) {
      return;
    }

    setState('countdown');

    setCountdownValue(COUNTDOWN_SECONDS);

    const countdownPlaybackToken = countdownSoundPlaybackTokenRef.current + 1;

    countdownSoundPlaybackTokenRef.current = countdownPlaybackToken;

    playCountdownSound(countdownPlaybackToken).catch(() => {});

    let count = COUNTDOWN_SECONDS;

    countdownRef.current = setInterval(() => {
      count -= 1;

      setCountdownValue(count);

      console.log('[RecordingDebug] countdown tick', {
        count,
      });

      if (count <= 0) {
        if (countdownRef.current) {
          clearInterval(countdownRef.current);

          countdownRef.current = null;
        }

        countdownSoundPlaybackTokenRef.current += 1;

        stopCountdownSound()
          .catch(() => {})
          .finally(() => startRecording().catch(() => {}));
      }
    }, 1000);
  }, [
    debugRecordingState,
    challengeRedirectTo,
    dailyLimit,
    dailyLimitReached,
    existingUploadJob,
    isCheckIn,
    playCountdownSound,
    requireSubscription,
    startRecording,
    stopCountdownSound,
  ]);

  const handleSwitchCamera = useCallback(() => {
    if (isRecordingRef.current) {
      return;
    }

    setCameraFacing((current) => (current === 'front' ? 'back' : 'front'));
  }, []);

  const handlePickCheckInMedia = useCallback(
    async (
      source: 'camera' | 'library',
      mediaType: 'image' | 'video',
      returnToPrevious = false
    ) => {
      if (!isCheckIn || isSubmitting) return;

      if (
        !requireSubscription({
          redirectTo: challengeRedirectTo,
          source: 'challenge_check_in_media',
        })
      )
        return;

      if (dailyLimitReached) {
        Alert.alert('Daily limit reached', 'You have reached your check-in limit for today.');
        if (returnToPrevious) router.back();
        return;
      }

      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: mediaType === 'image' ? ['images'] : ['videos'],
        allowsEditing: false,
        quality: 1,
        videoMaxDuration: MAX_RECORDING_SECONDS,
      };

      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync(options)
          : await ImagePicker.launchImageLibraryAsync(options);

      if (result.canceled || !result.assets[0]) {
        if (returnToPrevious) router.back();
        return;
      }

      const asset = result.assets[0];
      if (
        mediaType === 'video' &&
        asset.duration &&
        asset.duration > MAX_RECORDING_SECONDS * 1000
      ) {
        Alert.alert(
          'Video too long',
          `Please choose a video up to ${MAX_RECORDING_SECONDS} seconds.`
        );
        if (returnToPrevious) router.back();
        return;
      }

      const fallbackExtension = mediaType === 'image' ? 'jpg' : 'mp4';
      const sourceExtension = asset.fileName?.split('.').pop()?.toLowerCase() || fallbackExtension;
      const persistentUri = `${FileSystem.documentDirectory}check-in-${Date.now()}.${sourceExtension}`;

      try {
        await FileSystem.copyAsync({ from: asset.uri, to: persistentUri });
        recordedVideoUriRef.current = persistentUri;
        setRecordedVideoUri(persistentUri);
        setSelectedMediaType(mediaType);
        setCheckInSubmissionType(mediaType === 'image' ? 'photo' : 'uploaded_video');
        setSelectedMediaDimensions(
          asset.width > 0 && asset.height > 0 ? { width: asset.width, height: asset.height } : null
        );
        setSelectedMimeType(asset.mimeType || (mediaType === 'image' ? 'image/jpeg' : 'video/mp4'));
        setCaption(getCheckInCaption());
        setState('post-record');
      } catch {
        Alert.alert('Media unavailable', 'Could not prepare that file. Please choose another one.');
        if (returnToPrevious) router.back();
      }
    },
    [challengeRedirectTo, dailyLimitReached, isCheckIn, isSubmitting, requireSubscription]
  );

  useEffect(() => {
    if (!isCheckIn || !checkInMode || handledCheckInModeRef.current) return;

    handledCheckInModeRef.current = true;

    if (checkInMode === 'record_video') {
      setCheckInSubmissionType('live_video');
      setIsVideoRecorderOpen(true);
      return;
    }

    if (checkInMode === 'take_photo') {
      handlePickCheckInMedia('camera', 'image', true);
      return;
    }

    if (checkInMode === 'upload_photo') {
      handlePickCheckInMedia('library', 'image', true);
      return;
    }

    handlePickCheckInMedia('library', 'video', true);
  }, [checkInMode, handlePickCheckInMedia, isCheckIn]);

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
    setSelectedMediaType('video');
    setCheckInSubmissionType('live_video');
    setSelectedMediaDimensions(null);
    setSelectedMimeType('video/mp4');
    setIsVideoRecorderOpen(false);
    setCaption('');

    setAllowRepost(!isCheckIn);

    setElapsed(0);

    setCountdownValue(COUNTDOWN_SECONDS);

    setIsSubmitting(false);

    setState('pre-record');
  }, [cleanupRecordingRefs, debugRecordingState, isCheckIn, recordedVideoUri]);

  const handleSubmit = useCallback(async () => {
    debugRecordingState('handleSubmit called');

    if (!recordedVideoUri || !challenge || isSubmitting) {
      return;
    }
    if (
      !requireSubscription({
        redirectTo: challengeRedirectTo,
        source: isCheckIn ? 'challenge_submit_check_in' : 'challenge_submit_video',
      })
    )
      return;

    const trimmedCaption = caption.trim();

    if (!isCheckIn && !trimmedCaption) {
      Alert.alert('Caption required', 'Please add a caption before submitting your video.');

      return;
    }

    setIsSubmitting(true);

    try {
      await enqueueChallengeUpload({
        challengeId,

        videoUri: recordedVideoUri,

        mediaType: selectedMediaType,
        checkInSubmissionType: isCheckIn ? checkInSubmissionType : undefined,
        musicTrackId:
          selectedMediaType === 'video' && !isCheckIn ? selectedMusicTrack?.id : undefined,
        mediaWidth: isCheckIn ? selectedMediaDimensions?.width : undefined,
        mediaHeight: isCheckIn ? selectedMediaDimensions?.height : undefined,
        mimeType: selectedMimeType,

        allowRepost: isCheckIn ? false : allowRepost,

        caption: trimmedCaption || undefined,
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
    isCheckIn,
    challengeRedirectTo,
    requireSubscription,
    selectedMediaType,
    checkInSubmissionType,
    selectedMediaDimensions,
    selectedMimeType,
    selectedMusicTrack,
  ]);

  const handleCaptionFocus = useCallback(() => {
    setTimeout(() => {
      postRecordScrollRef.current?.scrollToEnd({
        animated: true,
      });
    }, 250);
  }, []);

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

  if (
    isCheckIn &&
    checkInMode &&
    state === 'pre-record' &&
    !isVideoRecorderOpen &&
    !handledCheckInModeRef.current
  ) {
    return <ScreenLoading />;
  }

  if (
    (!isCheckIn || isVideoRecorderOpen) &&
    (!cameraPermission?.granted || !micPermission?.granted)
  ) {
    return (
      <View
        className="flex-1 items-center justify-center bg-[#F9F9F9] px-8"
        style={{
          paddingTop: insets.top,
        }}>
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

  const totalPoints = challenge.points + (!isCheckIn && allowRepost ? 3 : 0);

  const isLiveState = state === 'pre-record' || state === 'countdown' || state === 'recording';

  const isCaptionMissing = !isCheckIn && !caption.trim();

  const progressPercent =
    state === 'recording' ? Math.min(100, (elapsed / MAX_RECORDING_SECONDS) * 100) : 0;

  const canStopRecording = state === 'recording' && elapsed >= MIN_STOP_RECORDING_SECONDS;

  const currentChallengeDay = progress?.nextAttemptNumber ?? 1;

  if (isCheckIn && state === 'pre-record' && !isVideoRecorderOpen) {
    const MediaChoice = ({
      label,
      description,
      featured = false,
      icon,
      onPress,
    }: {
      label: string;
      description: string;
      featured?: boolean;
      icon: React.ReactNode;
      onPress: () => void;
    }) => (
      <TouchableOpacity
        activeOpacity={0.72}
        className={`mb-3 flex-row items-center rounded-2xl border bg-white px-4 py-4 ${
          featured ? 'border-[#FFB99C]' : 'border-[#E7E7E7]'
        }`}
        disabled={dailyLimitReached}
        onPress={onPress}>
        <View className="mr-3.5 h-12 w-12 items-center justify-center rounded-full bg-[#FFF1EA]">
          {icon}
        </View>
        <View className="min-w-0 flex-1 pr-3">
          <Text className="font-body text-base font-bold text-[#1F1F1F]">{label}</Text>
          <Text className="mt-0.5 font-body text-xs text-[#777777]">{description}</Text>
        </View>
        <ArrowRight size={19} color="#FF5C1A" weight="bold" />
      </TouchableOpacity>
    );

    return (
      <View className="flex-1 bg-[#F6F6F6] px-5" style={{ paddingTop: insets.top + 18 }}>
        <TouchableOpacity
          onPress={handleCancel}
          className="mb-8 h-10 w-10 items-center justify-center rounded-full bg-white">
          <X size={22} color="#222" weight="bold" />
        </TouchableOpacity>
        <Text className="font-heading text-3xl font-extrabold text-black">Add your check-in</Text>
        <Text className="mb-7 mt-2 font-body text-base text-[#686868]">
          Add one photo or video - whichever feels easiest today.
        </Text>
        {/* <MediaChoice
          label="Take Photo"
          description="Snap a photo now"
          icon={<Camera size={23} color="#FF5C1A" />}
          onPress={() => handlePickCheckInMedia('camera', 'image')}
        />
        <MediaChoice
          label="Upload Photo"
          description="Choose from your library"
          icon={<ImageSquare size={23} color="#FF5C1A" />}
          onPress={() => handlePickCheckInMedia('library', 'image')}
        /> */}
        <MediaChoice
          label="Record Video"
          description="Record live in the app · 1 min max"
          featured
          icon={<VideoCamera size={23} color="#FF5C1A" />}
          onPress={() => {
            setCheckInSubmissionType('live_video');
            setIsVideoRecorderOpen(true);
          }}
        />
        <MediaChoice
          label="Upload Video"
          description="Choose a saved video · 1 min max"
          icon={<UploadSimple size={23} color="#FF5C1A" />}
          onPress={() => handlePickCheckInMedia('library', 'video')}
        />
        {dailyLimitReached && (
          <Text className="mt-2 text-center font-body text-sm font-semibold text-[#E5484D]">
            You reached your check-in limit for today.
          </Text>
        )}
      </View>
    );
  }

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
          mute={!isCheckIn || isCheckInAudioMuted}
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

        {state === 'pre-record' && isCheckIn && (
          <TouchableOpacity
            activeOpacity={0.78}
            accessibilityRole="switch"
            accessibilityLabel="Record microphone audio"
            accessibilityHint={
              isCheckInAudioMuted
                ? 'Turns on the original audio for your check-in video'
                : 'Mutes the original audio in your check-in video'
            }
            accessibilityState={{ checked: !isCheckInAudioMuted }}
            onPress={() => setIsCheckInAudioMuted((current) => !current)}
            hitSlop={{
              top: 8,
              bottom: 8,
              left: 8,
              right: 8,
            }}
            style={{
              position: 'absolute',
              top: insets.top + 16,
              left: '50%',
              zIndex: 30,
              minWidth: 102,
              height: 42,
              borderRadius: 21,
              paddingHorizontal: 12,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              columnGap: 7,
              backgroundColor: 'rgba(31,31,31,0.9)',
              transform: [{ translateX: -51 }],
            }}>
            {isCheckInAudioMuted ? (
              <MicrophoneSlash size={19} color="#FFFFFF" weight="bold" />
            ) : (
              <Microphone size={19} color="#FFFFFF" weight="bold" />
            )}
            <Text className="font-body text-xs font-bold text-white">
              {isCheckInAudioMuted ? 'Muted' : 'Audio on'}
            </Text>
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

        {state === 'pre-record' && !isCheckIn && (
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
                Review your {selectedMediaType === 'image' ? 'photo' : 'video'} then submit
              </Text>
            </View>
          </View>

          {recordedVideoUri && (
            <View className="mx-5 mt-5 overflow-hidden rounded-3xl bg-black">
              {isCheckIn && selectedMediaType === 'image' ? (
                <Image
                  source={{ uri: recordedVideoUri }}
                  style={{ width: '100%', aspectRatio: 4 / 5 }}
                  contentFit="cover"
                  contentPosition="center"
                />
              ) : isCheckIn ? (
                <SingleVideoPreview videoUrl={recordedVideoUri} />
              ) : currentChallengeDay === 1 ? (
                <CompositeVideoPlayer
                  leftVideoUrl={FIRST_ATTEMPT_VIDEO_URL}
                  rightVideoUrl={recordedVideoUri}
                  leftLabel=""
                  rightLabel="Day 1"
                  mirrorRight={false}
                  backgroundMusicSource={selectedMusicTrack?.source}
                  backgroundMusicVolume={BACKGROUND_MUSIC_VOLUME}
                />
              ) : progress?.day1VideoUrl ? (
                <CompositeVideoPlayer
                  leftVideoUrl={progress.day1VideoUrl}
                  rightVideoUrl={recordedVideoUri}
                  leftLabel="Day 1"
                  rightLabel={`Day ${currentChallengeDay}`}
                  mirrorRight={false}
                  backgroundMusicSource={selectedMusicTrack?.source}
                  backgroundMusicVolume={BACKGROUND_MUSIC_VOLUME}
                />
              ) : (
                <CompositeVideoPlayer
                  leftVideoUrl={challenge.instructionalVideoUrl || FIRST_ATTEMPT_VIDEO_URL}
                  rightVideoUrl={recordedVideoUri}
                  leftLabel="Challenge"
                  rightLabel={`Day ${currentChallengeDay}`}
                  mirrorRight={false}
                  backgroundMusicSource={selectedMusicTrack?.source}
                  backgroundMusicVolume={BACKGROUND_MUSIC_VOLUME}
                />
              )}
            </View>
          )}

          <View
            className="mx-5 mt-5 rounded-3xl bg-white px-4 py-4"
            style={{
              shadowColor: '#000',

              shadowOffset: {
                width: 0,
                height: 6,
              },

              shadowOpacity: 0.05,
              shadowRadius: 12,
            }}>
            <View className="mb-2 flex-row items-center justify-between">
              <Text className="font-body text-sm font-bold text-[#1F1F1F]">
                Caption{isCheckIn ? ' (optional)' : ' *'}
              </Text>

              <Text className="font-body text-xs text-[#838383]">
                {caption.trim().length}
                /150
              </Text>
            </View>

            <Textarea size="xl" className="rounded-2xl border border-[#E7E7E7] bg-[#FAFAFA]">
              <TextareaInput
                placeholder={isCheckIn ? 'Share your check-in...' : 'Share a progress update...'}
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

          {!isCheckIn && (
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
          )}

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
                {isCheckIn
                  ? `Submit Check-In for ${totalPoints} ${totalPoints === 1 ? 'pt' : 'pts'}`
                  : `Submit Day ${progress?.nextAttemptNumber ?? 1} for ${totalPoints} pts`}
              </ButtonText>
            </LoadingButton>

            <Text className="mt-1 text-center font-body text-sm font-semibold text-[#6F6F6F]">
              Keep the app open while your {selectedMediaType === 'image' ? 'photo' : 'video'}{' '}
              uploads
            </Text>
          </View>

          <TouchableOpacity
            className="mt-5 items-center"
            disabled={isSubmitting}
            onPress={handleStartOver}>
            <Text className="font-body text-sm font-semibold text-[#6F6F6F]">
              Remove or replace media
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return null;
}
