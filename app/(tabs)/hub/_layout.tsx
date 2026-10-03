import { Stack } from 'expo-router';

export default function HubLayout() {
  return (
    <Stack screenOptions={{ title: '' }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
    </Stack>
  );
}
