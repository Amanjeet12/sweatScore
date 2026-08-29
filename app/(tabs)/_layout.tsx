import { useQuery } from 'convex/react';
import { Tabs, usePathname } from 'expo-router';
import { ChartBar, CrownSimple, Fire, Rows, Trophy } from 'phosphor-react-native';
import { useEffect, useRef, useState } from 'react';
import { AppState, Platform, Text, View } from 'react-native';

import UpdateAvailableBanner from '~/components/core/dashboard/UpdateAvailableBanner';
import { api } from '~/convex/_generated/api';
import { Id } from '~/convex/_generated/dataModel';
import { useActivateUser } from '~/hooks/useActivateUser';
import { useHealthSync } from '~/hooks/useHealthSync';
import { useAuthStore } from '~/store/useAuthStore';
import { useRefreshStore } from '~/store/useRefreshStore';
import { useTabStore } from '~/store/useTabStore';
import { colors } from '~/utils/constants';
import { storage } from '~/utils/storage';
import { ALL_TABS } from '~/utils/types';

export default function TabLayout() {
  const setCurrentTab = useTabStore((state) => state.setCurrentTab);
  const currentUser = useAuthStore((state) => state.currentUser);
  const pathname = usePathname();
  const appState = useRef(AppState.currentState);
  const incrementRefreshKey = useRefreshStore((state) => state.incrementRefreshKey);
  const { activateUser } = useActivateUser();
  const latestFeedPostCreatedAt = useQuery(
    api.posts.getLatestVisiblePostCreatedAt,
    currentUser ? {} : 'skip'
  );
  const feedSeenStorageKey = currentUser?._id
    ? `feed_last_seen_post_at_${currentUser._id}`
    : undefined;
  const [lastSeenFeedPostAt, setLastSeenFeedPostAt] = useState<number | undefined>();
  const hasUnseenFeedPosts =
    typeof latestFeedPostCreatedAt === 'number' &&
    typeof lastSeenFeedPostAt === 'number' &&
    latestFeedPostCreatedAt > lastSeenFeedPostAt;

  const { syncAllMissedDays } = useHealthSync(
    currentUser?._id as Id<'users'>,
    undefined, // timezone will use default
    currentUser?.birthdate
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        activateUser();
      }

      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    setLastSeenFeedPostAt(feedSeenStorageKey ? storage.getNumber(feedSeenStorageKey) : undefined);
  }, [feedSeenStorageKey]);

  useEffect(() => {
    if (!feedSeenStorageKey || latestFeedPostCreatedAt === undefined) {
      return;
    }

    if (storage.getNumber(feedSeenStorageKey) === undefined) {
      const initialSeenAt = latestFeedPostCreatedAt ?? 0;

      storage.set(feedSeenStorageKey, initialSeenAt);
      setLastSeenFeedPostAt(initialSeenAt);
    }
  }, [feedSeenStorageKey, latestFeedPostCreatedAt]);

  useEffect(() => {
    if (
      !pathname.startsWith('/share') ||
      !feedSeenStorageKey ||
      typeof latestFeedPostCreatedAt !== 'number'
    ) {
      return;
    }

    storage.set(feedSeenStorageKey, latestFeedPostCreatedAt);
    setLastSeenFeedPostAt(latestFeedPostCreatedAt);
  }, [feedSeenStorageKey, latestFeedPostCreatedAt, pathname]);

  return (
    <View className="flex-1 bg-white">
      <Tabs
        backBehavior="history"
        screenOptions={{
          lazy: false,
          freezeOnBlur: true,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: '#878787',
          headerShown: false,
          tabBarStyle: {
            backgroundColor: '#FFFFFF',
            borderTopWidth: 1,
            borderTopColor: '#F0F0F0',
            borderTopLeftRadius: 0,
            borderTopRightRadius: 0,
            height: Platform.OS === 'ios' ? 80 : 70,
            paddingTop: Platform.OS === 'ios' ? 12 : 8,
            paddingBottom: Platform.OS === 'ios' ? 0 : 8,
          },
        }}>
        <Tabs.Screen
          name="dashboard"
          options={{
            title: '',
            tabBarLabel: ({ focused, color }) => (
              <Text
                style={{
                  color: focused ? colors.primary : color,
                  fontSize: 10,
                  fontFamily: 'Inter_500Medium',
                }}>
                Today
              </Text>
            ),
            // tabBarStyle: {
            //   // height: 90,
            //   paddingTop: 12,
            // },
            tabBarIcon: ({ color, focused }) => (
              <Fire
                color={focused ? colors.primary : color}
                weight={focused ? 'fill' : 'duotone'}
                size={28}
              />
            ),
            headerLeft: () => null,
            tabBarHideOnKeyboard: true,
            // unmountOnBlur: true
          }}
          listeners={() => ({
            tabPress: () => {
              setCurrentTab(ALL_TABS.DASHBOARD);
              // Run sync in background - don't block tab navigation
              syncAllMissedDays().then(() => {
                incrementRefreshKey();
              });
            },
          })}
        />
        <Tabs.Screen
          name="hub"
          options={{
            title: '',
            tabBarLabel: ({ focused, color }) => (
              <Text
                style={{
                  color: focused ? colors.primary : color,
                  fontSize: 10,
                  fontFamily: 'Inter_500Medium',
                }}>
                Challenges
              </Text>
            ),
            tabBarIcon: ({ color, focused }) => (
              <Trophy
                color={focused ? colors.primary : color}
                weight={focused ? 'fill' : 'duotone'}
                size={28}
              />
            ),
            tabBarHideOnKeyboard: true,
          }}
          listeners={() => ({
            tabPress: () => {
              setCurrentTab(ALL_TABS.HUB);
            },
          })}
        />
        <Tabs.Screen
          name="share"
          options={{
            title: '',
            tabBarLabel: ({ focused, color }) => (
              <Text
                style={{
                  color: focused ? colors.primary : color,
                  fontSize: 10,
                  fontFamily: 'Inter_500Medium',
                }}>
                Feed
              </Text>
            ),
            tabBarIcon: ({ color, focused }) => (
              <View>
                <Rows
                  color={focused ? colors.primary : color}
                  weight={focused ? 'fill' : 'duotone'}
                  size={28}
                />
                {hasUnseenFeedPosts ? (
                  <View
                    accessibilityLabel="New community posts"
                    style={{
                      position: 'absolute',
                      top: -4,
                      right: -5,
                      width: 14,
                      height: 14,
                      borderRadius: 7,
                      borderWidth: 2,
                      borderColor: '#FFFFFF',
                      backgroundColor: '#EF4444',
                      shadowColor: '#EF4444',
                      shadowOffset: { width: 0, height: 0 },
                      shadowOpacity: 0.65,
                      shadowRadius: 4,
                      elevation: 4,
                    }}
                  />
                ) : null}
              </View>
            ),
            tabBarHideOnKeyboard: true,
          }}
          listeners={() => ({
            tabPress: () => {
              if (feedSeenStorageKey && typeof latestFeedPostCreatedAt === 'number') {
                storage.set(feedSeenStorageKey, latestFeedPostCreatedAt);
                setLastSeenFeedPostAt(latestFeedPostCreatedAt);
              }

              setCurrentTab(ALL_TABS.SHARE);
            },
          })}
        />
        <Tabs.Screen
          name="notifications"
          options={{
            title: '',
            tabBarLabel: ({ focused, color }) => (
              <Text
                style={{
                  color: focused ? colors.primary : color,
                  fontSize: 10,
                  fontFamily: 'Inter_500Medium',
                }}>
                League
              </Text>
            ),
            // tabBarStyle: {
            //   // height: 90,
            //   paddingTop: 12,
            // },
            tabBarIcon: ({ color, focused }) => (
              <CrownSimple
                color={focused ? colors.primary : color}
                weight={focused ? 'fill' : 'duotone'}
                size={28}
              />
            ),
            tabBarHideOnKeyboard: true,
          }}
          listeners={() => ({
            tabPress: () => {
              setCurrentTab(ALL_TABS.NOTIFICATIONS);
            },
          })}
        />
        <Tabs.Screen
          name="rewards"
          options={{
            title: '',
            tabBarLabel: ({ focused, color }) => (
              <Text
                style={{
                  color: focused ? colors.primary : color,
                  fontSize: 10,
                  fontFamily: 'Inter_500Medium',
                }}>
                Progress
              </Text>
            ),
            tabBarIcon: ({ color, focused }) => (
              <ChartBar
                color={focused ? colors.primary : color}
                weight={focused ? 'fill' : 'duotone'}
                size={28}
              />
            ),
            tabBarHideOnKeyboard: true,
          }}
          listeners={() => ({
            tabPress: () => {
              setCurrentTab(ALL_TABS.REWARDS);
            },
          })}
        />
        {/* <Tabs.Screen
          name="settings"
          options={{
            title: '',
            tabBarLabel: ({ focused, color }) => (
              <Text style={{ color: focused ? colors.primary : color, fontSize: 10, fontFamily: 'Inter_500Medium' }}>You</Text>
            ),
            // tabBarStyle: {
            //   // height: 90,
            //   paddingTop: 12,
            // },
            tabBarIcon: ({ color, focused }) => (
              <User
                color={focused ? colors.primary : color}
                weight={focused ? 'fill' : 'duotone'}
                size={28}
              />
            ),
            tabBarHideOnKeyboard: true,
            popToTopOnBlur: true,
          }}
          listeners={() => ({
            tabPress: (e) => {
              setCurrentTab(ALL_TABS.SETTINGS);
            },
          })}
        /> */}
      </Tabs>
      <UpdateAvailableBanner />
    </View>
  );
}
