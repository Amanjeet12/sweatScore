import { useAction, useConvex, useMutation, useQuery } from 'convex/react';
import { router, Stack } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, TouchableOpacity, View } from 'react-native';
import SafeAreaView from '~/components/core/SafeAreaView';
import CoachActionButton from '~/components/core/CoachActionButton';
import { BackButton } from '~/components/core/BackButton';
import { Text } from '~/components/ui/text';
import { api } from '~/convex/_generated/api';
import { DEFAULT_COACH_TONE } from '~/shared/coachFoundation';
import { ToneSelection } from '~/shared/coachTonePreview';

const GROUPS = [
  {
    label: 'Tone',
    key: 'tone',
    choices: [
      ['warm_direct', 'Warm and direct'],
      ['calm_reassuring', 'Calm and reassuring'],
      ['upbeat_encouraging', 'Upbeat and encouraging'],
    ],
  },
  {
    label: 'Detail',
    key: 'detail',
    choices: [
      ['concise', 'Concise'],
      ['standard', 'Standard'],
    ],
  },
] as const;
const LABELS: Record<string, string> = {
  warm_direct: 'Warm and direct',
  calm_reassuring: 'Calm and reassuring',
  upbeat_encouraging: 'Upbeat and encouraging',
  concise: 'Concise',
  standard: 'Standard',
  daily_plan: 'Daily plan',
  meal_feedback: 'Meal feedback',
  both: 'Both',
};
const label = (value: string) => LABELS[value] ?? value;
const PREVIEW_FAILURES: Record<string, string> = {
  invalid_output: 'The provider response did not pass the plan rules. Try preview again.',
  provider_timeout: 'The provider timed out. Try preview again.',
  provider_rate_limited: 'The provider is rate limited. Try again later.',
  provider_unavailable: 'The provider is unavailable. Check its development configuration.',
};
const previewFailure = (code?: string) =>
  PREVIEW_FAILURES[code ?? ''] ?? 'The live provider did not return a usable response.';

function PreviewField({ label: title, value }: { label: string; value: string }) {
  return (
    <View className="border-t border-[#EEEAE6] py-3">
      <Text className="text-xs font-semibold uppercase tracking-wide text-[#A34829]">{title}</Text>
      <Text className="mt-1 text-base leading-6 text-[#282522]">{value}</Text>
    </View>
  );
}

