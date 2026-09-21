import { convexQuery } from '@convex-dev/react-query';
import { useQuery as useTanStackQuery } from '@tanstack/react-query';
import { useQuery } from 'convex/react';
import { router, Stack } from 'expo-router';
import { ArrowLeft, Drop, ForkKnife, Footprints, Heart, Sparkle } from 'phosphor-react-native';
import { ScrollView, TouchableOpacity, View } from 'react-native';

import { goBackOrReplace } from '~/components/core/BackButton';
import {
  CoachButton,
  CoachCard as PlanCard,
  CoachFocusHero,
  CoachLoading,
  CoachMark,
  CoachSaved,
} from '~/components/core/CoachPresentation';
import SafeAreaView from '~/components/core/CoachSafeAreaView';
import ScreenLoading from '~/components/core/ScreenLoading';
import { Text } from '~/components/ui/text';
import { api } from '~/convex/_generated/api';
import { COACH_CHECK_IN_LABELS } from '~/shared/progressCoach';
import {
  getCoachChallengeMapping,
  selectCoachChallengeCandidate,
} from '~/shared/progressCoachChallenges';
import { useAuthStore } from '~/store/useAuthStore';

export function formatCoachStepTarget(target: number | undefined): string {
  return typeof target === 'number' && Number.isFinite(target) && target > 0
    ? `${target.toLocaleString()} steps`
    : 'No step target today.';
}

function ReturnButton({
  coach = false,
  secondary = false,
}: {
  coach?: boolean;
  secondary?: boolean;
}) {
  return (
    <View className="mt-6">
      <CoachButton
        secondary={secondary}
        label={coach ? 'Return to Progress Coach' : 'Return to Today'}
        onPress={() => router.replace((coach ? '/progress-coach' : '/(tabs)/dashboard') as any)}
      />
    </View>
  );
}

function MessageScreen({
  title,
  message,
  coach = false,
}: {
  title: string;
  message: string;
  coach?: boolean;
}) {
  return (
    <SafeAreaView className="flex-1 bg-[#F9F9F9]">
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}>
        <View className="mb-8 items-center">
          <CoachMark />
        </View>
        <Text className="text-center font-heading text-xl font-semibold text-[#1A1A1A]">
          {title}
        </Text>
        <Text className="mt-2 text-center font-body text-sm leading-5 text-[#5A5551]">
          {message}
        </Text>
        <ReturnButton coach={coach} />
      </ScrollView>
    </SafeAreaView>
  );
}

export function ErrorBoundary() {
  return (
    <MessageScreen
      title="Today’s focus is unavailable"
      message="Return to Today and check again later."
    />
  );
}

