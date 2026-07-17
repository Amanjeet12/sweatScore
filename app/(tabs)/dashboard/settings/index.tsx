import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack } from 'expo-router';
import { ArrowRight } from 'phosphor-react-native';
import {
  Alert,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';

import { Avatar } from '~/components/core/Avatar';
import { BackButton } from '~/components/core/BackButton';
import { HeaderButton } from '~/components/core/HeaderButton';
import SafeAreaView from '~/components/core/SafeAreaView';
import MyActivities from '~/components/core/settings/MyActivities';
import { Button, ButtonText } from '~/components/ui/button';
import { Text } from '~/components/ui/text';
import { useAuthStore } from '~/store/useAuthStore';
import { colors, externalLinks } from '~/utils/constants';
import { formatDateToLocaleString } from '~/utils/formatter';

export default function TabSettings() {
  const currentUser = useAuthStore((state) => state.currentUser);
  const isIOS = Platform.OS === 'ios';

  const openWhatsApp = async () => {
    const url = externalLinks.whatsappSupport;

    try {
      const canOpen = await Linking.canOpenURL(url);

      if (canOpen) {
        await Linking.openURL(url);
      } else {
        const webUrl = url.replace('api.whatsapp.com', 'wa.me');
        await Linking.openURL(webUrl);
      }
    } catch {
      Alert.alert('Error', 'Unable to open WhatsApp. Please make sure WhatsApp is installed.');
    }
  };

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
            <Text className="text-center font-heading text-xl font-bold text-[#1A1A1A]">
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

            <Text className="text-center font-heading text-xl font-bold text-[#1A1A1A]">
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

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingTop: 18,
            paddingBottom: 32,
          }}>
          <View className="flex-col">
            <View className="mx-4 flex-col items-center gap-y-4">
              <View>
                <Avatar uri={currentUser?.image ?? undefined} name={currentUser?.name} />
              </View>

              <View className="flex-col items-center">
                <Text className="text-[20px] font-bold">{currentUser?.name}</Text>

                {/* <Text className="text-[14px]">
                  {formatDateToLocaleString(currentUser?.birthdate)}
                </Text> */}

                {/* <TouchableOpacity onPress={shareProfile}>
                  <View className="flex-row items-center gap-x-1">
                    <Ionicons name="paper-plane-outline" size={14} color="black" />
                    <Text className="font-lsBold text-[14px]">Share profile</Text>
                  </View>
                </TouchableOpacity> */}
              </View>
            </View>

            <View className="mx-4 mt-4">
              <Button
                variant="outline"
                size="md"
                className="w-full rounded-full"
                onPress={() => {
                  router.push({
                    pathname: '/(tabs)/dashboard/settings/profile/edit',
                  });
                }}>
                <ButtonText className="text-primary-500">Edit Profile</ButtonText>
              </Button>
            </View>

            {/* <View className="mx-4 mt-4">
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={openWhatsApp}
                className="flex-row items-center justify-center gap-x-2 rounded-full bg-primary-500 py-2.5">
                <Text className="font-medium text-white">💬 Chat with us on WhatsApp</Text>

                <ArrowRight size={18} weight="bold" color="white" />
              </TouchableOpacity>

              <View className="mt-1">
                <Text className="text-center text-sm text-black/60">
                  Fast help with setup and app issues.
                </Text>
              </View>
            </View> */}

            <View className="mt-4">
              <MyActivities />
            </View>
          </View>
        </ScrollView>
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