export default function AICoachSettings() {
  const convex = useConvex();
  const user = useQuery(api.users.current, {});
  const current = useQuery(api.coachFoundation.getToneContract, user?.isAdmin ? {} : 'skip');
  const save = useMutation(api.coachFoundation.saveToneContract);
  const preview = useAction(api.coachTonePreview.compare);
  const resetToday = useMutation(api.coachFoundation.resetMyTodayPlanForTesting);
  const beginReanswer = useMutation(api.coachFoundation.beginMyTodayReanswerForTesting);
  const [selected, setSelected] = useState<ToneSelection | null>(null);
  const [sampleMeal, setSampleMeal] = useState<'burrito_bowl' | 'chicken_flatbread'>(
    'burrito_bowl'
  );
  const [busy, setBusy] = useState<'preview' | 'save' | 'restore' | null>(null);
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState(false);
  const [resetting, setResetting] = useState(false);
  const resetAllowed = useQuery(
    api.coachFoundation.canResetMyTodayPlanForTesting,
    user?.isAdmin ? {} : 'skip'
  );
  const [comparison, setComparison] = useState<Awaited<ReturnType<typeof preview>> | null>(null);
  const [previewSide, setPreviewSide] = useState<'current' | 'selected'>('selected');
  const [showPreviewDetails, setShowPreviewDetails] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const hasChanges = Boolean(
    current &&
    selected &&
    (current.tone !== selected.tone ||
      current.detail !== selected.detail ||
      current.scope !== selected.scope)
  );
  const visibleDaily = comparison?.status === 'ready' ? comparison.daily[previewSide] : null;
  const visibleMeal =
    comparison?.status === 'ready' && comparison.meal.status === 'ready'
      ? comparison.meal[previewSide]
      : null;

  useEffect(() => {
    if (current && !selected)
      setSelected({ tone: current.tone, detail: current.detail, scope: 'both' });
  }, [current, selected]);

  const commit = async (action: 'save' | 'restore') => {
    if (!current || !selected || busy) return;
    setBusy(action);
    setError('');
    setConflict(false);
    try {
      const choice = action === 'restore' ? DEFAULT_COACH_TONE : selected;
      await save({ expectedVersion: current.version, ...choice, action });
      setSelected({ ...choice });
      setComparison(null);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      if (message.includes('Tone version changed')) {
        setConflict(true);
        setError('Another admin saved first. Review the latest settings before trying again.');
      } else setError('Could not save AI Coach settings. Please try again.');
    } finally {
      setBusy(null);
    }
  };

  const runPreview = async () => {
    if (!selected || busy) return;
    setBusy('preview');
    setError('');
    setComparison(null);
    setPreviewSide('selected');
    setShowPreviewDetails(false);
    try {
      const result = await preview({ selected, sampleMeal });
      setComparison(result);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      if (message.includes('Tone version changed')) setConflict(true);
      setError(
        message.includes('Preview limit reached')
          ? 'Preview limit reached. Try again in an hour.'
          : message.includes('Tone version changed')
            ? 'Another admin saved first. Review the latest settings before previewing.'
            : 'Live preview could not be completed. Check the provider configuration or try again.'
      );
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    } finally {
      setBusy(null);
    }
  };

  if (user && !user.isAdmin)
    return (
      <SafeAreaView className="flex-1 bg-[#F8F8F8] p-6">
        <Stack.Screen options={{ title: 'AI Coach settings' }} />
        <Text className="font-heading text-xl font-semibold">Admin access required</Text>
      </SafeAreaView>
    );

  return (
    <SafeAreaView className="flex-1 bg-[#F8F8F8]">
      <Stack.Screen
        options={{
          title: 'AI Coach settings',
          headerLeft: () => <BackButton fallbackHref="/(tabs)/dashboard/settings/admin" />,
        }}
      />
      <ScrollView
        ref={scrollRef}
        className="flex-1"
        contentContainerStyle={{ padding: 20, paddingBottom: 48 }}
        keyboardShouldPersistTaps="handled">
        <Text className="font-heading text-2xl font-semibold">AI Coach settings</Text>
        <Text className="mt-2 text-sm text-[#6B665F]">
          Choose one tone for future plans and meal feedback. Saved results keep their original
          tone.
        </Text>
        {current && selected ? (
          <>
            <View className="mt-5 rounded-2xl bg-white p-4">
              <Text className="font-semibold">Saved version {current.version}</Text>
              <Text className="mt-1 text-sm text-[#6B665F]">
                {label(current.tone)} · {label(current.detail)}
                {current.scope !== 'both' ? ` · Earlier scope: ${label(current.scope)}` : ''}
              </Text>
              <Text className="mt-3 font-semibold">
                Selected settings {hasChanges ? '· Unsaved' : '· Same as saved'}
              </Text>
              <Text className="mt-1 text-sm text-[#6B665F]">
                {label(selected.tone)} · {label(selected.detail)} · Daily plan and meal feedback
              </Text>
            </View>
            {GROUPS.map((group) => (
              <View key={group.key} className="mt-5 rounded-2xl bg-white p-4">
                <Text className="mb-3 font-heading text-lg font-semibold">{group.label}</Text>
                {group.choices.map(([value, title]) => {
                  const active = selected[group.key] === value;
                  return (
                    <TouchableOpacity
                      key={value}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: active }}
                      accessibilityLabel={title}
                      onPress={() => {
                        setSelected({ ...selected, [group.key]: value });
                        setComparison(null);
                      }}
                      className="mb-2 rounded-[20px] border px-4 py-3"
                      style={{
                        borderColor: active ? '#F26438' : '#E1DEDA',
                        backgroundColor: active ? '#FFF1E9' : '#FFFFFF',
                      }}>
                      <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 18 }}>
                        {active ? '● ' : '○ '}
                        {title}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
            <View className="mt-5 rounded-2xl bg-white p-4">
              <Text className="font-heading text-lg font-semibold">Preview meal photo</Text>
              <Text className="mt-1 text-sm text-[#6B665F]">
                Both tone responses use the same selected sample photo.
              </Text>
              {(
                [
                  ['burrito_bowl', 'Burrito bowl'],
                  ['chicken_flatbread', 'Chicken flatbread'],
                ] as const
              ).map(([key, title]) => (
                <TouchableOpacity
                  key={key}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: sampleMeal === key }}
                  accessibilityLabel={title}
                  onPress={() => {
                    setSampleMeal(key);
                    setComparison(null);
                  }}
                  className="mt-3 rounded-[20px] border px-4 py-3"
                  style={{
                    borderColor: sampleMeal === key ? '#F26438' : '#E1DEDA',
                    backgroundColor: sampleMeal === key ? '#FFF1E9' : '#FFFFFF',
                  }}>
                  <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 18 }}>
                    {sampleMeal === key ? '● ' : '○ '}
                    {title}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {error ? (
              <Text accessibilityRole="alert" className="mt-4 text-red-700">
                {error}
              </Text>
            ) : null}
            {conflict ? (
              <CoachActionButton
                label="Review current settings"
                variant="secondary"
                onPress={async () => {
                  try {
                    const latest = await convex.query(api.coachFoundation.getToneContract, {});
                    setSelected({ tone: latest.tone, detail: latest.detail, scope: 'both' });
                    setConflict(false);
                    setComparison(null);
                    setError('');
                  } catch {
                    setError('Could not reload current settings. Please try again.');
                  }
                }}
                className="mt-3"
              />
            ) : null}
            <CoachActionButton
              label={busy === 'preview' ? 'Preparing live preview…' : 'Preview response'}
              variant="secondary"
              disabled={Boolean(busy) || conflict || !hasChanges}
              onPress={runPreview}
              className="mt-5"
            />
            {!hasChanges ? (
              <Text className="mt-2 text-center text-sm text-[#6B665F]">
                Choose a different tone or detail to compare live responses.
              </Text>
            ) : null}
            {busy === 'preview' ? (
              <View className="mt-3 flex-row items-center justify-center gap-2">
                <ActivityIndicator color="#E9512A" />
                <Text className="text-sm text-[#6B665F]">
                  Comparing two real AI responses. This may take a minute.
                </Text>
              </View>
            ) : null}
            <CoachActionButton
              label={busy === 'save' ? 'Saving…' : 'Save settings'}
              disabled={Boolean(busy) || conflict}
              onPress={() => commit('save')}
              className="mt-3"
            />
            <CoachActionButton
              label={busy === 'restore' ? 'Restoring…' : 'Restore default tone'}
              variant="secondary"
              disabled={Boolean(busy) || conflict}
              onPress={() => commit('restore')}
              className="mt-3"
            />
          </>
        ) : (
          <Text className="mt-5">Loading saved settings…</Text>
        )}
        {comparison?.status === 'unavailable' ? (
          <Text
            onLayout={(event) =>
              scrollRef.current?.scrollTo({ y: event.nativeEvent.layout.y - 20, animated: true })
            }
            className="mt-5 text-[#6B665F]">
            {comparison.reason}
          </Text>
        ) : null}
        {comparison?.status === 'ready' ? (
          <View
            onLayout={(event) =>
              scrollRef.current?.scrollTo({ y: event.nativeEvent.layout.y - 20, animated: true })
            }
            className="mt-6">
            <Text className="font-heading text-xl font-semibold text-[#24211F]">Live preview</Text>
            <Text className="mt-1 text-sm text-[#6B665F]">
              Fictional example. Switch between the saved and selected tone to compare their
              wording. No member data or limits are used.
            </Text>
            <View className="mt-4 flex-row rounded-xl bg-[#EDE9E5] p-1">
              {(['current', 'selected'] as const).map((side) => {
                const active = previewSide === side;
                return (
                  <TouchableOpacity
                    key={side}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={
                      side === 'current'
                        ? `Saved tone, version ${comparison.currentVersion}`
                        : 'Selected unsaved tone'
                    }
                    onPress={() => setPreviewSide(side)}
                    className="flex-1 rounded-lg px-2 py-3"
                    style={{ backgroundColor: active ? '#FFFFFF' : 'transparent' }}>
                    <Text
                      className="text-center font-semibold"
                      style={{ color: active ? '#E9512A' : '#615C58' }}>
                      {side === 'current' ? 'Saved tone' : 'Selected tone'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text className="mt-2 text-sm text-[#6B665F]">
              {previewSide === 'current'
                ? `Version ${comparison.currentVersion} · ${label(current?.tone ?? '')} · ${label(current?.detail ?? '')}`
                : `${label(selected?.tone ?? '')} · ${label(selected?.detail ?? '')} · Not saved`}
            </Text>
            {comparison.sampleMeal.imageUrl ? (
              <View className="mt-4 overflow-hidden rounded-2xl bg-white">
                <Image
                  source={{ uri: comparison.sampleMeal.imageUrl }}
                  accessibilityLabel={`${comparison.sampleMeal.label} sample used for both meal previews`}
                  className="h-48 w-full"
                  resizeMode="cover"
                />
                <Text className="p-3 text-sm text-[#6B665F]">
                  Sample meal · {comparison.sampleMeal.label}
                </Text>
              </View>
            ) : null}
            <View className="mt-4 rounded-2xl bg-white p-4">
              <Text className="mb-2 font-heading text-lg font-semibold text-[#24211F]">
                Today’s plan
              </Text>
              {visibleDaily?.ok ? (
                <>
                  <PreviewField label="Headline" value={visibleDaily.output.headline} />
                  <PreviewField label="Workout" value={visibleDaily.output.workout} />
                  <PreviewField label="Steps" value={visibleDaily.output.steps} />
                  <PreviewField label="Sleep" value={visibleDaily.output.sleep} />
                  <PreviewField label="Meals" value={visibleDaily.output.meals} />
                  <PreviewField label="Why this was suggested" value={visibleDaily.output.why} />
                </>
              ) : (
                <Text className="py-3 text-[#6B665F]">
                  Daily preview unavailable: {previewFailure(visibleDaily?.code)}
                </Text>
              )}
            </View>
            {comparison.meal.status === 'ready' ? (
              <View className="mt-4 rounded-2xl bg-white p-4">
                <Text className="font-heading text-lg font-semibold text-[#24211F]">
                  Meal feedback
                </Text>
                {visibleMeal?.ok ? (
                  <>
                    <PreviewField
                      label="Verdict"
                      value={visibleMeal.result.verdict ?? 'Not a meal'}
                    />
                    <PreviewField label="Feedback" value={visibleMeal.result.feedback} />
                  </>
                ) : (
                  <Text className="mt-3 text-[#6B665F]">
                    Meal preview unavailable: {previewFailure(visibleMeal?.code)}
                  </Text>
                )}
              </View>
            ) : null}
            {comparison.meal.status === 'unavailable' ? (
              <Text className="mt-4 text-sm text-[#6B665F]">
                Meal preview unavailable: {comparison.meal.reason}
              </Text>
            ) : null}
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityState={{ expanded: showPreviewDetails }}
              onPress={() => setShowPreviewDetails((value) => !value)}
              className="mt-4 py-2">
              <Text className="text-sm font-semibold text-[#6B665F]">
                {showPreviewDetails ? 'Hide preview details' : 'Show preview details'}
              </Text>
            </TouchableOpacity>
            {showPreviewDetails ? (
              <View className="rounded-xl bg-white p-4">
                <Text className="text-xs text-[#6B665F]">
                  Daily prompt: {comparison.promptVersions.daily}
                  {'\n'}Meal prompt: {comparison.promptVersions.meal}
                </Text>
                {visibleDaily?.ok ? (
                  <Text className="mt-2 text-xs text-[#6B665F]">
                    Daily usage: {visibleDaily.inputTokens ?? '—'} input /{' '}
                    {visibleDaily.outputTokens ?? '—'} output tokens
                  </Text>
                ) : null}
                {visibleMeal?.ok ? (
                  <Text className="mt-1 text-xs text-[#6B665F]">
                    Meal usage: {visibleMeal.inputTokens ?? '—'} input /{' '}
                    {visibleMeal.outputTokens ?? '—'} output tokens
                  </Text>
                ) : null}
              </View>
            ) : null}
          </View>
        ) : null}
        {__DEV__ && user?.isAdmin && resetAllowed ? (
          <View className="mt-8 rounded-2xl bg-white p-4">
            <Text className="font-heading text-lg font-semibold">Development testing</Text>
            <Text className="mt-2 text-sm text-[#6B665F]">
              Clear only your own plan and answers for today to compare different daily selections.
              Your profile and earlier days remain. Available before any check-in or reward today.
            </Text>
            {!resetAllowed.available ? (
              <Text className="mt-3 text-sm text-[#8B5142]">
                {resetAllowed.reason ===
                'Today has check-in or reward records and cannot be reset safely'
                  ? 'A check-in, meal analysis or reward is linked to this plan. Its original context and scan count must be preserved. Re-answer today’s questions to prepare a new plan revision.'
                  : resetAllowed.reason}
              </Text>
            ) : null}
            <CoachActionButton
              label={resetting ? 'Clearing…' : 'Delete my plan for today'}
              variant="destructive"
              disabled={resetting || !resetAllowed.available}
              onPress={() =>
                Alert.alert(
                  'Delete today’s test plan?',
                  'This deletes your saved plan and daily answers for today. Generating a new plan may use another AI request.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Delete today’s plan',
                      style: 'destructive',
                      onPress: async () => {
                        if (resetting) return;
                        setResetting(true);
                        try {
                          await resetToday({});
                          Alert.alert('Plan cleared', 'You can answer today’s questions again.');
                        } catch {
                          Alert.alert(
                            'Could not clear plan',
                            'Today’s plan may now have a check-in or reward record. Nothing was deleted. Please review the updated reset availability.'
                          );
                        } finally {
                          setResetting(false);
                        }
                      },
                    },
                  ]
                )
              }
              className="mt-4"
            />
            {resetAllowed.reason ===
            'Today has check-in or reward records and cannot be reset safely' ? (
              <CoachActionButton
                label={resetting ? 'Opening questions…' : 'Re-answer today’s questions'}
                variant="secondary"
                disabled={resetting}
                onPress={async () => {
                  setResetting(true);
                  try {
                    await beginReanswer({});
                    router.push('/coach-onboarding?reanswer=1');
                  } catch (cause) {
                    Alert.alert(
                      'Could not reopen questions',
                      cause instanceof Error ? cause.message : 'Please try again.'
                    );
                  } finally {
                    setResetting(false);
                  }
                }}
                className="mt-3"
              />
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
