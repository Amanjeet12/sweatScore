import { useAuthActions } from '@convex-dev/auth/react';
import { useConvex } from 'convex/react';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { OtpInput } from 'react-native-otp-entry';

import {
  PrototypeOnboarding,
  PrototypeButton,
  PrototypeError,
  onboardingStyles as styles,
} from '~/components/core/auth/PrototypeOnboarding';
import { prototypeTypography as type } from '~/components/core/design/prototypeStyles';
import { Text } from '~/components/ui/text';
import { api } from '~/convex/_generated/api';
import { useAuthStore } from '~/store/useAuthStore';
import { resumeMember } from '~/utils/coachResumeNavigation';
import { delay } from '~/utils/helpers';

export default function Verify() {
  const convex = useConvex();
  const numberOfSeconds = 60;
  const { signIn } = useAuthActions();
  const [isLoading, setIsLoading] = useState(false);
  const authRequestActive = useRef(false);
  const [error, setError] = useState('');
  const [code, setCode] = useState<string>('');
  const [seconds, setSeconds] = useState(numberOfSeconds);
  const [resending, setResending] = useState(false);
  const [resendActive, setResendActive] = useState(false);
  const { email } = useLocalSearchParams();
  const setCurrentUser = useAuthStore((state) => state.setCurrentUser);

  const handleResend = async () => {
    if (!resendActive || authRequestActive.current) return;
    authRequestActive.current = true;
    setError('');
    setResendActive(false);
    setResending(true);
    let provider = 'resend-otp';
    if (email === process.env.EXPO_PUBLIC_TEST_ACCOUNT_EMAIL) {
      provider = 'test-otp';
    }
    try {
      await signIn(provider, { email });
      setSeconds(numberOfSeconds);
    } catch {
      setError('Could not send a new code. Please try again.');
      setResendActive(true);
    } finally {
      authRequestActive.current = false;
      setResending(false);
    }
  };

  const handleSubmit = async (submittedCode?: string) => {
    if (authRequestActive.current) return;

    const verificationCode = submittedCode ?? code;
    if (!/^\d{4}$/.test(verificationCode)) {
      setError('Enter the 4-digit code from your email.');
      return;
    }
    authRequestActive.current = true;
    setError('');
    setIsLoading(true);
    try {
      let provider = 'resend-otp';
      if (email === process.env.EXPO_PUBLIC_TEST_ACCOUNT_EMAIL) {
        provider = 'test-otp';
      }
      try {
        await signIn(provider, { email, code: verificationCode });
      } catch {
        setError('Code is invalid or expired. Enter the latest code or request a new one.');
        return;
      }
      await delay(500);
      const user = await convex.query(api.users.current);
      await setCurrentUser(user);

      await resumeMember(convex);
    } catch {
      setError('Could not finish signing in. Please try again.');
    } finally {
      authRequestActive.current = false;
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (seconds === 0) {
      if (!resending) setResendActive(true);
      return;
    }
    const timeout = setTimeout(() => setSeconds((remaining) => Math.max(0, remaining - 1)), 1000);
    return () => clearTimeout(timeout);
  }, [seconds, resending]);

  return (
    <PrototypeOnboarding
      stickyFooter
      image={require('~/assets/onboarding/verification-portrait.jpg')}
      onBack={router.back}
      footer={
        <>
          <PrototypeButton
            label="Verify email"
            onPress={() => handleSubmit()}
            loading={isLoading}
            disabled={resending}
          />
          <PrototypeButton
            label="Use a different email"
            onPress={router.back}
            secondary
            disabled={isLoading || resending}
          />
        </>
      }>
      <Text style={styles.heading}>We emailed you a code</Text>
      <Text style={styles.subtitle}>
        Enter the 4-digit code sent to <Text style={styles.link}>{email}</Text>.
      </Text>
      <View style={{ marginTop: 28 }}>
        <OtpInput
          numberOfDigits={4}
          autoFocus={false}
          disabled={isLoading || resending}
          blurOnFilled
          focusColor="#2a2a2a"
          onTextChange={(text) => {
            setError('');
            setCode(text);
          }}
          onFilled={(text) => {
            setCode(text);
            handleSubmit(text);
          }}
          theme={{
            containerStyle: { gap: 12 },
            pinCodeContainerStyle: {
              flex: 1,
              height: 'auto',
              minHeight: 76,
              paddingVertical: 20,
              borderRadius: 20,
              borderWidth: 1.5,
              borderColor: error ? '#d92d20' : '#ececec',
              backgroundColor: '#fff',
            },
            focusedPinCodeContainerStyle: { borderColor: '#2a2a2a' },
            pinCodeTextStyle: type.otp,
          }}
        />
      </View>
      <View style={{ marginTop: 8 }}>
        <PrototypeError error={error} />
      </View>
      <Text
        style={{
          marginTop: 28,
          textAlign: 'center',
          ...type.supporting,
        }}>
        Didn't receive it?{' '}
        <Text
          accessibilityRole="button"
          accessibilityState={{ disabled: !resendActive || isLoading }}
          style={[styles.link, { opacity: resendActive ? 1 : 0.65 }]}
          onPress={handleResend}>
          {resending
            ? 'Sending…'
            : resendActive
              ? 'Resend now'
              : `Resend in 00:${String(seconds).padStart(2, '0')}`}
        </Text>
      </Text>
    </PrototypeOnboarding>
  );
}
