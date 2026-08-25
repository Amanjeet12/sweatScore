import { useAuthActions } from '@convex-dev/auth/react';
import { Feather } from '@expo/vector-icons';
import { useConvex } from 'convex/react';
import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { KeyboardStickyView, useKeyboardState } from 'react-native-keyboard-controller';
import { OtpInput } from 'react-native-otp-entry';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ErrorMessage } from '~/components/core/ErrorMessage';
import { OnboardingHeroChrome } from '~/components/core/auth/OnboardingHeroChrome';
import { Text } from '~/components/ui/text';
import { api } from '~/convex/_generated/api';
import { useAuthStore } from '~/store/useAuthStore';
import { cn } from '~/utils/cn';
import { colors } from '~/utils/constants';
import { delay } from '~/utils/helpers';
import { hasPendingRevenueCatRedemption } from '~/utils/revenuecatRedemption';

export default function Verify() {
  const convex = useConvex();
  const numberOfSeconds = 60;
  const { signIn } = useAuthActions();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [code, setCode] = useState<string>('');
  const [seconds, setSeconds] = useState(0);
  const [resendActive, setResendActive] = useState(false);
  const { email } = useLocalSearchParams();
  const setCurrentUser = useAuthStore((state) => state.setCurrentUser);
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const { isVisible: keyboardVisible } = useKeyboardState();
  const heroHeight = Math.min(Math.max(windowHeight * 0.57, 380), 500);
  const otpBoxSize = Math.min(68, (windowWidth - 84) / 4);

  const handleResend = async () => {
    if (!resendActive) return;
    setError('');
    setResendActive(false);
    let provider = 'resend-otp';
    if (email === process.env.EXPO_PUBLIC_TEST_ACCOUNT_EMAIL) {
      provider = 'test-otp';
    }
    await signIn(provider, { email });
    setSeconds(numberOfSeconds);
  };

  const handleSubmit = async (submittedCode?: string) => {
    if (isLoading) return;

    const verificationCode = submittedCode ?? code;
    setError('');
    setIsLoading(true);
    try {
      if (verificationCode.length !== 4) {
        setError('Invalid code');
        setIsLoading(false);
        return;
      }
      let provider = 'resend-otp';
      if (email === process.env.EXPO_PUBLIC_TEST_ACCOUNT_EMAIL) {
        provider = 'test-otp';
      }
      await signIn(provider, { email, code: verificationCode });
      await delay(500);
      const user = await convex.query(api.users.current);
      await setCurrentUser(user);

      router.dismissAll();
      if (!user?.onboarded) {
        router.replace('/(auth)/setup-profile');
        return;
      }

      if (hasPendingRevenueCatRedemption()) {
        return;
      }

      router.replace('/(tabs)/dashboard');
    } catch {
      setError('Invalid code');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const interval = setInterval(() => {
      if (seconds > 0) {
        setSeconds(seconds - 1);
      }
      if (seconds === 0) {
        setResendActive(true);
        clearInterval(interval);
      }
    }, 1000);
    return () => {
      clearInterval(interval);
    };
  });

  useEffect(() => {
    setSeconds(numberOfSeconds);
  }, []);

  return (
    <View className="flex-1 bg-white">
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar style="light" />

      <Image
        source={require('~/assets/onboarding/otpscreen-clean-v2.png')}
        contentFit="cover"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          width: '100%',
          height: heroHeight,
        }}
      />

      <KeyboardStickyView style={{ flex: 1 }}>
        <View className="flex-1">
          <View style={{ width: '100%', height: heroHeight }} />

          {keyboardVisible && <View className="flex-1" />}

          <View
            className="bg-white"
            style={{
              marginTop: -30,
              borderTopLeftRadius: 32,
              borderTopRightRadius: 32,
              shadowColor: '#000000',
              shadowOffset: { width: 0, height: -5 },
              shadowOpacity: 0.05,
              shadowRadius: 12,
            }}>
            <View className={`px-6 ${keyboardVisible ? 'pt-5' : 'pt-7'}`}>
              <Text className="font-body text-xs font-bold uppercase tracking-[1.5px] text-primary-500">
                Check your inbox
              </Text>
              <Text className="mt-2 font-heading text-3xl font-bold leading-9 text-[#1A1A1A]">
                We emailed you a code
              </Text>
              <Text className="mt-2 font-body text-sm leading-5 text-[#838383]">
                Enter the 4-digit code sent to{' '}
                <Text className="font-body text-sm font-bold text-[#1A1A1A]">{email}</Text>.
              </Text>

              <View className={`${keyboardVisible ? 'mt-3' : 'mt-5'} items-center`}>
                <OtpInput
                  numberOfDigits={4}
                  autoFocus={false}
                  onTextChange={(text) => {
                    setError('');
                    setCode(text);
                  }}
                  onFilled={(text) => {
                    setCode(text);
                    handleSubmit(text);
                  }}
                  blurOnFilled
                  focusColor={colors.primary}
                  theme={{
                    containerStyle: { gap: 12 },
                    pinCodeContainerStyle: {
                      width: otpBoxSize,
                      height: Math.min(64, otpBoxSize),
                      borderRadius: 16,
                      borderWidth: 1,
                      borderColor: '#E8DDD6',
                      backgroundColor: '#FFF9F6',
                    },
                    focusedPinCodeContainerStyle: {
                      borderWidth: 1.5,
                      borderColor: colors.primary,
                    },
                    pinCodeTextStyle: {
                      color: '#1A1A1A',
                      fontFamily: 'Inter_700Bold',
                      fontSize: 20,
                    },
                  }}
                />
                <View className="mt-2 items-center">
                  <ErrorMessage error={error} />
                </View>
                {!keyboardVisible && (
                  <Text className="mt-3 text-center font-body text-sm text-[#838383]">
                    Didn&apos;t receive it?{' '}
                    <Text
                      className={cn('font-bold', {
                        'text-primary-500': resendActive,
                        'text-[#838383]': !resendActive,
                      })}
                      onPress={handleResend}>
                      {resendActive
                        ? 'Resend now'
                        : `Resend in 00:${String(seconds).padStart(2, '0')}`}
                    </Text>
                  </Text>
                )}
              </View>
            </View>
          </View>

          {!keyboardVisible && <View className="flex-1 bg-white" />}

          {!keyboardVisible && (
            <SafeAreaView edges={['bottom']} className="bg-white">
              <View className="bg-white px-6 pb-4 pt-2">
                <TouchableOpacity
                  accessibilityRole="button"
                  activeOpacity={0.8}
                  onPress={() => handleSubmit()}
                  disabled={isLoading}
                  style={{
                    height: 56,
                    backgroundColor: '#FF5C1A',
                    borderRadius: 17,
                    paddingHorizontal: 22,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    shadowColor: '#FF5C1A',
                    shadowOffset: { width: 0, height: 8 },
                    shadowOpacity: 0.2,
                    shadowRadius: 14,
                  }}>
                  {isLoading ? (
                    <ActivityIndicator color="white" style={{ flex: 1 }} />
                  ) : (
                    <>
                      <Text className="font-heading text-base font-bold text-white">
                        Verify email
                      </Text>
                      <Feather name="arrow-right" size={23} color="#FFFFFF" />
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  accessibilityRole="button"
                  activeOpacity={0.7}
                  onPress={router.back}
                  className="mt-4 items-center py-1">
                  <Text className="font-body text-sm font-bold text-[#5A5653]">
                    Use a different email
                  </Text>
                </TouchableOpacity>
              </View>
            </SafeAreaView>
          )}
        </View>
      </KeyboardStickyView>

      <OnboardingHeroChrome activeStep={2} onBack={router.back} />
    </View>
  );
}
