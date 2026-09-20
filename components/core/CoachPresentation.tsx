import { LinearGradient } from 'expo-linear-gradient';
import { Check, Sparkle } from 'phosphor-react-native';
import { ReactNode, useEffect, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, TouchableOpacity, View } from 'react-native';

import { Text } from '~/components/ui/text';
import { CoachPlanOutput } from '~/shared/progressCoach';

export function CoachMark() {
  return (
    <LinearGradient
      colors={['#F47742', '#C74420']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ width: 80, height: 80, borderRadius: 28, padding: 8 }}>
      <View className="flex-1 items-center justify-center rounded-[22px] border border-white/30">
        <Sparkle size={36} color="white" weight="fill" />
      </View>
    </LinearGradient>
  );
}

export function CoachButton({
  label,
  onPress,
  secondary = false,
}: {
  label: string;
  onPress: () => void;
  secondary?: boolean;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.82}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      className="min-h-14 w-full items-center justify-center rounded-[20px] border px-5 py-4"
      style={{
        backgroundColor: secondary ? '#FFFFFF' : '#C74420',
        borderColor: secondary ? '#E9E3DD' : '#C74420',
      }}>
      <Text
        allowFontScaling
        className="text-center font-heading text-base font-semibold"
        style={{ color: secondary ? '#1A1A1A' : '#FFFFFF' }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export function CoachCard({
  title,
  icon,
  children,
  quiet = false,
}: {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  quiet?: boolean;
}) {
  return (
    <View
      className="rounded-[24px] border border-[#E9E3DD] p-5"
      style={{ backgroundColor: quiet ? '#F3EEE8' : '#FFFFFF' }}>
      <View className="flex-row items-center">
        {icon ? (
          <View className="mr-3 h-10 w-10 items-center justify-center rounded-[14px] bg-[#FFF0E8]">
            {icon}
          </View>
        ) : null}
        <Text className="min-w-0 flex-1 font-heading text-base font-semibold text-[#1A1A1A]">
          {title}
        </Text>
      </View>
      <View className="mt-3">{children}</View>
    </View>
  );
}

export function CoachFocusHero({
  output,
  recovery,
  summary = false,
}: {
  output: CoachPlanOutput;
  recovery: boolean;
  summary?: boolean;
}) {
  return (
    <LinearGradient
      colors={recovery ? ['#393530', '#575049'] : ['#AC371B', '#CE4B23']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ borderRadius: 28, padding: 24 }}>
      <View className="mb-6 self-start rounded-full border border-white/30 px-3 py-2">
        <Text className="font-heading text-xs font-semibold text-white">
          {summary ? 'Your focus is ready' : 'Today’s saved focus'}
        </Text>
      </View>
      <Text className="font-heading text-xs font-semibold uppercase tracking-widest text-white">
        {recovery ? 'Recovery direction' : 'Your movement priority'}
      </Text>
      <Text className="mt-3 font-heading text-[28px] font-semibold text-white">
        {recovery ? 'Let’s prioritize recovery today.' : output.headline}
      </Text>
      <Text className="mt-3 font-body text-base text-white">
        {recovery
          ? 'Because you reported pain or feeling unwell, your Coach has not created a standard exercise target.'
          : output.checkIn.label}
      </Text>
      {!recovery && output.checkIn.durationMinutes > 0 ? (
        <View className="mt-5 self-start rounded-full bg-white px-3 py-2">
          <Text className="font-heading text-sm font-semibold text-[#A7371C]">
            {output.checkIn.durationMinutes} minutes
          </Text>
        </View>
      ) : null}
    </LinearGradient>
  );
}

export function CoachProgress({ step, total }: { step: number; total: number }) {
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Question progress"
      accessibilityValue={{ min: 1, max: total, now: step + 1 }}
      className="mx-5 flex-row gap-x-1.5">
      {Array.from({ length: total }, (_, index) => (
        <View
          key={index}
          className="h-1.5 flex-1 rounded-full"
          style={{ backgroundColor: index <= step ? '#C74420' : '#E9E3DD' }}
        />
      ))}
    </View>
  );
}

export function CoachSaved({ recovery = false }: { recovery?: boolean }) {
  return (
    <View className="my-5 flex-row items-center justify-center px-2">
      <Check size={18} color="#A7371C" weight="bold" />
      <Text className="ml-2 shrink text-center font-body text-xs text-[#625B55]">
        {recovery
          ? 'This recovery direction remains saved for today.'
          : 'Saved for the rest of today · one focus only'}
      </Text>
    </View>
  );
}

export function CoachLoading() {
  // Stay still until the accessibility preference is known, including on read failure.
  const [reduceMotion, setReduceMotion] = useState(true);
  useEffect(() => {
    let active = true;
    let preferenceChanged = false;
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (value) => {
      preferenceChanged = true;
      setReduceMotion(value);
    });
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (active && !preferenceChanged) setReduceMotion(value);
      })
      .catch(() => {});
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);
  return (
    <View className="items-center py-12" accessibilityLiveRegion="polite">
      <CoachMark />
      <Text className="mt-8 text-center font-heading text-[28px] font-semibold text-[#1A1A1A]">
        Shaping today’s focus
      </Text>
      <Text className="mt-3 text-center font-body text-base text-[#625B55]">
        Combining your readiness with verified progress…
      </Text>
      <View className="my-7 min-h-8 justify-center" accessibilityElementsHidden>
        {reduceMotion ? (
          <View className="flex-row gap-x-2">
            {[0, 1, 2].map((key) => (
              <View key={key} className="h-2 w-2 rounded-full bg-[#C74420]" />
            ))}
          </View>
        ) : (
          <ActivityIndicator color="#C74420" />
        )}
      </View>
      <Text className="text-center font-body text-sm text-[#625B55]">
        Your focus will appear automatically. You can leave safely and open this same focus again.
      </Text>
    </View>
  );
}
