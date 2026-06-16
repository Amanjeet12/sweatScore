import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { LockKey } from 'phosphor-react-native';
import { Image, Platform, StyleSheet, TouchableOpacity, View } from 'react-native';

import { Text } from '~/components/ui/text';
import { useTabStore } from '~/store/useTabStore';

interface BlurOverlayProps {
  title?: string;
  subtitle?: string;
  buttonText?: string;
  redirectTo?: string;
}

export default function BlurOverlay({
  title = 'Get Full Challenge Access',
  subtitle = 'Connect with your Sweat Sisters, post your daily check-ins and stay accountable.',
  buttonText = 'Get Full Access Now',
  redirectTo,
}: BlurOverlayProps) {
  const currentTab = useTabStore((state) => state.currentTab);

  const handleUpgrade = () => {
    if (redirectTo) {
      router.push({
        pathname: `/(tabs)/${currentTab}/paywall` as any,
        params: { redirectTo },
      });
    } else {
      router.push({
        pathname: `/(tabs)/${currentTab}/paywall` as any,
      });
    }
  };

  const handleNotNow = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace({
        pathname: `/(tabs)/dashboard`,
      });
    }
  };

  return (
    <View style={styles.container}>
      {/* Android needs additional semi-transparent backdrop for better blur effect */}
      {Platform.OS === 'android' && <View style={styles.androidBackdrop} />}

      <BlurView intensity={Platform.OS === 'ios' ? 10 : 0} tint="light" style={styles.blurView}>
        <View style={styles.card}>
          {/* Lock Icon with Gradient Background */}
          <View style={styles.iconContainer}>
            <LinearGradient
              colors={['#FFA480', '#FF5C1A']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.iconGradient}>
              <LockKey size={40} weight="fill" color="#FFFFFF" />
            </LinearGradient>
          </View>

          {/* Title */}
          <Text className="mb-4 text-center text-xl font-semibold text-[#1A1A1A]">{title}</Text>

          {/* Premium Image */}
          <Image
            source={require('~/assets/premium.png')}
            style={{ width: 200, height: 200, marginBottom: 16 }}
            resizeMode="contain"
          />

          {/* Subtitle */}
          <Text className="mb-4 text-center text-lg text-[#1A1A1A]">{subtitle}</Text>

          {/* Button */}
          <TouchableOpacity
            onPress={handleUpgrade}
            activeOpacity={0.8}
            style={{
              borderRadius: 9999,
              width: '100%',
              ...(Platform.OS === 'ios'
                ? {
                    shadowColor: '#000000',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.15,
                    shadowRadius: 8,
                  }
                : {
                    elevation: 6,
                  }),
            }}>
            <LinearGradient
              colors={['#FFA480', '#FF5C1A']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{
                borderRadius: 9999,
                paddingVertical: 16,
                paddingHorizontal: 40,
                alignItems: 'center',
              }}>
              <Text className="text-xl font-bold text-white">{buttonText}</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleNotNow} activeOpacity={0.8} className="mt-4">
            <Text className="text-center text-lg text-gray-500">Not now</Text>
          </TouchableOpacity>
        </View>
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
  },
  androidBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
  },
  blurView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Platform.OS === 'android' ? 'transparent' : 'rgba(255, 255, 255, 0.2)',
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 24,
    paddingBottom: 16,
    paddingTop: 44,
    paddingHorizontal: 32,
    alignItems: 'center',
    maxWidth: 360,
    marginHorizontal: 24,
    ...(Platform.OS === 'ios'
      ? {
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.1,
          shadowRadius: 16,
        }
      : {
          elevation: 8,
        }),
  },
  iconContainer: {
    position: 'absolute',
    top: -35,
  },
  iconGradient: {
    width: 65,
    height: 65,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'ios'
      ? {
          shadowColor: '#FF5C1A',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
        }
      : {
          elevation: 8,
        }),
  },
});
