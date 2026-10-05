import { useAction, useMutation, useQuery } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import { router } from 'expo-router';
import {
  Barbell,
  Check,
  Footprints,
  ForkKnife,
  MoonStars,
  MagnifyingGlass,
  YoutubeLogo,
} from 'phosphor-react-native';
import { useEffect, useRef, useState } from 'react';
import { Alert, Linking, ScrollView, TouchableOpacity, View } from 'react-native';

import CoachPlanPreparing from './CoachPlanPreparing';
import DailyQuestion from './DailyQuestion';
import PlanExplanation from './PlanExplanation';

import { PrototypeButton } from '~/components/core/auth/PrototypeOnboarding';
import PlanFeedback from '~/components/core/dashboard/PlanFeedback';
import { PrototypeSheetControl } from '~/components/core/design/PrototypeControl';
import { prototypeTypography as type } from '~/components/core/design/prototypeStyles';
import { Text } from '~/components/ui/text';
import { api } from '~/convex/_generated/api';
import type { CoachCategory } from '~/shared/coachFoundation';
import { mealPlanSummary } from '~/shared/coachPlanCopy';
import { DAILY_QUESTIONS } from '~/shared/coachQuestions';
import { workoutYoutubeSearch } from '~/shared/coachYoutubeSearch';

type Plan = FunctionReturnType<typeof api.revenueCatEntitlements.myPlan>;
type CheckIns = FunctionReturnType<typeof api.coachCheckIns.myToday> | undefined;
const QUESTIONS = [
  DAILY_QUESTIONS[2],
  DAILY_QUESTIONS[0],
  DAILY_QUESTIONS[1],
  DAILY_QUESTIONS[3],
  DAILY_QUESTIONS[4],
];
const ROWS = [
  { category: 'workout', title: 'Workout', Icon: Barbell },
  { category: 'steps', title: 'Steps', Icon: Footprints },
  { category: 'meals', title: 'Meals', Icon: ForkKnife },
  { category: 'sleep', title: 'Sleep', Icon: MoonStars },
] as const;
const ORANGE = '#E8541E';
function concise(value: string) {
  return value.match(/^.*?[.!?](?:\s|$)/)?.[0]?.trim() || value;
}

