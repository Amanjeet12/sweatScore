import { usePaginatedQuery } from 'convex/react';
import { ReactElement } from 'react';
import { ActivityIndicator, FlatList, View } from 'react-native';

import ActivityRow from '../settings/ActivityRow';

import { prototypeTypography as type } from '~/components/core/design/prototypeStyles';
import { Text } from '~/components/ui/text';
import { api } from '~/convex/_generated/api';
import { Id } from '~/convex/_generated/dataModel';

export default function UserActivities({
  userId,
  header,
}: {
  userId: Id<'users'>;
  header?: ReactElement;
}) {
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
    <FlatList
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingHorizontal: 22, paddingTop: 0, paddingBottom: 32, gap: 12 }}
      showsVerticalScrollIndicator={false}
      data={results}
      ListHeaderComponent={header}
      renderItem={({ item }) => <ActivityRow activity={item} compact />}
      keyExtractor={(item) => item._id.toString()}
      onEndReached={loadMorePages}
      onEndReachedThreshold={0.5}
      ListEmptyComponent={
        status === 'LoadingFirstPage' ? (
          <ActivityIndicator style={{ padding: 24 }} color="#ff5a1f" />
        ) : (
          <View style={{ paddingVertical: 28, alignItems: 'center' }}>
            <Text style={type.body}>No activities yet.</Text>
          </View>
        )
      }
      ListFooterComponent={
        status === 'LoadingMore' ? (
          <ActivityIndicator style={{ padding: 16 }} color="#ff5a1f" />
        ) : null
      }
    />
  );
}
