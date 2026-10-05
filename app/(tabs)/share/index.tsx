import { LegendList } from '@legendapp/list';
import { usePaginatedQuery, useQuery } from 'convex/react';
import { Image } from 'expo-image';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { ImageSquare, NotePencil, VideoCamera } from 'phosphor-react-native';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { MenuProvider } from 'react-native-popup-menu';
import { SafeAreaView } from 'react-native-safe-area-context';

import ScreenLoading from '~/components/core/ScreenLoading';
import {
  communityStyles as community,
  communityTypography as type,
} from '~/components/core/design/CommunityStyles';
import FeaturedRow from '~/components/core/posts/FeaturedRow';
import PostRow, { stopCurrentVideo } from '~/components/core/posts/Row';
import { Text } from '~/components/ui/text';
import { api } from '~/convex/_generated/api';
import type { Id } from '~/convex/_generated/dataModel';
import { useSubscriptionGuard } from '~/hooks/useSubscriptionGuard';
import { useAuthStore } from '~/store/useAuthStore';
import { storage } from '~/utils/storage';

const TabShare = () => {
  const { postId } = useLocalSearchParams<{ postId?: string | string[] }>();
  const [channel] = useState<number>(0);
  const { isPro, requireSubscription } = useSubscriptionGuard();
  const currentUser = useAuthStore((state) => state.currentUser);
  const pinnedPost = useQuery(api.posts.getPinnedPost);

  const { results, status, loadMore } = usePaginatedQuery(
    api.posts.getLatestPosts,
    { channel },
    { initialNumItems: 8 }
  );

  const loadMorePages = () => {
    if (status === 'CanLoadMore') loadMore(8);
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
      <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-white">
        <Stack.Screen options={{ headerShown: false, headerShadowVisible: false }} />
        <View className="flex-1 flex-col">
          <View style={community.header}>
            <Text style={type.title}>Community</Text>
          </View>

          <View className="flex-1 flex-col bg-white">
            <LegendList
              showsVerticalScrollIndicator={false}
              data={results}
              renderItem={({ item }: { item: (typeof results)[number] }) => <PostRow post={item} />}
              keyExtractor={(item) => item._id.toString()}
              ListHeaderComponent={
                <>
                  <View style={community.composer}>
                    <View className="bg-white pb-1 pt-1">
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
                        <View style={community.prompt}>
                          <Text style={type.prompt}>Share something with the community</Text>
                        </View>
                      </TouchableOpacity>

                      <View style={community.actions}>
                        <TouchableOpacity
                          activeOpacity={0.7}
                          onPress={() => handleCreatePost('image')}
                          accessibilityRole="button"
                          accessibilityLabel="Create a post with an image"
                          style={community.action}>
                          <ImageSquare size={22} color="#ff5a1f" weight="regular" />
                          <Text style={type.action}>Photo</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          activeOpacity={0.7}
                          onPress={() => handleCreatePost('video')}
                          accessibilityRole="button"
                          accessibilityLabel="Create a post with a video"
                          style={community.action}>
                          <VideoCamera size={22} color="#ff5a1f" weight="regular" />
                          <Text style={type.action}>Video</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          activeOpacity={0.7}
                          onPress={() => handleCreatePost()}
                          accessibilityRole="button"
                          accessibilityLabel="Write a community post"
                          style={community.action}>
                          <NotePencil size={22} color="#ff5a1f" weight="regular" />
                          <Text style={type.action}>Write</Text>
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
              onEndReachedThreshold={0.5}
            />
          </View>
        </View>
      </SafeAreaView>
    </MenuProvider>
  );
};

const styles = StyleSheet.create({
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ff5a1f',
  },
});

export default TabShare;
