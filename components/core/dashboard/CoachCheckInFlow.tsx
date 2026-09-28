import { useAuthToken } from '@convex-dev/auth/react';
import { useAction, useConvex, useMutation, useQuery } from 'convex/react';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system';
import { Barbell, Footprints, ForkKnife, MoonStars, X } from 'phosphor-react-native';
import { useEffect, useRef, useState } from 'react';
import { Alert, Image, ScrollView, TextInput, TouchableOpacity, View } from 'react-native';

import ScreenLoading from '~/components/core/ScreenLoading';
import CoachActionButton from '~/components/core/CoachActionButton';
import { Text } from '~/components/ui/text';
import { api } from '~/convex/_generated/api';
import { Id } from '~/convex/_generated/dataModel';
import { checkInGuide } from '~/shared/coachCheckInPresentation';
import { CoachCategory } from '~/shared/coachFoundation';
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
};

export default function CoachCheckInFlow({
  category,
  onClose,
  onOpenPlan,
  onExpandedChange,
  onPreferredHeightChange,
}: {
  category: CoachCategory;
  onClose: () => void;
  onOpenPlan: (status: 'no_plan' | 'pending' | 'ready' | 'locked') => void;
  onExpandedChange?: (expanded: boolean) => void;
  onPreferredHeightChange?: (height: number) => void;
}) {
  const convex = useConvex();
  const authToken = useAuthToken();
  const currentUser = useQuery(api.users.current);
  const today = useQuery(api.coachCheckIns.myToday, {});
  const reserve = useMutation(api.coachFoundation.reserveProof);
  const issueUpload = useMutation(api.coachCheckIns.issueUpload);
  const complete = useMutation(api.coachCheckIns.complete);
  const cancel = useMutation(api.coachCheckIns.cancel);
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
  const [headerHeight, setHeaderHeight] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  const [footerHeight, setFooterHeight] = useState(0);
  useEffect(() => {
    if (headerHeight && contentHeight && footerHeight)
      onPreferredHeightChange?.(headerHeight + contentHeight + footerHeight + 12);
  }, [headerHeight, contentHeight, footerHeight, onPreferredHeightChange]);
  useEffect(() => {
    onExpandedChange?.(showCamera || (category === 'meals' && Boolean(queue?.storageId)));
  }, [showCamera, category, queue?.storageId, onExpandedChange]);
  const meal = useQuery(
    api.coachMeals.myDraft,
    category === 'meals' && queue?.submissionId ? { submissionId: queue.submissionId } : 'skip'
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
          setQueue(recovered);
          if (server.storageId) storeData(queueKey, recovered);
        } else removeData(queueKey);
      })
      .catch(() => removeData(queueKey));
  }, [category, convex, currentUser?._id, queueKey, today?.day]);

  const persist = (next: ProofQueue) => {
    setQueue(next);
    if (queueKey) storeData(queueKey, next);
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
      persist({ ...queue, uri });
      setShowCamera(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save the photo.');
    } finally {
      setBusy(false);
    }
  };

  const upload = async () => {
    if (!queue?.uri) return;
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
      if (category === 'meals') return;
      await complete({ submissionId: queue.submissionId });
      if (queueKey) removeData(queueKey);
      await FileSystem.deleteAsync(queue.uri, { idempotent: true }).catch(() => {});
      setQueue(null);
      Alert.alert('Check-in complete', 'Your proof and points have been saved.');
      onClose();
    } catch (cause) {
      try {
        const saved = await convex.query(api.coachCheckIns.mySubmission, {
          submissionId: queue.submissionId,
        });
        if (saved.state === 'completed') {
          if (queueKey) removeData(queueKey);
          setQueue(null);
          onClose();
          return;
        }
        if (saved.state === 'uploaded' && saved.storageId) {
          persist({ ...queue, storageId: saved.storageId });
          setError(
            category === 'meals'
              ? 'Photo saved for meal analysis.'
              : 'Photo saved. Finish your check-in.'
          );
          return;
        }
      } catch {
        /* Keep the local queue for an offline retry. */
      }
      setError(
        cause instanceof Error ? cause.message : 'Upload failed. Your photo is saved for retry.'
      );
    } finally {
      setBusy(false);
    }
  };

  const finishUploaded = async () => {
    if (!queue || category === 'meals') return;
    setBusy(true);
    setError('');
    try {
      await complete({ submissionId: queue.submissionId });
      if (queueKey) removeData(queueKey);
      if (queue.uri) await FileSystem.deleteAsync(queue.uri, { idempotent: true }).catch(() => {});
      setQueue(null);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not finish check-in.');
    } finally {
      setBusy(false);
    }
  };

  const scanMeal = async () => {
    if (!queue) return;
    setBusy(true);
    setError('');
    try {
      const draftId = await saveMealCaption({ submissionId: queue.submissionId, caption });
      const result = await analyzeMeal({
        draftId,
        requestKey: Crypto.randomUUID().replaceAll('-', ''),
      });
      if (result.status === 'failed')
        setError('We could not assess this photo. You can retry if a scan remains.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Meal analysis could not start.');
    } finally {
      setBusy(false);
    }
  };

  const publishMeal = async () => {
    if (!queue || !meal?.draft) return;
    setBusy(true);
    setError('');
    try {
      await shareMeal({ draftId: meal.draft._id, caption });
      if (queueKey) removeData(queueKey);
      if (queue.uri) await FileSystem.deleteAsync(queue.uri, { idempotent: true }).catch(() => {});
      setQueue(null);
      Alert.alert('Meal shared', 'Your activity and 2 points have been saved.');
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

  const retakePlate = async () => {
    if (!queue) return;
    setBusy(true);
    setError('');
    try {
      await retakeMeal({ submissionId: queue.submissionId });
      persist({ ...queue, storageId: undefined, uri: undefined });
      setShowCamera(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not retake plate.');
    } finally {
      setBusy(false);
    }
  };

  if (!today || !currentUser) return <ScreenLoading />;
  const ready = today.status === 'ready' && Boolean(assignment);
  let primaryLabel = 'Close';
  let primaryAction: () => void = onClose;
  if (!ready) {
    primaryLabel = 'Get today’s plan';
    primaryAction = () => onOpenPlan(today.status);
  } else if (category === 'meals' && queue?.storageId) {
    if (meal?.draft?.status === 'ready' && meal.draft.verdict) {
      primaryLabel = 'Share activity';
      primaryAction = publishMeal;
    } else if (meal?.draft?.status !== 'ready' && (meal?.scanCount ?? 0) < 3) {
      primaryLabel = meal?.draft?.status === 'failed' ? 'Retry analysis' : 'Analyse plate';
      primaryAction = scanMeal;
    }
  } else if (queue?.uri && !queue.storageId) {
    primaryLabel = category === 'meals' ? 'Upload plate photo' : 'Upload and complete check-in';
    primaryAction = upload;
  } else if (queue && !queue.storageId) {
    primaryLabel = 'Resume live camera';
    primaryAction = () => setShowCamera(true);
  } else if (queue && category !== 'meals') {
    primaryLabel = 'Finish saved upload';
    primaryAction = finishUploaded;
  } else if (assignment?.mandatory && assignment.consumedCount < (category === 'meals' ? 3 : 1)) {
    primaryLabel = 'Start live proof';
    primaryAction = start;
  }
  const canRetakeMeal =
    category === 'meals' && Boolean(queue?.storageId) && (meal?.scanCount ?? 0) < 3;
  const guide = assignment ? checkInGuide(category, assignment, queue) : null;
  const Icon = {
    workout: Barbell,
    meals: ForkKnife,
    sleep: MoonStars,
    steps: Footprints,
  }[category];
  return (
    <View className="flex-1 bg-white">
      <View
        onLayout={(event) => setHeaderHeight(event.nativeEvent.layout.height)}
        className="border-b border-[#F0ECE9] px-6 pb-4 pt-3">
        <View
          className="mb-3 h-1 w-10 self-center rounded-full bg-[#DDD8D4]"
          accessibilityElementsHidden
        />
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-x-3">
            <View className="h-10 w-10 items-center justify-center rounded-xl bg-[#FFF0E8]">
              <Icon size={21} color="#F45A2B" weight="regular" />
            </View>
            <Text className="font-heading text-xl font-semibold text-[#231F1D]">
              {category[0].toUpperCase()}
              {category.slice(1)} check-in
            </Text>
          </View>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Close check-in"
            onPress={onClose}
            className="min-h-11 min-w-11 items-center justify-center rounded-full bg-[#F5F2F0]">
            <X size={20} color="#514943" />
          </TouchableOpacity>
        </View>
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
          <View className="mx-5 mb-5">
            <CoachActionButton
              label="Cancel camera"
              variant="secondary"
              disabled={busy}
              onPress={() => setShowCamera(false)}
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
            {today.status !== 'ready' || !assignment ? (
              <>
                <Text className="font-heading text-2xl">Get today’s plan first</Text>
                <Text className="mt-3">A ready plan is needed for personalised check-ins.</Text>
              </>
            ) : (
              <>
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
                {guide?.examples.length ? (
                  <View className="mt-5">
                    <Text className="font-heading text-base font-semibold text-[#251E1A]">
                      Moves you could try
                    </Text>
                    <View className="mt-3 flex-row flex-wrap gap-2">
                      {guide.examples.map((example) => (
                        <View
                          key={example}
                          className="rounded-full border border-[#F2D6C6] bg-white px-4 py-2">
                          <Text className="font-body text-sm text-[#55443B]">{example}</Text>
                        </View>
                      ))}
                    </View>
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
                {category === 'workout' && !assignment.mandatory ? (
                  <Text className="mt-4">Rest guidance is not a mandatory workout check-in.</Text>
                ) : null}
                {assignment.consumedCount >= (category === 'meals' ? 3 : 1) ? (
                  <Text className="mt-4">
                    This category’s daily reward slot has already been used.
                  </Text>
                ) : null}
                {category === 'meals' && queue?.storageId ? (
                  <View className="mt-5">
                    <Text className="font-heading text-xl">Log Activity</Text>
                    {queue.uri ? (
                      <Image source={{ uri: queue.uri }} className="mt-3 h-56 w-full rounded-xl" />
                    ) : null}
                    <TextInput
                      value={caption}
                      onChangeText={setCaption}
                      onEndEditing={() => {
                        if (queue?.storageId)
                          saveMealCaption({ submissionId: queue.submissionId, caption }).catch(
                            () => {}
                          );
                      }}
                      placeholder="Add a caption"
                      multiline
                      maxLength={500}
                      className="mt-3 min-h-20 rounded-xl border border-gray-300 bg-white p-3"
                    />
                    <Text className="mt-3 text-sm">
                      {meal?.scanCount ?? 0} of 3 daily scans used
                    </Text>
                    {busy ? <Text className="mt-3">Checking your plate...</Text> : null}
                    {meal?.draft?.status === 'ready' && meal.draft.verdict ? (
                      <View
                        className={`mt-4 rounded-xl p-4 ${meal.draft.verdict === 'On point' ? 'bg-green-100' : meal.draft.verdict === 'Nearly there' ? 'bg-amber-100' : 'bg-orange-100'}`}>
                        <Text className="font-heading text-lg">Portion Suggestion</Text>
                        <Text className="mt-2 font-semibold">{meal.draft.verdict}</Text>
                        <Text className="mt-2">{meal.draft.feedback}</Text>
                      </View>
                    ) : meal?.draft?.status === 'ready' ? (
                      <View className="mt-4 rounded-xl bg-gray-100 p-4">
                        <Text className="font-heading text-lg">Unable to assess a meal</Text>
                        <Text className="mt-2">{meal.draft.feedback}</Text>
                      </View>
                    ) : meal?.draft?.status === 'failed' ? (
                      <Text className="mt-3">
                        Analysis failed. Your photo and caption remain saved.
                      </Text>
                    ) : null}
                  </View>
                ) : null}
              </>
            )}
          </ScrollView>
          <View
            onLayout={(event) => setFooterHeight(event.nativeEvent.layout.height)}
            className="border-t border-[#EEE9E5] bg-white px-6 pb-4 pt-3">
            {error ? <Text className="mb-3 text-sm text-red-600">{error}</Text> : null}
            <CoachActionButton
              label={busy ? 'Working…' : primaryLabel}
              disabled={busy}
              onPress={primaryAction}
            />
            {canRetakeMeal ? (
              <CoachActionButton
                label="Retake photo"
                variant="secondary"
                disabled={busy}
                onPress={retakePlate}
                className="mt-2"
              />
            ) : null}
            {queue && !queue.storageId ? (
              <CoachActionButton
                label="Cancel capture"
                variant="secondary"
                disabled={busy}
                onPress={async () => {
                  await cancel({ submissionId: queue.submissionId });
                  if (queue.uri)
                    await FileSystem.deleteAsync(queue.uri, { idempotent: true }).catch(() => {});
                  if (queueKey) removeData(queueKey);
                  setQueue(null);
                  setShowCamera(false);
                }}
                className="mt-2"
              />
            ) : null}
          </View>
        </>
      )}
    </View>
  );
}
