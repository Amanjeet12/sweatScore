import { useAuthToken } from '@convex-dev/auth/react';
import { useAction, useConvex, useMutation, useQuery } from 'convex/react';
import { FunctionReturnType } from 'convex/server';
import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from 'expo-av';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system';
import { Image as GuideImage } from 'expo-image';
import { useKeepAwake } from 'expo-keep-awake';
import { Camera, VideoCamera, X } from 'phosphor-react-native';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { KeyboardAwareScrollView, KeyboardStickyView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MealAnalysisLoading } from './MealAnalysisLoading';
import MealReportFeedback from './MealReportFeedback';

import { MilestoneData } from '~/components/celebration/MilestoneModal';
import { RecordingOverlay } from '~/components/core/RecordingOverlay';
import ScreenLoading from '~/components/core/ScreenLoading';
import { ToastMessage } from '~/components/core/Toast';
import { PrototypeButton } from '~/components/core/auth/PrototypeOnboarding';
import { CheckInVideoPreview } from '~/components/core/dashboard/CheckInVideoPreview';
import {
  CheckInHeader,
  CheckInSheetHeader,
  checkInStyles as chrome,
} from '~/components/core/design/CheckInChrome';
import {
  prototypeTypography as type,
  prototypeColors as colors,
  prototypeComponents as components,
} from '~/components/core/design/prototypeStyles';
import { useCelebration } from '~/components/providers/CelebrationProvider';
import { useWorkoutUploadQueue } from '~/components/providers/WorkoutUploadProvider';
import { Text } from '~/components/ui/text';
import { useToast } from '~/components/ui/toast';
import { api } from '~/convex/_generated/api';
import { Id } from '~/convex/_generated/dataModel';
import {
  canStartCoachLivePhoto,
  coachCheckInPoints,
  randomCoachCheckInCaption,
} from '~/shared/coachCheckInPresentation';
import { CoachCategory } from '~/shared/coachFoundation';
import {
  createCheckInOperationGuard,
  mealReportMatchesPhoto,
  reconcileCapture,
  shareMealWithFeedback,
  type MealFeedbackInput,
} from '~/shared/coachMealFlow';
import { pointsLabel } from '~/shared/pointsLabel';
import { getErrorMessage } from '~/utils/error-message';
import { getData, removeData, storeData } from '~/utils/storage';

type ProofQueue = {
  userId: string;
  day: string;
  category: CoachCategory;
  submissionId: Id<'coachProofSubmissionsV1'>;
  assignmentId: string;
  planRevisionId?: string;
  label?: string;
  recommendation: string;
  stepTarget?: number;
  detailsV2?: {
    workoutExamples: string[];
    workoutReason: string;
    stepsReason: string;
  };
  captureId?: string;
  mealFeedback?: MealFeedbackInput & { draftId: Id<'coachMealDraftsV1'> };
  shareWithoutAnalysis?: boolean;
  postedMeal?: FunctionReturnType<typeof api.coachMeals.share>;
  uri?: string;
  storageId?: Id<'_storage'>;
  mediaType?: 'image' | 'video';
  caption?: string;
  plateDescription?: string;
};

// Mount with the camera so preview, countdown, recording, and saving stay awake.
// The hook releases the lock when the camera closes or the sheet unmounts.
function CameraKeepAwake() {
  useKeepAwake('coach-check-in-camera');
  return null;
}

