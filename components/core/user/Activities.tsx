import { usePaginatedQuery } from 'convex/react';
import { FlatList, View } from 'react-native';

import ScreenLoading from '../ScreenLoading';
import ActivityRow from '../settings/ActivityRow';

import { api } from '~/convex/_generated/api';
import { Id } from '~/convex/_generated/dataModel';

export default function UserActivities({ userId }: { userId: Id<'users'> }) {
  const { results, status, loadMore } = usePaginatedQuery(
    api.activities.getUserActivities,
    {
      userId,
    },
    { initialNumItems: 50 }
  );

  const loadMorePages = () => {
    if (status === 'CanLoadMore') {
      loadMore(50);
    }
  };

  return (
    <>
      {/* <View>
        <Text className="text-2xl font-bold text-primary-500 text-center">All Activities</Text>
      </View> */}
      {status === 'LoadingFirstPage' ? (
        <View className="mt-4 flex-1 flex-col gap-y-8">
          <ScreenLoading />
        </View>
      ) : (
        <View className="flex-1">
          <FlatList
            showsVerticalScrollIndicator={false}
            data={results}
            renderItem={({ item }) => <ActivityRow activity={item} />}
            keyExtractor={(item) => item._id.toString()}
            onEndReached={loadMorePages}
            onEndReachedThreshold={2.0}
          />
        </View>
      )}
    </>
  );
}
