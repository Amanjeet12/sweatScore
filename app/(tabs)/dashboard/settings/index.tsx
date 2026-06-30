import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack } from 'expo-router';
import { ArrowRight } from 'phosphor-react-native';
import { Alert, Linking, ScrollView, TouchableOpacity, View } from 'react-native';

import { Avatar } from '~/components/core/Avatar';
import SafeAreaView from '~/components/core/SafeAreaView';
import MyActivities from '~/components/core/settings/MyActivities';
import { Button, ButtonText } from '~/components/ui/button';
import { Text } from '~/components/ui/text';
import { useAuthStore } from '~/store/useAuthStore';
import { externalLinks } from '~/utils/constants';
import { formatDateToLocaleString } from '~/utils/formatter';

export default function TabSettings() {
  const currentUser = useAuthStore((state) => state.currentUser);

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
    } catch (error) {
      Alert.alert('Error', 'Unable to open WhatsApp. Please make sure WhatsApp is installed.');
    }
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
          headerShown: false,
        }}
      />

      <SafeAreaView className="flex-1 bg-[#F9F9F9]">
        <View className="px-5 pt-2">
          <View className="h-14 flex-row items-center justify-between">
            <View className="w-[118px] items-start">
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={handleBack}
                className="h-11 flex-row items-center justify-center rounded-full bg-white px-4"
                style={{
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 8 },
                  shadowOpacity: 0.07,
                  shadowRadius: 16,
                  elevation: 3,
                }}>
                <Ionicons name="chevron-back" size={25} color="#FF4B1F" />

                <Text className="ml-1 font-heading text-lg font-bold text-[#FF4B1F]">
                  Back
                </Text>
              </TouchableOpacity>
            </View>

            <View className="flex-1 items-center">
              <Text
                className="text-center font-heading text-xl font-bold text-[#1A1A1A]"
                numberOfLines={1}>
                My Profile
              </Text>
            </View>

            <View className="w-[118px] items-end">
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => {
                  router.push({
                    pathname: '/dashboard/settings/my-settings',
                  });
                }}
                className="h-11 w-11 items-center justify-center rounded-full bg-white"
                style={{
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 8 },
                  shadowOpacity: 0.07,
                  shadowRadius: 16,
                  elevation: 3,
                }}>
                <Ionicons size={24} name="settings-outline" color="#111111" />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingTop: 18,
            paddingBottom: 32,
          }}>
          <View className="flex-col">
            <View className="mx-4 flex-col items-center gap-y-4">
              <View>
                <Avatar uri={currentUser?.image ?? undefined} />
              </View>

              <View className="flex-col items-center">
                <Text className="text-[20px] font-bold">{currentUser?.name}</Text>

                <Text className="text-[14px]">
                  {formatDateToLocaleString(currentUser?.birthdate)}
                </Text>

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

            <View className="mx-4 mt-4">
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
            </View>

            <View className="mt-4">
              <MyActivities />
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}