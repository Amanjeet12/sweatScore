import { useAuthActions } from '@convex-dev/auth/react';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Link, router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { ActivityIndicator, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { KeyboardStickyView, useKeyboardState } from 'react-native-keyboard-controller';
import { z } from 'zod';

import { ErrorMessage } from '~/components/core/ErrorMessage';
import SafeAreaView from '~/components/core/SafeAreaView';
import { OnboardingHeroChrome } from '~/components/core/auth/OnboardingHeroChrome';
import { Input, InputField, InputSlot } from '~/components/ui/input';
import { Text } from '~/components/ui/text';
import { CatchPromise } from '~/utils/catch-promise';
import { getErrorMessage, getZodErrorMessage } from '~/utils/error-message';

export default function Email() {
  const { signIn } = useAuthActions();
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { height: windowHeight } = useWindowDimensions();
  const { isVisible: keyboardVisible } = useKeyboardState();
  const heroHeight = Math.min(Math.max(windowHeight * 0.57, 380), 500);

  const sendOtpSchema = z.object({
    email: z.string().email('Invalid email'),
  });

  const handleSubmit = async () => {
    setError(null);
    setIsLoading(true);

    const cleanedEmail = email.trim().toLowerCase();
    const result = await sendOtpSchema.safeParse({ email: cleanedEmail });

    if (!result.success) {
      setError(getZodErrorMessage(result.error));
      setIsLoading(false);
      return;
    }

    let provider = 'resend-otp';
    if (cleanedEmail === process.env.EXPO_PUBLIC_TEST_ACCOUNT_EMAIL) {
      provider = 'test-otp';
    }

    const [error, response] = await CatchPromise(
      signIn(provider, {
        email: cleanedEmail,
      })
    );

    if (error) {
      setError(getErrorMessage(error));
    }

    if (response) {
      router.push({
        pathname: '/(auth)/verify',
        params: { email: cleanedEmail },
      });
    }

    setIsLoading(false);
  };

  return (
    <View className="flex-1 bg-white">
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar style="light" />

      <Image
        source={require('~/assets/onboarding/emailscreen-clean-v2.png')}
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
                Let&apos;s get you set up
              </Text>
              <Text className="mt-2 font-heading text-3xl font-bold leading-9 text-[#1A1A1A]">
                What&apos;s your email?
              </Text>
              <Text className="mt-2 font-body text-sm leading-5 text-[#838383]">
                We&apos;ll send a quick code to make sure it&apos;s really you.
              </Text>

              <Text className="mb-2 mt-5 font-body text-xs font-bold text-[#4A4745]">
                Email address
              </Text>
              <Input
                size="xl"
                variant="outline"
                isInvalid={!!error}
                className="h-14 rounded-2xl border-[#E8DDD6] bg-white">
                <InputSlot className="pl-4">
                  <Feather name="mail" size={19} color="#FF5C1A" />
                </InputSlot>
                <InputField
                  className="font-body text-base text-[#1A1A1A] placeholder:text-[#AAA5A1]"
                  placeholder="you@example.com"
                  autoCapitalize="none"
                  autoComplete="email"
                  keyboardType="email-address"
                  returnKeyType="done"
                  onSubmitEditing={handleSubmit}
                  value={email}
                  onChangeText={(text) => {
                    setError(null);
                    setEmail(text);
                  }}
                />
              </Input>
              <View className="mt-2 items-center">
                <ErrorMessage error={error} />
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
                  onPress={handleSubmit}
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
                      <Text className="font-heading text-base font-bold text-white">Continue</Text>
                      <Feather name="arrow-right" size={23} color="#FFFFFF" />
                    </>
                  )}
                </TouchableOpacity>

                <Text className="mt-4 text-center font-body text-[11px] text-[#838383]">
                  By continuing, you agree to our{' '}
                  <Link href="/legals/terms">
                    <Text className="text-[11px] font-bold text-[#838383] underline">Terms</Text>
                  </Link>{' '}
                  and{' '}
                  <Link href="/legals/privacy-policy">
                    <Text className="text-[11px] font-bold text-[#838383] underline">
                      Privacy Policy
                    </Text>
                  </Link>
                </Text>
              </View>
            </SafeAreaView>
          )}
        </View>
      </KeyboardStickyView>

      <OnboardingHeroChrome activeStep={1} onBack={router.back} />
    </View>
  );
}
