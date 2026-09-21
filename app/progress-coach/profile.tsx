import { useMutation, useQuery } from 'convex/react';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Check } from 'phosphor-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { goBackOrReplace } from '~/components/core/BackButton';
import { CoachProgress } from '~/components/core/CoachPresentation';
import SafeAreaView from '~/components/core/SafeAreaView';
import ScreenLoading from '~/components/core/ScreenLoading';
import { Text } from '~/components/ui/text';
import { api } from '~/convex/_generated/api';
import {
  COACH_PROFILE_QUESTIONS,
  CoachProfileValues,
  CoachWeightUnit,
} from '~/shared/progressCoach';
import { useAuthStore } from '~/store/useAuthStore';

const REQUIRED_PROFILE_KEYS = COACH_PROFILE_QUESTIONS.map((question) => question.key);
const TOTAL_STEPS = COACH_PROFILE_QUESTIONS.length + 1;

type RequiredProfileValues = Omit<CoachProfileValues, 'currentWeight' | 'weightUnit'>;

function hasRequiredAnswers(
  answers: Partial<CoachProfileValues>
): answers is RequiredProfileValues {
  return REQUIRED_PROFILE_KEYS.every((key) => Boolean(answers[key]));
}

export function ErrorBoundary({ retry }: { error: Error; retry: () => Promise<void> }) {
  return (
    <SafeAreaView className="flex-1 bg-[#F9F9F9]">
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}>
        <Text className="text-center font-heading text-xl font-semibold text-[#1A1A1A]">
          Your profile could not load
        </Text>
        <Text className="mt-2 text-center font-body text-sm text-[#5A5551]">
          Check your connection and try again.
        </Text>
        <TouchableOpacity
          accessibilityRole="button"
          onPress={retry}
          className="mt-6 min-h-14 items-center justify-center rounded-[20px] bg-[#FF5C35] px-5">
          <Text className="font-heading text-base font-semibold text-white">Try again</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

export default function ProgressCoachProfile() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const isRetake = mode === 'retake';
  const currentUser = useAuthStore((state) => state.currentUser);
  const existingProfile = useQuery(
    api.progressCoach.getCoachProfile,
    isRetake && currentUser?._id ? {} : 'skip'
  );
  const upsertProfile = useMutation(api.progressCoach.upsertCoachProfile);
  const hydrated = useRef(false);
  const scrollRef = useRef<ScrollView>(null);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Partial<CoachProfileValues>>({});
  const [weight, setWeight] = useState('');
  const [weightUnit, setWeightUnit] = useState<CoachWeightUnit | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isRetake || existingProfile === undefined || hydrated.current) return;
    hydrated.current = true;
    if (!existingProfile) return;
    const { currentWeight, weightUnit: savedWeightUnit, ...profileAnswers } = existingProfile;
    setAnswers(profileAnswers);
    setWeight(currentWeight?.toString() ?? '');
    setWeightUnit(savedWeightUnit);
  }, [existingProfile, isRetake]);

  const goBack = useCallback(() => {
    if (step > 0) {
      setError(null);
      setStep((current) => current - 1);
      return true;
    }
    goBackOrReplace('/progress-coach');
    return true;
  }, [step]);

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'android') return;
      const subscription = BackHandler.addEventListener('hardwareBackPress', goBack);
      return () => subscription.remove();
    }, [goBack])
  );

  const question = step < COACH_PROFILE_QUESTIONS.length ? COACH_PROFILE_QUESTIONS[step] : null;
  const selectedValue = question ? answers[question.key] : undefined;
  const parsedWeight = useMemo(() => Number(weight.trim()), [weight]);
  const weightIsValid = weight.trim() === '' || (Number.isFinite(parsedWeight) && parsedWeight > 0);
  const canContinue = question
    ? Boolean(selectedValue)
    : weightIsValid && (weight.trim() === '' || weightUnit !== undefined);

  const handleContinue = async () => {
    if (!canContinue || submittingRef.current) return;
    setError(null);
    if (step < TOTAL_STEPS - 1) {
      setStep((current) => current + 1);
      return;
    }

    if (!hasRequiredAnswers(answers)) {
      setError('Please complete every profile question.');
      return;
    }

    submittingRef.current = true;
    setIsSubmitting(true);
    try {
      await upsertProfile({
        ...answers,
        ...(weight.trim() === ''
          ? { clearWeight: true }
          : { currentWeight: parsedWeight, weightUnit, clearWeight: false }),
      });
      goBackOrReplace('/progress-coach');
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'We could not save your profile. Try again.'
      );
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  if (!currentUser || (isRetake && existingProfile === undefined)) {
    return <ScreenLoading />;
  }

  if (isRetake && existingProfile === null) {
    return (
      <SafeAreaView className="flex-1 bg-[#F9F9F9]">
        <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}>
          <Text className="text-center font-body text-base text-[#5A5551]">
            Your coach profile could not be loaded.
          </Text>
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => router.replace('/progress-coach' as any)}
            className="mt-6 min-h-14 items-center justify-center rounded-[20px] bg-[#FF5C35] px-5">
            <Text className="font-heading text-base font-semibold text-white">Return to coach</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#F9F9F9]">
      <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View className="flex-row items-center px-5 pb-3 pt-3">
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={step > 0 ? 'Previous profile question' : 'Back to Progress Coach'}
            onPress={goBack}
            className="h-12 w-12 items-center justify-center rounded-full bg-white">
            <ArrowLeft size={22} color="#1A1A1A" weight="bold" />
          </TouchableOpacity>
          <View className="ml-4 flex-1">
            <Text className="font-heading text-sm font-semibold text-[#5A5551]">
              {isRetake ? 'Retake profile' : 'Set up profile'}
            </Text>
            <Text className="mt-0.5 font-body text-xs text-[#807A76]">
              Step {step + 1} of {TOTAL_STEPS}
            </Text>
          </View>
        </View>

        <CoachProgress step={step} total={TOTAL_STEPS} />

        <ScrollView
          ref={scrollRef}
          className="flex-1"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 20, paddingBottom: 24 }}>
          <View className="flex-1 pb-8 pt-8">
            <Text className="mb-3 font-heading text-xs font-semibold uppercase tracking-widest text-[#FF4B1F]">
              A little about you
            </Text>
            {question ? (
              <>
                <Text
                  allowFontScaling
                  className="font-heading text-[28px] font-semibold text-[#1A1A1A]">
                  {question.title}
                </Text>
                <Text className="mt-3 font-body text-sm text-[#5A5551]">
                  Tap an answer to move to the next question. You can go back to review your
                  answers.
                </Text>
                <View className="mt-7 gap-y-3">
                  {question.options.map((option) => {
                    const selected = selectedValue === option.value;
                    return (
                      <TouchableOpacity
                        key={option.value}
                        activeOpacity={0.78}
                        accessibilityRole="radio"
                        accessibilityState={{ selected }}
                        accessibilityHint="Selects this answer and opens the next question"
                        onPress={() => {
                          if (submittingRef.current) return;
                          setAnswers((current) => ({
                            ...current,
                            [question.key]: option.value,
                          }));
                          setError(null);
                          // Use this screen's step so repeated taps cannot skip a question.
                          setStep(step + 1);
                          scrollRef.current?.scrollTo({ y: 0, animated: false });
                        }}
                        className="min-h-16 flex-row items-center rounded-[20px] border px-4 py-3"
                        style={{
                          borderColor: selected ? '#FF5C35' : '#E3E1DE',
                          backgroundColor: selected ? '#FFF0E8' : '#FFFFFF',
                        }}>
                        <Text
                          allowFontScaling
                          className="min-w-0 flex-1 font-body text-base text-[#1A1A1A]">
                          {option.label}
                        </Text>
                        <View className="ml-3 h-7 w-7 items-center justify-center rounded-full border border-[#E3E1DE] bg-white">
                          {selected ? <Check size={18} color="#FF4B1F" weight="bold" /> : null}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            ) : (
              <>
                <Text
                  allowFontScaling
                  className="font-heading text-[28px] font-semibold text-[#1A1A1A]">
                  What is your current weight?
                </Text>
                <Text className="mt-2 font-body text-sm leading-5 text-[#807A76]">
                  Optional. This is stored with your profile but does not affect today’s targets.
                </Text>
                <TextInput
                  accessibilityLabel="Current weight"
                  value={weight}
                  onChangeText={(value) => {
                    setWeight(value);
                    if (value.trim() === '') setWeightUnit(undefined);
                  }}
                  keyboardType="decimal-pad"
                  placeholder="Enter weight or leave blank"
                  placeholderTextColor="#9B9591"
                  className="mt-7 min-h-14 rounded-[18px] border border-[#E3E1DE] bg-white px-4 font-body text-lg text-[#1A1A1A]"
                />
                <View className="mt-4 flex-row gap-x-3">
                  {(['lb', 'kg'] as const).map((unit) => {
                    const selected = weightUnit === unit;
                    return (
                      <TouchableOpacity
                        key={unit}
                        accessibilityRole="radio"
                        accessibilityState={{ selected }}
                        onPress={() => setWeightUnit(unit)}
                        className="min-h-12 flex-1 items-center justify-center rounded-[18px] border"
                        style={{
                          borderColor: selected ? '#FF5C35' : '#E3E1DE',
                          backgroundColor: selected ? '#FFF0E8' : '#FFFFFF',
                        }}>
                        <Text className="font-heading text-base font-semibold text-[#1A1A1A]">
                          {unit.toUpperCase()}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {!weightIsValid ? (
                  <Text className="mt-3 font-body text-sm text-red-600">
                    Enter a positive number or leave this field blank.
                  </Text>
                ) : null}
              </>
            )}
          </View>

          {error ? (
            <Text className="mb-3 text-center font-body text-sm text-red-600">{error}</Text>
          ) : null}
          {!question ? (
            <TouchableOpacity
              activeOpacity={0.82}
              accessibilityRole="button"
              accessibilityState={{ disabled: !canContinue || isSubmitting }}
              disabled={!canContinue || isSubmitting}
              onPress={handleContinue}
              className="min-h-14 items-center justify-center rounded-[20px] bg-[#FF5C35] px-5 py-4"
              style={{ opacity: !canContinue || isSubmitting ? 0.45 : 1 }}>
              <Text
                allowFontScaling
                className="text-center font-heading text-base font-semibold text-white">
                {isSubmitting ? 'Saving…' : 'Save profile'}
              </Text>
            </TouchableOpacity>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
