import { useAction, useConvex, useMutation, useQuery } from 'convex/react';
import { router, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, TextInput, TouchableOpacity, View } from 'react-native';
import SafeAreaView from '~/components/core/CoachSafeAreaView';
import CoachActionButton from '~/components/core/CoachActionButton';
import ScreenLoading from '~/components/core/ScreenLoading';
import { Text } from '~/components/ui/text';
import { api } from '~/convex/_generated/api';
import { useCoachRouteGuard } from '~/hooks/useCoachRouteGuard';
import { DAILY_QUESTIONS, PROFILE_QUESTIONS } from '~/shared/coachQuestions';
import { resumeMember } from '~/utils/coachResumeNavigation';

const QUESTION_ROUTES = ['profile', 'daily', 'today'] as const;

export default function CoachOnboarding() {
  const convex = useConvex();
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
  const [localStep, setLocalStep] = useState<number | null>(null);
  const [weight, setWeight] = useState('');
  const [unit, setUnit] = useState<'lb' | 'kg'>('lb');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setLocalStep(null);
  }, [decision?.screen, decision?.day]);
  useEffect(() => {
    if (decision?.screen === 'today' && currentPlan && currentPlan.requestStatus !== 'none')
      router.replace('/coach-plan');
  }, [decision?.screen, currentPlan?.requestStatus]);
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
    (decision.screen === 'today' && currentPlan?.requestStatus !== 'none')
  )
    return <ScreenLoading />;
  const profile = decision.screen === 'profile';
  const questions = profile ? PROFILE_QUESTIONS : DAILY_QUESTIONS;
  const step = Math.min(localStep ?? decision.question, questions.length - 1);
  const question = questions[step];
  const saved = profile
    ? foundation.state?.profileDraft
    : foundation.state?.dailyDraftDay === decision.day
      ? foundation.state?.dailyDraft
      : undefined;
  const selected = saved?.[question.key as keyof typeof saved];

  const choose = async (value: string) => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      if (profile) {
        await saveProfile({ [question.key]: value } as Parameters<typeof saveProfile>[0]);
        if (step === PROFILE_QUESTIONS.length - 1) {
          await finishProfile({});
          await resumeMember(convex);
        } else setLocalStep(step + 1);
      } else if (step === DAILY_QUESTIONS.length - 1) {
        await submitDaily({
          body: value as 'fine',
          requestKey: `first_${decision.day.replaceAll('-', '')}`,
        });
        await resumeMember(convex);
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
          {profile ? 'YOUR PROFILE' : "TODAY'S PLAN"} · {step + 1} OF {questions.length}
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
