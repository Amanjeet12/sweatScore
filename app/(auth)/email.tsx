import { useAuthActions } from '@convex-dev/auth/react';
import { Feather } from '@expo/vector-icons';
import { Link, router } from 'expo-router';
import { useState } from 'react';
import { TextInput, View } from 'react-native';
import { z } from 'zod';

import {
  PrototypeOnboarding,
  PrototypeButton,
  PrototypeError,
  onboardingStyles as styles,
} from '~/components/core/auth/PrototypeOnboarding';
import { Text } from '~/components/ui/text';
import { CatchPromise } from '~/utils/catch-promise';
import { getErrorMessage, getZodErrorMessage } from '~/utils/error-message';

export default function Email() {
  const { signIn } = useAuthActions();
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);

  const sendOtpSchema = z.object({
    email: z.string().email('Invalid email'),
  });

  const handleSubmit = async () => {
    if (isLoading) return;
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
    <PrototypeOnboarding
      stickyFooter
      image={require('~/assets/onboarding/email-portrait.jpg')}
      onBack={router.back}
      footer={
        <>
          <PrototypeButton label="Continue" onPress={handleSubmit} loading={isLoading} />
          <Text style={[styles.small, { textAlign: 'center' }]}>
            By continuing, you agree to our{' '}
            <Link href="/legals/terms" style={{ textDecorationLine: 'underline' }}>
              Terms
            </Link>{' '}
            and{' '}
            <Link href="/legals/privacy-policy" style={{ textDecorationLine: 'underline' }}>
              Privacy Policy
            </Link>
          </Text>
        </>
      }>
      <Text style={styles.heading}>What's your email?</Text>
      <Text style={styles.subtitle}>We'll send a quick code to make sure it's really you.</Text>
      <Text style={styles.label}>Email address</Text>
      <View style={{ justifyContent: 'center' }}>
        <TextInput
          accessibilityLabel="Email address"
          style={[
            styles.field,
            { paddingLeft: 52, borderColor: error ? '#d92d20' : focused ? '#2a2a2a' : '#ececec' },
          ]}
          placeholder="you@example.com"
          placeholderTextColor="#8a8a8a"
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          returnKeyType="done"
          editable={!isLoading}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onSubmitEditing={handleSubmit}
          value={email}
          onChangeText={(text) => {
            setError(null);
            setEmail(text);
          }}
        />
        <Feather name="mail" size={22} color="#e8541e" style={{ position: 'absolute', left: 18 }} />
      </View>
      <View style={{ marginTop: 8 }}>
        <PrototypeError error={error} />
      </View>
    </PrototypeOnboarding>
  );
}
