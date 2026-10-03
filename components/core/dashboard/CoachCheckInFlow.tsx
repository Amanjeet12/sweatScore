import { useAuthToken } from '@convex-dev/auth/react';
import { useAction, useConvex, useMutation, useQuery } from 'convex/react';
import { FunctionReturnType } from 'convex/server';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system';
import {
  ArrowLeft,
  ArrowRight,
  ArrowSquareOut,
  Barbell,
  Camera,
  Footprints,
  ForkKnife,
  MoonStars,
  PlayCircle,
  VideoCamera,
  X,
} from 'phosphor-react-native';
import { useEffect, useRef, useState } from 'react';
import { Alert, Image, Linking, ScrollView, TextInput, TouchableOpacity, View } from 'react-native';

import CoachActionButton from '~/components/core/CoachActionButton';
import { RecordingOverlay } from '~/components/core/RecordingOverlay';
import ScreenLoading from '~/components/core/ScreenLoading';
import { ToastMessage } from '~/components/core/Toast';
import { CheckInVideoPreview } from '~/components/core/dashboard/CheckInVideoPreview';
import { useCelebration } from '~/components/providers/CelebrationProvider';
import { Text } from '~/components/ui/text';
import { useToast } from '~/components/ui/toast';
import { api } from '~/convex/_generated/api';
import { Id } from '~/convex/_generated/dataModel';
import {
  canStartCoachLivePhoto,
  checkInGuide,
  coachCheckInPoints,
  randomCoachCheckInCaption,
} from '~/shared/coachCheckInPresentation';
import { CoachCategory } from '~/shared/coachFoundation';
import { workoutYoutubeSearch } from '~/shared/coachYoutubeSearch';
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
  const { celebrateCompletion } = useCelebration();
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
  const camera = useRef<CameraView>(null);
  const [queue, setQueue] = useState<ProofQueue | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [cameraMode, setCameraMode] = useState<'picture' | 'video'>('picture');
  const [recording, setRecording] = useState(false);
  const [audioMuted, setAudioMuted] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [cameraFacing, setCameraFacing] = useState<'front' | 'back'>('back');
  const recordingStarted = useRef(0);
  const recordingActive = useRef(false);
  const countdownActive = useRef(false);
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
      void ensureStandaloneAssignments({}).catch(() =>
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

  const showPostedSuccess = (pointsEarned: number) => {
    onClose();
    setTimeout(() => {
      celebrateCompletion({ type: 'check_in', pointsEarned });
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
      setShowCamera(true);
    } catch {
      setError('Could not start check-in. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const capture = async () => {
    if (!queue || !camera.current || !FileSystem.documentDirectory) return;
    setBusy(true);
    setError('');
    try {
      const photo = await camera.current.takePictureAsync({ quality: 0.8, shutterSound: false });
      if (!photo?.uri) return;
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
      setShowCamera(false);
      if (mode === 'details' && !closing.current) onCaptured?.();
    } catch (cause) {
      setError('Could not save the photo. Please try again.');
    } finally {
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
    } catch (cause) {
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
      showPostedSuccess(result.pointsEarned);
    } catch (cause) {
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
      showPostedSuccess(result.pointsEarned);
    } catch (cause) {
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
      setShowCamera(true);
    } catch (cause) {
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
  const guide = assignment || queue ? checkInGuide(category, assignment ?? queue!, queue) : null;
  const workoutDetails = false;
  const workoutRewardUsed = Boolean(assignment && assignment.consumedCount >= 1);
  const workoutSearch =
    workoutDetails && assignment?.mandatory
      ? workoutYoutubeSearch(queue?.label ?? assignment?.label)
      : null;
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
  const openWorkoutSearch = async () => {
    if (!workoutSearch) return;
    try {
      await Linking.openURL(workoutSearch.url);
    } catch {
      Alert.alert('YouTube could not be opened. Please try again.');
    }
  };
  const Icon = {
    workout: Barbell,
    meals: ForkKnife,
    sleep: MoonStars,
    steps: Footprints,
  }[category];
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
    <View className="flex-1 bg-white">
      <View
        onLayout={(event) => setHeaderHeight(event.nativeEvent.layout.height)}
        className="border-b border-[#F0ECE9] px-6 pb-4 pt-3">
        {mode === 'post' ? (
          <View className="min-h-14 flex-row items-center justify-between">
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Back to Today"
              onPress={onClose}
              className="min-h-11 min-w-11 items-center justify-center rounded-full bg-[#F5F2F0]">
              <ArrowLeft size={21} color="#514943" />
            </TouchableOpacity>
            <Text
              className="flex-1 text-center font-heading text-xl font-semibold text-[#231F1D]"
              numberOfLines={2}>
              Log Activity
            </Text>
            <View className="w-11" accessibilityElementsHidden />
          </View>
        ) : (
          <>
            <View
              className="mb-3 h-1 w-10 self-center rounded-full bg-[#DDD8D4]"
              accessibilityElementsHidden
            />
            <View className="flex-row items-start justify-between">
              {ready ? (
                <View className="min-w-0 flex-1 flex-row items-center pr-3">
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Back to Today"
                    onPress={closeSheet}
                    className="h-11 w-8 items-center justify-center">
                    <ArrowLeft size={20} color="#FF5C35" />
                  </TouchableOpacity>
                  <Text className="ml-2 font-heading text-sm font-semibold tracking-wide text-[#E9512A]">
                    LOG ACTIVITY
                  </Text>
                </View>
              ) : workoutDetails ? (
                <View className="min-w-0 flex-1 pr-3">
                  <View className="flex-row flex-wrap items-center gap-2">
                    <Text className="font-heading text-xs font-semibold uppercase tracking-wider text-[#F45A2B]">
                      LOG ACTIVITY
                    </Text>
                    <View className="rounded-lg bg-[#F1EFED] px-2.5 py-1">
                      <Text className="font-body text-xs text-[#655B55]">
                        {assignment?.mandatory ? 'Required' : 'No proof required'}
                      </Text>
                    </View>
                  </View>
                  <Text className="mt-2 font-heading text-[22px] font-semibold leading-7 text-[#231F1D]">
                    Add your proof
                  </Text>
                  <Text className="mt-1 font-body text-sm leading-5 text-[#77716D]">
                    Take a live photo to record today’s workout.
                  </Text>
                </View>
              ) : (
                <View className="min-w-0 flex-1 flex-row items-center gap-x-3 pr-3">
                  <View className="h-10 w-10 items-center justify-center rounded-xl bg-[#FFF0E8]">
                    <Icon size={21} color="#F45A2B" weight="regular" />
                  </View>
                  <Text className="flex-1 font-heading text-xl font-semibold text-[#231F1D]">
                    {category[0].toUpperCase()}
                    {category.slice(1)} check-in
                  </Text>
                </View>
              )}
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Close check-in"
                onPress={closeSheet}
                className="min-h-11 min-w-11 items-center justify-center rounded-full bg-[#F5F2F0]">
                <X size={20} color="#514943" />
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
      {showCamera ? (
        <View className="flex-1">
          <CameraView
            ref={camera}
            style={{ flex: 1 }}
            facing={cameraFacing}
            mode={cameraMode}
            mute={audioMuted}
            animateShutter={false}
            videoBitrate={2_000_000}
          />
          <RecordingOverlay
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
              setCameraFacing((value) => (value === 'back' ? 'front' : 'back'));
            }}
          />
          <View className="m-5">
            <CoachActionButton
              label={
                cameraMode === 'video'
                  ? recording
                    ? 'Stop recording'
                    : countdown
                      ? 'Get ready…'
                      : 'Start recording'
                  : busy
                    ? 'Working…'
                    : 'Take live photo'
              }
              disabled={countdown !== null || (busy && !recording)}
              onPress={
                cameraMode === 'video'
                  ? recording
                    ? () => camera.current?.stopRecording()
                    : startCountdown
                  : capture
              }
            />
          </View>
        </View>
      ) : (
        <>
          <ScrollView
            className="flex-1"
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={(_, height) => setContentHeight(height)}
            contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 20, paddingBottom: 24 }}>
            {mode === 'post' ? (
              queue && today.status !== 'locked' ? (
                <>
                  <View>
                    <View className="flex-row items-start justify-between gap-4">
                      <View className="min-w-0 flex-1">
                        {category !== 'meals' && category !== 'workout' ? (
                          <Text className="font-body text-xs font-semibold uppercase tracking-widest text-[#E9512A]">
                            DAILY ACTIVITY
                          </Text>
                        ) : null}
                        <Text className="mt-2 font-heading text-xl font-semibold text-[#251E1A]">
                          {category === 'meals' ? 'Log a meal' : guide?.title}
                        </Text>
                      </View>
                      <Text className="font-heading text-base font-semibold text-[#E9512A]">
                        +{points} {pointsLabel(points)}
                      </Text>
                    </View>
                    <View className="mt-5 flex-row items-center justify-between">
                      <Text className="font-body text-sm font-medium text-[#514943]">Caption</Text>
                      <Text className="font-body text-xs text-[#8B817B]">{caption.length}/150</Text>
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
                      accessibilityLabel="Check-in caption"
                      multiline
                      maxLength={150}
                      className="mt-2 min-h-28 rounded-[24px] border border-[#DCD7D3] bg-white p-4 font-body text-base text-[#251E1A]"
                    />
                  </View>
                  {queue.uri || proofImage ? (
                    <View className="relative mt-5">
                      {queue.mediaType === 'video' ? (
                        <CheckInVideoPreview uri={(queue.uri ?? proofImage)!} />
                      ) : (
                        <Image
                          source={{ uri: queue.uri ?? proofImage ?? undefined }}
                          className="w-full rounded-[24px] bg-[#F4F1EE]"
                          style={{ aspectRatio: 4 / 5 }}
                          resizeMode="cover"
                        />
                      )}
                      <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityLabel={
                          queue.mediaType === 'video'
                            ? 'Remove video and retake'
                            : 'Remove photo and retake'
                        }
                        disabled={busy}
                        onPress={retakePhoto}
                        className="absolute right-3 top-3 min-h-11 min-w-11 items-center justify-center rounded-full bg-black/75">
                        <X size={22} color="#FFFFFF" />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel="Retake missing photo"
                      disabled={busy}
                      onPress={retakePhoto}
                      className="mt-5 rounded-2xl bg-[#F7F6F4] p-5">
                      <Text className="font-body text-[#655B55]">
                        The local photo is unavailable. Tap to retake it before posting.
                      </Text>
                    </TouchableOpacity>
                  )}
                  {category === 'meals' ? (
                    <View className="mt-5">
                      <View className="flex-row items-center justify-between">
                        <Text className="font-body text-xs font-semibold uppercase tracking-widest text-[#C9532B]">
                          AI MEAL ANALYSIS
                        </Text>
                        <Text className="font-body text-xs text-[#817772]">
                          {meal?.scanCount ?? 0} of 3 checked
                        </Text>
                      </View>
                      {busy ? (
                        <View className="mt-4 py-5">
                          <View className="flex-row items-center gap-3">
                            <View className="flex-1">
                              <Text className="font-heading text-lg font-semibold text-[#251E1A]">
                                Looking at your plate
                              </Text>
                              <Text className="mt-1 font-body text-sm text-[#655B55]">
                                Checking the visible balance and portions.
                              </Text>
                            </View>
                          </View>
                          <View className="mt-4 h-2 overflow-hidden rounded-full bg-[#F0D8CC]">
                            <View className="h-full w-1/2 rounded-full bg-[#FF5C35]" />
                          </View>
                        </View>
                      ) : null}
                      {meal?.draft?.status === 'ready' && meal.draft.verdict ? (
                        <View className="mt-4 rounded-[24px] bg-[#FFF6F1] p-5">
                          <View className="flex-row items-start justify-between">
                            <View className="flex-1 pr-3">
                              <Text className="font-heading text-base font-semibold text-[#251E1A]">
                                Private feedback
                              </Text>
                              <Text className="mt-1 font-body text-xs text-[#817772]">
                                Based only on food visible in this photo
                              </Text>
                            </View>
                            <View className="overflow-hidden rounded-full bg-[#FF5C35] px-2 py-1">
                              <Text className="font-heading text-xs font-semibold text-white">
                                {meal.draft.verdict}
                              </Text>
                            </View>
                          </View>
                          <Text className="mt-5 font-body text-base leading-6 text-[#514943]">
                            {meal.draft.feedback}
                          </Text>
                        </View>
                      ) : meal?.draft?.status === 'ready' ? (
                        <View className="mt-4 rounded-[20px] bg-[#F7F6F4] p-5">
                          <Text className="font-heading text-lg">Unable to assess a meal</Text>
                          <Text className="mt-2">
                            Please retake the photo or try the analysis again.
                          </Text>
                          <Text className="mt-2">
                            This did not use a successful scan. Retake or try again with a clearer
                            meal photo.
                          </Text>
                        </View>
                      ) : meal?.draft?.status === 'failed' ? (
                        <View className="mt-4 rounded-[20px] border border-[#E8E2DE] bg-[#FAF8F7] p-4">
                          <Text className="font-heading text-base font-semibold text-[#251E1A]">
                            Portion check unavailable
                          </Text>
                          <Text className="mt-1 font-body text-sm leading-5 text-[#655B55]">
                            Your photo and caption are safe. Retry the check or share your meal
                            without it.
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  ) : null}
                </>
              ) : (
                <Text className="font-body text-base text-[#655B55]">
                  {today.status === 'locked'
                    ? 'Premium access is required to post this check-in.'
                    : 'No photo is ready for this check-in. Go back and take a live photo.'}
                </Text>
              )
            ) : ready ? (
              <>
                <View className="flex-row items-start justify-between gap-x-4">
                  <Text className="min-w-0 flex-1 font-heading text-[22px] font-semibold text-black">
                    {fixedTitle}
                  </Text>
                  <Text className="shrink-0 pt-0.5 font-body text-lg text-[#E9512A]">
                    +{points} {pointsLabel(points)}
                  </Text>
                </View>
                <Text className="mt-4 font-body text-base leading-6 text-[#77716D]">
                  {fixedInstruction}
                </Text>
                {canTakeLivePhoto ? (
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Take live photo"
                    disabled={busy}
                    onPress={() => void start('image')}
                    className="mt-5 min-h-[80px] flex-row items-center rounded-[24px] border border-[#E6E2DF] bg-white px-4">
                    <View className="mr-4 h-12 w-12 items-center justify-center rounded-full bg-[#FFF5F0]">
                      <Camera size={25} color="#FF5C35" />
                    </View>
                    <View className="min-w-0 flex-1">
                      <Text className="font-heading text-base font-semibold">Take live photo</Text>
                      <Text className="mt-1 font-body text-sm text-[#77716D]">
                        Use the in-app camera
                      </Text>
                    </View>
                    <ArrowRight size={22} color="#FF5C35" />
                  </TouchableOpacity>
                ) : null}
                {category === 'workout' && canTakeLivePhoto ? (
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Record video"
                    disabled={busy}
                    onPress={() => void start('video')}
                    className="mt-2 min-h-[80px] flex-row items-center rounded-[24px] border border-[#E6E2DF] bg-white px-4">
                    <View className="mr-4 h-12 w-12 items-center justify-center rounded-full bg-[#FFF5F0]">
                      <VideoCamera size={25} color="#FF5C35" />
                    </View>
                    <View className="min-w-0 flex-1">
                      <Text className="font-heading text-base font-semibold">Record video</Text>
                      <Text className="mt-1 font-body text-sm text-[#77716D]">
                        Record your proof · 1min max
                      </Text>
                    </View>
                    <ArrowRight size={22} color="#FF5C35" />
                  </TouchableOpacity>
                ) : null}
                {error ? (
                  <Text
                    accessibilityLiveRegion="polite"
                    className="mt-3 font-body text-sm text-[#B8462A]">
                    {error}
                  </Text>
                ) : null}
              </>
            ) : today.status !== 'ready' || !assignment ? (
              <>
                <Text className="font-heading text-2xl">Get today’s plan first</Text>
                <Text className="mt-3">A ready plan is needed for personalised check-ins.</Text>
              </>
            ) : (
              <>
                {workoutDetails ? (
                  <View className="rounded-2xl bg-[#FFF8F4] p-4">
                    <View className="flex-row items-start gap-3">
                      <View className="h-11 w-11 items-center justify-center rounded-xl bg-[#FFF0E8]">
                        <Barbell size={22} color="#F45A2B" />
                      </View>
                      <View className="min-w-0 flex-1">
                        <Text className="font-heading text-base font-semibold text-[#251E1A]">
                          {guide?.title}
                        </Text>
                        <Text className="mt-1 font-body text-sm leading-5 text-[#655B55]">
                          {queue?.recommendation ?? assignment.recommendation}
                        </Text>
                        <Text className="mt-2 font-body text-xs font-semibold text-[#C9532B]">
                          {workoutRewardUsed
                            ? 'Today’s workout reward has been used'
                            : assignment.mandatory
                              ? 'Reward available after live proof and posting'
                              : 'Rest guidance · no proof required'}
                        </Text>
                      </View>
                    </View>
                  </View>
                ) : (
                  <View className="rounded-3xl border border-[#F6DFD2] bg-[#FFF8F4] p-5">
                    <Text className="font-body text-xs font-semibold uppercase tracking-widest text-[#CA4E25]">
                      TODAY’S {category === 'meals' ? 'MEAL GUIDANCE' : 'RECOMMENDATION'}
                    </Text>
                    <Text className="mt-2 font-heading text-[23px] font-semibold leading-7 text-[#251E1A]">
                      {guide?.title}
                    </Text>
                    {guide?.recommendation ? (
                      <Text className="mt-3 font-body text-base leading-6 text-[#5F5752]">
                        {guide.recommendation}
                      </Text>
                    ) : null}
                  </View>
                )}
                {workoutSearch ? (
                  <View className="mt-4 rounded-2xl border border-[#E9DCD5] bg-white p-4">
                    <View className="flex-row items-start gap-3">
                      <View className="h-10 w-10 items-center justify-center rounded-xl bg-[#FFF0E8]">
                        <PlayCircle size={23} color="#F45A2B" />
                      </View>
                      <View className="min-w-0 flex-1">
                        <Text className="font-heading text-base font-semibold text-[#251E1A]">
                          Find a guided workout
                        </Text>
                        <Text className="mt-1 font-body text-sm leading-5 text-[#655B55]">
                          Search YouTube for “{workoutSearch.phrase}”
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      accessibilityRole="link"
                      accessibilityLabel={`Search on YouTube for ${workoutSearch.phrase}. Opens an external service.`}
                      onPress={openWorkoutSearch}
                      className="mt-4 min-h-12 flex-row items-center justify-center gap-2 rounded-xl border border-[#F0B99F] bg-[#FFF8F4] px-4 py-3">
                      <Text className="font-body text-sm font-semibold text-[#C9532B]">
                        Search on YouTube
                      </Text>
                      <ArrowSquareOut size={18} color="#C9532B" />
                    </TouchableOpacity>
                    <Text className="mt-2 font-body text-xs leading-4 text-[#77716D]">
                      Opens YouTube. Videos are provided by third parties.
                    </Text>
                  </View>
                ) : null}
                {guide?.reason ? (
                  <View className="mt-5 rounded-2xl bg-[#F7F6F4] p-4">
                    <Text className="font-body text-xs font-semibold uppercase tracking-wide text-[#817772]">
                      WHY THIS FITS TODAY
                    </Text>
                    <Text className="mt-2 font-body text-sm leading-5 text-[#504943]">
                      {guide.reason}
                    </Text>
                  </View>
                ) : null}
                {category === 'workout' && !assignment.mandatory && !workoutDetails ? (
                  <Text className="mt-4">Rest guidance is not a mandatory workout check-in.</Text>
                ) : null}
                {assignment.consumedCount >= (category === 'meals' ? 3 : 1) ? (
                  <Text className="mt-4">
                    This category’s daily reward slot has already been used.
                  </Text>
                ) : null}
                {canTakeLivePhoto ? (
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Take live photo using the in-app camera"
                    disabled={busy}
                    onPress={() => void start('image')}
                    className="mt-4 min-h-[72px] flex-row items-center gap-3 rounded-2xl border border-[#E3E1DE] bg-white px-4 py-3">
                    <View className="h-11 w-11 items-center justify-center rounded-xl bg-[#FFF0E8]">
                      <Camera size={23} color="#F45A2B" />
                    </View>
                    <View className="min-w-0 flex-1">
                      <Text className="font-heading text-base font-semibold text-[#251E1A]">
                        Take live photo
                      </Text>
                      <Text className="font-body text-sm text-[#77716D]">
                        Use the in-app camera
                      </Text>
                    </View>
                    <ArrowRight size={20} color="#F45A2B" />
                  </TouchableOpacity>
                ) : null}
                {error && !showFooter ? (
                  <Text className="mt-3 font-body text-sm text-[#B8462A]">{error}</Text>
                ) : null}
              </>
            )}
          </ScrollView>
          {showFooter ? (
            <View
              onLayout={(event) => setFooterHeight(event.nativeEvent.layout.height)}
              className="border-t border-[#EEE9E5] bg-white px-6 pb-4 pt-3">
              {error ? <Text className="mb-3 text-sm text-[#B8462A]">{error}</Text> : null}
              {showPrimaryAction ? (
                <CoachActionButton
                  label={busy ? 'Working…' : primaryLabel}
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
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Share without AI analysis"
                  disabled={busy}
                  onPress={() => publishMeal(true)}
                  className="mt-3 min-h-14 items-center justify-center rounded-[20px] border border-[#FF5C35] bg-white px-5 py-3.5">
                  <Text className="font-body text-base font-semibold text-[#E9512A]">
                    Share without AI analysis
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}
        </>
      )}
    </View>
  );
}
