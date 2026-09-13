import { Redirect } from 'expo-router';
// Group chat temporarily disabled.
// import { Stack } from 'expo-router';

/*
 * Always keep the group list as the first screen
 * in the group-chat stack. This lets dismissAll()
 * remove the chat and info screens safely.
 */
export const unstable_settings = {
  initialRouteName: 'index',
};

export default function GroupChatLayout() {
  return <Redirect href="/(tabs)/dashboard" />;
  /* Restore this stack when group chat is enabled.
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}>
      <Stack.Screen
        name="index"
        options={{
          headerShown: false,
        }}
      />

      <Stack.Screen
        name="[groupId]"
        options={{
          headerShown: false,
        }}
      />

      <Stack.Screen
        name="[groupId]/info"
        options={{
          headerShown: false,
        }}
      />
    </Stack>
  );
  */
}
