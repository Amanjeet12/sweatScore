import { useAction, useConvex, useMutation, useQuery } from 'convex/react';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Check } from 'phosphor-react-native';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { BackHandler, Keyboard, ScrollView, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BuildingRoutine } from '~/components/core/auth/BuildingRoutine';
import { CoachSurveyBridge } from '~/components/core/auth/CoachSurveyBridge';
import {
  PrototypeOnboarding,
  PrototypeButton,
  PrototypeError,
  onboardingStyles as surveyStyles,
} from '~/components/core/auth/PrototypeOnboarding';
import DailyQuestion from '~/components/core/dashboard/DailyQuestion';
import {
  prototypeComponents as chrome,
  prototypeTypography as type,
} from '~/components/core/design/prototypeStyles';
import { Text } from '~/components/ui/text';
import { api } from '~/convex/_generated/api';
import { useCoachRouteGuard } from '~/hooks/useCoachRouteGuard';
import {
  bodySelections,
  isUnanswered,
  toggleBodyFeeling,
  type BodyFeeling,
} from '~/shared/coachBodyFeeling';
import { COACH_CATEGORIES } from '~/shared/coachFoundation';
import { DAILY_QUESTIONS, PROFILE_QUESTIONS } from '~/shared/coachQuestions';
import { useAuthStore } from '~/store/useAuthStore';
import { resumeMember } from '~/utils/coachResumeNavigation';

const QUESTION_ROUTES = ['profile', 'daily', 'today'] as const;
const PROFILE_REVIEW_ROUTES = ['profile', 'health'] as const;
const BUILDING_ROUTINE_MINIMUM_MS = 6000;

const PROFILE_COPY: Record<string, { eyebrow: string; description: string }> = {
  weight: {
    eyebrow: "LET'S SET YOU UP",
    description: 'Used to track your trend over time.',
  },
  goal: {
    eyebrow: 'YOUR PROFILE',
    description: 'This shapes every suggestion your coach gives.',
  },
  bodyFeeling: {
    eyebrow: 'YOUR PROFILE',
    description: "There's no wrong answer here.",
  },
  routineFeeling: {
    eyebrow: 'YOUR PROFILE',
    description: '',
  },
  foodRelationship: {
    eyebrow: 'YOUR PROFILE',
    description: '',
  },
  usualSleep: {
    eyebrow: 'YOUR PROFILE',
    description: '',
  },
  biggestChallenge: {
    eyebrow: 'YOUR PROFILE',
    description: '',
  },
};

const PROFILE_OPTION_DESCRIPTIONS: Record<string, Record<string, string>> = {
  goal: {
    lose: 'Lose overall body fat',
    recomp: 'Build muscle and lose fat',
    fitness: 'Get more consistent',
  },
  bodyFeeling: {
    feel_good: 'Working on improving',
    little_insecure: 'Some areas I want to work on',
    quite_insecure: 'Really want to change how I feel',
  },
};

