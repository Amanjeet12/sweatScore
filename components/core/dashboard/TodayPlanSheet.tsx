import { useAction, useMutation, useQuery } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import { router } from 'expo-router';
import {
  ArrowLeft,
  ArrowRight,
  Barbell,
  Check,
  Footprints,
  ForkKnife,
  MoonStars,
  X,
  YoutubeLogo,
} from 'phosphor-react-native';
import { useEffect, useRef, useState } from 'react';
import { Animated, Linking, ScrollView, TouchableOpacity, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import PlanFeedback from '~/components/core/dashboard/PlanFeedback';
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
const ORANGE = '#FF5C35';
function concise(value: string) {
  return value.match(/^.*?[.!?](?:\s|$)/)?.[0]?.trim() || value;
}

function Sparkles() {
  return (
    <View className="h-20 items-center justify-center" accessibilityElementsHidden>
      <Svg width={80} height={80} viewBox="0 0 500 500">
        <Defs>
          <LinearGradient id="sparkleGradient" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#FF5C00" />
            <Stop offset="0.45" stopColor="#FF8A00" />
            <Stop offset="1" stopColor="#FFE600" />
          </LinearGradient>
        </Defs>
        <Path
          fill="url(#sparkleGradient)"
          d="M72 53 C64 94 43 110 0 120 C46 130 65 152 77 218 C83 160 102 134 148 119 C104 111 83 92 72 53 Z"
        />
        <Path
          fill="url(#sparkleGradient)"
          d="M237 133 C220 215 189 239 105 262 C184 282 218 323 241 442 C257 337 291 285 380 261 C292 243 256 216 237 133 Z"
        />
        <Path
          fill="url(#sparkleGradient)"
          d="M406 94 C396 140 370 162 322 176 C374 190 398 218 414 292 C421 230 445 192 498 174 C447 163 420 141 406 94 Z"
        />
        <Path
          fill="url(#sparkleGradient)"
          d="M126 315 C119 344 102 359 72 369 C105 379 121 398 131 442 C136 404 151 381 183 370 C151 362 135 345 126 315 Z"
        />
      </Svg>
    </View>
  );
}

export default function TodayPlanSheet({
  firstName,
  plan,
  checkIns,
  onClose,
  onCheckIn,
}: {
  firstName: string;
  plan: Plan;
  checkIns: CheckIns;
  onClose: () => void;
  onCheckIn: (category: CoachCategory) => void;
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
      void begin({})
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
  const loadingProgress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!pending) return;
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(loadingProgress, { toValue: 1, duration: 1900, useNativeDriver: false }),
        Animated.timing(loadingProgress, { toValue: 0, duration: 350, useNativeDriver: false }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [pending, loadingProgress]);
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
    <View>
      <View
        className="mt-3 h-1 w-12 self-center rounded-full bg-[#CBC7C3]"
        accessibilityElementsHidden
      />
      <View className="absolute left-5 right-5 top-7 z-10 flex-row justify-between">
        {!pending && !ready && plan.requestStatus === 'none' && index > 0 ? (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Previous question"
            onPress={() => {
              setError('');
              setStep(index - 1);
            }}
            className="h-11 w-11 items-center justify-center">
            <ArrowLeft color={ORANGE} size={25} />
          </TouchableOpacity>
        ) : (
          <View className="h-11 w-11" />
        )}
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Close today’s plan"
          onPress={onClose}
          className="h-11 w-11 items-center justify-center rounded-full bg-[#F7F4F2]">
          <X color="#625C58" size={24} />
        </TouchableOpacity>
      </View>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 22, paddingTop: 35, paddingBottom: 28 }}>
        {!pending ? <Sparkles /> : null}
        {ready && output ? (
          <>
            <Text className="mt-3 text-center font-heading text-[34px] font-semibold leading-10 text-black">
              Hey {firstName},
            </Text>
            <Text className="text-center font-heading text-[22px] font-semibold text-black">
              here’s today’s plan
            </Text>
            <Text className="mb-7 mt-7 text-center font-heading text-[26px] font-semibold leading-8 text-black">
              {output.headline}
            </Text>
            <View className="mb-4 rounded-[22px] bg-[#FFF6F1] p-5">
              <View className="flex-row justify-between">
                <Text>Today’s progress</Text>
                <Text>{completed}/4 complete</Text>
              </View>
              <View className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#FCE2D2]">
                <View
                  style={{ width: `${completed * 25}%`, backgroundColor: ORANGE, height: '100%' }}
                />
              </View>
            </View>
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
                  className="mb-3 rounded-[22px] border border-[#E6E2DF] bg-white p-4">
                  <View className="flex-row items-center">
                    <View className="mr-4 h-12 w-12 items-center justify-center rounded-full bg-[#FFF5F0]">
                      <Icon color={ORANGE} size={25} weight="fill" />
                    </View>
                    <View className="min-w-0 flex-1">
                      <Text className="font-heading font-semibold">{title}</Text>
                      <Text className="mt-1 font-body text-sm text-[#77716D]">{target}</Text>
                    </View>
                    {done ? (
                      <Check color={ORANGE} size={23} />
                    ) : (
                      <ArrowRight color={ORANGE} size={22} />
                    )}
                  </View>
                  {category === 'workout' && search ? (
                    <TouchableOpacity
                      accessibilityRole="link"
                      accessibilityLabel={`Search ${search.phrase} on YouTube`}
                      onPress={(event) => {
                        event.stopPropagation();
                        Linking.openURL(search.url).catch(() => {});
                      }}
                      className="mt-3 min-h-12 flex-row items-center justify-center rounded-xl bg-[#FFF0E8]">
                      <YoutubeLogo color={ORANGE} size={22} weight="fill" />
                      <Text className="ml-3 text-sm text-[#655B55]">Search {search.phrase}</Text>
                    </TouchableOpacity>
                  ) : null}
                </TouchableOpacity>
              );
            })}
            <View className="mt-3 rounded-[22px] bg-[#FFF6F1] p-5">
              <Text className="font-heading font-semibold">Why this was recommended</Text>
              <Text className="mt-2 font-body text-sm leading-5 text-[#77716D]">{output.why}</Text>
            </View>
            <PlanFeedback revisionId={plan.plan!.revisionId} />
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => {
                onClose();
                router.push('/coach-profile');
              }}
              className="min-h-14 items-center justify-center">
              <Text className="text-sm text-[#E9512A]">Update profile to refresh your plan →</Text>
            </TouchableOpacity>
          </>
        ) : pending ? (
          <>
            <Text className="mt-5 text-center font-heading text-[34px] font-semibold leading-10 text-black">
              Creating today’s{`\n`}plan, {firstName}
            </Text>
            <Text className="mt-5 text-center font-body text-lg leading-7">
              Your answers are saved and{`\n`}your plan is being built.
            </Text>
            <View className="my-7 rounded-[22px] bg-[#FFF6F1] p-5">
              <Text>This may take a moment</Text>
              <View
                accessibilityRole="progressbar"
                accessibilityLabel="Creating today’s plan"
                className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#FCE2D2]">
                <Animated.View
                  style={{
                    width: loadingProgress.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['8%', '92%'],
                    }),
                    height: '100%',
                    borderRadius: 8,
                    backgroundColor: ORANGE,
                  }}
                />
              </View>
            </View>
          </>
        ) : plan.requestStatus === 'failed' ? (
          <>
            <Text className="mt-5 text-center font-heading text-[30px] font-semibold">
              Your answers are saved
            </Text>
            <Text className="mt-4 text-center font-body text-base">
              We could not prepare today’s plan. Please try again.
            </Text>
            {plan.canRetry && plan.requestId ? (
              <TouchableOpacity
                accessibilityRole="button"
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
                className="mt-8 min-h-14 items-center justify-center rounded-full bg-[#FF5C35]">
                <Text className="font-heading font-semibold text-white">
                  {busy ? 'Retrying…' : 'Retry plan preparation'}
                </Text>
              </TouchableOpacity>
            ) : null}
          </>
        ) : (
          <>
            <Text className="mt-5 text-center font-heading text-[38px] font-semibold leading-[44px] text-black">
              Hey, {firstName}
            </Text>
            <Text className="mb-11 mt-7 text-center font-body text-lg leading-7 text-black">
              Answer 5 quick questions to get{`\n`}a personalised plan today.
            </Text>
            <Text className="mb-7 text-center font-heading text-xl font-semibold text-black">
              {question.key === 'mood' ? 'How’s your mood today?' : question.title}
            </Text>
            {question.options.map(([value, label]) => (
              <TouchableOpacity
                key={value}
                accessibilityRole="radio"
                accessibilityState={{ selected: draft?.[question.key] === value, disabled: busy }}
                disabled={busy}
                onPress={() => void choose(value)}
                className="mb-3 min-h-[76px] justify-center rounded-[24px] border px-6"
                style={{
                  borderColor: draft?.[question.key] === value ? ORANGE : '#E5E2DF',
                  backgroundColor: draft?.[question.key] === value ? '#FFF6F1' : '#FFFFFF',
                }}>
                <Text className="font-body text-lg text-black">{label}</Text>
              </TouchableOpacity>
            ))}
          </>
        )}
        {error ? (
          <Text
            accessibilityLiveRegion="polite"
            className="mt-4 text-center font-body text-sm text-[#B8462A]">
            {error}
          </Text>
        ) : null}
      </ScrollView>
    </View>
  );
}
