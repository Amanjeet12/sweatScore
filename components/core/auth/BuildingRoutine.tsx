import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Sparkle } from 'phosphor-react-native';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Animated, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { onboardingStyles } from '~/components/core/auth/PrototypeOnboarding';
import {
  prototypeComponents as chrome,
  prototypeTypography as type,
} from '~/components/core/design/prototypeStyles';
import { Text } from '~/components/ui/text';

// This presentation exists only while the existing profile completion request is in flight.
// It does not simulate plan generation or advance onboarding on a timer.
export function BuildingRoutine({ name }: { name?: string }) {
  const insets = useSafeAreaInsets();
  const pulse = useRef(new Animated.Value(0.35)).current;
  const [reduceMotion, setReduceMotion] = useState(true);
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
    pulse.stopAnimation();
    if (reduceMotion) {
      pulse.setValue(1);
      return;
    }
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 750, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.35, duration: 750, useNativeDriver: true }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [pulse, reduceMotion]);
  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          paddingLeft: 22 + insets.left,
          paddingRight: 22 + insets.right,
          paddingTop: insets.top,
          paddingBottom: Math.max(insets.bottom, 60),
        }}>
        <View
          style={{
            ...chrome.loadingIcon,
          }}>
          <Sparkle size={30} color="#e8541e" />
        </View>
        <Text accessibilityRole="header" style={[onboardingStyles.heading, { marginTop: 28 }]}>
          Building your custom routine{name ? ` ${name}` : ''}
        </Text>
        <Text
          style={{
            marginTop: 12,
            ...type.loadingBody,
          }}>
          Analysing your goals and setting up your profile
        </Text>
        <View
          accessibilityRole="progressbar"
          accessibilityLabel="Saving your survey and setting up your profile"
          accessibilityState={{ busy: true }}
          style={{
            marginTop: 28,
            height: 6,
            borderRadius: 3,
            backgroundColor: '#f1f1f1',
            overflow: 'hidden',
          }}>
          <Animated.View
            style={{
              opacity: pulse,
              width: '40%',
              height: 6,
              borderRadius: 3,
              backgroundColor: '#ff5a1f',
            }}
          />
        </View>
        <ActivityIndicator color="#e8541e" style={{ marginTop: 16, alignSelf: 'flex-start' }} />
      </ScrollView>
    </View>
  );
}