export default function CoachOnboarding() {
  const convex = useConvex();
  const memberId = useAuthStore((state) => state.currentUser?._id);
  const [showProfileIntro, setShowProfileIntro] = useState(false);
  const [surveyStartedFor, setSurveyStartedFor] = useState<typeof memberId>(undefined);
  const previousScreen = useRef<{ memberId: typeof memberId; content: ReactNode }>({
    memberId,
    content: null,
  });
  if (previousScreen.current.memberId !== memberId)
    previousScreen.current = { memberId, content: null };
  const rememberScreen = (content: ReactNode) => {
    previousScreen.current = { memberId, content };
    return content;
  };
  const { reanswer, nextCheckIn, reviewProfile } = useLocalSearchParams<{
    reanswer?: string;
    nextCheckIn?: string;
    reviewProfile?: string;
  }>();
  const selectedCheckIn = COACH_CATEGORIES.find((item) => item === nextCheckIn);
  const reanswerMode = __DEV__ && reanswer === '1';
  const [completingProfile, setCompletingProfile] = useState(false);
  // Health is still a free onboarding boundary; reviewing answers grants no paid access.
  const { decision, accepted } = useCoachRouteGuard(
    reviewProfile === '1' ? PROFILE_REVIEW_ROUTES : QUESTION_ROUTES,
    completingProfile
  );
  const reviewingProfile = reviewProfile === '1' && decision?.screen === 'health';
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
  const userName = useAuthStore((state) => state.currentUser?.name?.trim());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pendingProfileChoice, setPendingProfileChoice] = useState<string | null>(null);
  const [pendingBody, setPendingBody] = useState<{ scope: string; values: BodyFeeling[] } | null>(
    null
  );
  const submissionRef = useRef(false);
  const backHandlerRef = useRef<() => void>(() => {});
  const insets = useSafeAreaInsets();

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
      !reanswerMode &&
      decision?.screen === 'today' &&
      currentPlan?.requestStatus === 'none' &&
      foundation?.state?.profileRevisionId
    )
      router.replace('/(tabs)/dashboard');
  }, [
    decision?.screen,
    currentPlan?.requestStatus,
    foundation?.state?.profileRevisionId,
    reanswerMode,
  ]);
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

  if (completingProfile) return <BuildingRoutine name={userName} />;

  if (
    !accepted ||
    !decision ||
    !foundation ||
    (decision.screen === 'today' && !currentPlan) ||
    (!reanswerMode && decision.screen === 'today' && currentPlan?.requestStatus !== 'none') ||
    (!reanswerMode &&
      decision.screen === 'today' &&
      Boolean(foundation.state?.profileRevisionId)) ||
    (reanswerMode && foundation.state?.testReanswerDay !== foundation.day)
  )
    return previousScreen.current.content;
  const profile =
    !reanswerMode &&
    (reviewingProfile ||
      decision.screen === 'profile' ||
      (decision.screen === 'today' && !foundation.state?.profileRevisionId));
  const questions = profile ? PROFILE_QUESTIONS : DAILY_QUESTIONS;
  const testDraft = foundation.state?.testReanswerDraft;
  const nextTestStep = reanswerMode
    ? DAILY_QUESTIONS.findIndex((item) => isUnanswered(testDraft?.[item.key]))
    : -1;
  const currentDraft = profile
    ? foundation.state?.profileDraft
    : foundation.state?.dailyDraftDay === decision.day
      ? foundation.state?.dailyDraft
      : undefined;
  const firstUnanswered = questions.findIndex((item) =>
    isUnanswered((currentDraft as Record<string, unknown> | undefined)?.[item.key])
  );
  const step = Math.min(
    localStep ??
      (reanswerMode
        ? nextTestStep < 0
          ? 4
          : nextTestStep
        : reviewingProfile
          ? questions.length - 1
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
  const bodyScope = `${decision.day}:${reanswerMode ? foundation.state?.testReanswerKey : 'daily'}`;
  const selectedBody =
    pendingBody?.scope === bodyScope
      ? pendingBody.values
      : bodySelections(
          reanswerMode
            ? testDraft?.body
            : foundation.state?.dailyDraftDay === decision.day
              ? foundation.state.dailyDraft?.body
              : undefined
        );
  const chooseBody = async (value: BodyFeeling) => {
    if (busy || submissionRef.current) return;
    submissionRef.current = true;
    const values = toggleBodyFeeling(selectedBody, value);
    setPendingBody({ scope: bodyScope, values });
    setBusy(true);
    setError('');
    try {
      if (reanswerMode) await saveReanswer({ body: values });
      else await saveDaily({ body: values });
    } catch {
      setError('Could not save your answer. Please try again.');
    } finally {
      submissionRef.current = false;
      setBusy(false);
    }
  };
  const submitBody = async () => {
    if (busy || submissionRef.current || selectedBody.length === 0) return;
    submissionRef.current = true;
    setBusy(true);
    setError('');
    try {
      if (reanswerMode) {
        await finishReanswer({ body: selectedBody });
        router.replace('/coach-plan');
      } else {
        await submitDaily({
          body: selectedBody,
          requestKey: `first_${decision.day.replaceAll('-', '')}`,
        });
        router.replace({
          pathname: '/coach-plan-loading',
          params: selectedCheckIn ? { nextCheckIn: selectedCheckIn } : {},
        });
      }
    } catch {
      setError('Could not prepare today’s plan. Your selections are kept here. Please try again.');
    } finally {
      submissionRef.current = false;
      setBusy(false);
    }
  };

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
    if (profile) {
      setShowProfileIntro(true);
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
        await saveReanswer({ [question.key]: value } as Parameters<typeof saveReanswer>[0]);
        setLocalStep(step + 1);
      } else if (profile) {
        const finishingProfile = step === PROFILE_QUESTIONS.length - 1;
        const startedBuildingAt = Date.now();
        if (finishingProfile) setCompletingProfile(true);
        await saveProfile({ [question.key]: value } as Parameters<typeof saveProfile>[0]);
        if (finishingProfile) {
          await finishProfile({});
          const remaining = BUILDING_ROUTINE_MINIMUM_MS - (Date.now() - startedBuildingAt);
          if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
          if (decision.returningMember) router.replace('/(tabs)/dashboard');
          else await resumeMember(convex);
        } else {
          setPendingProfileChoice(null);
          setLocalStep(step + 1);
        }
      } else {
        await saveDaily({ [question.key]: value } as Parameters<typeof saveDaily>[0]);
        setPendingProfileChoice(null);
        setLocalStep(step + 1);
      }
    } catch {
      setCompletingProfile(false);
      setPendingProfileChoice(null);
      setError('Could not save your answer. Please try again.');
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
    } catch {
      setError('Could not save your weight. Please try again.');
    } finally {
      submissionRef.current = false;
      setBusy(false);
    }
  };

  if (profile) {
    if (showProfileIntro || (firstUnanswered === 0 && surveyStartedFor !== memberId)) {
      return rememberScreen(
        <View className="flex-1 bg-white">
          <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />
          <CoachSurveyBridge
            onStart={() => {
              setShowProfileIntro(false);
              setSurveyStartedFor(memberId);
            }}
          />
        </View>
      );
    }
    const copy = PROFILE_COPY[question.key];
    const effectiveProfileChoice =
      pendingProfileChoice ?? (typeof selected === 'string' ? selected : null);
    const canContinueWeight = Number.isFinite(Number(weight)) && Number(weight) > 0;
    const continueProfile = () => {
      Keyboard.dismiss();
      saveWeight().catch(() => {});
    };
    return rememberScreen(
      <PrototypeOnboarding
        key={question.key}
        image={require('~/assets/onboarding/survey-headphones.jpg')}
        stickyFooter={question.key === 'weight'}
        activeStep={step + 1}
        onBack={goBack}
        footer={
          question.key === 'weight' ? (
            <PrototypeButton
              label="Continue"
              onPress={continueProfile}
              loading={busy}
              disabled={!canContinueWeight}
            />
          ) : (
            <PrototypeError error={error} />
          )
        }>
        <Stack.Screen options={{ gestureEnabled: false }} />
        <Text accessibilityRole="header" style={surveyStyles.heading}>
          {question.title}
        </Text>
        {copy?.description ? <Text style={surveyStyles.subtitle}>{copy.description}</Text> : null}
        {question.key === 'weight' ? (
          <>
            <View
              style={{
                marginTop: 24,
                flexDirection: 'row',
                padding: 4,
                borderRadius: 16,
                backgroundColor: '#f5f5f5',
              }}>
              {(['lb', 'kg'] as const).map((choice) => (
                <TouchableOpacity
                  key={choice}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: unit === choice, disabled: busy }}
                  disabled={busy}
                  onPress={() => {
                    setError('');
                    setUnit(choice);
                  }}
                  style={{
                    flex: 1,
                    paddingVertical: 11,
                    borderRadius: 12,
                    alignItems: 'center',
                    backgroundColor: unit === choice ? '#fff' : 'transparent',
                    shadowColor: '#1e140a',
                    shadowOpacity: unit === choice ? 0.12 : 0,
                    shadowRadius: 4,
                    shadowOffset: { width: 0, height: 1 },
                    elevation: unit === choice ? 1 : 0,
                  }}>
                  <Text
                    style={{
                      ...type[unit === choice ? 'selectedUnit' : 'unit'],
                    }}>
                    {choice === 'lb' ? 'lbs' : 'kg'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={{ marginTop: 14, justifyContent: 'center' }}>
              <TextInput
                value={weight}
                onChangeText={(value) => {
                  setError('');
                  setWeight(value);
                }}
                editable={!busy}
                keyboardType="decimal-pad"
                placeholder="e.g. 170"
                placeholderTextColor="#8a8a8a"
                accessibilityLabel="Current weight"
                returnKeyType="done"
                onSubmitEditing={continueProfile}
                style={[
                  surveyStyles.field,
                  { paddingRight: 64, borderColor: error ? '#d92d20' : '#ececec' },
                ]}
              />
              <Text
                style={{
                  position: 'absolute',
                  right: 18,
                  fontFamily: 'Inter_400Regular',
                  fontSize: 15,
                  color: '#8a8a8a',
                }}>
                {unit === 'lb' ? 'lbs' : 'kg'}
              </Text>
            </View>
            <PrototypeError error={error} />
          </>
        ) : (
          <View style={{ marginTop: 24, gap: 12 }}>
            {question.options.map(([value, label]) => {
              const isSelected = effectiveProfileChoice === value;
              const description = PROFILE_OPTION_DESCRIPTIONS[question.key]?.[value];
              return (
                <TouchableOpacity
                  key={value}
                  disabled={busy}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected, disabled: busy }}
                  activeOpacity={0.82}
                  onPress={() => {
                    setError('');
                    setPendingProfileChoice(value);
                    choose(value).catch(() => {});
                  }}
                  style={{
                    ...chrome.option,
                    borderColor: isSelected ? '#ff5a1f' : '#ececec',
                    backgroundColor: isSelected ? '#fff3ea' : '#fff',
                    opacity: busy && !isSelected ? 0.65 : 1,
                  }}>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        ...type[isSelected ? 'selectedOption' : 'option'],
                      }}>
                      {label}
                    </Text>
                    {description ? (
                      <Text style={[surveyStyles.small, { marginTop: 2 }]}>{description}</Text>
                    ) : null}
                  </View>
                  <View
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 12,
                      borderWidth: 1.5,
                      borderColor: isSelected ? '#ff5a1f' : '#d9d9d9',
                      backgroundColor: isSelected ? '#ff5a1f' : '#fff',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                    {isSelected ? <Check size={14} color="#fff" weight="bold" /> : null}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </PrototypeOnboarding>
    );
  }

  const effectiveDailyChoice =
    pendingProfileChoice ?? (typeof selected === 'string' ? selected : null);
  return rememberScreen(
    <View className="flex-1 bg-white" style={{ paddingTop: insets.top }}>
      <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 22,
          paddingTop: 18,
          paddingBottom: insets.bottom + 28,
        }}>
        <DailyQuestion
          index={step}
          total={DAILY_QUESTIONS.length}
          title={question.title}
          description={
            decision.changedDay && step === 0
              ? 'It’s a new day. Your earlier plan is saved; answer for a fresh plan.'
              : reanswerMode
                ? 'Update your answers for today.'
                : step === 0
                  ? 'Answer 5 quick questions to get a personalised plan today.'
                  : undefined
          }
          options={question.options}
          selected={question.key === 'body' ? selectedBody : effectiveDailyChoice}
          multiple={question.key === 'body'}
          onContinue={
            question.key === 'body'
              ? () => {
                  submitBody().catch(() => {});
                }
              : undefined
          }
          busy={busy}
          onChoose={(value) => {
            if (question.key === 'body') {
              chooseBody(value as BodyFeeling).catch(() => {});
              return;
            }
            setError('');
            setPendingProfileChoice(value);
            choose(value).catch(() => {});
          }}
          onBack={step > 0 ? goBack : undefined}
          onClose={() => router.replace('/(tabs)/dashboard')}
        />
        {error ? (
          <Text
            accessibilityLiveRegion="polite"
            accessibilityRole="alert"
            className="mt-3"
            style={type.error}>
            {error}
          </Text>
        ) : null}
      </ScrollView>
    </View>
  );
}