export default function CoachCheckInFlow({
  category,
  onClose,
  onOpenPlan,
  onExpandedChange,
  onPreferredHeightChange,
  mode = 'details',
  onCaptured,
  initialToday,
  initialCurrentUser,
}: {
  category: CoachCategory;
  onClose: () => void;
  onOpenPlan: (status: 'no_plan' | 'pending' | 'ready' | 'locked') => void;
  onExpandedChange?: (expanded: boolean) => void;
  onPreferredHeightChange?: (height: number) => void;
  mode?: 'details' | 'post';
  onCaptured?: () => void;
  initialToday?: FunctionReturnType<typeof api.coachCheckIns.myToday>;
  initialCurrentUser?: FunctionReturnType<typeof api.users.current>;
}) {
  const convex = useConvex();
  const { enqueue: enqueueWorkoutUpload, pending: workoutUploadPending } = useWorkoutUploadQueue();
  const toast = useToast();
  const { celebrateCompletion, showMilestone } = useCelebration();
  const authToken = useAuthToken();
  const currentUser = useQuery(api.users.current) ?? initialCurrentUser;
  const today = useQuery(api.coachCheckIns.myToday, {}) ?? initialToday;
  const ensureStandaloneAssignments = useMutation(api.coachCheckIns.ensureStandaloneAssignments);
  const reserve = useMutation(api.coachFoundation.reserveProof);
  const issueUpload = useMutation(api.coachCheckIns.issueUpload);
  const complete = useMutation(api.coachCheckIns.complete);
  const saveProofCaption = useMutation(api.coachCheckIns.saveCaption);
  const retakeProof = useMutation(api.coachCheckIns.retakeProof);
  const saveMealCaption = useMutation(api.coachMeals.saveCaption);
  const retakeMeal = useMutation(api.coachMeals.retake);
  const analyzeMeal = useAction(api.coachMealAnalysis.analyze);
  const shareMeal = useMutation(api.coachMeals.share);
  const [permission, requestPermission] = useCameraPermissions();
  const [microphonePermission, requestMicrophonePermission] = useMicrophonePermissions();
  const insets = useSafeAreaInsets();
  const camera = useRef<CameraView>(null);
  const operations = useRef(createCheckInOperationGuard()).current;
  const queueRef = useRef<ProofQueue | null>(null);
  useEffect(() => () => operations.invalidate(), [operations]);
  const submitMealFeedback = useMutation(api.coachMeals.submitReportFeedback);
  const [queue, setQueue] = useState<ProofQueue | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [showMealGuide, setShowMealGuide] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraAttempt, setCameraAttempt] = useState(0);
  const [cameraStartupError, setCameraStartupError] = useState('');
  const [photoPreviewError, setPhotoPreviewError] = useState(false);
  const [cameraMode, setCameraMode] = useState<'picture' | 'video'>('picture');
  const [recording, setRecording] = useState(false);
  const [audioMuted, setAudioMuted] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [cameraFacing, setCameraFacing] = useState<'front' | 'back'>('back');
  const recordingStarted = useRef(0);
  const recordingActive = useRef(false);
  const countdownActive = useRef(false);
  const photoCaptureActive = useRef(false);
  const countdownSound = useRef<Audio.Sound | null>(null);
  const stopCountdownSound = async () => {
    const sound = countdownSound.current;
    countdownSound.current = null;
    if (!sound) return;
    await sound.stopAsync().catch(() => {});
    await sound.unloadAsync().catch(() => {});
  };
  const countingDown = countdown !== null;
  useEffect(() => {
    if (!countingDown) return;
    let cancelled = false;
    const play = async () => {
      try {
        await Audio.setIsEnabledAsync(true);
        await Audio.setAudioModeAsync({
          // CameraView already owns an input-capable session. Playback-only
          // mode cannot activate while that microphone input is attached.
          allowsRecordingIOS: true,
          interruptionModeIOS: InterruptionModeIOS.MixWithOthers,
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
          shouldDuckAndroid: false,
          playThroughEarpieceAndroid: false,
        });
        if (cancelled) return;
        const { sound } = await Audio.Sound.createAsync(require('~/assets/beep.mp3'), {
          shouldPlay: false,
          isLooping: false,
          positionMillis: 0,
          volume: 1,
        });
        if (cancelled) {
          await sound.unloadAsync();
          return;
        }
        countdownSound.current = sound;
        await sound.playAsync();
      } catch (soundError) {
        console.warn('[CoachVideo] Countdown sound unavailable', soundError);
      }
    };
    play().catch(() => {});
    return () => {
      cancelled = true;
      stopCountdownSound().catch(() => {});
    };
  }, [countingDown]);
  const cameraSessionKey = `${cameraFacing}-${cameraMode}-${cameraAttempt}`;
  // Android CameraX switches lenses on the existing view. Remounting on every
  // flip lets the old view's asynchronous unbindAll tear down the new preview.
  const cameraViewKey =
    Platform.OS === 'android' ? `${cameraMode}-${cameraAttempt}` : cameraSessionKey;
  const activeCameraSession = useRef(cameraSessionKey);
  activeCameraSession.current = cameraSessionKey;
  const startupRecoveryAttempts = useRef(0);
  useEffect(() => {
    if (!showCamera) startupRecoveryAttempts.current = 0;
  }, [showCamera]);
  useEffect(() => {
    setCameraStartupError('');
    if (!showCamera || cameraReady) return;
    const timer = setTimeout(() => {
      if (startupRecoveryAttempts.current === 0) {
        startupRecoveryAttempts.current += 1;
        setCameraAttempt((value) => value + 1);
      } else {
        setCameraStartupError('Camera could not get ready. Tap Retry camera to restart it.');
      }
    }, 8000);
    return () => clearTimeout(timer);
  }, [showCamera, cameraReady, cameraFacing, cameraMode, cameraAttempt]);
  useEffect(() => {
    if (!recording) return;
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - recordingStarted.current) / 1000));
    }, 250);
    return () => clearInterval(timer);
  }, [recording]);
  useEffect(
    () => () => {
      countdownActive.current = false;
      if (recordingActive.current) camera.current?.stopRecording();
    },
    []
  );
  const [busy, setBusy] = useState(false);
  const [scanningMeal, setScanningMeal] = useState(false);
  const [error, setError] = useState('');
  const [caption, setCaption] = useState('');
  const [plateDescription, setPlateDescription] = useState('');
  const foundation = useQuery(api.coachFoundation.getMyFoundation, {});
  const supportsClientUpdate = foundation?.supportsClientUpdate === true;
  const mealHistory = useQuery(
    api.coachMeals.myTodayMeals,
    category === 'meals' && supportsClientUpdate
      ? { refresh: Number((initialToday?.day ?? today?.day ?? '').replaceAll('-', '')) }
      : 'skip'
  );
  const [viewedMealId, setViewedMealId] = useState<string | null>(null);
  const viewedMeal = mealHistory?.items.find((item) => item.activityId === viewedMealId);

  const [mealRefresh, setMealRefresh] = useState(0);
  const [headerHeight, setHeaderHeight] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  const [footerHeight, setFooterHeight] = useState(0);
  const closing = useRef(false);
  useEffect(() => {
    if (headerHeight && contentHeight)
      onPreferredHeightChange?.(
        headerHeight +
          contentHeight +
          footerHeight +
          (category === 'meals' && mode === 'details' ? 0 : 12)
      );
  }, [headerHeight, contentHeight, footerHeight, onPreferredHeightChange, category, mode]);
  useEffect(() => {
    onExpandedChange?.(showCamera || Boolean(viewedMealId));
  }, [showCamera, viewedMealId, onExpandedChange]);
  const rawMeal = useQuery(
    api.coachMeals.myDraft,
    category === 'meals' && queue?.submissionId
      ? { submissionId: queue.submissionId, refresh: mealRefresh }
      : 'skip'
  );
  const matchingMealPhoto = mealReportMatchesPhoto(queue?.storageId, rawMeal);
  // Daily allowance/counts remain available before upload; only the report is photo-bound.
  const meal = rawMeal
    ? {
        ...rawMeal,
        draft: matchingMealPhoto ? rawMeal.draft : null,
        canRetryAnalysis: matchingMealPhoto && rawMeal.canRetryAnalysis,
      }
    : undefined;
  useEffect(() => {
    if (meal?.draft?.status !== 'analyzing') return;
    const timer = setInterval(() => setMealRefresh((value) => value + 1), 15_000);
    return () => clearInterval(timer);
  }, [meal?.draft?.status]);
  const [remotePreview, setRemotePreview] = useState<{
    storageId: string;
    uri: string | null;
  } | null>(null);
  useEffect(() => {
    if (mode !== 'post' || !queue?.storageId) return;
    const storageId = queue.storageId;
    let cancelled = false;
    convex
      .query(api.coachCheckIns.myProofImage, { submissionId: queue.submissionId })
      .then((uri) => {
        if (!cancelled && queueRef.current?.storageId === storageId)
          setRemotePreview({ storageId, uri });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [mode, queue?.submissionId, queue?.storageId, convex, operations]);
  const proofImage = queue?.storageId === remotePreview?.storageId ? remotePreview?.uri : null;
  useEffect(() => {
    if (meal?.draft?.caption && !caption) setCaption(meal.draft.caption);
    setPlateDescription(meal?.draft?.plateDescription ?? queueRef.current?.plateDescription ?? '');
  }, [meal?.draft?._id]);
  const assignment = today?.assignments.find((item) => item.category === category);
  useEffect(() => {
    if (today?.status === 'no_plan' && !assignment)
      ensureStandaloneAssignments({}).catch(() =>
        setError('Check-in is unavailable right now. Please try again.')
      );
  }, [today?.status, assignment?._id, ensureStandaloneAssignments]);
  const queueKey =
    currentUser?._id && today && category
      ? `coach-proof:v1:${currentUser._id}:${today.day}:${category}`
      : null;

  useEffect(() => {
    if (!queueKey || !currentUser || !today || !category) return;
    const saved = getData(queueKey) as ProofQueue | null;
    if (
      !saved ||
      saved.userId !== currentUser._id ||
      saved.day !== today.day ||
      saved.category !== category
    )
      return;
    const token = operations.snapshot();
    let cancelled = false;
    convex
      .query(api.coachCheckIns.mySubmission, { submissionId: saved.submissionId })
      .then((server) => {
        if (cancelled || !operations.isCurrent(token)) return;
        const pendingFeedback =
          category === 'meals' &&
          saved.shareWithoutAnalysis !== true &&
          saved.mealFeedback?.helpful !== undefined;
        if (
          server.assignmentId === saved.assignmentId &&
          server.planRevisionId === saved.planRevisionId &&
          server.recommendation === saved.recommendation &&
          (server.state !== 'completed' || pendingFeedback) &&
          server.state !== 'reversed'
        ) {
          const recovered = reconcileCapture(saved, server.storageId);
          const recoveredCaption =
            recovered.caption ??
            server.caption ??
            (category === 'meals'
              ? 'Plate full of goodness ✌️'
              : randomCoachCheckInCaption(category));
          const nextRecovered = { ...recovered, caption: recoveredCaption };
          queueRef.current = nextRecovered;
          setQueue(nextRecovered);
          setCaption(recoveredCaption);
          setPlateDescription(recovered.plateDescription ?? '');
          storeData(queueKey, nextRecovered);
        } else removeData(queueKey);
      })
      .catch(() => {
        // A temporary entitlement or network failure must not erase pinned local proof.
      });
    return () => {
      cancelled = true;
    };
  }, [category, convex, currentUser?._id, queueKey, today?.day, operations]);

  const persist = (next: ProofQueue) => {
    queueRef.current = next;
    setQueue(next);
    if (queueKey) storeData(queueKey, next);
  };

  const showPostedSuccess = (pointsEarned: number, milestones: MilestoneData[] = []) => {
    onClose();
    setTimeout(() => {
      celebrateCompletion({ type: 'check_in', pointsEarned });
      milestones.forEach(showMilestone);
      toast.show({
        placement: 'top',
        duration: 10000,
        render: () => (
          <ToastMessage
            message={`+${pointsEarned} ${pointsLabel(pointsEarned)} added. Your post will be live soon.`}
            action="success"
          />
        ),
      });
    }, 350);
  };

  const closeSheet = () => {
    if (closing.current) return;
    closing.current = true;
    operations.invalidate();
    photoCaptureActive.current = false;
    countdownActive.current = false;
    setCountdown(null);
    // A reserved slot is intentionally reused on reopening. Cancelling it here
    // would leave the slot occupied but make its proof impossible to upload.
    // Captured photos and captions stay in the owner-bound local queue.
    if (recording) camera.current?.stopRecording();
    setShowCamera(false);
    onClose();
  };

  const start = async (mediaType: 'image' | 'video' = 'image') => {
    if (!currentUser || !today || !category || !queueKey) return;
    if (closing.current) return;
    const operation = operations.begin();
    if (operation === null) return;
    setBusy(true);
    setError('');
    try {
      let selectedAssignment = assignment;
      if (!selectedAssignment && today.status === 'no_plan') {
        await ensureStandaloneAssignments({});
        const updated = await convex.query(api.coachCheckIns.myToday, {});
        selectedAssignment = updated.assignments.find((item) => item.category === category);
      }
      if (!selectedAssignment) {
        setError('Check-in is unavailable right now. Please try again.');
        return;
      }
      const granted = permission?.granted || (await requestPermission()).granted;
      if (!granted) {
        setError('Camera access is needed for live proof.');
        return;
      }
      if (
        mediaType === 'video' &&
        !audioMuted &&
        !(microphonePermission?.granted || (await requestMicrophonePermission()).granted)
      ) {
        setAudioMuted(true);
      }
      const id = await reserve({
        assignmentId: selectedAssignment._id,
        requestKey: Crypto.randomUUID().replaceAll('-', ''),
      });
      const server = await convex.query(api.coachCheckIns.mySubmission, { submissionId: id });
      if (!operations.isCurrent(operation)) return;
      persist({
        userId: currentUser._id,
        day: server.day,
        category,
        submissionId: id,
        assignmentId: server.assignmentId,
        planRevisionId: server.planRevisionId,
        label: selectedAssignment.label,
        recommendation: server.recommendation,
        stepTarget: selectedAssignment.stepTarget,
        detailsV2: selectedAssignment.detailsV2,
        mediaType,
      });
      setCameraMode(mediaType === 'video' ? 'video' : 'picture');
      setCameraReady(false);
      setShowCamera(true);
    } catch {
      if (!operations.isCurrent(operation)) return;
      setError('Could not start check-in. Please try again.');
    } finally {
      if (operations.isCurrent(operation)) {
        operations.end(operation);
        setBusy(false);
      }
    }
  };

  const capture = async () => {
    if (
      !queue ||
      !camera.current ||
      photoCaptureActive.current ||
      busy ||
      !FileSystem.documentDirectory
    )
      return;
    if (closing.current) return;
    const operation = operations.begin();
    if (operation === null) return;
    // The native photo output validates readiness even if iOS loses onCameraReady.
    photoCaptureActive.current = true;
    setBusy(true);
    setError('');
    try {
      const photo = await camera.current.takePictureAsync({ quality: 0.8, shutterSound: false });
      if (!photo?.uri) throw new Error('Camera did not return a photo');
      const capturedFile = await FileSystem.getInfoAsync(photo.uri);
      if (!capturedFile.exists || !capturedFile.size) throw new Error('Empty camera photo');
      const captureId = Crypto.randomUUID().replaceAll('-', '');
      const uri = `${FileSystem.documentDirectory}coach-proof-${queue.submissionId}-${captureId}.jpg`;
      await FileSystem.deleteAsync(uri, { idempotent: true });
      await FileSystem.copyAsync({ from: photo.uri, to: uri });
      if (!operations.isCurrent(operation)) {
        await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
        return;
      }
      const nextCaption = caption.trim()
        ? caption
        : category === 'meals'
          ? 'Plate full of goodness ✌️'
          : randomCoachCheckInCaption(category);
      setCaption(nextCaption);
      persist({
        ...queue,
        captureId,
        uri,
        storageId: undefined,
        mealFeedback: undefined,
        postedMeal: undefined,
        shareWithoutAnalysis: undefined,
        caption: nextCaption,
      });
      setPhotoPreviewError(false);
      setShowCamera(false);
      if (mode === 'details' && !closing.current) onCaptured?.();
    } catch {
      if (!operations.isCurrent(operation)) return;
      setError('Could not save the photo. Please try again.');
    } finally {
      if (operations.isCurrent(operation)) {
        operations.end(operation);
        photoCaptureActive.current = false;
        setBusy(false);
      }
    }
  };

  const captureVideo = async () => {
    if (
      !queue ||
      !camera.current ||
      !FileSystem.documentDirectory ||
      closing.current ||
      recordingActive.current ||
      !cameraReady
    )
      return;
    if (closing.current) return;
    const operation = operations.begin();
    if (operation === null) return;
    recordingActive.current = true;
    recordingStarted.current = Date.now();
    setElapsed(0);
    setRecording(true);
    setError('');
    try {
      const video = await camera.current.recordAsync({
        maxDuration: 60,
        maxFileSize: 19_000_000,
        // iOS applies videoBitrate only when an explicit codec is selected.
        ...(Platform.OS === 'ios' ? { codec: 'avc1' as const } : {}),
      });
      if (!video?.uri) return;
      const extension = video.uri.toLowerCase().endsWith('.mov') ? 'mov' : 'mp4';
      const captureId = Crypto.randomUUID().replaceAll('-', '');
      const uri = `${FileSystem.documentDirectory}coach-proof-${queue.submissionId}-${captureId}.${extension}`;
      await FileSystem.deleteAsync(uri, { idempotent: true });
      await FileSystem.copyAsync({ from: video.uri, to: uri });
      if (!operations.isCurrent(operation)) return;
      const nextCaption = caption.trim() ? caption : randomCoachCheckInCaption(category);
      setCaption(nextCaption);
      persist({ ...queue, captureId, uri, caption: nextCaption, mediaType: 'video' });
      setShowCamera(false);
      if (mode === 'details' && !closing.current) onCaptured?.();
    } catch (recordingError) {
      if (!operations.isCurrent(operation)) return;
      console.warn('[CoachVideo] Recording failed', recordingError);
      setError('Could not record the video. Please try again.');
    } finally {
      if (operations.isCurrent(operation)) {
        operations.end(operation);
        recordingActive.current = false;
        setRecording(false);
        setBusy(false);
      }
    }
  };

  useEffect(() => {
    if (countdown === null) return;
    const timer = setTimeout(() => {
      if (!countdownActive.current || closing.current) return;
      if (countdown > 1) setCountdown(countdown - 1);
      else {
        countdownActive.current = false;
        setCountdown(null);
        stopCountdownSound().finally(() => {
          if (!closing.current) captureVideo().catch(() => {});
        });
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const startCountdown = () => {
    if (
      !camera.current ||
      !cameraReady ||
      busy ||
      countdownActive.current ||
      recordingActive.current
    )
      return;
    countdownActive.current = true;
    setError('');
    setCountdown(5);
  };

  const expiredProofMessage =
    'This check-in belongs to yesterday. Start a new check-in for today. Your recording is still saved on this device.';
  const upload = async (operation: number): Promise<Id<'_storage'> | null> => {
    if (!queue?.uri) return null;
    try {
      if (!authToken) throw new Error('Sign in again before uploading proof.');
      const siteUrl = process.env.EXPO_PUBLIC_CONVEX_URL?.replace('.convex.cloud', '.convex.site');
      if (!siteUrl) throw new Error('Proof upload service is unavailable.');
      const { token } = await issueUpload({
        submissionId: queue.submissionId,
        mediaType: queue.mediaType ?? 'image',
      });
      if (!operations.isCurrent(operation)) return null;
      const task = FileSystem.createUploadTask(`${siteUrl}/api/coach-proof-upload`, queue.uri, {
        httpMethod: 'POST',
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
        headers: {
          'Content-Type':
            queue.mediaType === 'video'
              ? queue.uri?.toLowerCase().endsWith('.mov')
                ? 'video/quicktime'
                : 'video/mp4'
              : 'image/jpeg',
          Authorization: `Bearer ${authToken}`,
          'X-Coach-Submission': queue.submissionId,
          'X-Coach-Capture-Token': token,
        },
      });
      const result = await task.uploadAsync();
      if (!result) throw new Error('No response from the upload service.');
      if (result.status < 200 || result.status >= 300) {
        console.warn('[CoachUpload] Rejected', result.status, result.body);
        throw new Error(
          result.status === 413
            ? 'The video exceeds the upload size limit.'
            : result.status === 401
              ? 'Your session expired. Sign in again to upload.'
              : result.status === 403 || result.status === 409
                ? 'The upload session changed. Please retry.'
                : `Upload service returned ${result.status}. Please retry.`
        );
      }
      const storageId = JSON.parse(result.body).storageId as Id<'_storage'> | undefined;
      if (!storageId) throw new Error('Photo upload did not return media identity.');
      if (!operations.isCurrent(operation)) return null;
      persist({ ...(queueRef.current ?? queue), storageId });
      return storageId;
    } catch (uploadError) {
      if (!operations.isCurrent(operation)) return null;
      console.warn('[CoachUpload] Failed', uploadError);
      try {
        const saved = await convex.query(api.coachCheckIns.mySubmission, {
          submissionId: queue.submissionId,
        });
        if (!operations.isCurrent(operation)) return null;
        if (today && saved.day !== today.day) {
          setError(expiredProofMessage);
          return null;
        }
        if (saved.state === 'uploaded' && saved.storageId) {
          persist({ ...(queueRef.current ?? queue), storageId: saved.storageId });
          return saved.storageId;
        }
      } catch {
        /* Keep the local queue for an offline retry. */
      }
      setError(
        `${getErrorMessage(uploadError)} Your ${queue.mediaType === 'video' ? 'video' : 'photo'} is saved for retry.`
      );
      return null;
    }
  };

  const publishProof = async () => {
    if (!queue || category === 'meals') return;
    if (closing.current) return;
    const operation = operations.begin();
    if (operation === null) return;
    setBusy(true);
    setError('');
    try {
      if (today && queue.day !== today.day) {
        setError(expiredProofMessage);
        return;
      }
      if (queue.mediaType === 'video' && queue.uri && queueKey) {
        enqueueWorkoutUpload({
          userId: queue.userId,
          submissionId: queue.submissionId,
          uri: queue.uri,
          caption,
          queueKey,
        });
        onClose();
        return;
      }
      await saveProofCaption({ submissionId: queue.submissionId, caption });
      const storageId = queue.storageId ?? (await upload(operation));
      if (!storageId) return;
      const result = await complete({ submissionId: queue.submissionId, caption });
      if (queueKey) removeData(queueKey);
      if (queue.uri) await FileSystem.deleteAsync(queue.uri, { idempotent: true }).catch(() => {});
      setQueue(null);
      showPostedSuccess(result.pointsEarned, result.milestones);
    } catch {
      if (!operations.isCurrent(operation)) return;
      setError(
        `Could not post. Your ${queue.mediaType === 'video' ? 'video' : 'photo'} is saved for retry.`
      );
    } finally {
      if (operations.isCurrent(operation)) {
        operations.end(operation);
        setBusy(false);
      }
    }
  };

  const scanMeal = async () => {
    if (!queue) return;
    if (closing.current) return;
    const operation = operations.begin();
    if (operation === null) return;
    setBusy(true);
    setScanningMeal(true);
    setError('');
    try {
      const storageId = queue.storageId ?? (await upload(operation));
      if (!storageId || !operations.isCurrent(operation)) return;
      const draftId = await saveMealCaption({
        submissionId: queue.submissionId,
        caption,
        ...(supportsClientUpdate ? { plateDescription } : {}),
      });
      if (!operations.isCurrent(operation)) return;
      const result = await analyzeMeal({
        draftId,
        requestKey: Crypto.randomUUID().replaceAll('-', ''),
      });
      if (!operations.isCurrent(operation)) return;
      if (result.status === 'failed')
        setError(
          result.errorCode === 'provider_timeout'
            ? 'Analysis timed out. Your photo is saved. Retry when ready; no successful scan was used.'
            : result.errorCode === 'unclear_image'
              ? 'The photo is too unclear to assess. Retake it in better light; no successful scan was used.'
              : result.errorCode === 'invalid_output'
                ? 'We could not assess this photo reliably. Retry or retake; no successful scan was used.'
                : 'Meal analysis is temporarily unavailable. Retry when connected; no successful scan was used.'
        );
    } catch (cause) {
      if (!operations.isCurrent(operation)) return;
      const message = cause instanceof Error ? cause.message : '';
      if (message.includes('Three successful meal scans')) {
        setError(
          'You have used today’s three private portion checks. You can still share this meal.'
        );
        setMealRefresh((value) => value + 1);
      } else if (message.includes('already being analysed')) {
        setError('This meal is already being checked. Please wait a moment.');
      } else {
        setError('We could not start the portion check. Your photo is safe—please try again.');
      }
    } finally {
      if (operations.isCurrent(operation)) {
        operations.end(operation);
        setScanningMeal(false);
        setBusy(false);
      }
    }
  };

  const publishMeal = async (skipAnalysis = false) => {
    if (!queue || closing.current) return;
    const operation = operations.begin();
    if (operation === null) return;
    setBusy(true);
    setError('');
    try {
      const storageId = queue.storageId ?? (await upload(operation));
      if (!storageId || !operations.isCurrent(operation)) return;
      const draftId =
        meal?.draft?._id ??
        (await saveMealCaption({
          submissionId: queue.submissionId,
          caption,
          ...(supportsClientUpdate ? { plateDescription } : {}),
        }));
      if (!operations.isCurrent(operation)) return;
      const feedback =
        !skipAnalysis && queueRef.current?.mealFeedback?.draftId === draftId
          ? queueRef.current.mealFeedback
          : undefined;
      // A lost share response may be confirmed by the live owner-bound draft.
      const postedMeal =
        queue.postedMeal ??
        (meal?.draft?.status === 'shared' && meal.draft.postId && meal.draft.activityId
          ? {
              postId: meal.draft.postId,
              activityId: meal.draft.activityId,
              pointsEarned: coachCheckInPoints('meals'),
              milestones: [],
            }
          : undefined);
      persist({ ...(queueRef.current ?? queue), shareWithoutAnalysis: skipAnalysis });
      const result = await shareMealWithFeedback({
        posted: postedMeal,
        share: () =>
          shareMeal({
            draftId,
            caption: queueRef.current?.caption ?? caption,
            skipAnalysis: skipAnalysis || undefined,
          }),
        onPosted: (postedMeal) => {
          if (operations.isCurrent(operation))
            persist({ ...(queueRef.current ?? queue), postedMeal });
        },
        feedback,
        submitFeedback: async (value) => {
          if (!operations.isCurrent(operation)) throw new Error('Meal screen closed');
          const latest = await convex.query(api.coachMeals.myDraft, {
            submissionId: queue.submissionId,
          });
          if (!operations.isCurrent(operation)) throw new Error('Meal screen closed');
          if (latest.draft?._id !== draftId || latest.draft.storageId !== storageId)
            throw new Error('Meal report changed');
          if (
            latest.draft.memberHelpful === value.helpful &&
            (latest.draft.memberCorrection ?? '') === value.correction.trim()
          )
            return;
          await submitMealFeedback({ draftId, ...value });
        },
      });
      if (!operations.isCurrent(operation)) return;
      if (queueKey) removeData(queueKey);
      if (queue.uri) await FileSystem.deleteAsync(queue.uri, { idempotent: true }).catch(() => {});
      queueRef.current = null;
      setQueue(null);
      showPostedSuccess(result.pointsEarned, result.milestones);
    } catch {
      if (!operations.isCurrent(operation)) return;
      setError(
        queueRef.current?.postedMeal
          ? 'Your meal is shared. Private feedback could not be saved. Tap Share meal to retry only your feedback.'
          : 'Could not share. Your photo, caption and private feedback are saved for retry.'
      );
    } finally {
      if (operations.isCurrent(operation)) {
        operations.end(operation);
        setBusy(false);
      }
    }
  };

  const retakePhoto = async () => {
    if (queue && workoutUploadPending(queue.submissionId)) {
      setError('Your video is uploading in the background. Please wait until it finishes.');
      return;
    }
    if (!queue || queue.postedMeal || meal?.draft?.status === 'shared') return;
    if (closing.current) return;
    const operation = operations.begin();
    if (operation === null) return;
    setBusy(true);
    setError('');
    try {
      if (queue.storageId) {
        if (category === 'meals') await retakeMeal({ submissionId: queue.submissionId });
        else await retakeProof({ submissionId: queue.submissionId });
      }
      if (!operations.isCurrent(operation)) return;
      setPlateDescription('');
      persist({
        ...queue,
        plateDescription: undefined,
        storageId: undefined,
        uri: undefined,
        captureId: undefined,
        mealFeedback: undefined,
        postedMeal: undefined,
        shareWithoutAnalysis: undefined,
      });
      if (queue.uri) await FileSystem.deleteAsync(queue.uri, { idempotent: true }).catch(() => {});
      if (!operations.isCurrent(operation)) return;
      setCameraMode(queue.mediaType === 'video' ? 'video' : 'picture');
      setCameraReady(false);
      setPhotoPreviewError(false);
      setShowCamera(true);
    } catch {
      if (!operations.isCurrent(operation)) return;
      setError('Could not retake the photo. Please try again.');
    } finally {
      if (operations.isCurrent(operation)) {
        operations.end(operation);
        setBusy(false);
      }
    }
  };

  if (!today || !currentUser) return <ScreenLoading />;
  if (queue && workoutUploadPending(queue.submissionId)) {
    return (
      <View style={{ flex: 1, padding: 22, gap: 20 }}>
        <CheckInHeader title="Log a workout" onBack={onClose} />
        <Text style={type.body}>
          Uploading your video. Please keep the app open until it finishes.
        </Text>
        <PrototypeButton label="Back to Today" onPress={onClose} />
      </View>
    );
  }
  const ready = today.status === 'no_plan' || (today.status === 'ready' && Boolean(assignment));
  const mealAnalysisLimitReached =
    category === 'meals' && mode === 'post' && (!meal || meal.analysisLimitReached);
  const hasMealReport =
    (meal?.draft?.status === 'ready' || meal?.draft?.status === 'shared') &&
    Boolean(meal.draft.verdict);
  const showingMealAnalysis =
    !hasMealReport && (scanningMeal || meal?.draft?.status === 'analyzing');
  let primaryLabel = 'Close';
  let primaryAction: () => void = onClose;
  let showPrimaryAction = true;
  if (mode === 'post' && queue && today.status !== 'locked') {
    if (!queue.uri && !queue.storageId) {
      primaryLabel = queue.mediaType === 'video' ? 'Record video' : 'Take live photo';
      primaryAction = () => {
        setCameraMode(queue.mediaType === 'video' ? 'video' : 'picture');
        setCameraReady(false);
        setShowCamera(true);
      };
    } else if (category === 'meals') {
      if (
        meal?.draft?.status === 'shared' ||
        (meal?.draft?.status === 'ready' && meal.draft.verdict)
      ) {
        primaryLabel = 'Share meal';
        primaryAction = () =>
          publishMeal(meal?.draft?.status === 'shared' && queue.shareWithoutAnalysis === true);
      } else if (mealAnalysisLimitReached) {
        showPrimaryAction = false;
      } else if (!queue.storageId && queue.uri) {
        primaryLabel = 'Analyse meal using AI';
        primaryAction = scanMeal;
      } else if (meal?.draft?.status === 'ready' && !meal.draft.verdict) {
        primaryLabel = 'Retake photo';
        primaryAction = retakePhoto;
      } else if (meal?.draft?.status === 'analyzing') {
        primaryLabel = meal.canRetryAnalysis ? 'Retry analysis' : 'Analysing meal…';
        if (meal.canRetryAnalysis) primaryAction = scanMeal;
      } else if (queue.storageId) {
        primaryLabel =
          meal?.draft?.status === 'failed' ? 'Retry analysis' : 'Analyse meal using AI';
        primaryAction = scanMeal;
      }
    } else if (queue.uri || queue.storageId) {
      primaryLabel = 'Share activity';
      primaryAction = publishProof;
    }
  } else if (!ready) {
    primaryLabel = 'Get today’s plan';
    primaryAction = () => onOpenPlan(today.status);
  } else if (queue?.uri || queue?.storageId) {
    primaryLabel = 'Continue check-in';
    primaryAction = () => onCaptured?.();
  }
  const canTakeLivePhoto = canStartCoachLivePhoto(
    category,
    mode,
    today.status,
    assignment
      ? { ...assignment, mandatory: true }
      : today.status === 'no_plan'
        ? { mandatory: true, consumedCount: 0 }
        : undefined,
    Boolean(queue?.uri || queue?.storageId)
  );
  const showFooter = mode === 'post' || Boolean(queue?.uri || queue?.storageId);
  const canShareMealWithoutAnalysis =
    mode === 'post' &&
    category === 'meals' &&
    Boolean(queue?.uri || queue?.storageId) &&
    meal?.draft?.status !== 'analyzing';
  const points = coachCheckInPoints(category);
  const fixedTitle =
    category === 'workout'
      ? (assignment?.label ?? 'Log a workout')
      : category === 'steps'
        ? `Hit ${(assignment?.stepTarget ?? 8000).toLocaleString('en-US')} Steps`
        : category === 'sleep'
          ? 'Log your sleep'
          : 'Log Your Meals';
  const fixedInstruction =
    category === 'workout'
      ? 'Snap a picture of your smartwatch or record a video showing your workout today.'
      : category === 'steps'
        ? 'Snap a picture of your smartwatch showing you met your steps target.'
        : category === 'sleep'
          ? "Snap a picture of your smartwatch showing last night's sleep."
          : 'Snap a clear picture of your plate and your AI coach will check how it fits your goals.';
  if (viewedMeal) {
    return (
      <View style={{ flex: 1, backgroundColor: '#fff' }}>
        <CheckInHeader title="Meal feedback" onBack={() => setViewedMealId(null)} />
        <ScrollView contentContainerStyle={{ padding: 22, paddingBottom: 32 }}>
          {viewedMeal.imageUrl ? (
            <Image
              source={{ uri: viewedMeal.imageUrl }}
              style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: 22 }}
            />
          ) : null}
          <Text style={[type.sheetSectionHeading, { marginTop: 24 }]}>Private feedback</Text>
          {viewedMeal.verdict ? (
            <Text style={[chrome.badgeText, { marginTop: 8 }]}>{viewedMeal.verdict}</Text>
          ) : null}
          <Text style={[type.explanation, { marginTop: 14 }]}>
            {viewedMeal.feedback ?? 'This meal was shared without AI analysis.'}
          </Text>
          {viewedMeal.nextMeal ? (
            <Text style={[type.explanation, { marginTop: 16 }]}>{viewedMeal.nextMeal}</Text>
          ) : null}
        </ScrollView>
      </View>
    );
  }
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: '#fff',
        paddingLeft: mode === 'details' ? insets.left : 0,
        paddingRight: mode === 'details' ? insets.right : 0,
      }}>
      <View onLayout={(event) => setHeaderHeight(event.nativeEvent.layout.height)}>
        {mode === 'post' ? (
          <CheckInHeader
            title={
              category === 'meals'
                ? 'Log a meal'
                : category === 'workout'
                  ? 'Log a workout'
                  : 'Log Activity'
            }
            onBack={onClose}
          />
        ) : (
          <CheckInSheetHeader onClose={closeSheet} circularBack={category === 'meals'} />
        )}
      </View>
      {showCamera ? (
        <View style={{ flex: 1, backgroundColor: '#1a1a1a' }}>
          <CameraKeepAwake />
          <View style={{ flex: 1, overflow: 'hidden' }} pointerEvents="none">
            <CameraView
              key={cameraViewKey}
              ref={camera}
              style={StyleSheet.absoluteFillObject}
              onCameraReady={() => {
                if (activeCameraSession.current !== cameraSessionKey) return;
                setCameraReady(true);
                setCameraStartupError('');
              }}
              onMountError={() => {
                if (activeCameraSession.current !== cameraSessionKey) return;
                setCameraReady(false);
                setCameraStartupError('Camera could not start. Please try again.');
              }}
              facing={cameraFacing}
              mode={cameraMode}
              mute={audioMuted}
              animateShutter={false}
              videoQuality="720p"
              videoBitrate={2_000_000}
            />
          </View>
          <RecordingOverlay
            prototype
            countdown={countdown}
            recording={recording}
            elapsed={elapsed}
            audioMuted={audioMuted}
            onToggleAudio={
              cameraMode === 'video'
                ? async () => {
                    if (busy || countdownActive.current || recordingActive.current) return;
                    if (
                      audioMuted &&
                      !(
                        microphonePermission?.granted ||
                        (await requestMicrophonePermission()).granted
                      )
                    ) {
                      setError('Microphone access is needed to record audio.');
                      return;
                    }
                    setError('');
                    setAudioMuted((value) => !value);
                  }
                : undefined
            }
            onFlip={() => {
              if (busy || countdownActive.current || recordingActive.current) return;
              startupRecoveryAttempts.current = 0;
              setCameraReady(false);
              setCameraFacing((value) => (value === 'back' ? 'front' : 'back'));
            }}
          />
          <View style={[chrome.footer, { zIndex: 40 }]}>
            {Boolean(cameraStartupError || error) && (
              <Text accessibilityRole="alert" style={type.error}>
                {cameraStartupError || error}
              </Text>
            )}
            {cameraStartupError ? (
              <PrototypeButton
                label="Retry camera"
                onPress={() => {
                  startupRecoveryAttempts.current = 0;
                  setCameraReady(false);
                  setCameraStartupError('');
                  setCameraAttempt((value) => value + 1);
                }}
              />
            ) : (
              <PrototypeButton
                label={
                  cameraMode === 'video'
                    ? recording
                      ? 'Stop recording'
                      : countdown
                        ? 'Get ready…'
                        : !cameraReady
                          ? 'Preparing camera…'
                          : 'Start recording'
                    : 'Take live photo'
                }
                loading={busy && !recording}
                disabled={
                  (cameraMode === 'video' && !cameraReady && !recording) ||
                  countdown !== null ||
                  (busy && !recording)
                }
                onPress={
                  cameraMode === 'video'
                    ? recording
                      ? () => camera.current?.stopRecording()
                      : startCountdown
                    : capture
                }
              />
            )}
          </View>
        </View>
      ) : (
        <>
          <KeyboardAwareScrollView
            style={{ flex: 1 }}
            bottomOffset={footerHeight + 24}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={(_, height) => setContentHeight(height)}
            contentContainerStyle={{
              paddingHorizontal: 22,
              paddingTop: mode === 'post' ? 12 : 16,
              paddingBottom: mode === 'post' ? 24 : category === 'meals' ? 8 : 40,
            }}>
            {mode === 'post' ? (
              queue && today.status !== 'locked' ? (
                <>
                  {category !== 'meals' || !meal?.draft?.verdict ? (
                    <>
                      <View
                        style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
                        <Text style={type.supporting}>
                          {category === 'meals' && supportsClientUpdate
                            ? "What's on your plate?"
                            : 'Caption'}
                        </Text>
                        <Text style={[type.caption, { color: colors.subtle }]}>
                          {category === 'meals' && supportsClientUpdate
                            ? 'Optional'
                            : `${caption.length}/150`}
                        </Text>
                      </View>
                      <TextInput
                        editable={!busy && !queue.postedMeal && meal?.draft?.status !== 'shared'}
                        value={
                          category === 'meals' && supportsClientUpdate ? plateDescription : caption
                        }
                        onChangeText={(value) => {
                          if (category === 'meals' && supportsClientUpdate) {
                            setPlateDescription(value);
                            persist({ ...(queueRef.current ?? queue), plateDescription: value });
                            return;
                          }
                          setCaption(value);
                          persist({ ...(queueRef.current ?? queue), caption: value });
                        }}
                        onEndEditing={() => {
                          const save =
                            category === 'meals'
                              ? queue.storageId &&
                                !queue.postedMeal &&
                                meal?.draft?.status !== 'shared'
                                ? saveMealCaption({
                                    submissionId: queue.submissionId,
                                    caption,
                                    ...(supportsClientUpdate ? { plateDescription } : {}),
                                  })
                                : Promise.resolve()
                              : saveProofCaption({ submissionId: queue.submissionId, caption });
                          save.catch(() => {});
                        }}
                        placeholder={
                          category === 'meals' && supportsClientUpdate
                            ? 'Describe the food on your plate'
                            : 'Add a caption'
                        }
                        placeholderTextColor={colors.subtle}
                        accessibilityLabel={
                          category === 'meals' && supportsClientUpdate
                            ? "What's on your plate?"
                            : 'Check-in caption'
                        }
                        multiline
                        maxLength={category === 'meals' && supportsClientUpdate ? 500 : 150}
                        style={chrome.caption}
                      />
                    </>
                  ) : null}
                  {queue.uri || proofImage ? (
                    <View style={{ position: 'relative', marginTop: 20 }}>
                      {queue.mediaType === 'video' ? (
                        <CheckInVideoPreview uri={(queue.uri ?? proofImage)!} />
                      ) : (
                        <Image
                          key={queue.captureId ?? queue.uri ?? queue.storageId}
                          source={{ uri: queue.uri ?? proofImage ?? undefined }}
                          style={{
                            width: '100%',
                            aspectRatio: 4 / 5,
                            borderRadius: 22,
                            backgroundColor: colors.secondary,
                          }}
                          resizeMode="cover"
                          onLoad={() => {
                            if (
                              queueRef.current?.uri === queue.uri &&
                              queueRef.current?.storageId === queue.storageId
                            )
                              setPhotoPreviewError(false);
                          }}
                          onError={() => {
                            if (
                              queueRef.current?.uri === queue.uri &&
                              queueRef.current?.storageId === queue.storageId
                            )
                              setPhotoPreviewError(true);
                          }}
                        />
                      )}
                      {photoPreviewError && queue.mediaType !== 'video' ? (
                        <View
                          style={[
                            StyleSheet.absoluteFillObject,
                            {
                              alignItems: 'center',
                              justifyContent: 'center',
                              borderRadius: 22,
                              backgroundColor: colors.secondary,
                              padding: 20,
                            },
                          ]}>
                          <Text style={[type.supporting, { textAlign: 'center' }]}>
                            Photo preview unavailable. Remove it and take another photo.
                          </Text>
                        </View>
                      ) : null}
                      <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityLabel={
                          queue.mediaType === 'video'
                            ? 'Remove video and retake'
                            : 'Remove photo and retake'
                        }
                        disabled={
                          busy || Boolean(queue.postedMeal) || meal?.draft?.status === 'shared'
                        }
                        onPress={retakePhoto}
                        style={{
                          position: 'absolute',
                          right: 10,
                          top: 10,
                          width: 44,
                          height: 44,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}>
                        <View
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 18,
                            backgroundColor: 'rgba(0,0,0,0.5)',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}>
                          <X size={16} color="#fff" />
                        </View>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel="Retake missing photo"
                      disabled={busy}
                      onPress={retakePhoto}
                      style={{
                        marginTop: 20,
                        borderRadius: 22,
                        backgroundColor: colors.secondary,
                        padding: 20,
                      }}>
                      <Text style={type.body}>
                        The local photo is unavailable. Tap to retake it before posting.
                      </Text>
                    </TouchableOpacity>
                  )}
                  {category === 'meals' ? (
                    <View style={{ marginTop: 26 }}>
                      {showingMealAnalysis ? <MealAnalysisLoading /> : null}
                      {(meal?.draft?.status === 'ready' || meal?.draft?.status === 'shared') &&
                      meal.draft.verdict ? (
                        <View>
                          <View
                            style={{
                              flexDirection: 'row',
                              flexWrap: 'wrap',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: 12,
                            }}>
                            <Text style={type.sheetSectionHeading}>Private feedback</Text>
                            <View style={chrome.badge}>
                              <Text style={[chrome.badgeText, { fontSize: 13 }]}>
                                {meal.draft.verdict}
                              </Text>
                            </View>
                          </View>
                          <Text style={[type.caption, { color: colors.subtle, marginTop: 2 }]}>
                            {meal.scanCount ?? 0} of 3 checked
                          </Text>
                          <Text style={[type.explanation, { marginTop: 14 }]}>
                            {meal.draft.feedback}
                          </Text>
                          {meal.draft.nextMeal ? (
                            <Text style={[type.explanation, { marginTop: 16 }]}>
                              {meal.draft.nextMeal}
                            </Text>
                          ) : null}
                          <MealReportFeedback
                            key={meal.draft._id}
                            draft={meal.draft}
                            busy={busy}
                            value={
                              queue.mealFeedback?.draftId === meal.draft._id
                                ? queue.mealFeedback
                                : {
                                    helpful: meal.draft.memberHelpful,
                                    correction: meal.draft.memberCorrection ?? '',
                                  }
                            }
                            onChange={(value) => {
                              if (queueRef.current?.storageId !== meal.draft?.storageId) return;
                              persist({
                                ...(queueRef.current ?? queue),
                                mealFeedback: { draftId: meal.draft!._id, ...value },
                              });
                            }}
                          />
                        </View>
                      ) : meal?.draft?.status === 'ready' ? (
                        <View style={{ gap: 8 }}>
                          <Text style={type.sheetSectionHeading}>Unable to assess a meal</Text>
                          <Text style={type.body}>
                            Please retake the photo or try the analysis again.
                          </Text>
                          <Text style={type.supporting}>
                            This did not use a successful scan. Retake or try again with a clearer
                            meal photo.
                          </Text>
                        </View>
                      ) : meal?.draft?.status === 'failed' ? (
                        <View
                          style={{
                            borderRadius: 22,
                            backgroundColor: colors.secondary,
                            padding: 18,
                            gap: 8,
                          }}>
                          <Text style={type.sheetSectionHeading}>Portion check unavailable</Text>
                          <Text style={type.body}>
                            Your photo and caption are safe. Retry the check or share your meal
                            without it.
                          </Text>
                        </View>
                      ) : !busy && meal?.draft?.status !== 'analyzing' ? (
                        <Text style={type.caption}>{meal?.scanCount ?? 0} of 3 checked</Text>
                      ) : null}
                    </View>
                  ) : null}
                </>
              ) : (
                <Text style={type.body}>
                  {today.status === 'locked'
                    ? 'Premium access is required to post this check-in.'
                    : 'No photo is ready for this check-in. Go back and take a live photo.'}
                </Text>
              )
            ) : ready ? (
              <>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'flex-start',
                    gap: 12,
                    justifyContent: 'space-between',
                  }}>
                  <Text style={[type.checkInSheetHeading, { flex: 1 }]}>
                    {category === 'workout'
                      ? 'Log a workout'
                      : category === 'meals'
                        ? 'Log a meal'
                        : fixedTitle}
                    {category === 'meals' ? (
                      <Text style={[type.supporting, { color: '#8A8A8A' }]}>
                        {'  '}
                        {mealHistory?.count ?? assignment?.consumedCount ?? 0}/3
                      </Text>
                    ) : null}
                  </Text>
                  <View style={[chrome.badge, { marginTop: 4 }]}>
                    <Text style={chrome.badgeText}>
                      +{points} {pointsLabel(points)}
                    </Text>
                  </View>
                </View>
                {category === 'workout' && assignment?.label ? (
                  <Text style={[type.supporting, { marginTop: 8 }]}>{assignment.label}</Text>
                ) : null}
                <Text style={[type.body, { marginTop: 10 }]}>{fixedInstruction}</Text>
                {category === 'meals' && mealHistory?.items.length ? (
                  <View style={{ flexDirection: 'row', gap: 12, marginTop: 20 }}>
                    {mealHistory.items.map((item, index) => (
                      <TouchableOpacity
                        key={item.activityId}
                        accessibilityRole="button"
                        accessibilityLabel={`Read feedback for meal ${index + 1}`}
                        onPress={() => setViewedMealId(item.activityId)}
                        style={{
                          flex: 1,
                          maxWidth: 100,
                          aspectRatio: 1,
                          borderRadius: 16,
                          overflow: 'hidden',
                          backgroundColor: '#F2F2F2',
                        }}>
                        {item.imageUrl ? (
                          <Image
                            source={{ uri: item.imageUrl }}
                            style={{ width: '100%', height: '100%' }}
                          />
                        ) : (
                          <Text>Meal {index + 1}</Text>
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : null}
                <View style={{ marginTop: 24, gap: 12 }}>
                  {canTakeLivePhoto || category === 'meals' ? (
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel="Take live photo"
                      accessibilityState={{
                        disabled: busy || !canTakeLivePhoto || (mealHistory?.count ?? 0) >= 3,
                        busy,
                      }}
                      disabled={busy || !canTakeLivePhoto || (mealHistory?.count ?? 0) >= 3}
                      onPress={() => {
                        start('image').catch(() => {});
                      }}
                      style={[
                        chrome.actionCard,
                        (busy || !canTakeLivePhoto || (mealHistory?.count ?? 0) >= 3) && {
                          opacity: 0.4,
                        },
                      ]}>
                      <View style={components.iconTile}>
                        <Camera size={24} color={colors.icon} />
                      </View>
                      <View style={{ flex: 1, gap: 1 }}>
                        <Text style={type.cardTitle}>Take live photo</Text>
                        <Text style={type.caption}>Use the in-app camera</Text>
                      </View>
                      {busy ? <ActivityIndicator color={colors.ink} /> : null}
                    </TouchableOpacity>
                  ) : null}
                  {category === 'workout' && canTakeLivePhoto ? (
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel="Record video"
                      accessibilityState={{ disabled: busy, busy }}
                      disabled={busy}
                      onPress={() => {
                        start('video').catch(() => {});
                      }}
                      style={[chrome.actionCard, busy && { opacity: 0.6 }]}>
                      <View style={components.iconTile}>
                        <VideoCamera size={24} color={colors.icon} />
                      </View>
                      <View style={{ flex: 1, gap: 1 }}>
                        <Text style={type.cardTitle}>Record video</Text>
                        <Text style={type.caption}>Record your proof · 1min max</Text>
                      </View>
                    </TouchableOpacity>
                  ) : null}
                </View>
                {category === 'meals' ? (
                  <TouchableOpacity
                    accessibilityRole="button"
                    onPress={() => setShowMealGuide(true)}
                    style={{
                      minHeight: 44,
                      marginTop: 12,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                    <Text style={type.supporting}>How to take the picture</Text>
                  </TouchableOpacity>
                ) : null}
                {error && !showFooter ? (
                  <Text accessibilityRole="alert" style={[type.error, { marginTop: 12 }]}>
                    {error}
                  </Text>
                ) : null}
              </>
            ) : (
              <View style={{ gap: 12 }}>
                <Text style={type.checkInSheetHeading}>Get today’s plan first</Text>
                <Text style={type.body}>A ready plan is needed for personalised check-ins.</Text>
              </View>
            )}
          </KeyboardAwareScrollView>
          {showFooter ? (
            <KeyboardStickyView offset={{ opened: insets.bottom }}>
              <View
                onLayout={(event) => setFooterHeight(event.nativeEvent.layout.height)}
                style={chrome.footer}>
                {error ? (
                  <Text accessibilityRole="alert" style={type.error}>
                    {error}
                  </Text>
                ) : null}
                {showPrimaryAction ? (
                  <PrototypeButton
                    label={primaryLabel}
                    loading={busy}
                    disabled={
                      busy ||
                      (mode === 'post' &&
                        (!queue ||
                          today.status === 'locked' ||
                          (meal?.draft?.status === 'analyzing' && !meal.canRetryAnalysis)))
                    }
                    onPress={primaryAction}
                  />
                ) : null}
                {canShareMealWithoutAnalysis ? (
                  <PrototypeButton
                    label="Share without AI analysis"
                    secondary
                    disabled={
                      busy || Boolean(queue?.postedMeal) || meal?.draft?.status === 'shared'
                    }
                    onPress={() => publishMeal(true)}
                  />
                ) : null}
              </View>
            </KeyboardStickyView>
          ) : null}
        </>
      )}
      <Modal
        visible={showMealGuide}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMealGuide(false)}>
        <View
          style={{
            flex: 1,
            justifyContent: 'center',
            paddingHorizontal: 24,
            backgroundColor: 'rgba(0,0,0,0.5)',
          }}>
          <View
            accessibilityViewIsModal
            style={{ backgroundColor: '#fff', borderRadius: 30, padding: 22, gap: 14 }}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Close photo guidance"
              onPress={() => setShowMealGuide(false)}
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: '#F2F2F2',
                alignSelf: 'flex-end',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <X size={24} color={colors.ink} />
            </TouchableOpacity>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1, aspectRatio: 1, overflow: 'hidden', borderRadius: 20 }}>
                <GuideImage
                  source={require('~/assets/meal-photo-dark.jpeg')}
                  contentFit="contain"
                  style={{ width: '100%', height: '100%' }}
                  accessible
                  accessibilityLabel="Too dark: a dim meal photo marked with a cross."
                />
              </View>
              <View style={{ flex: 1, aspectRatio: 1, overflow: 'hidden', borderRadius: 20 }}>
                <GuideImage
                  source={require('~/assets/meal-photo-bright.jpeg')}
                  contentFit="contain"
                  style={{ width: '100%', height: '100%' }}
                  accessible
                  accessibilityLabel="Bright, from above: the full plate clearly visible, marked with a check."
                />
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Text style={[type.smallCaption, { flex: 1, textAlign: 'center', color: '#C43D4B' }]}>
                Too dark
              </Text>
              <Text style={[type.smallCaption, { flex: 1, textAlign: 'center', color: '#258653' }]}>
                Bright, from above
              </Text>
            </View>
            <Text style={type.caption}>
              Use good light, hold your camera above the plate and keep the whole meal in view.
            </Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}
