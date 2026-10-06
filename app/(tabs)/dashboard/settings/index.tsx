import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack } from 'expo-router';
import { Platform, StyleSheet, TouchableOpacity, View } from 'react-native';

import { Avatar } from '~/components/core/Avatar';
import { BackButton } from '~/components/core/BackButton';
import { HeaderButton } from '~/components/core/HeaderButton';
import SafeAreaView from '~/components/core/SafeAreaView';
import { prototypeTypography as type } from '~/components/core/design/prototypeStyles';
import MyActivities from '~/components/core/settings/MyActivities';
import { Text } from '~/components/ui/text';
import { useAuthStore } from '~/store/useAuthStore';
import { colors } from '~/utils/constants';

export default function TabSettings() {
  const currentUser = useAuthStore((state) => state.currentUser);
  const isIOS = Platform.OS === 'ios';

  const openSettings = () => {
    router.push({
      pathname: '/dashboard/settings/my-settings',
    });
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/dashboard');
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: !isIOS,
          headerTitleAlign: 'center',
          title: '',
          headerStyle: {
            backgroundColor: '#F9F9F9',
          },
          headerTitle: () => (
            <Text className="text-center font-heading text-xl font-semibold text-[#1A1A1A]">
              My Profile
            </Text>
          ),
          headerRight: () => (
            <HeaderButton onPress={openSettings}>
              <Ionicons size={22} name="settings-outline" />
            </HeaderButton>
          ),
          headerLeft: () => <BackButton fallbackHref="/(tabs)/dashboard" text="Back" />,
          headerShadowVisible: false,
        }}
      />

      <SafeAreaView className="flex-1 bg-[#F9F9F9]">
        {isIOS && (
          <View style={styles.iosHeader}>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={handleBack}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={styles.iosBackButton}>
              <Ionicons name="chevron-back" size={30} color={colors.primary} />
              <Text style={styles.iosBackText}>Back</Text>
            </TouchableOpacity>

            <Text className="text-center font-heading text-xl font-semibold text-[#1A1A1A]">
              My Profile
            </Text>

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={openSettings}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={styles.iosSettingsButton}>
              <Ionicons size={28} color={colors.nearBlack} name="settings-outline" />
            </TouchableOpacity>
          </View>
        )}

        <MyActivities
          header={
            <View style={{ paddingTop: 18, paddingBottom: 8 }}>
              <View className="flex-col items-center gap-y-4">
                <Avatar uri={currentUser?.image ?? undefined} name={currentUser?.name} />
                <Text className="text-[20px] font-bold">{currentUser?.name}</Text>
                <TouchableOpacity
                  activeOpacity={0.7}
                  accessibilityRole="link"
                  hitSlop={{ top: 10, bottom: 10, left: 16, right: 16 }}
                  onPress={() => router.push('/(tabs)/dashboard/settings/profile/edit')}>
                  <Text
                    className="text-sm text-primary-500"
                    style={{ fontFamily: 'Inter_600SemiBold' }}>
                    Edit Profile
                  </Text>
                </TouchableOpacity>
              </View>
              <Text style={[type.cardTitle, { marginTop: 28 }]}>Activity history</Text>
            </View>
          }
        />
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  iosHeader: {
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  iosBackButton: {
    position: 'absolute',
    left: 16,
    height: 44,
    minWidth: 92,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  iosBackText: {
    color: colors.primary,
    fontFamily: 'Inter_700Bold',
    fontSize: 20,
    marginLeft: 1,
  },
  iosSettingsButton: {
    position: 'absolute',
    right: 18,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
