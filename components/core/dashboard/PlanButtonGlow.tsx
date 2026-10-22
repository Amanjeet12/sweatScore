import { ReactNode, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, View } from 'react-native';

export default function PlanButtonGlow({
  active,
  children,
}: {
  active: boolean;
  children: ReactNode;
}) {
  const pulse = useRef(new Animated.Value(0)).current;
  const [reduceMotion, setReduceMotion] = useState(true);

  useEffect(() => {
    let mounted = true;
    let changed = false;
    const listener = AccessibilityInfo.addEventListener('reduceMotionChanged', (value) => {
      changed = true;
      setReduceMotion(value);
    });
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (mounted && !changed) setReduceMotion(value);
      })
      .catch(() => {});
    return () => {
      mounted = false;
      listener.remove();
    };
  }, []);

  useEffect(() => {
    pulse.setValue(0);
    if (!active || reduceMotion) return;
    const animation = Animated.loop(
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
    animation.start();
    return () => animation.stop();
  }, [active, reduceMotion, pulse]);

  return (
    <View style={{ maxWidth: '48%', marginRight: 6, marginBottom: 6 }}>
      {active ? (
        <Animated.View
          pointerEvents="none"
          accessible={false}
          style={{
            position: 'absolute',
            top: -4,
            bottom: -4,
            left: -4,
            right: -4,
            borderRadius: 100,
            backgroundColor: '#FFFFFF',
            opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.08, 0.18] }),
            transform: [
              { scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.98, 1.02] }) },
            ],
          }}
        />
      ) : null}
      <View className="min-h-9 flex-row items-center justify-center rounded-full bg-white px-7 py-2">
        {children}
      </View>
    </View>
  );
}
