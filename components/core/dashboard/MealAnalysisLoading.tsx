import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, View } from 'react-native';

import {
  prototypeTypography as type,
  prototypeColors as colors,
} from '~/components/core/design/prototypeStyles';
import { Text } from '~/components/ui/text';

/** Indeterminate presentation only; the server draft status controls completion. */
export function MealAnalysisLoading() {
  const travel = useRef(new Animated.Value(0)).current;
  const [width, setWidth] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(true);
  useEffect(() => {
    let active = true;
    let changed = false;
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (value) => {
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
      subscription.remove();
    };
  }, []);
  useEffect(() => {
    travel.setValue(0);
    if (reduceMotion || !width) return;
    const animation = Animated.loop(
      Animated.timing(travel, {
        toValue: 1,
        duration: 1800,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      })
    );
    animation.start();
    return () => animation.stop();
  }, [reduceMotion, travel, width]);
  return (
    <View accessibilityLiveRegion="polite" style={{ gap: 8 }}>
      <Text style={type.sheetSectionHeading}>Looking at your plate</Text>
      <Text style={type.supporting}>Checking the visible balance and portions.</Text>
      <View
        accessibilityRole="progressbar"
        accessibilityLabel="Meal analysis in progress"
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        style={{
          height: 6,
          borderRadius: 3,
          backgroundColor: '#f1f1f1',
          overflow: 'hidden',
          marginTop: 6,
        }}>
        <Animated.View
          style={{
            width: '35%',
            height: 6,
            borderRadius: 3,
            backgroundColor: colors.accent,
            transform: [
              {
                translateX: reduceMotion
                  ? width * 0.325
                  : travel.interpolate({ inputRange: [0, 1], outputRange: [-width * 0.35, width] }),
              },
            ],
          }}
        />
      </View>
    </View>
  );
}
