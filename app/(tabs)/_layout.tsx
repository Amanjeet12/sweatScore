import { Tabs } from 'expo-router';
import { CrownSimple, Fire, VideoCamera, ChatCircleDots, ChartBar } from 'phosphor-react-native';
import { useEffect, useRef, useState } from 'react';
import { AppState, Platform, Text, View } from 'react-native';

import UpdateAvailableBanner from '~/components/core/dashboard/UpdateAvailableBanner';
import { Id } from '~/convex/_generated/dataModel';
import { useActivateUser } from '~/hooks/useActivateUser';
import { useHealthSync } from '~/hooks/useHealthSync';
import { useAuthStore } from '~/store/useAuthStore';
import { useRefreshStore } from '~/store/useRefreshStore';
import { useTabStore } from '~/store/useTabStore';
import { colors } from '~/utils/constants';
import { ALL_TABS } from '~/utils/types';

export default function TabLayout() {
  const setCurrentTab = useTabStore((state) => state.setCurrentTab);
  const currentUser = useAuthStore((state) => state.currentUser);
  const appState = useRef(AppState.currentState);
  const [appStateVisible, setAppStateVisible] = useState(appState.current);
  const incrementRefreshKey = useRefreshStore((state) => state.incrementRefreshKey);
  const { activateUser } = useActivateUser();

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
      setAppStateVisible(appState.current);
    });

    return () => {
      subscription.remove();
    };
  }, []);

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
              <VideoCamera
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
              <ChatCircleDots
                color={focused ? colors.primary : color}
                weight={focused ? 'fill' : 'duotone'}
                size={28}
              />
            ),
            tabBarHideOnKeyboard: true,
          }}
          listeners={() => ({
            tabPress: () => {
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
