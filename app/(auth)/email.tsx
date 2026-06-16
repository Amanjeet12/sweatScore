import { useAuthActions } from '@convex-dev/auth/react';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Link, router, Stack } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, TouchableOpacity, View } from 'react-native';
import { KeyboardStickyView, useKeyboardState } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { z } from 'zod';

import { ErrorMessage } from '~/components/core/ErrorMessage';
import SafeAreaView from '~/components/core/SafeAreaView';
import { Input, InputField } from '~/components/ui/input';
import { Text } from '~/components/ui/text';
import { CatchPromise } from '~/utils/catch-promise';
import { getErrorMessage, getZodErrorMessage } from '~/utils/error-message';

export default function Email() {
  const { signIn } = useAuthActions();
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const insets = useSafeAreaInsets();
  const { isVisible: keyboardVisible } = useKeyboardState();

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

      {/* Image fixed at top — does NOT move with keyboard */}
      <Image
        source={require('~/assets/onboarding/emailscreen.png')}
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
          {/* Invisible spacer matching image height — reserves space so form sits below image */}
          <View style={{ width: '100%', aspectRatio: 4044 / 3938 }} />

          {/* Top spacer pushes form down when keyboard is open */}
          {keyboardVisible && <View className="flex-1" />}

          {/* Form panel */}
          <View className="bg-white">
            <View className="px-8 pt-8">
              <Text className="mb-4 text-center font-heading text-3xl font-bold text-[#1A1A1A]">
                What&apos;s your email?
              </Text>
              <Input size="xl" variant="rounded" isInvalid={!!error}>
                <InputField
                  placeholder="your email here"
                  autoCapitalize="none"
                  autoComplete="email"
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
              <Text className="mt-3 text-center font-body text-base text-[#5A5A5A]">
                We&apos;ll email you a code to verify it&apos;s you. Takes 5 seconds.
              </Text>
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

              <Text className="mt-3 text-center font-body text-sm text-[#1A1A1A]">
                By clicking next, you agree to our{' '}
                <Link href="/legals/terms">
                  <Text className="text-sm font-bold text-primary-500">Terms of Use</Text>
                </Link>{' '}
                and{' '}
                <Link href="/legals/privacy-policy">
                  <Text className="text-sm font-bold text-primary-500">Privacy Policy</Text>
                </Link>
              </Text>
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
