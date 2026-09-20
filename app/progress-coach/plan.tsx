import { useQuery } from 'convex/react';
import { router, Stack } from 'expo-router';
import { ArrowLeft, Sparkle } from 'phosphor-react-native';
import { ReactNode } from 'react';
import { ScrollView, TouchableOpacity, View } from 'react-native';

import { goBackOrReplace } from '~/components/core/BackButton';
import SafeAreaView from '~/components/core/SafeAreaView';
import ScreenLoading from '~/components/core/ScreenLoading';
import { Text } from '~/components/ui/text';
import { api } from '~/convex/_generated/api';
import { COACH_CHECK_IN_LABELS } from '~/shared/progressCoach';
import { useAuthStore } from '~/store/useAuthStore';

export function formatCoachStepTarget(target: number | undefined): string {
  return typeof target === 'number' && Number.isFinite(target) && target > 0
    ? `${target.toLocaleString()} steps`
    : 'No step target today.';
}

function ReturnButton({ coach = false }: { coach?: boolean }) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      onPress={() => router.replace((coach ? '/progress-coach' : '/(tabs)/dashboard') as any)}
      className="mt-6 min-h-14 items-center justify-center rounded-[20px] bg-[#FF5C35] px-5">
      <Text className="font-heading text-base font-semibold text-white">
        {coach ? 'Return to Progress Coach' : 'Return to Today'}
      </Text>
    </TouchableOpacity>
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
      <View className="flex-1 justify-center px-6">
        <Text className="text-center font-heading text-xl font-semibold text-[#1A1A1A]">
          {title}
        </Text>
        <Text className="mt-2 text-center font-body text-sm leading-5 text-[#5A5551]">
          {message}
        </Text>
        <ReturnButton coach={coach} />
      </View>
    </SafeAreaView>
  );
}

function PlanCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View className="rounded-[22px] bg-white p-5">
      <Text className="font-heading text-lg font-semibold text-[#1A1A1A]">{title}</Text>
      <View className="mt-2">{children}</View>
    </View>
  );
}

export function ErrorBoundary() {
  return (
    <MessageScreen
      title="Today’s plan is unavailable"
      message="Return to Today and check again later."
    />
  );
}

export default function ProgressCoachPlan() {
  const currentUser = useAuthStore((state) => state.currentUser);
  const plan = useQuery(api.progressCoach.getTodayPlan, currentUser?._id ? {} : 'skip');
  if (currentUser === undefined || plan === undefined) return <ScreenLoading />;
  if (plan === null)
    return (
      <MessageScreen
        title="No plan found for today"
        message="Start from Progress Coach when you are ready for today’s check-in."
        coach
      />
    );
  if (plan.status === 'failed')
    return (
      <MessageScreen
        title="Today’s plan is unavailable"
        message="Your coach could not prepare today’s guidance. No new request will be made from this screen."
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
        <View className="flex-1 items-center justify-center px-7">
          <View className="h-14 w-14 items-center justify-center rounded-full bg-[#FFF0E8]">
            <Sparkle size={28} color="#FF5C35" weight="fill" />
          </View>
          <Text className="mt-5 text-center font-heading text-2xl font-semibold text-[#1A1A1A]">
            Preparing today’s guidance
          </Text>
          <Text className="mt-2 text-center font-body text-base leading-6 text-[#5A5551]">
            Your plan is being prepared. You can leave safely and open this same plan again.
          </Text>
        </View>
      </SafeAreaView>
    );
  }
  if (!plan.output)
    return (
      <MessageScreen
        title="Today’s plan is unavailable"
        message="Return to Today and check again later."
      />
    );

  const output = plan.output;
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
        <Text className="mt-7 font-heading text-[28px] font-semibold leading-9 text-[#1A1A1A]">
          {output.headline}
        </Text>
        <Text className="mt-1 font-body text-xs text-[#807A76]">Plan for {plan.date}</Text>
        {plan.status === 'fallback' ? (
          <View className="mt-5 rounded-[18px] bg-[#FFF0E8] p-4">
            <Text className="font-body text-sm leading-5 text-[#5A5551]">
              Personalization was limited today, but your plan is ready.
            </Text>
          </View>
        ) : null}
        <View className="mt-6 gap-y-4">
          <PlanCard title="Check-in">
            <Text className="font-heading text-base font-semibold text-[#FF5C35]">
              {COACH_CHECK_IN_LABELS[output.checkIn.type]}
            </Text>
            <Text className="mt-1 font-body text-base leading-6 text-[#5A5551]">
              {output.checkIn.label}
            </Text>
            {duration ? (
              <Text className="mt-1 font-body text-sm text-[#807A76]">{duration}</Text>
            ) : null}
          </PlanCard>
          <PlanCard title="Nutrition">
            <Text className="font-body text-base leading-6 text-[#5A5551]">
              {output.nutrition.message}
            </Text>
            <Text className="mt-2 font-body text-sm text-[#807A76]">
              {output.nutrition.carbServings} carbohydrate{' '}
              {output.nutrition.carbServings === 1 ? 'serving' : 'servings'}
            </Text>
          </PlanCard>
          <PlanCard title="Steps">
            <Text className="font-body text-base leading-6 text-[#5A5551]">
              {formatCoachStepTarget(output.steps.target)}
            </Text>
          </PlanCard>
          <PlanCard title="Hydration">
            <Text className="font-body text-base leading-6 text-[#5A5551]">
              Aim for {output.hydration.litres} litres as general wellness guidance.
            </Text>
          </PlanCard>
          <PlanCard title="Why">
            <Text className="font-body text-base leading-6 text-[#5A5551]">{output.why}</Text>
          </PlanCard>
        </View>
        {output.safetyNotice ? (
          <View className="mt-4 rounded-[18px] border border-[#F2C7B8] bg-[#FFF8F4] p-4">
            <Text className="font-heading text-sm font-semibold text-[#1A1A1A]">
              Take care today
            </Text>
            <Text className="mt-1 font-body text-sm leading-5 text-[#5A5551]">
              {output.safetyNotice}
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
