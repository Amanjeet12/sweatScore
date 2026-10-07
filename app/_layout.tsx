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
import { Montserrat_600SemiBold } from '@expo-google-fonts/montserrat';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConvexReactClient } from 'convex/react';
import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo } from 'react';
import { LogBox, Platform, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GluestackUIProvider } from '@/components/ui/gluestack-ui-provider';
import SessionRedirect from '~/components/providers/SessionRedirect';
import ForceUpdateGate from '~/components/core/ForceUpdateGate';
import { CelebrationProvider } from '~/components/providers/CelebrationProvider';
import { ChallengeUploadProvider } from '~/components/providers/ChallengeUploadProvider';
import { RevenueCatProvider } from '~/components/providers/RevenueCatProvider';
import RevenueCatRedemptionHandler from '~/components/providers/RevenueCatRedemptionHandler';
import { WorkoutUploadProvider } from '~/components/providers/WorkoutUploadProvider';
import { Id } from '~/convex/_generated/dataModel';
import { usePushNotifications } from '~/hooks/usePushNotifications';
import { useAuthStore } from '~/store/useAuthStore';
import { authSessionStorage } from '~/utils/authSessionStorage';
import { NOTIFICATION_TYPE } from '~/utils/types';

const convex = new ConvexReactClient(process.env.EXPO_PUBLIC_CONVEX_URL!, {
  unsavedChangesWarning: false,
});

LogBox.ignoreAllLogs();

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

export default function Layout() {
  const sessionVersion = useAuthStore((state) => state.sessionVersion);
  const sessionStorage = useMemo(() => authSessionStorage.storage(), [sessionVersion]);
  useEffect(() => {
    if (sessionVersion > 0) queryClient.clear();
  }, [sessionVersion]);
  const currentUser = useAuthStore((state) => state.currentUser);
  const { backgroundNotification } = usePushNotifications();
  const insets = useSafeAreaInsets();

  const [interLoaded, interError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Montserrat_600SemiBold,
  });

  useEffect(() => {
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
          notificationData.notificationType === NOTIFICATION_TYPE.NEW_POST_LIKED ||
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
        } else if (
          notificationData.notificationType === NOTIFICATION_TYPE.CHALLENGE_POST_LIVE ||
          notificationData.notificationType === NOTIFICATION_TYPE.VIDEO_FEED_LIVE
        ) {
          if (notificationData.postId) {
            router.push({
              pathname: '/(tabs)/share/[postId]',
              params: { postId: notificationData.postId as Id<'posts'> },
            });
          }
        } else if (notificationData.notificationType === NOTIFICATION_TYPE.TODAY_PLAN_QUESTIONS) {
          router.push('/coach-onboarding');
        } else if (notificationData.notificationType === NOTIFICATION_TYPE.TODAY_PLAN_READY) {
          router.push('/coach-plan');
        } else if (
          notificationData.notificationType === NOTIFICATION_TYPE.WEEKLY_PROGRESS_PHOTO_DUE
        ) {
          router.push('/progress-photo');
        } else if (
          notificationData.notificationType === NOTIFICATION_TYPE.CHALLENGE_STARTS_TOMORROW
        ) {
          if (notificationData.challengeId)
            router.push({
              pathname: '/challenge-view/[challengeId]',
              params: { challengeId: notificationData.challengeId as string },
            });
          else router.push('/(tabs)/hub');
        } else if (notificationData.notificationType === NOTIFICATION_TYPE.NEW_MONTH) {
          router.push('/(tabs)/dashboard');
        } else if (notificationData.notificationType === NOTIFICATION_TYPE.NEW_CHAT_MESSAGE) {
          // Group chat temporarily disabled; ignore old chat notifications.
          /*
          const notificationGroupId = notificationData.groupId;

          if (typeof notificationGroupId === 'string' && notificationGroupId) {
            router.push({
              pathname: '/group-chat/[groupId]',

              params: {
                groupId: notificationGroupId as Id<'chatGroups'>,
              },
            });
          } else {
            router.push('/group-chat');
          }
          */
        } else {
          // Unknown notification type
        }
      }
    }
  }, [backgroundNotification?.request?.content?.data, currentUser?._id]);

  if (!interLoaded && !interError) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
        <ConvexAuthProvider key={sessionVersion} client={convex} storage={sessionStorage}>
          <QueryClientProvider client={queryClient}>
            <GluestackUIProvider mode="light">
              <RevenueCatProvider>
                <RevenueCatRedemptionHandler />
                <CelebrationProvider>
                  <ChallengeUploadProvider>
                    <WorkoutUploadProvider>
                      <StatusBar style="auto" />
                      <View
                        className="flex-1 bg-white"
                        style={
                          Platform.OS === 'android' ? { paddingBottom: insets.bottom } : undefined
                        }>
                        <SessionRedirect />
                        <Stack screenOptions={{ title: '' }}>
                          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
                          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                          <Stack.Screen
                            name="subscription"
                            options={{
                              headerShown: false,
                              gestureEnabled: false,
                              presentation: 'card',
                              animation: 'none',
                            }}
                          />

                          <Stack.Screen name="group-chat" options={{ headerShown: false }} />
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
                              presentation: 'card',
                              animation: 'slide_from_right',
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
                              presentation: 'card',
                              animation: 'slide_from_right',
                              gestureEnabled: true,
                              headerTitle: '',
                            }}
                          />
                          <Stack.Screen
                            name="challenge-record/[challengeId]"
                            options={{
                              presentation: 'card',
                              animation: 'slide_from_right',
                              headerShown: false,
                              gestureEnabled: false,
                            }}
                          />
                          <Stack.Screen
                            name="progress-photo"
                            options={{
                              presentation: 'card',
                              animation: 'slide_from_right',
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
                      {/* <ForceUpdateGate /> */}
                    </WorkoutUploadProvider>
                  </ChallengeUploadProvider>
                </CelebrationProvider>
              </RevenueCatProvider>
            </GluestackUIProvider>
          </QueryClientProvider>
        </ConvexAuthProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
