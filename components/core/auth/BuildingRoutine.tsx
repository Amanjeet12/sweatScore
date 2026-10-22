import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Sparkle } from 'phosphor-react-native';
import { useEffect, useRef } from 'react';
import { Animated, Easing, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { onboardingStyles } from '~/components/core/auth/PrototypeOnboarding';
import {
  prototypeComponents as chrome,
  prototypeTypography as type,
} from '~/components/core/design/prototypeStyles';
import { Text } from '~/components/ui/text';

// Keep the onboarding presentation visible for the six-second profile setup interval.
export function BuildingRoutine({ name }: { name?: string }) {
  const insets = useSafeAreaInsets();
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: 6000,
      easing: Easing.linear,
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [progress]);
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
              width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
              height: 6,
              borderRadius: 3,
              backgroundColor: '#ff5a1f',
            }}
          />
        </View>
      </ScrollView>
    </View>
  );
}
