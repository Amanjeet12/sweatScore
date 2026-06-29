import { Ionicons } from '@expo/vector-icons';
import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { View, TouchableOpacity } from 'react-native';

import { BackButton } from '~/components/core/BackButton';
import SafeAreaView from '~/components/core/SafeAreaView';
import { Text } from '~/components/ui/text';

export default function AdminView() {
  const [loading, setLoading] = useState(false);

  return (
    <SafeAreaView className="flex-1 bg-white">
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitleAlign: 'center',
          title: '',
          headerTitle: () => (
            <Text className="text-center font-heading text-2xl font-bold text-[#1A1A1A]">
              Admin View
            </Text>
          ),
          headerShadowVisible: false,
          headerLeft: () => <BackButton fallbackHref="/(tabs)/dashboard/settings/my-settings" />,
        }}
      />
      <View className="mx-8 mt-4 flex-col gap-y-8">
        <TouchableOpacity
          onPress={() => {
            router.push('/dashboard/settings/admin/users');
          }}
          disabled={loading}>
          <View className="flex-row items-center gap-x-4">
            <Ionicons size={25} name="people-outline" />
            <View>
              <Text className="font-lsBold text-2xl">Users</Text>
            </View>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => {
            router.push('/dashboard/settings/admin/pending-approvals');
          }}
          disabled={loading}>
          <View className="flex-row items-center gap-x-4">
            <Ionicons size={25} name="time-outline" />
            <View>
              <Text className="font-lsBold text-2xl">Pending Approvals</Text>
            </View>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => {
            router.push('/dashboard/settings/admin/creator-hub');
          }}
          disabled={loading}>
          <View className="flex-row items-center gap-x-4">
            <Ionicons size={25} name="videocam-outline" />
            <View>
              <Text className="font-lsBold text-2xl">Creator Hub</Text>
            </View>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => {
            router.push('/dashboard/settings/admin/challenges');
          }}
          disabled={loading}>
          <View className="flex-row items-center gap-x-4">
            <Ionicons size={25} name="trophy-outline" />
            <View>
              <Text className="font-lsBold text-2xl">Challenges</Text>
            </View>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => {
            router.push('/dashboard/settings/admin/rewards-banner');
          }}
          disabled={loading}>
          <View className="flex-row items-center gap-x-4">
            <Ionicons size={25} name="gift-outline" />
            <View>
              <Text className="font-lsBold text-2xl">Rewards Banner</Text>
            </View>
          </View>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
