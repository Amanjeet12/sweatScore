import { useAction, useQuery } from 'convex/react';
import * as Crypto from 'expo-crypto';
import { router, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import CoachActionButton from '~/components/core/CoachActionButton';
import SafeAreaView from '~/components/core/CoachSafeAreaView';
import ScreenLoading from '~/components/core/ScreenLoading';
import { Text } from '~/components/ui/text';
import { api } from '~/convex/_generated/api';
import { useCoachRouteGuard } from '~/hooks/useCoachRouteGuard';
import { PROFILE_QUESTIONS } from '~/shared/coachQuestions';

type Answers = {
  goal: 'lose' | 'recomp' | 'fitness';
  bodyFeeling: 'feel_good' | 'little_insecure' | 'quite_insecure';
  routineFeeling: 'working_keep_going' | 'starting_stopping' | 'struggle_keep_up';
  foodRelationship:
    | 'balanced_most_days'
    | 'fall_off'
    | 'restrict_then_overeat'
    | 'do_not_think_about_it';
  usualSleep: 'regular_restful' | 'okay_could_be_better' | 'needs_work';
  biggestChallenge: 'time' | 'motivation' | 'food' | 'something_else';
};
export default function CoachProfileEditor() {
  const { accepted, decision } = useCoachRouteGuard(['today']);
  const profile = useQuery(api.coachProfileEditor.myProfile, accepted ? {} : 'skip');
  const save = useAction(api.coachDailyService.saveProfileAndMaybeRefresh);
  const [answers, setAnswers] = useState<Partial<Answers>>({});
  const [weight, setWeight] = useState('');
  const [unit, setUnit] = useState<'lb' | 'kg'>('lb');
  const [initialized, setInitialized] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!profile || initialized) return;
    setAnswers(profile.answers);
    setWeight(String(profile.weight.value));
    setUnit(profile.weight.unit);
    setInitialized(true);
  }, [profile, initialized]);
  if (!accepted || profile === undefined) return <ScreenLoading />;
  if (!profile) return <Text>Complete your profile from Today first.</Text>;
  const submit = async () => {
    if (!decision?.verifiedAccess) return;
    const value = Number(weight);
    if (
      !Number.isFinite(value) ||
      value <= 0 ||
      Object.keys(profile.answers).some((key) => !answers[key as keyof Answers])
    ) {
      setError('Complete all seven answers.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await save({
        answers: answers as Answers,
        weight: { value, unit },
        expectedVersion: profile.version,
        requestKey: `profile_${Crypto.randomUUID().replaceAll('-', '')}`,
      });
      router.replace('/coach-plan');
    } catch (cause) {
      setError('Could not save your profile. Please try again.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <SafeAreaView className="flex-1 bg-[#F9F9F9]">
      <Stack.Screen options={{ title: 'Update your profile' }} />
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 24, paddingBottom: 48 }}>
          <Text className="font-heading text-2xl font-semibold">Update your profile</Text>
          <Text className="mb-5 mt-2 text-sm text-[#6B665F]">
            Your saved answers are preselected. Saving may refresh today’s plan once.
          </Text>
          {PROFILE_QUESTIONS.map((question) => (
            <View key={question.key} className="mb-4 rounded-2xl bg-white p-4">
              <Text className="mb-3 font-heading text-base font-semibold">{question.title}</Text>
              {question.key === 'weight' ? (
                <>
                  <View className="mb-3 flex-row gap-2">
                    {(['lb', 'kg'] as const).map((choice) => (
                      <TouchableOpacity
                        key={choice}
                        onPress={() => setUnit(choice)}
                        className="rounded-[20px] px-4 py-2"
                        style={{ backgroundColor: unit === choice ? '#FFF0E8' : '#F5F3F1' }}>
                        <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 16 }}>
                          {choice}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <TextInput
                    value={weight}
                    onChangeText={setWeight}
                    keyboardType="decimal-pad"
                    accessibilityLabel="Current weight"
                    className="rounded-xl border border-[#E3E1DE] p-3"
                  />
                </>
              ) : (
                question.options.map(([value, label]) => (
                  <TouchableOpacity
                    key={value}
                    accessibilityRole="radio"
                    accessibilityState={{
                      selected: answers[question.key as keyof Answers] === value,
                    }}
                    onPress={() => setAnswers((current) => ({ ...current, [question.key]: value }))}
                    className="mb-2 rounded-[20px] border px-4 py-3"
                    style={{
                      borderColor:
                        answers[question.key as keyof Answers] === value ? '#FF5C35' : '#E3E1DE',
                      backgroundColor:
                        answers[question.key as keyof Answers] === value ? '#FFF0E8' : 'white',
                    }}>
                    <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 16 }}>{label}</Text>
                  </TouchableOpacity>
                ))
              )}
            </View>
          ))}
          {error ? <Text className="mb-3 text-red-600">{error}</Text> : null}
          <CoachActionButton
            label={busy ? 'Saving…' : 'Save profile'}
            disabled={busy || !decision?.verifiedAccess}
            onPress={submit}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
