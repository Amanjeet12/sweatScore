import { usePaginatedQuery } from 'convex/react';
import { Stack } from 'expo-router';
import { FlatList, View, Text } from 'react-native';

import { BackButton } from '~/components/core/BackButton';
import SafeAreaView from '~/components/core/SafeAreaView';
import ScreenLoading from '~/components/core/ScreenLoading';
import UserRow from '~/components/core/admin/UserRow';
import { api } from '~/convex/_generated/api';

export default function AdminViewUsers() {
  const { results, status, loadMore } = usePaginatedQuery(
    api.admin.users,
    {},
    { initialNumItems: 50 }
  );

  const loadMorePages = () => {
    if (status === 'CanLoadMore') {
      loadMore(50);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitleAlign: 'center',
          title: '',
          headerTitle: () => (
            <Text className="text-center font-heading text-2xl font-bold text-[#1A1A1A]">
              Users
            </Text>
          ),
          headerShadowVisible: false,
          headerLeft: () => <BackButton fallbackHref="/(tabs)/dashboard/settings/admin" />,
        }}
      />

      {status === 'LoadingFirstPage' ? (
        <ScreenLoading />
      ) : (
        <View className="mx-8 mt-4 flex-1 flex-col gap-y-8">
          <FlatList
            showsVerticalScrollIndicator={false}
            data={results}
            renderItem={({ item }) => <UserRow user={item} />}
            keyExtractor={(item) => item._id.toString()}
            onEndReached={loadMorePages}
            onEndReachedThreshold={2.0}
          />
        </View>
      )}
    </SafeAreaView>
  );
}
