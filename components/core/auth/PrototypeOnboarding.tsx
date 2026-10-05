import { Feather } from '@expo/vector-icons';
import { Image, ImageSource } from 'expo-image';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ReactNode, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  StyleProp,
  ViewStyle,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { KeyboardAwareScrollView, KeyboardStickyView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  prototypeTypography as type,
  prototypeComponents as chrome,
} from '~/components/core/design/prototypeStyles';
import { Text } from '~/components/ui/text';

export function PrototypeOnboarding({
  image,
  children,
  footer,
  onBack,
  profile = false,
  activeStep,
  stickyFooter = false,
}: {
  image: ImageSource;
  children: ReactNode;
  footer: ReactNode;
  onBack?: () => void;
  profile?: boolean;
  activeStep?: number;
  stickyFooter?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const { height, fontScale } = useWindowDimensions();
  const [footerHeight, setFooterHeight] = useState(128);
  const heroHeight = Math.min(profile ? 320 : 360, height * (profile ? 0.38 : 0.427));
  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar style="light" />
      <KeyboardAwareScrollView
        bottomOffset={stickyFooter ? footerHeight + 48 * fontScale : 24}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="none"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1 }}>
        <View style={{ height: heroHeight }}>
          <Image
            source={image}
            contentFit="cover"
            contentPosition={{ top: '20%', left: '50%' }}
            style={StyleSheet.absoluteFill}
            accessibilityIgnoresInvertColors
          />
          <View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(24,14,8,0.1)' }]}
          />
          {onBack && (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Go back"
              onPress={onBack}
              style={{
                position: 'absolute',
                top: insets.top + 12,
                left: 22 + insets.left,
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: 'rgba(24,14,8,0.38)',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Feather name="chevron-left" size={22} color="#fff" />
            </TouchableOpacity>
          )}
          {activeStep !== undefined && (
            <View
              accessibilityRole="progressbar"
              accessibilityLabel={`Step ${activeStep} of 7`}
              accessibilityValue={{ min: 1, max: 7, now: activeStep }}
              style={{
                position: 'absolute',
                top: insets.top + 32,
                left: 82 + insets.left,
                right: 22 + insets.right,
                flexDirection: 'row',
                gap: 6,
              }}>
              {Array.from({ length: 7 }, (_, index) => (
                <View
                  key={index}
                  style={{
                    flex: 1,
                    height: 4,
                    borderRadius: 2,
                    backgroundColor: index < activeStep ? '#fff' : 'rgba(255,255,255,0.45)',
                  }}
                />
              ))}
            </View>
          )}
        </View>
        <View
          style={{
            flexGrow: 1,
            marginTop: -28,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            backgroundColor: '#fff',
            paddingHorizontal: 22,
            paddingTop: 30,
          }}>
          <View style={{ paddingLeft: insets.left, paddingRight: insets.right }}>{children}</View>
          {!stickyFooter && (
            <View
              style={{
                marginTop: 'auto',
                paddingTop: 24,
                gap: 12,
                paddingBottom: Math.max(34, insets.bottom),
                paddingLeft: insets.left,
                paddingRight: insets.right,
              }}>
              {footer}
            </View>
          )}
        </View>
      </KeyboardAwareScrollView>
      {stickyFooter && (
        <KeyboardStickyView offset={{ opened: Math.max(34, insets.bottom) - 12 }}>
          <View
            onLayout={(event) => {
              const next = event.nativeEvent.layout.height;
              setFooterHeight((previous) => (Math.abs(previous - next) > 1 ? next : previous));
            }}
            style={{
              backgroundColor: '#fff',
              gap: 12,
              paddingTop: 12,
              paddingLeft: 22 + insets.left,
              paddingRight: 22 + insets.right,
              paddingBottom: Math.max(34, insets.bottom),
            }}>
            {footer}
          </View>
        </KeyboardStickyView>
      )}
    </View>
  );
}

export function PrototypeButton({
  label,
  onPress,
  loading = false,
  disabled = false,
  secondary = false,
  welcome = false,
  style,
  className,
  variant,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  secondary?: boolean;
  welcome?: boolean;
  style?: StyleProp<ViewStyle>;
  className?: string;
  variant?: 'primary' | 'secondary';
}) {
  secondary = secondary || variant === 'secondary';
  return (
    <TouchableOpacity
      className={className}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
      style={[
        chrome.button,
        {
          backgroundColor: welcome ? '#fff' : secondary ? '#f5f5f5' : '#2a2a2a',
          opacity: disabled || loading ? 0.65 : 1,
        },
        style,
      ]}>
      <Text
        style={[
          type.button,
          {
            color: secondary || welcome ? '#2a2a2a' : '#fff',
            opacity: loading ? 0 : 1,
          },
        ]}>
        {label}
      </Text>
      {loading ? (
        <ActivityIndicator
          style={{ position: 'absolute' }}
          color={secondary || welcome ? '#2a2a2a' : '#fff'}
        />
      ) : null}
    </TouchableOpacity>
  );
}

export const onboardingStyles = StyleSheet.create({
  heading: type.onboardingHeading,
  subtitle: { ...type.body, marginTop: 8 },
  label: { ...type.label, marginTop: 24, marginBottom: 10 },
  field: { ...chrome.field, ...type.field },
  fieldContainer: chrome.field,
  small: type.caption,
  link: { fontFamily: 'Inter_600SemiBold', fontWeight: 'normal', color: '#2a2a2a' },
});

export function PrototypeError({ error }: { error: string | null }) {
  return error ? (
    <Text
      accessibilityLiveRegion="polite"
      style={[type.error, { marginTop: 8, textAlign: 'center' }]}>
      {error}
    </Text>
  ) : null;
}
