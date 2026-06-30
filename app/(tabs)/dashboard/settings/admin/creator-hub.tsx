import { useQuery } from 'convex/react';
import { router, Stack } from 'expo-router';
import { FlatList, TouchableOpacity, View } from 'react-native';

import { BackButton } from '~/components/core/BackButton';
import { HeaderButton } from '~/components/core/HeaderButton';
import SafeAreaView from '~/components/core/SafeAreaView';
import ScreenLoading from '~/components/core/ScreenLoading';
import CreatorRow from '~/components/core/creators/Row';
import { Text } from '~/components/ui/text';
import { api } from '~/convex/_generated/api';

export default function AdminViewCreatorHub() {
  const getCreators = useQuery(api.admin.getCreators);

  return (
    <SafeAreaView className="flex-1 bg-white">
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitleAlign: 'center',
          title: '',
          headerTitle: () => (
            <Text className="text-center font-heading text-2xl font-bold text-[#1A1A1A]">
              Creator Hub
            </Text>
          ),
          headerShadowVisible: false,
          headerRight: () => (
            <HeaderButton minWidth={72} onPress={() => router.push('/creator/new')}>
              <Text className="text-xl font-semibold text-primary-500">+ Add</Text>
            </HeaderButton>
          ),
          headerLeft: () => <BackButton fallbackHref="/(tabs)/dashboard/settings/admin" />,
        }}
      />

      {!getCreators ? (
        <ScreenLoading />
      ) : (
        <View className="mx-4 mt-4 flex-1 flex-col gap-y-8">
          <FlatList
            showsVerticalScrollIndicator={false}
            data={getCreators}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() =>
                  router.push({
                    pathname: '/dashboard/settings/admin/creator/[creatorId]',
                    params: { creatorId: item._id },
                  })
                }>
                <CreatorRow creator={item} />
              </TouchableOpacity>
            )}
            keyExtractor={(item) => item._id.toString()}
            ListEmptyComponent={<Text className="text-center text-2xl">No creators</Text>}
          />
        </View>
      )}
    </SafeAreaView>
  );
}
