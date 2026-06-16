import { Ionicons } from '@expo/vector-icons';
import { LegendList } from '@legendapp/list';
import { usePaginatedQuery, useQuery } from 'convex/react';
import { LinearGradient } from 'expo-linear-gradient';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Platform, View, TouchableOpacity } from 'react-native';
import { MenuProvider } from 'react-native-popup-menu';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import SafeAreaView from '~/components/core/SafeAreaView';
import ScreenLoading from '~/components/core/ScreenLoading';
import FeaturedRow from '~/components/core/posts/FeaturedRow';
import PostRow, { stopCurrentVideo } from '~/components/core/posts/Row';
import { useRevenueCat } from '~/components/providers/RevenueCatProvider';
import { Text } from '~/components/ui/text';
import { api } from '~/convex/_generated/api';
import { Id } from '~/convex/_generated/dataModel';
import { storage } from '~/utils/storage';

const TabShare = () => {
  const insets = useSafeAreaInsets();
  const { postId } = useLocalSearchParams();
  const [channel, setChannel] = useState<number>(0);
  const { isPro } = useRevenueCat();

  const pinnedPost = useQuery(api.posts.getPinnedPost);

  const { results, status, loadMore } = usePaginatedQuery(
    api.posts.getLatestPosts,
    { channel },
    { initialNumItems: 15 }
  );

  const loadMorePages = () => {
    if (status === 'CanLoadMore') {
      loadMore(15);
    }
  };

  const renderPinnedPost = () => {
    if (!pinnedPost) return null;

    return (
      <View>
        <FeaturedRow post={pinnedPost} />
      </View>
    );
  };

  useEffect(() => {
    const CommunityGuidelinesShown = storage.getBoolean('communityGuidelinesShown');
    if (!CommunityGuidelinesShown && isPro) {
      router.push({
        pathname: '/legals/community-guidelines',
      });
    }
  }, [isPro]);

  useEffect(() => {
    if (postId) {
      router.push({
        pathname: '/(tabs)/share/[postId]',
        params: { postId: postId as Id<'posts'> },
      });
    }
  }, [postId]);

  // Stop any playing community video when the user navigates away from this
  // screen (other tab or pushing a new screen on top).
  useFocusEffect(
    useCallback(() => {
      return () => {
        stopCurrentVideo?.();
      };
    }, [])
  );

  return (
    <MenuProvider>
      <SafeAreaView className="flex-1 bg-white">
        <Stack.Screen
          options={{
            headerShown: false,
            headerShadowVisible: false,
          }}
        />
        <View
          className="flex-1 flex-col"
          style={Platform.OS === 'android' ? { paddingTop: insets.top } : undefined}>
          <View className="mt-4 border-b border-b-[#EEEAE5] pb-4">
            <View className="mb-4 flex-row items-center justify-between px-4">
              <View>
                <Text className="font-heading text-2xl font-bold text-[#1A1A1A]">Community</Text>
                <Text className="font-body text-sm text-[#838383]">Sweat Sisters</Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  if (!isPro) {
                    router.push('/(tabs)/share/paywall');
                    return;
                  }
                  router.push('/posts/new');
                }}
                className="h-10 w-10 overflow-hidden rounded-full">
                <LinearGradient
                  colors={['#FF8A65', '#FF5C1A']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="add" size={24} color="white" />
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
          {status === 'LoadingFirstPage' ? (
            <ScreenLoading className="bg-transparent" />
          ) : (
            <>
              <View className="flex-1 flex-col bg-white">
                <LegendList
                  showsVerticalScrollIndicator={false}
                  data={results}
                  renderItem={({ item }: { item: (typeof results)[number] }) => (
                    <PostRow post={item} />
                  )}
                  keyExtractor={(item) => item._id.toString()}
                  ListHeaderComponent={renderPinnedPost}
                  ListFooterComponent={<View className="mb-4" />}
                  onEndReached={loadMorePages}
                  onEndReachedThreshold={2.0}
                  recycleItems
                />
              </View>
            </>
          )}
        </View>
      </SafeAreaView>
    </MenuProvider>
  );
};

export default TabShare;
