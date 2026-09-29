import { LinearGradient } from 'expo-linear-gradient';
import { Sparkles } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, View } from 'react-native';

import { Text } from '~/components/ui/text';

/** Indeterminate animation: plan generation has no measurable percentage. */
export default function CoachPlanPreparing({
  compact = false,
  mode = 'plan',
}: {
  compact?: boolean;
  mode?: 'plan' | 'profile';
}) {
  const [reduceMotion, setReduceMotion] = useState(true);
  const [trackWidth, setTrackWidth] = useState(0);
  const travel = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let active = true;
    let changed = false;
    const listener = AccessibilityInfo.addEventListener('reduceMotionChanged', (value) => {
      changed = true;
      setReduceMotion(value);
    });
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (active && !changed) setReduceMotion(value);
      })
      .catch(() => {});
    return () => {
      active = false;
      listener.remove();
    };
  }, []);

  useEffect(() => {
    travel.stopAnimation();
    pulse.stopAnimation();
    if (reduceMotion || trackWidth < 100) {
      travel.setValue(0);
      pulse.setValue(0);
      return;
    }
    const sweep = Animated.loop(
      Animated.timing(travel, {
        toValue: 1,
        duration: 2100,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      })
    );
    const glow = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    sweep.start();
    glow.start();
    return () => {
      sweep.stop();
      glow.stop();
    };
  }, [pulse, reduceMotion, trackWidth, travel]);

  return (
    <LinearGradient
      colors={['#FFF8F3', '#FFFFFF', '#FFF3EC']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      className="overflow-hidden rounded-[30px] border border-[#F3CDBA]"
      style={{ padding: compact ? 18 : 26 }}
      accessibilityLiveRegion="polite">
      <View className="flex-row items-center">
        <Animated.View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{
            transform: [
              { scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.09] }) },
            ],
          }}
          className="h-14 w-14 items-center justify-center rounded-2xl bg-[#FF5C35]">
          <Sparkles size={28} color="#FFFFFF" strokeWidth={1.8} />
        </Animated.View>
        <View className="ml-4 flex-1">
          <Text className="font-body text-xs font-semibold uppercase tracking-widest text-[#C54B25]">
            SWEATSCORE AI COACH
          </Text>
          <Text className="mt-1 font-heading text-xl font-semibold text-[#241B17]">
            {mode === 'profile' ? 'Getting your coach ready' : 'Crafting today’s plan'}
          </Text>
        </View>
      </View>
      {!compact ? (
        <Text className="mt-5 font-body text-base leading-6 text-[#5F5650]">
          {mode === 'profile'
            ? 'Saving your coach profile and getting your coaching experience ready. You’ll answer today’s questions after access is verified.'
            : 'Your answers are saved. We’re shaping practical guidance for your workout, steps, sleep and meals.'}
        </Text>
      ) : null}
      {!compact && mode === 'plan' ? (
        <View className="mt-5 flex-row justify-between rounded-2xl bg-white/80 px-4 py-3">
          {['Answers saved', 'Building plan', 'Final check'].map((label, index) => (
            <View key={label} className="flex-1 items-center">
              <View
                className={`h-7 w-7 items-center justify-center rounded-full ${index === 0 ? 'bg-primary-500' : index === 1 ? 'border-2 border-primary-500 bg-[#FFF3ED]' : 'border border-[#D9D2CD] bg-white'}`}>
                <Text
                  className={`font-body text-xs font-bold ${index === 0 ? 'text-white' : index === 1 ? 'text-primary-500' : 'text-[#928A84]'}`}>
                  {index === 0 ? '✓' : index + 1}
                </Text>
              </View>
              <Text className="mt-2 text-center font-body text-[10px] leading-4 text-[#655B55]">
                {label}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
      <View
        className="mt-6 h-3 overflow-hidden rounded-full bg-[#F0D8CC]"
        accessibilityRole="progressbar"
        accessibilityLabel={
          mode === 'profile' ? 'Coach profile setup in progress' : 'Plan preparation in progress'
        }
        accessibilityValue={{ text: 'Preparing' }}
        onLayout={(event) => {
          const width = event.nativeEvent.layout.width;
          setTrackWidth((previous) => (Math.abs(previous - width) > 1 ? width : previous));
        }}>
        {reduceMotion ? (
          <View
            className="h-full rounded-full bg-[#FF5C35]"
            style={{ width: Math.max(72, trackWidth * 0.45) }}
          />
        ) : (
          <Animated.View
            className="h-full w-1/3 overflow-hidden rounded-full"
            style={{
              transform: [
                {
                  translateX: travel.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-trackWidth / 3, trackWidth],
                  }),
                },
              ],
            }}>
            <LinearGradient
              colors={['#FF9C62', '#FF5C35', '#F34C43']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              className="h-full w-full"
            />
          </Animated.View>
        )}
      </View>
      <Text className="mt-3 font-body text-xs text-[#7A6C63]">
        {mode === 'profile'
          ? 'Your profile is saved. Today’s plan has not been started.'
          : 'This may take a moment. Your answers are saved.'}
      </Text>
    </LinearGradient>
  );
}
