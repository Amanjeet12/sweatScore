import { useAuthToken } from '@convex-dev/auth/react';
import { useAction, useConvex, useMutation, useQuery } from 'convex/react';
import { FunctionReturnType } from 'convex/server';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system';
import { Camera, VideoCamera, X } from 'phosphor-react-native';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  StyleSheet,
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
import { pointsLabel } from '~/shared/pointsLabel';
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
  uri?: string;
  storageId?: Id<'_storage'>;
  mediaType?: 'image' | 'video';
  caption?: string;
};

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
  const [queue, setQueue] = useState<ProofQueue | null>(null);
  const [showCamera, setShowCamera] = useState(false);
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
  const cameraSessionKey = `${cameraFacing}-${cameraMode}-${cameraAttempt}`;
  useEffect(() => {
    setCameraStartupError('');
    if (!showCamera || cameraReady || cameraMode === 'picture') return;
    const timer = setTimeout(() => {
      setCameraStartupError('Camera is taking too long to get ready. Please retry.');
    }, 12000);
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
  const [error, setError] = useState('');
  const [caption, setCaption] = useState('');
  const [mealRefresh, setMealRefresh] = useState(0);
  const [headerHeight, setHeaderHeight] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  const [footerHeight, setFooterHeight] = useState(0);
  const closing = useRef(false);
  useEffect(() => {
    if (headerHeight && contentHeight)
      onPreferredHeightChange?.(headerHeight + contentHeight + footerHeight + 12);
  }, [headerHeight, contentHeight, footerHeight, onPreferredHeightChange]);
  useEffect(() => {
    onExpandedChange?.(showCamera);
  }, [showCamera, onExpandedChange]);
  const meal = useQuery(
    api.coachMeals.myDraft,
    category === 'meals' && queue?.submissionId
      ? { submissionId: queue.submissionId, refresh: mealRefresh }
      : 'skip'
  );
  useEffect(() => {
    if (meal?.draft?.status !== 'analyzing') return;
    const timer = setInterval(() => setMealRefresh((value) => value + 1), 15_000);
    return () => clearInterval(timer);
  }, [meal?.draft?.status]);
  const proofImage = useQuery(
    api.coachCheckIns.myProofImage,
    mode === 'post' && queue?.storageId ? { submissionId: queue.submissionId } : 'skip'
  );
  useEffect(() => {
    if (meal?.draft?.caption && !caption) setCaption(meal.draft.caption);
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
    convex
      .query(api.coachCheckIns.mySubmission, { submissionId: saved.submissionId })
      .then((server) => {
        if (
          server.assignmentId === saved.assignmentId &&
          server.planRevisionId === saved.planRevisionId &&
          server.recommendation === saved.recommendation &&
          server.state !== 'completed' &&
          server.state !== 'reversed'
        ) {
          const recovered = server.storageId ? { ...saved, storageId: server.storageId } : saved;
          const recoveredCaption =
            recovered.caption ??
            server.caption ??
            (category === 'meals'
              ? 'Plate full of goodness ✌️'
              : randomCoachCheckInCaption(category));
          const nextRecovered = { ...recovered, caption: recoveredCaption };
          setQueue(nextRecovered);
          setCaption(recoveredCaption);
          storeData(queueKey, nextRecovered);
        } else removeData(queueKey);
      })
      .catch(() => {
        // A temporary entitlement or network failure must not erase pinned local proof.
      });
  }, [category, convex, currentUser?._id, queueKey, today?.day]);

  const persist = (next: ProofQueue) => {
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
      setError('Could not start check-in. Please try again.');
    } finally {
      setBusy(false);
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
    // The native photo output validates readiness even if iOS loses onCameraReady.
    photoCaptureActive.current = true;
    setBusy(true);
    setError('');
    try {
      const photo = await camera.current.takePictureAsync({ quality: 0.8, shutterSound: false });
      if (!photo?.uri) throw new Error('Camera did not return a photo');
      const capturedFile = await FileSystem.getInfoAsync(photo.uri);
      if (!capturedFile.exists || !capturedFile.size) throw new Error('Empty camera photo');
      const uri = `${FileSystem.documentDirectory}coach-proof-${queue.submissionId}.jpg`;
      await FileSystem.deleteAsync(uri, { idempotent: true });
      await FileSystem.copyAsync({ from: photo.uri, to: uri });
      const nextCaption = caption.trim()
        ? caption
        : category === 'meals'
          ? 'Plate full of goodness ✌️'
          : randomCoachCheckInCaption(category);
      setCaption(nextCaption);
      persist({ ...queue, uri, caption: nextCaption });
      setPhotoPreviewError(false);
      setShowCamera(false);
      if (mode === 'details' && !closing.current) onCaptured?.();
    } catch {
      setError('Could not save the photo. Please try again.');
    } finally {
      photoCaptureActive.current = false;
      setBusy(false);
    }
  };

  const captureVideo = async () => {
    if (
      !queue ||
      !camera.current ||
      !FileSystem.documentDirectory ||
      closing.current ||
      recordingActive.current
    )
      return;
    recordingActive.current = true;
    recordingStarted.current = Date.now();
    setElapsed(0);
    setRecording(true);
    setError('');
    try {
      const video = await camera.current.recordAsync({ maxDuration: 60, maxFileSize: 19_000_000 });
      if (!video?.uri) return;
      const extension = video.uri.toLowerCase().endsWith('.mov') ? 'mov' : 'mp4';
      const uri = `${FileSystem.documentDirectory}coach-proof-${queue.submissionId}.${extension}`;
      await FileSystem.deleteAsync(uri, { idempotent: true });
      await FileSystem.copyAsync({ from: video.uri, to: uri });
      const nextCaption = caption.trim() ? caption : randomCoachCheckInCaption(category);
      setCaption(nextCaption);
      persist({ ...queue, uri, caption: nextCaption, mediaType: 'video' });
      setShowCamera(false);
      if (mode === 'details' && !closing.current) onCaptured?.();
    } catch {
      setError('Could not save the video. Please try again.');
    } finally {
      recordingActive.current = false;
      setRecording(false);
      setBusy(false);
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
        captureVideo().catch(() => {});
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const startCountdown = () => {
    if (!camera.current || busy || countdownActive.current || recordingActive.current) return;
    countdownActive.current = true;
    setError('');
    setCountdown(5);
  };

  const upload = async (): Promise<Id<'_storage'> | null> => {
    if (!queue?.uri) return null;
    setBusy(true);
    setError('');
    try {
      if (!authToken) throw new Error('Sign in again before uploading proof.');
      const siteUrl = process.env.EXPO_PUBLIC_CONVEX_URL?.replace('.convex.cloud', '.convex.site');
      if (!siteUrl) throw new Error('Proof upload service is unavailable.');
      const { token } = await issueUpload({
        submissionId: queue.submissionId,
        mediaType: queue.mediaType ?? 'image',
      });
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
      if (!result || result.status < 200 || result.status >= 300)
        throw new Error('Photo upload failed. Retry when connected.');
      const storageId = JSON.parse(result.body).storageId as Id<'_storage'> | undefined;
      if (!storageId) throw new Error('Photo upload did not return media identity.');
      persist({ ...queue, storageId });
      return storageId;
    } catch {
      try {
        const saved = await convex.query(api.coachCheckIns.mySubmission, {
          submissionId: queue.submissionId,
        });
        if (saved.state === 'uploaded' && saved.storageId) {
          persist({ ...queue, storageId: saved.storageId });
          return saved.storageId;
        }
      } catch {
        /* Keep the local queue for an offline retry. */
      }
      setError('Upload failed. Your photo is saved for retry.');
      return null;
    } finally {
      setBusy(false);
    }
  };

  const publishProof = async () => {
    if (!queue || category === 'meals') return;
    setBusy(true);
    setError('');
    try {
      await saveProofCaption({ submissionId: queue.submissionId, caption });
      const storageId = queue.storageId ?? (await upload());
      if (!storageId) return;
      const result = await complete({ submissionId: queue.submissionId, caption });
      if (queueKey) removeData(queueKey);
      if (queue.uri) await FileSystem.deleteAsync(queue.uri, { idempotent: true }).catch(() => {});
      setQueue(null);
      showPostedSuccess(result.pointsEarned, result.milestones);
    } catch {
      setError('Could not post. Your photo is saved for retry.');
    } finally {
      setBusy(false);
    }
  };

  const scanMeal = async () => {
    if (!queue) return;
    setBusy(true);
    setError('');
    try {
      const storageId = queue.storageId ?? (await upload());
      if (!storageId) return;
      const draftId = await saveMealCaption({ submissionId: queue.submissionId, caption });
      const result = await analyzeMeal({
        draftId,
        requestKey: Crypto.randomUUID().replaceAll('-', ''),
      });
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
      setBusy(false);
    }
  };

  const publishMeal = async (skipAnalysis = false) => {
    if (!queue) return;
    setBusy(true);
    setError('');
    try {
      const storageId = queue.storageId ?? (await upload());
      if (!storageId) return;
      const draftId =
        meal?.draft?._id ?? (await saveMealCaption({ submissionId: queue.submissionId, caption }));
      const result = await shareMeal({ draftId, caption, skipAnalysis: skipAnalysis || undefined });
      if (queueKey) removeData(queueKey);
      if (queue.uri) await FileSystem.deleteAsync(queue.uri, { idempotent: true }).catch(() => {});
      setQueue(null);
      showPostedSuccess(result.pointsEarned, result.milestones);
    } catch {
      setError('Could not share. Your photo and caption are saved.');
    } finally {
      setBusy(false);
    }
  };

  const retakePhoto = async () => {
    if (!queue) return;
    setBusy(true);
    setError('');
    try {
      if (queue.storageId) {
        if (category === 'meals') await retakeMeal({ submissionId: queue.submissionId });
        else await retakeProof({ submissionId: queue.submissionId });
      }
      if (queue.uri) await FileSystem.deleteAsync(queue.uri, { idempotent: true }).catch(() => {});
      persist({ ...queue, storageId: undefined, uri: undefined });
      setCameraMode(queue.mediaType === 'video' ? 'video' : 'picture');
      setCameraReady(false);
      setPhotoPreviewError(false);
      setShowCamera(true);
    } catch {
      setError('Could not retake the photo. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  if (!today || !currentUser) return <ScreenLoading />;
  const ready = today.status === 'no_plan' || (today.status === 'ready' && Boolean(assignment));
  const mealAnalysisLimitReached =
    category === 'meals' && mode === 'post' && (!meal || meal.analysisLimitReached);
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
      if (meal?.draft?.status === 'ready' && meal.draft.verdict) {
        primaryLabel = 'Share meal';
        primaryAction = () => publishMeal(false);
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
    assignment ?? (today.status === 'no_plan' ? { mandatory: true, consumedCount: 0 } : undefined),
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
        ? `Hit ${(assignment?.stepTarget ?? 10000).toLocaleString('en-US')} Steps`
        : category === 'sleep'
          ? 'Aim for 7 Hours Sleep'
          : 'Log Your Meals';
  const fixedInstruction =
    category === 'workout'
      ? 'Snap a picture of your smartwatch or record a video showing your workout today.'
      : category === 'steps'
        ? 'Snap a picture of your smartwatch showing you met your steps target.'
        : category === 'sleep'
          ? 'Snap a picture of your smartwatch showing you met your sleep target.'
          : 'Snap a picture of your meals to check in and get a private portion check using AI.';
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
          <CheckInSheetHeader onClose={closeSheet} />
        )}
      </View>
      {showCamera ? (
        <View style={{ flex: 1, backgroundColor: '#1a1a1a' }}>
          <View style={{ flex: 1, overflow: 'hidden' }} pointerEvents="none">
            <CameraView
              key={cameraSessionKey}
              ref={camera}
              style={StyleSheet.absoluteFillObject}
              onCameraReady={() => {
                setCameraReady(true);
                setCameraStartupError('');
              }}
              onMountError={() => {
                setCameraReady(false);
                setCameraStartupError('Camera could not start. Please try again.');
              }}
              facing={cameraFacing}
              mode={cameraMode}
              mute={audioMuted}
              animateShutter={false}
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
              if (busy) return;
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
              paddingBottom: mode === 'post' ? 24 : 40,
            }}>
            {mode === 'post' ? (
              queue && today.status !== 'locked' ? (
                <>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
                    <Text style={type.supporting}>Caption</Text>
                    <Text style={[type.caption, { color: colors.subtle }]}>
                      {caption.length}/150
                    </Text>
                  </View>
                  <TextInput
                    value={caption}
                    onChangeText={(value) => {
                      setCaption(value);
                      persist({ ...queue, caption: value });
                    }}
                    onEndEditing={() => {
                      const save =
                        category === 'meals'
                          ? queue.storageId
                            ? saveMealCaption({ submissionId: queue.submissionId, caption })
                            : Promise.resolve()
                          : saveProofCaption({ submissionId: queue.submissionId, caption });
                      save.catch(() => {});
                    }}
                    placeholder="Add a caption"
                    placeholderTextColor={colors.subtle}
                    accessibilityLabel="Check-in caption"
                    multiline
                    maxLength={150}
                    style={chrome.caption}
                  />
                  {queue.uri || proofImage ? (
                    <View style={{ position: 'relative', marginTop: 20 }}>
                      {queue.mediaType === 'video' ? (
                        <CheckInVideoPreview uri={(queue.uri ?? proofImage)!} />
                      ) : (
                        <Image
                          source={{ uri: queue.uri ?? proofImage ?? undefined }}
                          style={{
                            width: '100%',
                            aspectRatio: 4 / 5,
                            borderRadius: 22,
                            backgroundColor: colors.secondary,
                          }}
                          resizeMode="cover"
                          onLoad={() => setPhotoPreviewError(false)}
                          onError={() => setPhotoPreviewError(true)}
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
                        disabled={busy}
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
                      {busy || meal?.draft?.status === 'analyzing' ? <MealAnalysisLoading /> : null}
                      {meal?.draft?.status === 'ready' && meal.draft.verdict ? (
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
                            {meal.scanCount ?? 0} of 3 checked · Based only on food visible in this
                            photo
                          </Text>
                          <Text style={[type.explanation, { marginTop: 14 }]}>
                            {meal.draft.feedback}
                          </Text>
                          <MealReportFeedback key={meal.draft._id} draft={meal.draft} />
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
                <View style={{ marginTop: 24, gap: 12 }}>
                  {canTakeLivePhoto ? (
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel="Take live photo"
                      accessibilityState={{ disabled: busy, busy }}
                      disabled={busy}
                      onPress={() => {
                        start('image').catch(() => {});
                      }}
                      style={[chrome.actionCard, busy && { opacity: 0.6 }]}>
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
                      mode === 'post' &&
                      (!queue ||
                        today.status === 'locked' ||
                        (meal?.draft?.status === 'analyzing' && !meal.canRetryAnalysis))
                    }
                    onPress={primaryAction}
                  />
                ) : null}
                {canShareMealWithoutAnalysis ? (
                  <PrototypeButton
                    label="Share without AI analysis"
                    secondary
                    disabled={busy}
                    onPress={() => publishMeal(true)}
                  />
                ) : null}
              </View>
            </KeyboardStickyView>
          ) : null}
        </>
      )}
    </View>
  );
}
