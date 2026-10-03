import { Stack } from 'expo-router';

export default function DashboardLayout() {
  return (
    <Stack screenOptions={{ title: '' }}>
      <Stack.Screen name="creators/[creatorId]" options={{ headerShown: false }} />
      <Stack.Screen name="creators/videos/[videoId]" options={{ headerShown: false }} />
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen
        name="challenges"
        options={{ headerShown: true, presentation: 'card', animation: 'slide_from_right' }}
      />
      <Stack.Screen name="workouts" options={{ headerShown: true, title: 'Creators' }} />
      <Stack.Screen name="settings" options={{ headerShown: false }} />
    </Stack>
  );
}
