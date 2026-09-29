import { useAuthToken } from '@convex-dev/auth/react';
import { useAction, useConvex, useMutation, useQuery } from 'convex/react';
import { CameraView, useCameraPermissions } from 'expo-camera';
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
  X,
} from 'phosphor-react-native';
import { useEffect, useRef, useState } from 'react';
import { Alert, Image, Linking, ScrollView, TextInput, TouchableOpacity, View } from 'react-native';

import CoachActionButton from '~/components/core/CoachActionButton';
import ScreenLoading from '~/components/core/ScreenLoading';
import { Text } from '~/components/ui/text';
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
import { getData, removeData, storeData } from '~/utils/storage';

type ProofQueue = {
  userId: string;
  day: string;
  category: CoachCategory;
  submissionId: Id<'coachProofSubmissionsV1'>;
  assignmentId: string;
  planRevisionId: string;
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
}: {
  category: CoachCategory;
  onClose: () => void;
  onOpenPlan: (status: 'no_plan' | 'pending' | 'ready' | 'locked') => void;
  onExpandedChange?: (expanded: boolean) => void;
  onPreferredHeightChange?: (height: number) => void;
  mode?: 'details' | 'post';
  onCaptured?: () => void;
}) {
  const convex = useConvex();
  const authToken = useAuthToken();
  const currentUser = useQuery(api.users.current);
  const today = useQuery(api.coachCheckIns.myToday, {});
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
  const camera = useRef<CameraView>(null);
  const [queue, setQueue] = useState<ProofQueue | null>(null);
  const [showCamera, setShowCamera] = useState(false);
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
            recovered.caption ?? server.caption ?? randomCoachCheckInCaption(category);
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

  const closeSheet = () => {
    if (closing.current) return;
    closing.current = true;
    // A reserved slot is intentionally reused on reopening. Cancelling it here
    // would leave the slot occupied but make its proof impossible to upload.
    // Captured photos and captions stay in the owner-bound local queue.
    setShowCamera(false);
    onClose();
  };

  const start = async () => {
    if (!assignment || !currentUser || !today || !category || !queueKey) return;
    setBusy(true);
    setError('');
    try {
      const granted = permission?.granted || (await requestPermission()).granted;
      if (!granted) {
        setError('Camera access is needed for live proof.');
        return;
      }
      const id = await reserve({
        assignmentId: assignment._id,
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
        label: assignment.label,
        recommendation: server.recommendation,
        stepTarget: assignment.stepTarget,
        detailsV2: assignment.detailsV2,
      });
      setShowCamera(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not start proof.');
    } finally {
      setBusy(false);
    }
  };

  const capture = async () => {
    if (!queue || !camera.current || !FileSystem.documentDirectory) return;
    setBusy(true);
    setError('');
    try {
      const photo = await camera.current.takePictureAsync({ quality: 0.8 });
      if (!photo?.uri) return;
      const uri = `${FileSystem.documentDirectory}coach-proof-${queue.submissionId}.jpg`;
      await FileSystem.deleteAsync(uri, { idempotent: true });
      await FileSystem.copyAsync({ from: photo.uri, to: uri });
      const nextCaption = caption.trim() ? caption : randomCoachCheckInCaption(category);
      setCaption(nextCaption);
      persist({ ...queue, uri, caption: nextCaption });
      setShowCamera(false);
      if (mode === 'details' && !closing.current) onCaptured?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save the photo.');
    } finally {
      setBusy(false);
    }
  };

  const upload = async (): Promise<Id<'_storage'> | null> => {
    if (!queue?.uri) return null;
    setBusy(true);
    setError('');
    try {
      if (!authToken) throw new Error('Sign in again before uploading proof.');
      const siteUrl = process.env.EXPO_PUBLIC_CONVEX_URL?.replace('.convex.cloud', '.convex.site');
      if (!siteUrl) throw new Error('Proof upload service is unavailable.');
      const { token } = await issueUpload({ submissionId: queue.submissionId });
      const task = FileSystem.createUploadTask(`${siteUrl}/api/coach-proof-upload`, queue.uri, {
        httpMethod: 'POST',
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
        headers: {
          'Content-Type': 'image/jpeg',
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
      setError(
        cause instanceof Error ? cause.message : 'Upload failed. Your photo is saved for retry.'
      );
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
      await complete({ submissionId: queue.submissionId, caption });
      if (queueKey) removeData(queueKey);
      if (queue.uri) await FileSystem.deleteAsync(queue.uri, { idempotent: true }).catch(() => {});
      setQueue(null);
      Alert.alert('Check-in posted', 'Your activity and points have been saved.');
      onClose();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Could not post. Your photo is saved for retry.'
      );
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
      setError(cause instanceof Error ? cause.message : 'Meal analysis could not start.');
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
      await shareMeal({ draftId, caption, skipAnalysis: skipAnalysis || undefined });
      if (queueKey) removeData(queueKey);
      if (queue.uri) await FileSystem.deleteAsync(queue.uri, { idempotent: true }).catch(() => {});
      setQueue(null);
      Alert.alert(
        'Meal shared',
        skipAnalysis
          ? 'Your meal and 2 points have been saved without an AI portion check.'
          : 'Your meal, private portion check and 2 points have been saved.'
      );
      onClose();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Could not share. Your photo and caption are saved.'
      );
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
      setShowCamera(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not retake photo.');
    } finally {
      setBusy(false);
    }
  };

  if (!today || !currentUser) return <ScreenLoading />;
  const ready = today.status === 'ready' && Boolean(assignment);
  let primaryLabel = 'Close';
  let primaryAction: () => void = onClose;
  if (mode === 'post' && queue && today.status !== 'locked') {
    if (!queue.uri && !queue.storageId) {
      primaryLabel = 'Take live photo';
      primaryAction = () => setShowCamera(true);
    } else if (category === 'meals') {
      if (!queue.storageId && queue.uri) {
        primaryLabel = 'Get portion suggestion';
        primaryAction = scanMeal;
      } else if (meal?.draft?.status === 'ready' && meal.draft.verdict) {
        primaryLabel = 'Share meal';
        primaryAction = () => publishMeal(false);
      } else if (meal?.draft?.status === 'ready' && !meal.draft.verdict) {
        primaryLabel = 'Retake photo';
        primaryAction = retakePhoto;
      } else if (meal?.draft?.status === 'analyzing') {
        primaryLabel = meal.canRetryAnalysis ? 'Retry analysis' : 'Analysing meal…';
        if (meal.canRetryAnalysis) primaryAction = scanMeal;
      } else if (queue.storageId && (meal?.scanCount ?? 0) < 3) {
        primaryLabel =
          meal?.draft?.status === 'failed' ? 'Retry portion check' : 'Get portion suggestion';
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
  const workoutDetails =
    mode === 'details' && category === 'workout' && ready && Boolean(assignment?.mandatory);
  const workoutRewardUsed = Boolean(assignment && assignment.consumedCount >= 1);
  const workoutSearch =
    workoutDetails && assignment?.mandatory
      ? workoutYoutubeSearch(queue?.label ?? assignment?.label)
      : null;
  const canTakeLivePhoto = canStartCoachLivePhoto(
    category,
    mode,
    today.status,
    assignment,
    Boolean(queue?.uri || queue?.storageId)
  );
  const showFooter = mode === 'post' || !ready || Boolean(queue?.uri || queue?.storageId);
  const canShareMealWithoutAnalysis =
    mode === 'post' &&
    category === 'meals' &&
    Boolean(queue?.uri || queue?.storageId) &&
    meal?.draft?.status !== 'analyzing' &&
    !(meal?.draft?.status === 'ready' && meal.draft.verdict);
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
              {workoutDetails ? (
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
          <CameraView ref={camera} style={{ flex: 1 }} facing="back" />
          <View className="m-5">
            <CoachActionButton
              label={busy ? 'Working…' : 'Take live proof photo'}
              disabled={busy}
              onPress={capture}
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
                  <View className="rounded-[24px] border border-[#EEE8E3] bg-[#FFFDFC] p-5">
                    <View className="flex-row items-start justify-between gap-4">
                      <View className="min-w-0 flex-1">
                        <Text className="font-body text-xs font-semibold uppercase tracking-widest text-[#E9512A]">
                          DAILY ACTIVITY
                        </Text>
                        <Text className="mt-2 font-heading text-xl font-semibold text-[#251E1A]">
                          {guide?.title}
                        </Text>
                      </View>
                      <Text className="font-heading text-base font-semibold text-[#E9512A]">
                        +{points} pts
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
                      className="mt-2 min-h-28 rounded-[20px] border border-[#DCD7D3] bg-white p-4 font-body text-base text-[#251E1A]"
                    />
                  </View>
                  {queue.uri || proofImage ? (
                    <View className="relative mt-5">
                      <Image
                        source={{ uri: queue.uri ?? proofImage ?? undefined }}
                        className="h-80 w-full rounded-[24px] bg-[#F4F1EE]"
                        resizeMode="cover"
                      />
                      <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityLabel="Remove photo and retake"
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
                          PRIVATE AI PORTION CHECK
                        </Text>
                        <Text className="font-body text-xs text-[#817772]">
                          {meal?.scanCount ?? 0} of 3 today
                        </Text>
                      </View>
                      {busy ? (
                        <View className="mt-4 rounded-[24px] border border-[#F3D4C5] bg-[#FFF8F4] p-5">
                          <View className="flex-row items-center gap-3">
                            <View className="h-11 w-11 items-center justify-center rounded-2xl bg-[#FF5C35]">
                              <ForkKnife size={22} color="#FFFFFF" />
                            </View>
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
                        <View className="mt-4 overflow-hidden rounded-[24px] border border-[#F0C9B6] bg-[#FFF8F4]">
                          <View className="bg-[#FF5C35] px-5 py-4">
                            <Text className="font-body text-xs font-semibold uppercase tracking-widest text-white/80">
                              YOUR PLATE
                            </Text>
                            <Text className="mt-1 font-heading text-2xl font-semibold text-white">
                              {meal.draft.verdict}
                            </Text>
                          </View>
                          <View className="p-5">
                            <Text className="font-heading text-lg font-semibold text-[#251E1A]">
                              One useful adjustment
                            </Text>
                            <Text className="mt-2 font-body text-base leading-6 text-[#514943]">
                              {meal.draft.feedback}
                            </Text>
                            <Text className="mt-4 font-body text-xs leading-4 text-[#817772]">
                              Based only on food visible in this photo. This feedback stays private.
                            </Text>
                          </View>
                        </View>
                      ) : meal?.draft?.status === 'ready' ? (
                        <View className="mt-4 rounded-[20px] bg-[#F7F6F4] p-5">
                          <Text className="font-heading text-lg">Unable to assess a meal</Text>
                          <Text className="mt-2">{meal.draft.feedback}</Text>
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
                    onPress={start}
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
                  <Text className="mt-3 font-body text-sm text-red-600">{error}</Text>
                ) : null}
              </>
            )}
          </ScrollView>
          {showFooter ? (
            <View
              onLayout={(event) => setFooterHeight(event.nativeEvent.layout.height)}
              className="border-t border-[#EEE9E5] bg-white px-6 pb-4 pt-3">
              {error ? <Text className="mb-3 text-sm text-red-600">{error}</Text> : null}
              {canShareMealWithoutAnalysis ? (
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Share meal without AI portion check"
                  disabled={busy}
                  onPress={() => publishMeal(true)}
                  className="mb-3 min-h-12 items-center justify-center rounded-2xl border border-[#DCD7D3] bg-white px-4">
                  <Text className="font-body text-sm font-semibold text-[#514943]">
                    Share without AI check
                  </Text>
                </TouchableOpacity>
              ) : null}
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
            </View>
          ) : null}
        </>
      )}
    </View>
  );
}