export default function TodayPlanSheet({
  firstName,
  plan,
  checkIns,
  onClose,
  onCheckIn,
  onContentHeight,
}: {
  firstName: string;
  plan: Plan;
  checkIns: CheckIns;
  onClose: () => void;
  onCheckIn: (category: CoachCategory) => void;
  onContentHeight?: (height: number) => void;
}) {
  const foundation = useQuery(api.coachFoundation.getMyFoundation, {});
  const begin = useMutation(api.coachFoundation.beginReturningPlanSetup);
  const save = useMutation(api.coachFoundation.saveDailyDraft);
  const submit = useAction(api.coachDailyService.submitDailyAnswersAndGenerate);
  const retry = useMutation(api.coachDailyService.retryFailedPlan);
  const [step, setStep] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [retryRequestId, setRetryRequestId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const busyRef = useRef(false);
  const beganRef = useRef(false);
  const draft =
    foundation?.state?.dailyDraftDay === plan.day ? foundation.state.dailyDraft : undefined;

  useEffect(() => {
    if (!foundation || plan.requestStatus !== 'none' || beganRef.current) return;
    if (!foundation.state?.profileRevisionId) {
      beganRef.current = true;
      begin({})
        .then(() => {
          onClose();
          router.push('/coach-onboarding');
        })
        .catch(() => setError('Could not open today’s questions. Please try again.'));
    }
  }, [foundation, plan.requestStatus, begin, onClose]);

  const firstUnanswered = QUESTIONS.findIndex((question) => draft?.[question.key] === undefined);
  const index = step ?? (firstUnanswered < 0 ? QUESTIONS.length - 1 : firstUnanswered);
  const question = QUESTIONS[index];
  const choose = async (value: string) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError('');
    let finalAnswerSaved = false;
    try {
      if (index === QUESTIONS.length - 1) {
        setSubmitting(true);
        await save({ body: value as Parameters<typeof submit>[0]['body'] });
        finalAnswerSaved = true;
        await submit({
          body: value as Parameters<typeof submit>[0]['body'],
          requestKey: `first_${plan.day.replaceAll('-', '')}`,
        });
      } else {
        await save({ [question.key]: value } as Parameters<typeof save>[0]);
        setStep(index + 1);
      }
    } catch {
      setSubmitting(false);
      setError(
        index === QUESTIONS.length - 1
          ? finalAnswerSaved
            ? 'We could not prepare today’s plan. Your answers are saved. Please try again.'
            : 'Could not save your answer. Please try again.'
          : 'Could not save your answer. Please try again.'
      );
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  useEffect(() => {
    if (plan.requestStatus === 'ready' || plan.requestStatus === 'failed') setSubmitting(false);
  }, [plan.requestStatus]);
  const pending =
    plan.requestStatus === 'pending' ||
    (submitting && plan.requestStatus === 'none') ||
    Boolean(retryRequestId && plan.requestId !== retryRequestId);
  const ready = Boolean(plan.plan) && plan.requestStatus === 'ready';
  const completed = ROWS.filter(
    ({ category }) =>
      (checkIns?.assignments.find((item) => item.category === category)?.consumedCount ?? 0) > 0
  ).length;
  const output = plan.plan?.output;
  const workoutTarget =
    checkIns?.status === 'ready'
      ? checkIns.assignments.find((item) => item.category === 'workout')?.label
      : undefined;
  const search = output ? workoutYoutubeSearch(workoutTarget ?? output.workout) : null;

  return (
    <View style={{ flex: 1 }}>
      <View
        className="mt-2.5 h-1 w-10 self-center rounded-full bg-[#D9D9D9]"
        accessibilityElementsHidden
      />
      <ScrollView
        onContentSizeChange={(_, height) => onContentHeight?.(height + 14)}
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 22, paddingTop: 18, paddingBottom: 30 }}>
        {ready && output ? (
          <>
            <View className="flex-row items-center justify-between">
              <Text style={type.supporting} className="min-w-0 flex-1 pr-3">
                Hey {firstName}, here’s today’s plan
              </Text>
              <PrototypeSheetControl kind="close" label="Close today’s plan" onPress={onClose} />
            </View>
            <Text style={type.planHeading} className="mt-3.5">
              {output.headline}
            </Text>
            <View className="mt-[26px]">
              <View className="flex-row justify-between">
                <Text style={[type.progressLabel, { flex: 1, paddingRight: 12 }]}>
                  Today’s progress
                </Text>
                <Text style={[type.progressValue, { flexShrink: 1, textAlign: 'right' }]}>
                  {completed}/4 complete
                </Text>
              </View>
              <View
                accessibilityRole="progressbar"
                accessibilityLabel="Today’s plan progress"
                accessibilityValue={{ min: 0, max: 4, now: completed }}
                className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-[#F1F1F1]">
                <View
                  style={{
                    width: `${completed * 25}%`,
                    backgroundColor: '#ff5a1f',
                    height: '100%',
                  }}
                />
              </View>
            </View>
            <View className="mt-7 gap-[22px]">
              {ROWS.map(({ category, title, Icon }) => {
                const assignment = checkIns?.assignments.find((item) => item.category === category);
                const target =
                  category === 'steps'
                    ? `${plan.plan?.stepTarget.toLocaleString('en-US')} steps`
                    : category === 'workout' && workoutTarget
                      ? workoutTarget
                      : category === 'meals'
                        ? mealPlanSummary(output.meals)
                        : concise(output[category]);
                const done = (assignment?.consumedCount ?? 0) > 0;
                return (
                  <TouchableOpacity
                    key={category}
                    accessibilityRole="button"
                    accessibilityLabel={`${title}: ${target}`}
                    onPress={() => onCheckIn(category)}
                    className="flex-row items-center">
                    <View className="mr-[14px] h-12 w-12 items-center justify-center rounded-2xl bg-[#FFF3EA]">
                      <Icon size={24} color={ORANGE} />
                    </View>
                    <View className="min-w-0 flex-1 pr-3">
                      <Text style={type.cardTitle}>{title}</Text>
                      <Text style={type.supporting} className="mt-1">
                        {target}
                      </Text>
                    </View>
                    <View className="h-[26px] w-[26px] items-center justify-center rounded-full border-[1.5px] border-[#D9D9D9]">
                      {done ? <Check size={17} color="#8A8A8A" /> : null}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
            {search ? (
              <View className="mt-[34px]">
                <Text style={type.sheetSectionHeading}>Find your workout on YouTube</Text>
                <Text style={type.supporting} className="mt-1">
                  Search for a workout that fits today’s plan.
                </Text>
                <TouchableOpacity
                  accessibilityRole="link"
                  accessibilityLabel={`Search ${search.phrase} on YouTube`}
                  onPress={() =>
                    Linking.openURL(search.url).catch(() =>
                      Alert.alert('YouTube could not be opened. Please try again.')
                    )
                  }
                  className="mt-3 min-h-16 flex-row items-center rounded-[32px] bg-[#F5F5F5] px-[22px] py-4">
                  <MagnifyingGlass size={24} color="#8A8A8A" />
                  <Text style={type.search} className="mx-3 min-w-0 flex-1">
                    {search.phrase}
                  </Text>
                  <YoutubeLogo size={32} color={ORANGE} weight="fill" />
                </TouchableOpacity>
              </View>
            ) : null}
            <PlanExplanation explanation={output.why} />
            <PlanFeedback revisionId={plan.plan!.revisionId} />
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => {
                onClose();
                router.push('/coach-profile');
              }}
              className="mt-4 min-h-11 items-center justify-center">
              <Text style={[type.body, { color: '#E8541E', textAlign: 'center' }]}>
                Update profile to refresh your plan →
              </Text>
            </TouchableOpacity>
          </>
        ) : pending || plan.requestStatus === 'failed' ? (
          <>
            <PrototypeSheetControl
              kind="close"
              label="Close today’s plan"
              onPress={onClose}
              style={{ alignSelf: 'flex-end' }}
            />
            {pending ? (
              <CoachPlanPreparing prototype firstName={firstName} />
            ) : (
              <View className="py-8">
                <Text style={type.planHeading}>Your answers are saved</Text>
                <Text style={type.loadingBody} className="mt-4">
                  We could not prepare today’s plan. Please try again.
                </Text>
                {plan.canRetry && plan.requestId ? (
                  <PrototypeButton
                    label="Retry plan preparation"
                    loading={busy}
                    disabled={busy}
                    onPress={async () => {
                      setBusy(true);
                      setError('');
                      try {
                        const requestId = await retry({
                          failedRequestId: plan.requestId!,
                          requestKey: `retry_${plan.day.replaceAll('-', '')}_${Date.now()}`,
                        });
                        setRetryRequestId(requestId);
                      } catch {
                        setError('Could not retry right now. Please try again.');
                      } finally {
                        setBusy(false);
                      }
                    }}
                    style={{ marginTop: 32 }}
                  />
                ) : null}
              </View>
            )}
          </>
        ) : (
          <DailyQuestion
            index={index}
            total={QUESTIONS.length}
            title={question.key === 'mood' ? 'How’s your mood today?' : question.title}
            description={
              index === 0 ? 'Answer 5 quick questions to get a personalised plan today.' : undefined
            }
            options={question.options}
            selected={typeof draft?.[question.key] === 'string' ? draft[question.key] : undefined}
            busy={busy}
            onChoose={(value) => {
              choose(value).catch(() => {});
            }}
            onBack={
              index > 0
                ? () => {
                    setError('');
                    setStep(index - 1);
                  }
                : undefined
            }
            onClose={onClose}
          />
        )}
        {error ? (
          <Text style={type.error} accessibilityLiveRegion="polite" className="mt-4">
            {error}
          </Text>
        ) : null}
      </ScrollView>
    </View>
  );
}
