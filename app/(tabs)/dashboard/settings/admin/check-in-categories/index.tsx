import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery } from 'convex/react';
import { router, Stack } from 'expo-router';
import { Alert, Image, ScrollView, TouchableOpacity, View } from 'react-native';
import { BackButton } from '~/components/core/BackButton';
import SafeAreaView from '~/components/core/SafeAreaView';
import ScreenLoading from '~/components/core/ScreenLoading';
import { Text } from '~/components/ui/text';
import { api } from '~/convex/_generated/api';
import { getErrorMessage } from '~/utils/error-message';

export default function CategoryList() {
  const categories = useQuery(api.checkInCategories.listForAdmin, {});
  const schedulerStatus = useQuery(api.admin.legacySchedulerStatus, {});
  const remove = useMutation(api.checkInCategories.remove);
  return (
    <SafeAreaView className="flex-1 bg-white">
      <Stack.Screen
        options={{
          title: 'Check-In Categories',
          headerLeft: () => <BackButton fallbackHref="/(tabs)/dashboard/settings/admin" />,
        }}
      />
      {categories === undefined ? (
        <ScreenLoading />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 24, gap: 12 }}>
          {!schedulerStatus?.retired ? (
            <TouchableOpacity
              onPress={() =>
                router.push('/dashboard/settings/admin/check-in-categories/new' as any)
              }
              className="mb-2 rounded-xl bg-primary-500 p-4">
              <Text className="text-center font-bold text-white">+ Add Category</Text>
            </TouchableOpacity>
          ) : null}
          {categories.map((category) => (
            <TouchableOpacity
              key={category._id}
              disabled={schedulerStatus?.retired}
              onPress={() =>
                router.push(`/dashboard/settings/admin/check-in-categories/${category._id}` as any)
              }
              className="rounded-xl   p-4">
              <View className="flex-row items-center">
                {category.iconUrl ? (
                  <Image source={{ uri: category.iconUrl }} className="mr-3 h-12 w-12 rounded-xl" />
                ) : (
                  <Text className="mr-3 text-2xl">{category.emoji || '✓'}</Text>
                )}
                <View className="flex-1">
                  <Text className="font-bold">{category.name}</Text>
                  <Text numberOfLines={2} className="text-sm text-gray-500">
                    {category.description}
                  </Text>
                  <Text className={category.isActive ? 'text-green-600' : 'text-gray-400'}>
                    {category.isActive ? 'Active' : 'Inactive'}
                  </Text>
                </View>
                <Ionicons name="create-outline" size={22} />
              </View>
              {!schedulerStatus?.retired ? (
                <TouchableOpacity
                  onPress={() =>
                    Alert.alert('Delete Category', 'Permanently delete this unused category?', [
                      { text: 'Cancel' },
                      {
                        text: 'Delete',
                        style: 'destructive',
                        onPress: async () => {
                          try {
                            await remove({ categoryId: category._id });
                          } catch (error) {
                            Alert.alert('Unable to delete', getErrorMessage(error));
                          }
                        },
                      },
                    ])
                  }>
                  <Text className="mt-3 text-right text-red-500">Delete</Text>
                </TouchableOpacity>
              ) : null}
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
