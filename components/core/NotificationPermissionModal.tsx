import { useMutation } from 'convex/react';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Bell } from 'phosphor-react-native';
import { useState } from 'react';
import { Modal, Platform, ScrollView, View, useWindowDimensions } from 'react-native';

import CoachActionButton from '~/components/core/CoachActionButton';
import { Text } from '~/components/ui/text';
import { api } from '~/convex/_generated/api';

export default function NotificationPermissionModal({ onClose }: { onClose: () => void }) {
  const { height } = useWindowDimensions();

  const register = useMutation(api.users.updateExpoPushToken);
  const choose = useMutation(api.revenueCatEntitlements.chooseTrialNotifications);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const finish = async (enabled: boolean) => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      if (enabled) {
        if (Platform.OS === 'android')
          await Notifications.setNotificationChannelAsync('default', {
            name: 'default',
            importance: Notifications.AndroidImportance.HIGH,
          });
        const permission = await Notifications.requestPermissionsAsync();
        if (
          !permission.granted &&
          permission.ios?.status !== Notifications.IosAuthorizationStatus.PROVISIONAL
        ) {
          setError('Notifications are off. Enable them in your device settings or skip for now.');
          return;
        }
        const token = await Notifications.getExpoPushTokenAsync({
          projectId: Constants.expoConfig?.extra?.eas?.projectId,
        });
        await register({ expoPushToken: token.data });
      }
      await choose({ enabled });
      onClose();
    } catch {
      setError('Could not save your notification choice. Please try again.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      transparent
      visible
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => {
        if (!busy) finish(false);
      }}>
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          padding: 24,
          backgroundColor: 'rgba(20, 14, 10, 0.35)',
        }}>
        <View
          accessibilityViewIsModal
          style={{
            width: '100%',
            maxWidth: 360,
            maxHeight: height * 0.85,
            borderRadius: 28,
            backgroundColor: '#FFF9F5',
            overflow: 'hidden',
          }}>
          <ScrollView contentContainerStyle={{ padding: 24 }} bounces={false}>
            <View className="items-center">
              <View className="h-16 w-16 items-center justify-center rounded-full bg-[#FFE8DC]">
                <Bell size={32} color="#FF5C35" weight="duotone" />
              </View>
              <Text
                style={{
                  marginTop: 16,
                  fontFamily: 'Inter_700Bold',
                  fontSize: 24,
                  lineHeight: 30,
                  color: '#1A1A1A',
                  textAlign: 'center',
                }}>
                Turn on notifications
              </Text>
              <Text
                style={{
                  marginTop: 12,
                  fontFamily: 'Inter_400Regular',
                  fontSize: 15,
                  lineHeight: 22,
                  color: '#55504D',
                  textAlign: 'center',
                }}>
                Get reminders for your check-ins and activity. If you're on a free trial, we'll also
                remind you before your free access ends.
              </Text>
            </View>
            {error ? (
              <Text
                accessibilityLiveRegion="polite"
                className="mt-4 text-center font-body text-sm text-red-600">
                {error}
              </Text>
            ) : null}
            <CoachActionButton
              className="mt-6"
              label={busy ? 'Saving…' : 'Turn on notifications'}
              disabled={busy}
              onPress={() => {
                finish(true);
              }}
            />
            <CoachActionButton
              className="mt-3"
              variant="secondary"
              label="Skip for now"
              disabled={busy}
              onPress={() => {
                finish(false);
              }}
            />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
