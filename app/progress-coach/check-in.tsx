import { useMutation } from 'convex/react';
import { router, Stack, useFocusEffect } from 'expo-router';
import { ArrowLeft, Check } from 'phosphor-react-native';
import { useCallback, useRef, useState } from 'react';
import { BackHandler, Platform, ScrollView, TouchableOpacity, View } from 'react-native';

import SafeAreaView from '~/components/core/SafeAreaView';
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
  const [error, setError] = useState<string | null>(null);
  const question = COACH_DAILY_QUESTIONS[step];
  const selectedValue = answers[question.key];

  const goBack = useCallback(() => {
    if (step > 0) setStep((current) => current - 1);
    else router.back();
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
      <Stack.Screen options={{ headerShown: false }} />
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
      <View className="mx-5 h-1.5 overflow-hidden rounded-full bg-[#E9E3DF]">
        <View
          className="h-full rounded-full bg-[#FF5C35]"
          style={{ width: `${((step + 1) / COACH_DAILY_QUESTIONS.length) * 100}%` }}
        />
      </View>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 20, paddingBottom: 24 }}>
        <View className="flex-1 pt-8">
          <Text
            allowFontScaling
            maxFontSizeMultiplier={1.4}
            className="font-heading text-2xl font-semibold leading-8 text-[#1A1A1A]">
            {question.title}
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
                  onPress={() =>
                    setAnswers((current) => ({ ...current, [question.key]: option.value }))
                  }
                  className="min-h-16 flex-row items-center rounded-[20px] border px-4 py-3"
                  style={{
                    borderColor: selected ? '#FF5C35' : '#E3E1DE',
                    backgroundColor: selected ? '#FFF0E8' : '#FFFFFF',
                  }}>
                  <Text
                    allowFontScaling
                    maxFontSizeMultiplier={1.4}
                    className="min-w-0 flex-1 font-body text-base leading-6 text-[#1A1A1A]">
                    {option.label}
                  </Text>
                  {selected ? <Check size={20} color="#FF5C35" weight="bold" /> : null}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
        {error ? (
          <Text className="mb-3 text-center font-body text-sm text-red-600">{error}</Text>
        ) : null}
        <TouchableOpacity
          activeOpacity={0.82}
          accessibilityRole="button"
          accessibilityState={{ disabled: !selectedValue || isSubmitting }}
          disabled={!selectedValue || isSubmitting}
          onPress={handleContinue}
          className="min-h-14 items-center justify-center rounded-[20px] bg-[#FF5C35] px-5 py-3"
          style={{ opacity: !selectedValue || isSubmitting ? 0.45 : 1 }}>
          <Text className="text-center font-heading text-base font-semibold text-white">
            {isSubmitting
              ? 'Creating today’s plan…'
              : step === COACH_DAILY_QUESTIONS.length - 1
                ? 'Create today’s plan'
                : 'Continue'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
