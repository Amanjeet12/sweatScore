import { useAction, useConvex, useMutation, useQuery } from 'convex/react';
import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Check } from 'phosphor-react-native';
import { useEffect, useRef, useState } from 'react';
import {
  BackHandler,
  ScrollView,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { KeyboardStickyView, useKeyboardState } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import CoachActionButton from '~/components/core/CoachActionButton';
import SafeAreaView from '~/components/core/CoachSafeAreaView';
import CoachSetupLoading from '~/components/core/CoachSetupLoading';
import { OnboardingHeroChrome } from '~/components/core/auth/OnboardingHeroChrome';
import { OnboardingPrimaryButton } from '~/components/core/auth/OnboardingPrimaryButton';
import { Text } from '~/components/ui/text';
import { api } from '~/convex/_generated/api';
import { useCoachRouteGuard } from '~/hooks/useCoachRouteGuard';
import { COACH_CATEGORIES } from '~/shared/coachFoundation';
import { DAILY_QUESTIONS, PROFILE_QUESTIONS } from '~/shared/coachQuestions';
import { resumeMember } from '~/utils/coachResumeNavigation';

const QUESTION_ROUTES = ['profile', 'daily', 'today'] as const;

const PROFILE_COPY: Record<string, { eyebrow: string; description: string }> = {
  weight: {
    eyebrow: 'Your starting point',
    description: 'This helps your Coach follow your progress over time.',
  },
  goal: {
    eyebrow: 'Your goal',
    description: 'Choose the outcome that matters most to you right now.',
  },
  bodyFeeling: {
    eyebrow: 'How you feel',
    description: 'There is no right answer. Choose what feels most honest today.',
  },
  routineFeeling: {
    eyebrow: 'Your routine',
    description: 'This helps your Coach suggest something you can realistically maintain.',
  },
  foodRelationship: {
    eyebrow: 'Food and you',
    description: 'Pick the answer that best reflects most of your days.',
  },
  usualSleep: {
    eyebrow: 'Your recovery',
    description: 'Think about how your sleep usually feels, rather than one unusual night.',
  },
  biggestChallenge: {
    eyebrow: 'Your biggest barrier',
    description: 'Your Coach will keep this in mind when shaping your daily guidance.',
  },
};

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
  const [pendingProfileChoice, setPendingProfileChoice] = useState<string | null>(null);
  const submissionRef = useRef(false);
  const backHandlerRef = useRef<() => void>(() => {});
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const { isVisible: keyboardVisible } = useKeyboardState();
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      backHandlerRef.current();
      return true;
    });
    return () => subscription.remove();
  }, []);

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
    return <CoachSetupLoading />;
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

  const goBack = () => {
    if (busy) return;
    setError('');
    if (step > 0) {
      setPendingProfileChoice(null);
      setLocalStep(step - 1);
      return;
    }
    if (reanswerMode) {
      router.replace('/coach-plan');
      return;
    }
    if (decision.returningMember) {
      router.replace('/(tabs)/dashboard');
      return;
    }
    router.replace('/(auth)/setup-profile');
  };
  backHandlerRef.current = goBack;

  const choose = async (value: string) => {
    if (busy || submissionRef.current) return;
    submissionRef.current = true;
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
        } else {
          setPendingProfileChoice(null);
          setLocalStep(step + 1);
        }
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
      submissionRef.current = false;
      setBusy(false);
    }
  };

  const saveWeight = async () => {
    const value = Number(weight);
    if (!Number.isFinite(value) || value <= 0) {
      setError('Enter your current weight to continue.');
      return;
    }
    if (busy || submissionRef.current) return;
    submissionRef.current = true;
    setBusy(true);
    setError('');
    try {
      await saveProfile({ weight: { value, unit } });
      setLocalStep(1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save your weight.');
    } finally {
      submissionRef.current = false;
      setBusy(false);
    }
  };

  if (profile) {
    const copy = PROFILE_COPY[question.key] ?? {
      eyebrow: 'Your profile',
      description: 'Choose the answer that feels most like you.',
    };
    // Match the responsive hero used by the email and OTP onboarding screens.
    const heroHeight = Math.min(Math.max(windowHeight * 0.57, 380), 500);
    const effectiveProfileChoice =
      pendingProfileChoice ?? (typeof selected === 'string' ? selected : null);
    const canContinueWeight = Number.isFinite(Number(weight)) && Number(weight) > 0;
    const continueProfile = () => {
      saveWeight().catch(() => {});
    };

    return (
      <View className="flex-1 bg-white">
        <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />
        <Image
          source={require('~/assets/onboarding/coach-onboarding.jpg')}
          contentFit="cover"
          contentPosition={{ top: '22%', left: '50%' }}
          accessibilityIgnoresInvertColors
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            left: 0,
            width: '100%',
            height: heroHeight,
          }}
        />
        <OnboardingHeroChrome activeStep={step + 1} totalSteps={7} onBack={goBack} />

        <KeyboardStickyView style={{ flex: 1 }}>
          <View className="flex-1">
            <View style={{ width: '100%', height: heroHeight }} />
            {keyboardVisible ? <View className="flex-1" /> : null}
            <View
              className="overflow-hidden bg-white"
              style={{
                flex: keyboardVisible ? undefined : 1,
                maxHeight: keyboardVisible ? Math.max(320, windowHeight * 0.48) : undefined,
                marginTop: -32,
                borderTopLeftRadius: 34,
                borderTopRightRadius: 34,
              }}>
              <ScrollView
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="interactive"
                automaticallyAdjustKeyboardInsets
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{
                  flexGrow: 1,
                  paddingHorizontal: 24,
                  paddingTop: 28,
                  paddingBottom: Math.max(insets.bottom, 16) + 16,
                }}>
                <View accessibilityRole="progressbar" accessibilityLabel={`Step ${step + 1} of 7`}>
                  <Text className="font-body text-xs font-bold uppercase tracking-[1.5px] text-primary-500">
                    {copy.eyebrow}
                  </Text>
                  <Text className="mt-2 font-heading text-3xl font-semibold leading-10 text-[#1A1A1A]">
                    {question.title}
                  </Text>
                  <Text className="mt-2 font-body text-sm leading-6 text-[#77716D]">
                    {copy.description}
                  </Text>
                </View>

                <View className="mt-6">
                  {question.key === 'weight' ? (
                    <>
                      <View className="mb-4 flex-row gap-3">
                        {(['lb', 'kg'] as const).map((choice) => (
                          <TouchableOpacity
                            key={choice}
                            accessibilityRole="radio"
                            accessibilityState={{ selected: unit === choice }}
                            disabled={busy}
                            onPress={() => setUnit(choice)}
                            className={`min-h-12 flex-1 items-center justify-center rounded-2xl border ${unit === choice ? 'border-primary-500 bg-[#FFF3ED]' : 'border-[#E3E1DE] bg-white'}`}>
                            <Text className="font-body text-base font-semibold text-[#1A1A1A]">
                              {choice === 'lb' ? 'lbs' : 'kg'}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                      <TextInput
                        value={weight}
                        onChangeText={(value) => {
                          setError('');
                          setWeight(value);
                        }}
                        editable={!busy}
                        keyboardType="decimal-pad"
                        placeholder="e.g. 170"
                        placeholderTextColor="#AAA5A1"
                        accessibilityLabel="Current weight"
                        returnKeyType="done"
                        onSubmitEditing={continueProfile}
                        className="min-h-16 rounded-2xl border border-[#D9D5D2] bg-white px-5 py-4 font-body text-lg text-[#1A1A1A]"
                      />
                    </>
                  ) : (
                    question.options.map(([value, label], optionIndex) => {
                      const isSelected = effectiveProfileChoice === value;
                      return (
                        <TouchableOpacity
                          key={value}
                          disabled={busy}
                          onPress={() => {
                            setError('');
                            setPendingProfileChoice(value);
                            choose(value).catch(() => {});
                          }}
                          accessibilityRole="radio"
                          accessibilityState={{ selected: isSelected, disabled: busy }}
                          activeOpacity={0.82}
                          className={`mb-3 min-h-[68px] flex-row items-center rounded-[20px] border px-4 py-3 ${isSelected ? 'border-primary-500 bg-[#FFF3ED]' : 'border-[#E3E1DE] bg-white'}`}>
                          <View
                            className={`h-10 w-10 items-center justify-center rounded-[14px] ${isSelected ? 'bg-primary-500' : 'bg-[#FFF0E8]'}`}>
                            <Text
                              className={`font-body text-sm font-bold ${isSelected ? 'text-white' : 'text-primary-500'}`}>
                              {String(optionIndex + 1).padStart(2, '0')}
                            </Text>
                          </View>
                          <Text className="mx-4 flex-1 font-body text-base font-semibold leading-6 text-[#1A1A1A]">
                            {label}
                          </Text>
                          {isSelected ? <Check size={21} color="#FF5C1A" weight="bold" /> : null}
                        </TouchableOpacity>
                      );
                    })
                  )}
                </View>

                {error ? (
                  <Text
                    accessibilityLiveRegion="polite"
                    className="mt-1 font-body text-sm text-red-600">
                    {error}
                  </Text>
                ) : null}

                <View className="mt-auto pt-6">
                  {question.key === 'weight' && !keyboardVisible ? (
                    <OnboardingPrimaryButton
                      label="Continue"
                      onPress={continueProfile}
                      isLoading={busy}
                      disabled={!canContinueWeight}
                      borderRadius={18}
                      labelFontSize={18}
                    />
                  ) : null}
                  <Text className="mt-3 text-center font-body text-xs text-[#77716D]">
                    {question.key === 'weight' && keyboardVisible
                      ? 'Tap Done when your weight is entered.'
                      : question.key === 'weight'
                        ? 'Your answers save securely as you go.'
                        : busy
                          ? 'Saving your answer…'
                          : 'Choose one answer to continue.'}
                  </Text>
                </View>
              </ScrollView>
            </View>
          </View>
        </KeyboardStickyView>
      </View>
    );
  }

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
