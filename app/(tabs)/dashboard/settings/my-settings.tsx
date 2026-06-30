import { useAuthActions } from '@convex-dev/auth/react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation } from 'convex/react';
import { Stack, router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Linking, TouchableOpacity, View } from 'react-native';
import Purchases from 'react-native-purchases';

import { BackButton } from '~/components/core/BackButton';
import SafeAreaView from '~/components/core/SafeAreaView';
import { Text } from '~/components/ui/text';
import { api } from '~/convex/_generated/api';
import { useAuthStore } from '~/store/useAuthStore';
import { externalLinks } from '~/utils/constants';
import { delay } from '~/utils/helpers';

export default function TabMySettings() {
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const setCurrentUser = useAuthStore((state) => state.setCurrentUser);
  const currentUser = useAuthStore((state) => state.currentUser);

  const { signOut } = useAuthActions();
  const deleteAccountMutation = useMutation(api.users.deleteAccount);

  const openWhatsApp = async () => {
    const url = externalLinks.whatsappSupport;

    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        // Fallback: try opening in browser
        const webUrl = url.replace('api.whatsapp.com', 'wa.me');
        await Linking.openURL(webUrl);
      }
    } catch (error) {
      Alert.alert('Error', 'Unable to open WhatsApp. Please make sure WhatsApp is installed.');
    }
  };

  const logoutUser = async () => {
    setLoading(true);
    try {
      setCurrentUser(null);
      await signOut();
      await delay(500);
      await Purchases.logOut();
      router.dismissAll();
      router.replace({ pathname: '/' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account? This action cannot be undone and will permanently delete all your data including activities, points, and profile information.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Confirm Deletion',
              'This is your final confirmation. Your account and all associated data will be permanently deleted.',
              [
                {
                  text: 'Cancel',
                  style: 'cancel',
                },
                {
                  text: 'Delete My Account',
                  style: 'destructive',
                  onPress: async () => {
                    setDeleting(true);
                    try {
                      await deleteAccountMutation();
                      setCurrentUser(null);
                      await signOut();
                      await delay(500);
                      await Purchases.logOut();
                      router.dismissAll();
                      router.replace({ pathname: '/' });
                    } catch (error) {
                      Alert.alert('Error', 'Failed to delete account. Please try again.');
                      setDeleting(false);
                    }
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-[#F9F9F9]">
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitleAlign: 'center',
          title: '',
          headerTitle: () => (
            <Text className="text-center font-heading text-2xl font-bold text-[#1A1A1A]">
              Settings
            </Text>
          ),
          headerShadowVisible: false,
          headerLeft: () => <BackButton fallbackHref="/(tabs)/dashboard/settings" />,
        }}
      />
      <View className="mx-8 mt-8 flex-col gap-y-8">
        {currentUser?.isAdmin && (
          <TouchableOpacity
            onPress={() => {
              router.push('/dashboard/settings/admin');
            }}
            disabled={loading}>
            <View className="flex-row items-center gap-x-4">
              <Ionicons size={25} name="person-outline" />
              <View>
                <Text className="font-lsBold text-2xl">Admin View</Text>
              </View>
            </View>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          onPress={() => {
            router.push('/dashboard/settings/about');
          }}
          disabled={loading}>
          <View className="flex-row items-center gap-x-4">
            <Ionicons size={25} name="information-circle-outline" />
            <View>
              <Text className="font-lsBold text-2xl">About</Text>
            </View>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => {
            router.push('/legals/official-rules');
          }}
          disabled={loading}>
          <View className="flex-row items-center gap-x-4">
            <Ionicons size={25} name="document-text-outline" />
            <View>
              <Text className="font-lsBold text-2xl">Official Rules</Text>
            </View>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => {
            router.push('/legals/community-guidelines');
          }}
          disabled={loading}>
          <View className="flex-row items-center gap-x-4">
            <Ionicons size={25} name="people-outline" />
            <View>
              <Text className="font-lsBold text-2xl">Community Guidelines</Text>
            </View>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => {
            Linking.openURL('https://support.sweatscore.com/');
          }}
          disabled={loading}>
          <View className="flex-row items-center gap-x-4">
            <Ionicons size={25} name="chatbox-ellipses-outline" />
            <View>
              <Text className="font-lsBold text-2xl">Help & Support</Text>
            </View>
          </View>
        </TouchableOpacity>
        <TouchableOpacity onPress={openWhatsApp} disabled={loading}>
          <View className="flex-row items-center gap-x-4">
            <Ionicons size={25} name="logo-whatsapp" />
            <View>
              <Text className="font-lsBold text-2xl">WhatsApp Support</Text>
            </View>
          </View>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleDeleteAccount} disabled={deleting || loading}>
          <View className="flex-row items-center gap-x-4">
            {deleting ? (
              <ActivityIndicator size={25} color="red" />
            ) : (
              <Ionicons size={25} name="trash-outline" color="red" />
            )}
            <View>
              <Text className="font-lsBold text-2xl text-red-600">Delete Account</Text>
            </View>
          </View>
        </TouchableOpacity>
        <TouchableOpacity onPress={logoutUser} disabled={loading}>
          <View className="flex-row items-center gap-x-4">
            {loading ? (
              <ActivityIndicator size={25} color="red" />
            ) : (
              <Ionicons size={25} name="log-out-outline" color="red" />
            )}
            <View>
              <Text className="font-lsBold text-2xl text-red-600">Logout</Text>
            </View>
          </View>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
