import { useMutation } from 'convex/react';
import { router, Stack, useFocusEffect } from 'expo-router';
import { ArrowLeft, Check } from 'phosphor-react-native';
import { useCallback, useRef, useState } from 'react';
import { BackHandler, Platform, ScrollView, TouchableOpacity, View } from 'react-native';

import { goBackOrReplace } from '~/components/core/BackButton';
import { CoachProgress } from '~/components/core/CoachPresentation';
import SafeAreaView from '~/components/core/CoachSafeAreaView';
import { Text } from '~/components/ui/text';
import { api } from '~/convex/_generated/api';
import { COACH_DAILY_QUESTIONS, CoachDailyInputs } from '~/shared/progressCoach';

const DAILY_KEYS = COACH_DAILY_QUESTIONS.map((question) => question.key);
function hasAllAnswers(answers: Partial<CoachDailyInputs>): answers is CoachDailyInputs {
  return DAILY_KEYS.every((key) => Boolean(answers[key]));
}

export default function ProgressCoachCheckIn() {
  const startTodayPlan = useMutation(api.progressCoach.startTodayPlan);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Partial<CoachDailyInputs>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const scrollRef = useRef<ScrollView>(null);
  const [error, setError] = useState<string | null>(null);
  const question = COACH_DAILY_QUESTIONS[step];
  const selectedValue = answers[question.key];

  const goBack = useCallback(() => {
    if (step > 0) setStep((current) => current - 1);
    else goBackOrReplace('/progress-coach');
    setError(null);
    return true;
  }, [step]);

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'android') return;
      const subscription = BackHandler.addEventListener('hardwareBackPress', goBack);
      return () => subscription.remove();
    }, [goBack])
  );

  const handleContinue = async () => {
    if (!selectedValue || submittingRef.current) return;
    setError(null);
    if (step < COACH_DAILY_QUESTIONS.length - 1) {
      setStep((current) => current + 1);
      return;
    }
    if (!hasAllAnswers(answers)) {
      setError('Please answer every check-in question.');
      return;
    }
    submittingRef.current = true;
    setIsSubmitting(true);
    try {
      await startTodayPlan({ inputs: answers });
      router.replace('/progress-coach/plan' as any);
    } catch {
      setError('We could not create today’s plan. Please return to Progress Coach and try again.');
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-[#F9F9F9]">
      <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />
      <View className="flex-row items-center px-5 pb-3 pt-3">
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={step > 0 ? 'Previous check-in question' : 'Back to Progress Coach'}
          onPress={goBack}
          className="h-12 w-12 items-center justify-center rounded-full bg-white">
          <ArrowLeft size={22} color="#1A1A1A" weight="bold" />
        </TouchableOpacity>
        <View className="ml-4 flex-1">
          <Text className="font-heading text-sm font-semibold text-[#5A5551]">
            Today’s check-in
          </Text>
          <Text className="mt-0.5 font-body text-xs text-[#807A76]">
            Step {step + 1} of {COACH_DAILY_QUESTIONS.length}
          </Text>
        </View>
      </View>
      <CoachProgress step={step} total={COACH_DAILY_QUESTIONS.length} />
      <ScrollView
        ref={scrollRef}
        className="flex-1"
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 20, paddingBottom: 24 }}>
        <View className="flex-1 pb-8 pt-8">
          <Text className="mb-3 font-heading text-xs font-semibold uppercase tracking-widest text-[#FF4B1F]">
            Today’s readiness
          </Text>
          <Text allowFontScaling className="font-heading text-[28px] font-semibold text-[#1A1A1A]">
            {question.title}
          </Text>
          <Text className="mt-3 font-body text-sm text-[#5A5551]">
            {step < COACH_DAILY_QUESTIONS.length - 1
              ? 'Tap an answer to move to the next question.'
              : 'Choose how your body feels, then create today’s focus when you’re ready.'}
          </Text>
          <View className="mt-7 gap-y-3">
            {question.options.map((option) => {
              const selected = selectedValue === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  activeOpacity={0.78}
                  accessibilityRole="radio"
                  accessibilityState={{ selected, disabled: isSubmitting }}
                  disabled={isSubmitting}
                  accessibilityHint={
                    step < COACH_DAILY_QUESTIONS.length - 1
                      ? 'Selects this answer and opens the next question'
                      : 'Selects this answer for your daily focus'
                  }
                  onPress={() => {
                    if (submittingRef.current) return;
                    setAnswers((current) => ({ ...current, [question.key]: option.value }));
                    setError(null);
                    if (step < COACH_DAILY_QUESTIONS.length - 1) {
                      setStep(step + 1);
                      scrollRef.current?.scrollTo({ y: 0, animated: false });
                    }
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
        </View>
        {error ? (
          <Text className="mb-3 text-center font-body text-sm text-red-600">{error}</Text>
        ) : null}
        {step === COACH_DAILY_QUESTIONS.length - 1 ? (
          <TouchableOpacity
            activeOpacity={0.82}
            accessibilityRole="button"
            accessibilityState={{ disabled: !selectedValue || isSubmitting }}
            disabled={!selectedValue || isSubmitting}
            onPress={handleContinue}
            className="min-h-14 items-center justify-center rounded-[20px] bg-[#FF5C35] px-5 py-4"
            style={{ opacity: !selectedValue || isSubmitting ? 0.45 : 1 }}>
            <Text className="text-center font-heading text-base font-semibold text-white">
              {isSubmitting ? 'Saving today’s focus…' : 'Create today’s focus'}
            </Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
