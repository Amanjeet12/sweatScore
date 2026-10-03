import { Stack } from 'expo-router';

export default function NotificationsLayout() {
  return (
    <Stack screenOptions={{ title: '' }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
    </Stack>
  );
}
