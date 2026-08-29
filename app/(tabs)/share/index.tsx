import { LegendList } from '@legendapp/list';
import { usePaginatedQuery, useQuery } from 'convex/react';
import { Image } from 'expo-image';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { ImageSquare } from 'phosphor-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import { MenuProvider } from 'react-native-popup-menu';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import SafeAreaView from '~/components/core/SafeAreaView';
import ScreenLoading from '~/components/core/ScreenLoading';
import FeaturedRow from '~/components/core/posts/FeaturedRow';
import PostRow, { stopCurrentVideo } from '~/components/core/posts/Row';
import { Text } from '~/components/ui/text';
import { api } from '~/convex/_generated/api';
import type { Id } from '~/convex/_generated/dataModel';
import { useSubscriptionGuard } from '~/hooks/useSubscriptionGuard';
import { useAuthStore } from '~/store/useAuthStore';
import { storage } from '~/utils/storage';

const FEED_PROMPTS = [
  'Show us your water bottle, [name]',
  'Share your view right now, [name]',
  'Share a motivational quote, [name]',
  'Post your outfit today, [name]',
  "Share what's on your playlist, [name]",
  'Post your go-to healthy snack, [name]',
  'Post your gym bag, [name]',
  'Post your favourite leggings, [name]',
  'Post your workout shoes, [name]',
  'Post your current read, [name]',
  'Post your feel-good song, [name]',
];

const TabShare = () => {
  const insets = useSafeAreaInsets();
  const { postId } = useLocalSearchParams<{ postId?: string | string[] }>();
  const [channel] = useState<number>(0);
  const { isPro, requireSubscription } = useSubscriptionGuard();
  const currentUser = useAuthStore((state) => state.currentUser);
  const pinnedPost = useQuery(api.posts.getPinnedPost);

  const { results, status, loadMore } = usePaginatedQuery(
    api.posts.getLatestPosts,
    { channel },
    { initialNumItems: 15 }
  );

  const loadMorePages = () => {
    if (status === 'CanLoadMore') loadMore(15);
  };

  const handleCreatePost = () => {
    if (!requireSubscription({ redirectTo: '/(tabs)/share', source: 'community_create_post' })) {
      return;
    }
    router.push('/posts/new');
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
    const communityGuidelinesShown = storage.getBoolean('communityGuidelinesShown');
    if (!communityGuidelinesShown && isPro) {
      router.push({ pathname: '/legals/community-guidelines' });
    }
  }, [isPro]);

  useEffect(() => {
    const selectedPostId = Array.isArray(postId) ? postId[0] : postId;
    if (!selectedPostId) return;
    router.push({
      pathname: '/(tabs)/share/[postId]',
      params: { postId: selectedPostId as Id<'posts'> },
    });
  }, [postId]);

  useFocusEffect(
    useCallback(() => {
      return () => stopCurrentVideo?.();
    }, [])
  );

  const userName = currentUser?.name?.trim().split(' ')[0] || 'User';
  const userInitial = userName.charAt(0).toUpperCase();
  const userImage = currentUser?.image?.trim();
  const feedPrompt = useMemo(() => {
    const randomIndex = Math.floor(Math.random() * FEED_PROMPTS.length);
    return FEED_PROMPTS[randomIndex].replace(/\[name\]/g, userName);
  }, [userName]);

  return (
    <MenuProvider>
      <SafeAreaView className="flex-1 bg-white">
        <Stack.Screen options={{ headerShown: false, headerShadowVisible: false }} />
        <View
          className="flex-1 flex-col"
          style={Platform.OS === 'android' ? { paddingTop: insets.top } : undefined}>
          <View className="border-b border-b-[#EEEAE5] bg-[#FAFAFA] px-4 pb-5 pt-5">
            <View>
              <Text className="font-heading text-2xl font-extrabold text-[#1A1A1A]">Feed</Text>
              <Text className="mt-0.5 font-body text-sm text-[#5F5F5F]">Sweat Sisters</Text>
            </View>

            <View className="mt-4 flex-row items-center rounded-full border border-[#DB6D06] bg-white px-3 py-2.5">
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={handleCreatePost}
                accessibilityRole="button"
                accessibilityLabel="Create community post"
                className="flex-1 flex-row items-center">
                <View style={styles.avatar}>
                  {userImage ? (
                    <Image
                      source={{ uri: userImage }}
                      style={StyleSheet.absoluteFillObject}
                      contentFit="cover"
                    />
                  ) : (
                    <Text className="font-heading text-sm font-bold text-white">{userInitial}</Text>
                  )}
                </View>
                <Text className="flex-1 pr-2 font-body text-sm text-[#555658]" numberOfLines={2}>
                  {feedPrompt}
                </Text>
              </TouchableOpacity>

              <View className="ml-2 flex-row items-center gap-x-2">
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={handleCreatePost}
                  accessibilityRole="button"
                  accessibilityLabel="Create a post with an image"
                  className="h-9 w-9 items-center justify-center rounded-full bg-[#FFF2E9]">
                  <ImageSquare size={20} color="#F76B1C" weight="bold" />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {status === 'LoadingFirstPage' ? (
            <ScreenLoading className="bg-transparent" />
          ) : (
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
                onEndReachedThreshold={2}
                recycleItems
              />
            </View>
          )}
        </View>
      </SafeAreaView>
    </MenuProvider>
  );
};

const styles = StyleSheet.create({
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    marginRight: 10,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF5C1A',
  },
});

export default TabShare;
