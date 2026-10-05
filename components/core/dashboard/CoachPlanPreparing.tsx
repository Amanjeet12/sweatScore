import { LinearGradient } from 'expo-linear-gradient';
import { Sparkles } from 'lucide-react-native';
import { Sparkle } from 'phosphor-react-native';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, View } from 'react-native';

import {
  prototypeComponents as chrome,
  prototypeTypography as type,
} from '~/components/core/design/prototypeStyles';
import { Text } from '~/components/ui/text';

/** Indeterminate animation: plan generation has no measurable percentage. */
export default function CoachPlanPreparing({
  compact = false,
  mode = 'plan',
  firstName,
  prototype = false,
}: {
  compact?: boolean;
  mode?: 'plan' | 'profile';
  firstName?: string;
  prototype?: boolean;
}) {
  const [reduceMotion, setReduceMotion] = useState(true);
  const [trackWidth, setTrackWidth] = useState(0);
  const travel = useRef(new Animated.Value(0)).current;

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
    if (reduceMotion || trackWidth < 100) {
      travel.setValue(0);
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
    sweep.start();
    return () => {
      sweep.stop();
    };
  }, [reduceMotion, trackWidth, travel]);

  return (
    <View style={{ padding: prototype ? 0 : compact ? 18 : 26 }} accessibilityLiveRegion="polite">
      {prototype ? (
        <View style={[chrome.loadingIcon, { marginBottom: 28 }]}>
          <Sparkle size={30} color="#e8541e" />
        </View>
      ) : mode === 'profile' ? (
        <View className="mb-7 items-center">
          <Sparkles size={54} color="#FF8B24" />
        </View>
      ) : null}
      <Text
        style={prototype ? type.onboardingHeading : undefined}
        className={
          prototype
            ? ''
            : 'text-center font-heading text-[30px] font-semibold leading-10 text-[#1A1A1A]'
        }>
        {mode === 'profile'
          ? `Building your custom routine${firstName ? ` ${firstName}` : ''}`
          : `Creating today’s plan${prototype && firstName ? `, ${firstName}` : ''}`}
      </Text>
      <Text
        style={prototype ? type.loadingBody : undefined}
        className={
          prototype ? 'mt-3' : 'mt-7 text-center font-body text-lg leading-7 text-[#514943]'
        }>
        {mode === 'profile'
          ? 'Analysing your goals and setting up your profile'
          : 'Your answers are saved and your plan is being built.'}
      </Text>
      <View
        className={
          prototype
            ? 'mt-6 h-1.5 overflow-hidden rounded-full bg-[#F1F1F1]'
            : 'mt-6 h-3 overflow-hidden rounded-full bg-[#F0D8CC]'
        }
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
            style={{
              width: Math.max(72, trackWidth * 0.45),
              ...(prototype ? { backgroundColor: '#ff5a1f' } : {}),
            }}
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
              colors={prototype ? ['#ff5a1f', '#ff5a1f'] : ['#FF9C62', '#FF5C35', '#F34C43']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              className="h-full w-full"
              style={prototype ? { height: '100%', width: '100%' } : undefined}
            />
          </Animated.View>
        )}
      </View>
      {mode === 'plan' ? (
        <Text
          style={prototype ? type.caption : undefined}
          className={prototype ? 'mt-3' : 'mt-3 text-center font-body text-sm text-[#77716D]'}>
          This may take a moment
        </Text>
      ) : null}
    </View>
  );
}
