import Ionicons from '@expo/vector-icons/Ionicons';
import * as Application from 'expo-application';
import { Stack, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { TouchableOpacity, View } from 'react-native';

import { BackButton } from '~/components/core/BackButton';
import SafeAreaView from '~/components/core/SafeAreaView';
import { Text } from '~/components/ui/text';
import { useTabStore } from '~/store/useTabStore';

export default function TabMySettingsAbout() {
  const [loading, setLoading] = useState(false);
  const currentTab = useTabStore((state) => state.currentTab);
  const [localAppDetails, setLocalAppDetails] = useState<Date>();

  const getLocalAppDetails = async () => {
    const resp = await Application.getLastUpdateTimeAsync();
    setLocalAppDetails(resp);
  };

  useEffect(() => {
    getLocalAppDetails();
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-white">
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitleAlign: 'center',
          title: '',
          headerTitle: () => (
            <Text className="text-center font-heading text-2xl font-bold text-[#1A1A1A]">
              About
            </Text>
          ),
          headerShadowVisible: false,
          headerLeft: () => <BackButton onPress={router.back} />,
        }}
      />
      <View className="mx-8 mt-8 flex-1 flex-col gap-y-8">
        <TouchableOpacity
          onPress={() => {
            router.push('/legals/privacy-policy');
          }}
          disabled={loading}>
          <View className="flex-row">
            <View className="flex-1">
              <Text className="text-[20px]">SweatScore Privacy Policy</Text>
            </View>
            <View>
              <Ionicons size={24} name="chevron-forward-outline" />
            </View>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => {
            router.push('/legals/terms');
          }}
          disabled={loading}>
          <View className="flex-row">
            <View className="flex-1">
              <Text className="text-[20px]">SweatScore Terms of Use</Text>
            </View>
            <View>
              <Ionicons size={24} name="chevron-forward-outline" />
            </View>
          </View>
        </TouchableOpacity>
        <View>
          <Text className="text-sm text-hint">
            App version {Application.nativeApplicationVersion}
          </Text>
          {localAppDetails ? (
            <Text className="text-sm text-hint">
              Last updated on {localAppDetails.toLocaleDateString()}
            </Text>
          ) : null}
        </View>
      </View>
    </SafeAreaView>
  );
}
