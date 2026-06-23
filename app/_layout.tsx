import '@/global.css';
import { ConvexAuthProvider } from '@convex-dev/auth/react';
import { ConvexQueryClient } from '@convex-dev/react-query';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { Montserrat_700Bold, Montserrat_800ExtraBold } from '@expo-google-fonts/montserrat';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConvexReactClient } from 'convex/react';
import { router, Stack, useRootNavigationState } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { LogBox, Platform, View, Text, TextInput } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GluestackUIProvider } from '@/components/ui/gluestack-ui-provider';
import ForceUpdateGate from '~/components/core/ForceUpdateGate';
import { RevenueCatProvider } from '~/components/providers/RevenueCatProvider';
import { Id } from '~/convex/_generated/dataModel';
import { usePushNotifications } from '~/hooks/usePushNotifications';
import { useAuthStore } from '~/store/useAuthStore';
import { NOTIFICATION_TYPE } from '~/utils/types';
import { ChallengeUploadProvider } from '~/components/providers/ChallengeUploadProvider';

const convex = new ConvexReactClient(process.env.EXPO_PUBLIC_CONVEX_URL!, {
  unsavedChangesWarning: false,
});

LogBox.ignoreAllLogs();

const secureStorage = {
  getItem: SecureStore.getItemAsync,
  setItem: SecureStore.setItemAsync,
  removeItem: SecureStore.deleteItemAsync,
};
const convexQueryClient = new ConvexQueryClient(convex);
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryKeyHashFn: convexQueryClient.hashFn(),
      queryFn: convexQueryClient.queryFn(),
    },
  },
});
convexQueryClient.connect(queryClient);

// @ts-ignore
Text.defaultProps = { ...(Text.defaultProps || {}), allowFontScaling: false };
// @ts-ignore
TextInput.defaultProps = {
  // @ts-ignore
  ...(TextInput.defaultProps || {}),
  allowFontScaling: false,
};

