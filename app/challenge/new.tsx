import { router, Stack } from 'expo-router';

import { BackButton } from '~/components/core/BackButton';
import SafeAreaView from '~/components/core/SafeAreaView';
import ChallengeForm from '~/components/core/admin/ChallengeForm';
import { Text } from '~/components/ui/text';

export default function NewChallenge() {
  return (
    <SafeAreaView className="flex-1 bg-white">
      <Stack.Screen
        options={{
          title: '',
          headerTitleAlign: 'center',
          headerStyle: { backgroundColor: '#FFFFFF' },
          headerShadowVisible: false,
          headerBackVisible: false,
          headerLeft: () => <BackButton onPress={() => router.back()} text="Back" />,
        }}
      />

      <Text className="mb-4 mt-4 text-center font-heading text-3xl font-bold text-[#1A1A1A]">
        New Challenge
      </Text>

      <ChallengeForm mode="create" onSuccess={() => router.back()} />
    </SafeAreaView>
  );
}
