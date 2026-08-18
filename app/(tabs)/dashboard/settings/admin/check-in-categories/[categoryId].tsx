import { useQuery } from 'convex/react';
import { Stack, useLocalSearchParams } from 'expo-router';
import { BackButton } from '~/components/core/BackButton';
import SafeAreaView from '~/components/core/SafeAreaView';
import ScreenLoading from '~/components/core/ScreenLoading';
import CheckInCategoryForm from '~/components/core/admin/CheckInCategoryForm';
import { api } from '~/convex/_generated/api';
import { Id } from '~/convex/_generated/dataModel';
export default function EditCategory() {
  const { categoryId } = useLocalSearchParams<{ categoryId: string }>();
  const category = useQuery(api.checkInCategories.getForAdmin, {
    categoryId: categoryId as Id<'checkInCategories'>,
  });
  return (
    <SafeAreaView className="flex-1 bg-white">
      <Stack.Screen
        options={{
          title: 'Edit Check-In Category',
          headerLeft: () => (
            <BackButton
              fallbackHref={'/(tabs)/dashboard/settings/admin/check-in-categories' as any}
            />
          ),
        }}
      />
      {category ? <CheckInCategoryForm category={category} /> : <ScreenLoading />}
    </SafeAreaView>
  );
}