export default function Layout() {
  const currentUser = useAuthStore((state) => state.currentUser);
  const rootNavigationState = useRootNavigationState();
  const { backgroundNotification } = usePushNotifications();
  const insets = useSafeAreaInsets();

  const [montserratLoaded, montserratError] = useFonts({
    Montserrat_700Bold,
    Montserrat_800ExtraBold,
  });

  const [interLoaded, interError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (!rootNavigationState?.key) {
      return;
    }

    if (backgroundNotification && currentUser) {
      if (backgroundNotification.request.content.data) {
        const notificationData = backgroundNotification.request.content.data;

        if (notificationData.notificationType === NOTIFICATION_TYPE.NEW_ACTIVITY_SUBMITTED) {
          if (currentUser.isAdmin) {
            router.push({
              pathname: '/(tabs)/dashboard/settings/admin/pending-approvals',
            });
          }
        } else if (notificationData.notificationType === NOTIFICATION_TYPE.NO_ACTIVITY_REMINDER) {
          router.push({
            pathname: '/(tabs)/dashboard/settings',
          });
        } else if (
          notificationData.notificationType === NOTIFICATION_TYPE.NEW_ACTIVITY_APPROVED ||
          notificationData.notificationType === NOTIFICATION_TYPE.NEW_ACTIVITY_REJECTED
        ) {
          router.push({
            pathname: '/(tabs)/dashboard',
          });
        } else if (
          notificationData.notificationType === NOTIFICATION_TYPE.NEW_REWARD_UNLOCKED_500 ||
          notificationData.notificationType === NOTIFICATION_TYPE.NEW_REWARD_UNLOCKED_250 ||
          notificationData.notificationType === NOTIFICATION_TYPE.NEW_REWARD_UNLOCKED_100
        ) {
          router.push({
            pathname: '/(tabs)/rewards',
          });
        } else if (
          notificationData.notificationType === NOTIFICATION_TYPE.NEW_COMMENT_POSTED ||
          notificationData.notificationType === NOTIFICATION_TYPE.NEW_ADMIN_POST
        ) {
          if (notificationData.postId) {
            router.push({
              pathname: '/(tabs)/share/[postId]',
              params: { postId: notificationData.postId as Id<'posts'> },
            });
          } else {
            router.push({
              pathname: '/(tabs)/share',
            });
          }
        } else if (notificationData.notificationType === NOTIFICATION_TYPE.CHALLENGE_POST_LIVE) {
          if (notificationData.postId) {
            router.push({
              pathname: '/(tabs)/share/[postId]',
              params: { postId: notificationData.postId as Id<'posts'> },
            });
          }
        } else {
          // console.log('Unknown notification type', notificationData.notificationType);
        }
      }
    }
  }, [backgroundNotification?.request?.content?.data, currentUser?._id, rootNavigationState?.key]);

  if (!montserratLoaded && !montserratError && !interLoaded && !interError) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
        <ConvexAuthProvider
          client={convex}
          storage={Platform.OS === 'android' || Platform.OS === 'ios' ? secureStorage : undefined}>
          <QueryClientProvider client={queryClient}>
            <GluestackUIProvider mode="light">
              <RevenueCatProvider>
                <ChallengeUploadProvider>
                  <StatusBar style="auto" />
                  <View
                    className="flex-1 bg-white"
                    style={
                      Platform.OS === 'android' ? { paddingBottom: insets.bottom } : undefined
                    }>
                    <Stack>
                      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                      <Stack.Screen
                        name="posts/new"
                        options={{
                          headerTitle: '',
                        }}
                      />
                      <Stack.Screen
                        name="posts/edit"
                        options={{
                          headerTitle: '',
                        }}
                      />
                      <Stack.Screen
                        name="posts/comments"
                        options={{
                          presentation: 'modal',
                          gestureEnabled: false,
                          headerTitle: '',
                        }}
                      />
                      <Stack.Screen
                        name="activity/new"
                        options={{
                          presentation: 'modal',
                          gestureEnabled: false,
                          headerTitle: '',
                        }}
                      />
                      <Stack.Screen
                        name="activity/edit"
                        options={{
                          presentation: 'modal',
                          gestureEnabled: false,
                          headerTitle: '',
                        }}
                      />
                      <Stack.Screen
                        name="creator/new"
                        options={{
                          presentation: 'modal',
                          gestureEnabled: false,
                          headerTitle: '',
                        }}
                      />
                      <Stack.Screen
                        name="creator/edit"
                        options={{
                          presentation: 'modal',
                          gestureEnabled: false,
                          headerTitle: '',
                        }}
                      />
                      <Stack.Screen
                        name="challenge/new"
                        options={{
                          presentation: 'modal',
                          gestureEnabled: false,
                          headerTitle: '',
                        }}
                      />
                      <Stack.Screen
                        name="challenge/[challengeId]"
                        options={{
                          presentation: 'modal',
                          gestureEnabled: false,
                          headerTitle: '',
                        }}
                      />
                      <Stack.Screen
                        name="creator-video/edit"
                        options={{
                          presentation: 'modal',
                          gestureEnabled: false,
                          headerTitle: '',
                        }}
                      />
                      <Stack.Screen
                        name="challenge-view/[challengeId]"
                        options={{
                          presentation: 'modal',
                          gestureEnabled: true,
                          headerTitle: '',
                        }}
                      />
                      <Stack.Screen
                        name="challenge-record/[challengeId]"
                        options={{
                          presentation: 'fullScreenModal',
                          headerShown: false,
                          gestureEnabled: false,
                        }}
                      />
                      <Stack.Screen
                        name="legals/terms"
                        options={{
                          presentation: 'modal',
                          gestureEnabled: false,
                        }}
                      />
                      <Stack.Screen
                        name="legals/privacy-policy"
                        options={{
                          presentation: 'modal',
                          gestureEnabled: false,
                        }}
                      />
                      <Stack.Screen
                        name="legals/official-rules"
                        options={{
                          presentation: 'modal',
                          gestureEnabled: false,
                        }}
                      />
                      <Stack.Screen
                        name="legals/community-guidelines"
                        options={{
                          presentation: 'modal',
                          gestureEnabled: false,
                        }}
                      />
                    </Stack>
                  </View>
                  <ForceUpdateGate />
                </ChallengeUploadProvider>
              </RevenueCatProvider>
            </GluestackUIProvider>
          </QueryClientProvider>
        </ConvexAuthProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
