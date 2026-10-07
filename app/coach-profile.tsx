import { useAction, useQuery } from 'convex/react';
import * as Crypto from 'expo-crypto';
import { router, Stack } from 'expo-router';
import { Check } from 'phosphor-react-native';
import { useEffect, useState } from 'react';
import { TextInput, TouchableOpacity, View } from 'react-native';
import { KeyboardAwareScrollView, KeyboardStickyView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import SafeAreaView from '~/components/core/CoachSafeAreaView';
import ScreenLoading from '~/components/core/ScreenLoading';
import { PrototypeButton } from '~/components/core/auth/PrototypeOnboarding';
import { CheckInHeader, checkInStyles as chrome } from '~/components/core/design/CheckInChrome';
import {
  prototypeTypography as type,
  prototypeColors as colors,
  prototypeComponents,
} from '~/components/core/design/prototypeStyles';
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
  const insets = useSafeAreaInsets();
  const { accepted, decision } = useCoachRouteGuard(['today']);
  const profile = useQuery(api.coachProfileEditor.myProfile, accepted ? {} : 'skip');
  const save = useAction(api.coachDailyService.saveProfileAndMaybeRefresh);
  const [answers, setAnswers] = useState<Partial<Answers>>({});
  const [weight, setWeight] = useState('');
  const [unit, setUnit] = useState<'lb' | 'kg'>('lb');
  const [initialized, setInitialized] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [footerHeight, setFooterHeight] = useState(88);
  useEffect(() => {
    if (!profile || initialized) return;
    setAnswers(profile.answers);
    setWeight(String(profile.weight.value));
    setUnit(profile.weight.unit);
    setInitialized(true);
  }, [profile, initialized]);
  if (!accepted || profile === undefined)
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <ScreenLoading />
      </>
    );
  if (!profile)
    return (
      <SafeAreaView className="flex-1 bg-white">
        <Stack.Screen options={{ headerShown: false }} />
        <CheckInHeader
          title="Update your profile"
          onBack={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/dashboard'))}
        />
        <Text style={[type.body, { padding: 22 }]}>Complete your profile from Today first.</Text>
      </SafeAreaView>
    );
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
    } catch {
      setError('Could not save your profile. Please try again.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <SafeAreaView className="flex-1 bg-white">
      <Stack.Screen options={{ headerShown: false }} />
      <CheckInHeader
        title="Update your profile"
        onBack={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/dashboard'))}
      />
      <KeyboardAwareScrollView
        bottomOffset={footerHeight + 24}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingHorizontal: 22, paddingTop: 12, paddingBottom: 36 }}>
        <Text style={[type.body, { marginBottom: 36 }]}>
          Your saved answers are preselected. Saving will change your plan from tomorrow.
        </Text>
        {PROFILE_QUESTIONS.map((question) => (
          <View key={question.key} style={{ marginBottom: 36, gap: 14 }}>
            <Text style={type.sheetSectionHeading}>{question.title}</Text>
            {question.key === 'weight' ? (
              <>
                <View
                  style={{
                    flexDirection: 'row',
                    alignSelf: 'flex-start',
                    padding: 4,
                    borderRadius: 16,
                    backgroundColor: colors.secondary,
                  }}>
                  {(['lb', 'kg'] as const).map((choice) => (
                    <TouchableOpacity
                      key={choice}
                      accessibilityRole="radio"
                      accessibilityLabel={`Weight in ${choice}`}
                      accessibilityState={{ selected: unit === choice }}
                      onPress={() => setUnit(choice)}
                      style={{
                        minHeight: 44,
                        paddingHorizontal: 22,
                        paddingVertical: 8,
                        justifyContent: 'center',
                        borderRadius: 12,
                        backgroundColor: unit === choice ? '#fff' : 'transparent',
                        shadowColor: '#1e140a',
                        shadowOffset: { width: 0, height: 1 },
                        shadowRadius: 2,
                        shadowOpacity: unit === choice ? 0.12 : 0,
                        elevation: unit === choice ? 2 : 0,
                      }}>
                      <Text style={unit === choice ? type.selectedUnit : type.unit}>{choice}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <View
                  style={[
                    prototypeComponents.field,
                    {
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: '#fcfcfc',
                      borderWidth: 1,
                      borderColor: '#efefef',
                    },
                  ]}>
                  <TextInput
                    value={weight}
                    onChangeText={setWeight}
                    keyboardType="decimal-pad"
                    accessibilityLabel="Current weight"
                    placeholder="Enter weight"
                    placeholderTextColor={colors.subtle}
                    style={[type.profileWeight, { flex: 1, padding: 0 }]}
                  />
                  <Text style={type.body}>{unit}</Text>
                </View>
              </>
            ) : (
              <View style={{ gap: 10 }} accessibilityRole="radiogroup">
                {question.options.map(([value, label]) => {
                  const selected = answers[question.key as keyof Answers] === value;
                  return (
                    <TouchableOpacity
                      key={value}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      onPress={() =>
                        setAnswers((current) => ({ ...current, [question.key]: value }))
                      }
                      style={[
                        chrome.profileOption,
                        {
                          borderColor: selected ? colors.accent : colors.border,
                          backgroundColor: selected ? colors.selected : '#fff',
                        },
                      ]}>
                      <Text style={[selected ? type.selectedOption : type.option, { flex: 1 }]}>
                        {label}
                      </Text>
                      <View
                        style={[
                          chrome.selector,
                          {
                            borderColor: selected ? colors.accent : '#d9d9d9',
                            backgroundColor: selected ? colors.accent : 'transparent',
                          },
                        ]}>
                        {selected ? <Check size={13} color="#fff" weight="bold" /> : null}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        ))}
      </KeyboardAwareScrollView>
      <KeyboardStickyView offset={{ opened: insets.bottom }}>
        <View
          onLayout={(event) => setFooterHeight(event.nativeEvent.layout.height)}
          style={chrome.footer}>
          {error ? (
            <Text accessibilityRole="alert" style={type.error}>
              {error}
            </Text>
          ) : null}
          <PrototypeButton
            label="Save profile"
            loading={busy}
            disabled={!decision?.verifiedAccess}
            onPress={submit}
          />
        </View>
      </KeyboardStickyView>
    </SafeAreaView>
  );
}
