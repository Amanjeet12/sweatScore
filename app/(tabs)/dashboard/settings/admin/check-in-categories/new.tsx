import { Stack } from 'expo-router';
import { BackButton } from '~/components/core/BackButton';
import SafeAreaView from '~/components/core/SafeAreaView';
import CheckInCategoryForm from '~/components/core/admin/CheckInCategoryForm';
export default function NewCategory() {
  return (
    <SafeAreaView className="flex-1 bg-white">
      <Stack.Screen
        options={{
          title: 'Add Check-In Category',
          headerLeft: () => (
            <BackButton
              fallbackHref={'/(tabs)/dashboard/settings/admin/check-in-categories' as any}
            />
          ),
        }}
      />
      <CheckInCategoryForm />
    </SafeAreaView>
  );
}
