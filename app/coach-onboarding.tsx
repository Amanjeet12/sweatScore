import { useAction, useConvex, useMutation, useQuery } from 'convex/react';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, TextInput, TouchableOpacity, View } from 'react-native';
import SafeAreaView from '~/components/core/CoachSafeAreaView';
import CoachActionButton from '~/components/core/CoachActionButton';
import ScreenLoading from '~/components/core/ScreenLoading';
import { Text } from '~/components/ui/text';
import { api } from '~/convex/_generated/api';
import { useCoachRouteGuard } from '~/hooks/useCoachRouteGuard';
import { DAILY_QUESTIONS, PROFILE_QUESTIONS } from '~/shared/coachQuestions';
import { COACH_CATEGORIES } from '~/shared/coachFoundation';
import { resumeMember } from '~/utils/coachResumeNavigation';

const QUESTION_ROUTES = ['profile', 'daily', 'today'] as const;

export default function CoachOnboarding() {
  const convex = useConvex();
  const { reanswer, nextCheckIn } = useLocalSearchParams<{
    reanswer?: string;
    nextCheckIn?: string;
  }>();
  const selectedCheckIn = COACH_CATEGORIES.find((item) => item === nextCheckIn);
  const reanswerMode = __DEV__ && reanswer === '1';
  const { decision, accepted } = useCoachRouteGuard(QUESTION_ROUTES);
  const foundation = useQuery(api.coachFoundation.getMyFoundation, accepted ? {} : 'skip');
  const currentPlan = useQuery(
    api.revenueCatEntitlements.myPlan,
    accepted && decision?.screen === 'today' ? {} : 'skip'
  );
  const saveProfile = useMutation(api.coachFoundation.saveProfileDraft);
  const finishProfile = useMutation(api.coachFoundation.finishProfile);
  const saveDaily = useMutation(api.coachFoundation.saveDailyDraft);
  const submitDaily = useAction(api.coachDailyService.submitDailyAnswersAndGenerate);
  const saveReanswer = useMutation(api.coachFoundation.saveMyTodayReanswerDraftForTesting);
  const finishReanswer = useMutation(api.coachFoundation.finishMyTodayReanswerForTesting);
  const [localStep, setLocalStep] = useState<number | null>(null);
  const [weight, setWeight] = useState('');
  const [unit, setUnit] = useState<'lb' | 'kg'>('lb');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setLocalStep(null);
  }, [decision?.screen, decision?.day]);
  useEffect(() => {
    if (
      !reanswerMode &&
      decision?.screen === 'today' &&
      currentPlan &&
      currentPlan.requestStatus !== 'none'
    )
      router.replace({
        pathname: currentPlan.requestStatus !== 'ready' ? '/coach-plan-loading' : '/coach-plan',
        params: selectedCheckIn ? { nextCheckIn: selectedCheckIn } : {},
      });
  }, [decision?.screen, currentPlan?.requestStatus, reanswerMode, selectedCheckIn]);
  useEffect(() => {
    if (
      reanswerMode &&
      foundation &&
      (foundation.state?.testReanswerDay !== foundation.day || !foundation.state?.testReanswerKey)
    )
      router.replace('/coach-plan');
  }, [
    foundation?.day,
    foundation?.state?.testReanswerDay,
    foundation?.state?.testReanswerKey,
    reanswerMode,
  ]);
  useEffect(() => {
    const saved = foundation?.state?.profileDraft?.weight;
    if (saved) {
      setWeight(String(saved.value));
      setUnit(saved.unit);
    }
  }, [foundation?.state?.profileDraft?.weight]);

  if (
    !accepted ||
    !decision ||
    !foundation ||
    (decision.screen === 'today' && !currentPlan) ||
    (!reanswerMode && decision.screen === 'today' && currentPlan?.requestStatus !== 'none') ||
    (reanswerMode && foundation.state?.testReanswerDay !== foundation.day)
  )
    return <ScreenLoading />;
  const profile =
    !reanswerMode &&
    (decision.screen === 'profile' ||
      (decision.screen === 'today' && !foundation.state?.profileRevisionId));
  const questions = profile ? PROFILE_QUESTIONS : DAILY_QUESTIONS;
  const testDraft = foundation.state?.testReanswerDraft;
  const nextTestStep = reanswerMode
    ? DAILY_QUESTIONS.findIndex((item) => testDraft?.[item.key] === undefined)
    : -1;
  const currentDraft = profile
    ? foundation.state?.profileDraft
    : foundation.state?.dailyDraftDay === decision.day
      ? foundation.state?.dailyDraft
      : undefined;
  const firstUnanswered = questions.findIndex(
    (item) => (currentDraft as Record<string, unknown> | undefined)?.[item.key] === undefined
  );
  const step = Math.min(
    localStep ??
      (reanswerMode
        ? nextTestStep < 0
          ? 4
          : nextTestStep
        : decision.screen === 'today'
          ? firstUnanswered < 0
            ? questions.length - 1
            : firstUnanswered
          : decision.question),
    questions.length - 1
  );
  const question = questions[step];
  const saved = reanswerMode ? testDraft : currentDraft;
  const selected = saved?.[question.key as keyof typeof saved];

  const choose = async (value: string) => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      if (reanswerMode) {
        if (step === DAILY_QUESTIONS.length - 1) {
          await finishReanswer({ body: value as 'fine' });
          router.replace('/coach-plan');
        } else {
          await saveReanswer({ [question.key]: value } as Parameters<typeof saveReanswer>[0]);
          setLocalStep(step + 1);
        }
      } else if (profile) {
        await saveProfile({ [question.key]: value } as Parameters<typeof saveProfile>[0]);
        if (step === PROFILE_QUESTIONS.length - 1) {
          await finishProfile({});
          if (decision.returningMember) setLocalStep(null);
          else await resumeMember(convex);
        } else setLocalStep(step + 1);
      } else if (step === DAILY_QUESTIONS.length - 1) {
        await submitDaily({
          body: value as 'fine',
          requestKey: `first_${decision.day.replaceAll('-', '')}`,
        });
        router.replace({
          pathname: '/coach-plan-loading',
          params: selectedCheckIn ? { nextCheckIn: selectedCheckIn } : {},
        });
      } else {
        await saveDaily({ [question.key]: value } as Parameters<typeof saveDaily>[0]);
        setLocalStep(step + 1);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save your answer. Try again.');
      setLocalStep(null);
    } finally {
      setBusy(false);
    }
  };

  const saveWeight = async () => {
    const value = Number(weight);
    if (!Number.isFinite(value) || value <= 0) {
      setError('Enter your current weight to continue.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await saveProfile({ weight: { value, unit } });
      setLocalStep(1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save your weight.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-[#F9F9F9]">
      <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: 24,
          paddingTop: 40,
          paddingBottom: 32,
        }}>
        <Text className="font-body text-xs font-bold uppercase tracking-wider text-primary-500">
          {profile ? 'YOUR PROFILE' : reanswerMode ? 'RE-ANSWER TODAY' : "TODAY'S PLAN"} ·{' '}
          {step + 1} OF {questions.length}
        </Text>
        {decision.changedDay && !profile ? (
          <Text className="mt-4 font-body text-sm text-[#6B665A]">
            It’s a new day. Your earlier plan is saved as history; answer today’s questions for a
            fresh plan.
          </Text>
        ) : null}
        <Text className="mb-6 mt-4 font-heading text-2xl font-semibold text-[#1A1A1A]">
          {question.title}
        </Text>
        {profile && step === 0 ? (
          <>
            <Text className="mb-4 font-body text-sm text-[#6B665A]">
              Used to track your trend over time.
            </Text>
            <View className="mb-4 flex-row gap-3">
              {(['lb', 'kg'] as const).map((choice) => (
                <TouchableOpacity
                  key={choice}
                  onPress={() => setUnit(choice)}
                  className={`rounded-[20px] border px-6 py-3 ${unit === choice ? 'border-primary-500 bg-[#FFF0E8]' : 'border-[#E3E1DE] bg-white'}`}>
                  <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 18 }}>
                    {choice === 'lb' ? 'lbs' : 'kg'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              value={weight}
              onChangeText={setWeight}
              keyboardType="decimal-pad"
              placeholder="e.g. 170"
              accessibilityLabel="Current weight"
              className="mb-5 rounded-2xl border border-[#E3E1DE] bg-white px-4 py-4 text-lg"
            />
            <CoachActionButton
              label={busy ? 'Saving…' : 'Next Question'}
              disabled={busy}
              onPress={saveWeight}
            />
          </>
        ) : (
          question.options.map(([value, label]) => (
            <TouchableOpacity
              key={value}
              disabled={busy}
              onPress={() => choose(value)}
              accessibilityRole="button"
              accessibilityState={{ selected: selected === value }}
              className={`mb-3 rounded-[20px] border px-5 py-5 ${selected === value ? 'border-primary-500 bg-[#FFF0E8]' : 'border-[#E3E1DE] bg-white'}`}>
              <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 18, color: '#1A1A1A' }}>
                {label}
              </Text>
            </TouchableOpacity>
          ))
        )}
        {error ? <Text className="mt-3 font-body text-sm text-red-600">{error}</Text> : null}
        {reanswerMode ? (
          <CoachActionButton
            label="Back to today’s plan"
            variant="secondary"
            disabled={busy}
            onPress={() => router.replace('/coach-plan')}
            className="mt-6"
          />
        ) : null}
        {step > 0 ? (
          <CoachActionButton
            label="Previous question"
            variant="secondary"
            disabled={busy}
            onPress={() => setLocalStep(step - 1)}
            className="mt-6"
          />
        ) : null}
        <View className="mt-auto py-3">
          <Text className="text-center font-body text-xs text-[#6B665A]">
            Your answers save as you go.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
