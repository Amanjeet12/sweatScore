import { useAuthActions } from '@convex-dev/auth/react';
import { Feather } from '@expo/vector-icons';
import { useConvex } from 'convex/react';
import { Image } from 'expo-image';
import { Link, router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, TouchableOpacity, View } from 'react-native';
import { KeyboardStickyView, useKeyboardState } from 'react-native-keyboard-controller';
import { OtpInput } from 'react-native-otp-entry';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ErrorMessage } from '~/components/core/ErrorMessage';
import { Text } from '~/components/ui/text';
import { api } from '~/convex/_generated/api';
import { useAuthStore } from '~/store/useAuthStore';
import { cn } from '~/utils/cn';
import { colors } from '~/utils/constants';
import { delay } from '~/utils/helpers';
import { hasActiveSubscription } from '~/utils/subscription';

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
  const insets = useSafeAreaInsets();
  const { isVisible: keyboardVisible } = useKeyboardState();

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

  const handleSubmit = async () => {
    setError('');
    setIsLoading(true);
    try {
      if (code.length !== 4) {
        setError('Invalid code');
        setIsLoading(false);
        return;
      }
      let provider = 'resend-otp';
      if (email === process.env.EXPO_PUBLIC_TEST_ACCOUNT_EMAIL) {
        provider = 'test-otp';
      }
      await signIn(provider, { email, code });
      await delay(500);
      const user = await convex.query(api.users.current);
      await setCurrentUser(user);

      router.dismissAll();
      if (!user?.onboarded) {
        router.replace('/(auth)/setup-profile');
        return;
      }

      const isSubscribed = await hasActiveSubscription(user);

      if (isSubscribed) {
        router.replace('/(tabs)/dashboard');
      } else {
        router.replace({
          pathname: '/subscription',
          params: {
            redirectTo: '/(tabs)/dashboard',
            showBackToLogin: 'true',
          },
        });
      }
    } catch (error) {
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

      {/* Image fixed at top — does NOT move with keyboard */}
      <Image
        source={require('~/assets/onboarding/otpscreen.png')}
        contentFit="cover"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          width: '100%',
          aspectRatio: 4044 / 3938,
        }}
      />

      {/* Form content overlays; KSV translates it up when keyboard opens */}
      <KeyboardStickyView style={{ flex: 1 }}>
        <View className="flex-1">
          {/* Invisible spacer matching image height */}
          <View style={{ width: '100%', aspectRatio: 4044 / 3938 }} />

          {/* Top spacer pushes form down when keyboard is open */}
          {keyboardVisible && <View className="flex-1" />}

          {/* Form panel */}
          <View className="bg-white">
            <View className="px-8 pt-8">
              <Text className="mb-6 text-center font-heading text-3xl font-bold text-[#1A1A1A]">
                We just emailed you{'\n'}a code
              </Text>
              <Text className="text-center font-body text-base text-[#5A5A5A]">
                Enter the code sent to
              </Text>
              <Text className="mt-1 text-center font-body text-base font-bold text-primary-500">
                {email}
              </Text>

              <View className="mt-6 items-center">
                <OtpInput
                  numberOfDigits={4}
                  autoFocus={false}
                  onTextChange={(text) => {
                    setError('');
                    setCode(text);
                  }}
                  focusColor={colors.primary}
                />
                <View className="mt-3 items-center">
                  <ErrorMessage error={error} />
                </View>
                <Text className="mt-4 text-center font-body text-sm text-[#5A5A5A]">
                  Didn&apos;t get the code?{' '}
                  <Text
                    className={cn('font-bold', {
                      'text-primary-500': resendActive,
                      'text-[#5A5A5A]': !resendActive,
                    })}
                    onPress={handleResend}>
                    Resend
                  </Text>{' '}
                  in {seconds} sec.
                </Text>
              </View>
            </View>
          </View>

          {/* Middle spacer pushes button to bottom when keyboard closed */}
          {!keyboardVisible && <View className="flex-1 bg-white" />}

          <SafeAreaView edges={['bottom']} className="bg-white">
            <View className="bg-white px-8 pb-8 pt-2">
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={handleSubmit}
                disabled={isLoading}
                style={{
                  backgroundColor: '#F76B1C',
                  borderRadius: 9999,
                  paddingVertical: 12,
                  alignItems: 'center',
                }}>
                {isLoading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="text-2xl font-bold text-white">Next</Text>
                )}
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </View>
      </KeyboardStickyView>

      {/* Plain back button overlay — sits over image, no native chrome / blur */}
      <TouchableOpacity
        onPress={router.back}
        style={{
          position: 'absolute',
          top: insets.top + 8,
          left: 16,
          zIndex: 10,
        }}>
        <View className="flex-row items-center">
          <Feather name="chevron-left" size={32} color="#FFFFFF" />
          <Text className="ml-1 text-xl font-bold text-white">Back</Text>
        </View>
      </TouchableOpacity>
    </View>
  );
}