export default function ProgressCoachPlan() {
  const currentUser = useAuthStore((state) => state.currentUser);
  const plan = useQuery(api.progressCoach.getTodayPlan, currentUser?._id ? {} : 'skip');
  const challengeMapping = getCoachChallengeMapping(plan?.output?.checkIn.type);
  const challengeQuery = useTanStackQuery({
    ...convexQuery(api.challengeCompletions.getPublishedChallenges, {
      tag: challengeMapping?.tag ?? 'Full Body',
    }),
    enabled: challengeMapping !== undefined,
  });
  const suggestedChallenge = selectCoachChallengeCandidate(
    challengeQuery.data,
    challengeMapping,
    plan?.date
  );
  if (currentUser === undefined || plan === undefined) return <ScreenLoading />;
  if (plan === null)
    return (
      <MessageScreen
        title="No saved focus for today"
        message="Start from Progress Coach when you are ready for today’s check-in."
        coach
      />
    );
  if (plan.status === 'failed')
    return (
      <MessageScreen
        title="Today’s focus is unavailable"
        message="We couldn’t prepare today’s guidance. No conflicting focus was created. You can safely return to Today."
      />
    );
  if (plan.status === 'pending') {
    return (
      <SafeAreaView className="flex-1 bg-[#F9F9F9]">
        <Stack.Screen options={{ headerShown: false }} />
        <View className="px-5 pt-4">
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Back to Progress Coach"
            onPress={() => goBackOrReplace('/progress-coach')}
            className="h-12 w-12 items-center justify-center rounded-full bg-white">
            <ArrowLeft size={22} color="#1A1A1A" weight="bold" />
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}>
          <CoachLoading />
        </ScrollView>
      </SafeAreaView>
    );
  }
  if (!plan.output)
    return (
      <MessageScreen
        title="Today’s focus is unavailable"
        message="Return to Today and check again later."
      />
    );

  const output = plan.output;
  const recovery = plan.safetyState === 'pain_or_unwell';
  const duration =
    output.checkIn.durationMinutes > 0 ? `${output.checkIn.durationMinutes} minutes` : null;
  return (
    <SafeAreaView className="flex-1 bg-[#F9F9F9]">
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32, paddingTop: 16 }}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Back to Progress Coach"
          onPress={() => goBackOrReplace('/progress-coach')}
          className="h-12 w-12 items-center justify-center rounded-full bg-white">
          <ArrowLeft size={22} color="#1A1A1A" weight="bold" />
        </TouchableOpacity>
        <View className="mt-6">
          <CoachFocusHero output={output} recovery={recovery} />
        </View>
        <Text className="mt-3 font-body text-xs text-[#5A5551]">Saved focus · {plan.date}</Text>
        {plan.status === 'fallback' && !recovery ? (
          <View className="mt-5 rounded-[18px] bg-[#F6F4F2] p-4">
            <Text className="font-body text-sm leading-5 text-[#5A5551]">
              Personalized wording was unavailable today. Your saved guidance is still ready.
            </Text>
          </View>
        ) : null}
        <View className="mt-6 gap-y-4">
          <PlanCard
            title={recovery ? 'Movement direction' : 'One clear priority'}
            icon={
              recovery ? <Heart size={21} color="#FF4B1F" /> : <Sparkle size={21} color="#FF4B1F" />
            }>
            <Text className="font-heading text-2xl font-semibold text-[#1A1A1A]">
              {COACH_CHECK_IN_LABELS[output.checkIn.type]}
            </Text>
            <Text className="mt-1 font-body text-base leading-6 text-[#5A5551]">
              {output.checkIn.label}
            </Text>
            {duration ? (
              <Text className="mt-1 font-body text-sm text-[#807A76]">{duration}</Text>
            ) : null}
          </PlanCard>
          <PlanCard title="Nutrition" icon={<ForkKnife size={21} color="#FF4B1F" />}>
            <Text className="font-body text-base leading-6 text-[#5A5551]">
              {output.nutrition.message}
            </Text>
            <Text className="mt-2 font-body text-sm text-[#807A76]">
              {output.nutrition.carbServings} carbohydrate{' '}
              {output.nutrition.carbServings === 1 ? 'serving' : 'servings'}
            </Text>
          </PlanCard>
          <PlanCard title="Steps" icon={<Footprints size={21} color="#FF4B1F" />}>
            <Text className="font-body text-base leading-6 text-[#5A5551]">
              {formatCoachStepTarget(output.steps.target)}
            </Text>
          </PlanCard>
          <PlanCard title="Hydration" icon={<Drop size={21} color="#FF4B1F" />}>
            <Text className="font-body text-base leading-6 text-[#5A5551]">
              Aim for {output.hydration.litres} litres as general wellness guidance.
            </Text>
          </PlanCard>
          <PlanCard title="Why this was selected" quiet>
            <Text className="font-body text-base leading-6 text-[#5A5551]">{output.why}</Text>
          </PlanCard>
          {suggestedChallenge && challengeMapping ? (
            <PlanCard title="Continue in SweatScore">
              <Text className="font-body text-sm leading-5 text-[#5A5551]">
                A related existing challenge is available if you would like to explore it.
              </Text>
              <Text
                allowFontScaling
                className="mt-3 font-heading text-base font-semibold leading-6 text-[#1A1A1A]">
                {suggestedChallenge.name}
              </Text>
              <View className="mt-4">
                <CoachButton
                  label={challengeMapping.actionLabel}
                  onPress={() =>
                    router.push({
                      pathname: '/challenge-view/[challengeId]',
                      params: { challengeId: suggestedChallenge._id },
                    })
                  }
                />
              </View>
            </PlanCard>
          ) : null}
        </View>
        {recovery || output.safetyNotice ? (
          <View className="mt-4 rounded-[18px] border border-[#F2C7B8] bg-[#FFF8F4] p-4">
            <Text className="font-heading text-sm font-semibold text-[#1A1A1A]">
              Take care today
            </Text>
            <Text className="mt-1 font-body text-sm leading-5 text-[#5A5551]">
              Your Coach cannot assess symptoms or provide medical advice.
            </Text>
            <Text className="mt-2 font-body text-sm leading-5 text-[#5A5551]">
              {output.safetyNotice}
            </Text>
          </View>
        ) : null}
        <CoachSaved recovery={recovery} />
        <ReturnButton secondary={!recovery} />
      </ScrollView>
    </SafeAreaView>
  );
}
