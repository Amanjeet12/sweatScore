import { LegendList } from '@legendapp/list';
import { usePaginatedQuery, useQuery } from 'convex/react';
import { Image } from 'expo-image';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { ImageSquare, NotePencil, VideoCamera } from 'phosphor-react-native';
import { useCallback, useEffect, useState } from 'react';
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

  const handleCreatePost = (initialMediaType?: 'image' | 'video') => {
    if (!requireSubscription({ redirectTo: '/(tabs)/share', source: 'community_create_post' })) {
      return;
    }
    if (initialMediaType) {
      router.push({ pathname: '/posts/new', params: { initialMediaType } });
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

  useFocusEffect(
    useCallback(() => {
      const communityGuidelinesShown = storage.getBoolean('communityGuidelinesShown');
      if (!communityGuidelinesShown && isPro) {
        router.push({ pathname: '/legals/community-guidelines' });
      }
    }, [isPro])
  );

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
  return (
    <MenuProvider>
      <SafeAreaView className="flex-1 bg-[#F9F9F9]">
        <Stack.Screen options={{ headerShown: false, headerShadowVisible: false }} />
        <View
          className="flex-1 flex-col"
          style={Platform.OS === 'android' ? { paddingTop: insets.top } : undefined}>
          <View className="bg-[#F9F9F9] px-4 pb-3 pt-5">
            <View>
              <Text
                style={{ fontFamily: 'Inter_700Bold' }}
                className="mt-1 text-[28px] text-[#1A1A1A]">
                Community
              </Text>
            </View>
          </View>

          <View className="flex-1 flex-col bg-[#F9F9F9]">
            <LegendList
              showsVerticalScrollIndicator={false}
              data={results}
              renderItem={({ item }: { item: (typeof results)[number] }) => <PostRow post={item} />}
              keyExtractor={(item) => item._id.toString()}
              ListHeaderComponent={
                <>
                  <View className="px-4 pb-3 pt-5">
                    <View className="overflow-hidden rounded-[24px] bg-white px-4 pb-2 pt-4">
                      <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={() => handleCreatePost()}
                        accessibilityRole="button"
                        accessibilityLabel="Create community post"
                        className="flex-row items-center">
                        <View style={styles.avatar}>
                          {userImage ? (
                            <Image
                              source={{ uri: userImage }}
                              style={StyleSheet.absoluteFillObject}
                              contentFit="cover"
                            />
                          ) : (
                            <Text
                              style={{ fontFamily: 'Inter_600SemiBold' }}
                              className="text-sm text-white">
                              {userInitial}
                            </Text>
                          )}
                        </View>
                        <View className="min-h-11 flex-1 justify-center rounded-[20px] bg-[#FBF9F7] px-4">
                          <Text className="font-body text-xs text-[#77716D]" numberOfLines={1}>
                            Share something with the community
                          </Text>
                        </View>
                      </TouchableOpacity>

                      <View className="mt-3 flex-row border-t border-[#EEE8E3] pt-2">
                        <TouchableOpacity
                          activeOpacity={0.7}
                          onPress={() => handleCreatePost('image')}
                          accessibilityRole="button"
                          accessibilityLabel="Create a post with an image"
                          className="min-h-10 flex-1 flex-row items-center justify-center gap-x-2 rounded-[20px]">
                          <ImageSquare size={17} color="#FF5C35" weight="bold" />
                          <Text
                            style={{ fontFamily: 'Inter_600SemiBold' }}
                            className="text-[11px] text-[#4D4946]">
                            Photo
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          activeOpacity={0.7}
                          onPress={() => handleCreatePost('video')}
                          accessibilityRole="button"
                          accessibilityLabel="Create a post with a video"
                          className="min-h-10 flex-1 flex-row items-center justify-center gap-x-2 rounded-[20px]">
                          <VideoCamera size={17} color="#FF5C35" weight="bold" />
                          <Text
                            style={{ fontFamily: 'Inter_600SemiBold' }}
                            className="text-[11px] text-[#4D4946]">
                            Video
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          activeOpacity={0.7}
                          onPress={() => handleCreatePost()}
                          accessibilityRole="button"
                          accessibilityLabel="Write a community post"
                          className="min-h-10 flex-1 flex-row items-center justify-center gap-x-2 rounded-[20px]">
                          <NotePencil size={17} color="#FF5C35" weight="bold" />
                          <Text
                            style={{ fontFamily: 'Inter_600SemiBold' }}
                            className="text-[11px] text-[#4D4946]">
                            Write
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                  {renderPinnedPost()}
                </>
              }
              ListEmptyComponent={
                status === 'LoadingFirstPage' ? <ScreenLoading className="bg-transparent" /> : null
              }
              ListFooterComponent={<View className="mb-6" />}
              onEndReached={loadMorePages}
              onEndReachedThreshold={2}
              recycleItems
            />
          </View>
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
