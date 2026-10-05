import { useConvex } from 'convex/react';
import { LinearGradient } from 'expo-linear-gradient';
import { Link, router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Image, StyleSheet, ScrollView, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import ScreenLoading from '~/components/core/ScreenLoading';
import { PrototypeButton } from '~/components/core/auth/PrototypeOnboarding';
import { prototypeTypography as type } from '~/components/core/design/prototypeStyles';
import { api } from '~/convex/_generated/api';
import { useActivateUser } from '~/hooks/useActivateUser';
import { useAuthStore } from '~/store/useAuthStore';
import { resumeMember } from '~/utils/coachResumeNavigation';
import { hasPendingRevenueCatRedemption } from '~/utils/revenuecatRedemption';
import { storeData } from '~/utils/storage';

export default function Home() {
  const convex = useConvex();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const welcomeImage = Image.resolveAssetSource(
    require('~/assets/onboarding/welcome-jump-rope.jpg')
  );
  const [isLoading, setIsLoading] = useState(true);
  const setCurrentUser = useAuthStore((state) => state.setCurrentUser);
  const { activateUser } = useActivateUser();

  const authenticateUser = async () => {
    setIsLoading(true);

    try {
      const user = await convex.query(api.users.current);

      if (!user) {
        if (hasPendingRevenueCatRedemption()) {
          router.replace('/(auth)/email');
        }
        return;
      }

      await activateUser();

      // Wait until RevenueCat identifies this user.
      await setCurrentUser(user);

      storeData('autoSync', {
        enabled: user.autoSyncEnabled ?? true,
      });

      await resumeMember(convex);
    } catch (error) {
      console.error('Authentication check failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    authenticateUser();
  }, []);

  return (
    <>
      <Stack.Screen
        options={{
          title: '',
          headerStyle: {
            backgroundColor: '#fff',
          },
          headerShadowVisible: false,
          headerLeft: () => null,
          headerBackVisible: false,
          header: () => null,
        }}
      />
      {isLoading ? (
        <ScreenLoading />
      ) : (
        <View style={styles.welcome}>
          <StatusBar style="light" />
          <Image
            source={require('~/assets/onboarding/welcome-jump-rope.jpg')}
            accessibilityIgnoresInvertColors
            style={{
              position: 'absolute',
              left: -width * 0.08,
              top: -72 * (width / 390),
              width: width * 1.16,
              height: width * 1.16 * (welcomeImage.height / welcomeImage.width),
            }}
          />
          <LinearGradient
            pointerEvents="none"
            colors={['rgba(122,46,16,0)', 'rgba(122,46,16,0.82)', '#7a2e10', '#7a2e10']}
            locations={[0.61, 0.79, 0.91, 1]}
            style={StyleSheet.absoluteFill}
          />
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={[
              styles.content,
              {
                paddingLeft: 22 + insets.left,
                paddingRight: 22 + insets.right,
                paddingBottom: Math.max(34, insets.bottom),
                paddingTop: insets.top + 12,
              },
            ]}>
            <Text style={styles.heading}>Movement That's{'\n'}Made For You.</Text>
            <PrototypeButton
              label="Get Started"
              welcome
              onPress={() => router.push('/email')}
              style={styles.startButton}
            />
            <Text style={styles.legal}>
              By signing up, you agree to our{' '}
              <Link href="/legals/terms">
                <Text style={styles.legalLink}>Terms of Use</Text>
              </Link>{' '}
              and{' '}
              <Link href="/legals/privacy-policy">
                <Text style={styles.legalLink}>Privacy Policy</Text>
              </Link>
            </Text>
            <Text style={styles.login}>
              Back for more?{' '}
              <Link href="/(auth)/email">
                <Text style={styles.loginLink}>Log in here.</Text>
              </Link>
            </Text>
          </ScrollView>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  welcome: { flex: 1, backgroundColor: '#7a2e10', overflow: 'hidden' },
  content: { flexGrow: 1, justifyContent: 'flex-end', alignItems: 'center' },
  heading: type.welcomeTitle,
  startButton: {
    marginTop: 26,
    width: '100%',
    borderRadius: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  legal: {
    marginTop: 16,
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    lineHeight: 18,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
  },
  legalLink: { fontFamily: 'Inter_600SemiBold', fontSize: 13, lineHeight: 18, color: '#fff' },
  login: {
    marginTop: 12,
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
  },
  loginLink: { fontFamily: 'Inter_600SemiBold', fontSize: 14, lineHeight: 20, color: '#fff' },
});
