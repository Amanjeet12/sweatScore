import { LegendList } from '@legendapp/list';
import { usePaginatedQuery, useQuery } from 'convex/react';
import { Image } from 'expo-image';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState, useMemo } from 'react';
import { Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
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
import { useAuthStore } from '~/store/useAuthStore';
import { storage } from '~/utils/storage';
import { ImageSquare, VideoCamera } from 'phosphor-react-native';

const COMMUNITY_TAGLINES = [
  "Share what's on your plate today, [name]!",
  'Show us your pre- or post-workout snack, [name]!',
  'What are we cooking for dinner tonight, [name]?',
  'Drop your lunch photo below, [name]!',
  'Hydration check! Show us your water bottle right now, [name]!',
  'Show us your workout space today, [name]!',
  'Drop a pic of your view right now, [name]!',
  'Show us your workout outfit today, [name]!',
  'What song or playlist is keeping you moving right now, [name]?',
  'Drop a quick video clip of your workout today, [name]!',
  'How many points did you lock in today, [name]?',
  'Drop a selfie after your workout today, [name]!',
  'Drop an emoji that sums up your energy level right now, [name]!',
  'How many steps did you clock today, [name]?',
  'Show us your breakfast today, [name]!',
  "Coffee, tea, or a smoothie? What's in your cup right now, [name]?",
  'Show us your gym bag essentials, [name]!',
  "How did today's session go, [name]?",
  'Drop your favourite healthy meal right now, [name]!',
  'What time did you train today, [name]?',
  "What's your fitness goal this month, [name]?",
  'Rest day or active day today, [name]?',
  'Post your water intake so far, [name]!',
  "What's motivating you this week, [name]?",
];
const TabShare = () => {
  const insets = useSafeAreaInsets();
  const { postId } = useLocalSearchParams();
  const [channel, setChannel] = useState<number>(0);
  const { isPro } = useRevenueCat();
  const currentUser = useAuthStore((state) => state.currentUser);

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

  const handleCreatePost = () => {
    if (!isPro) {
      router.push('/(tabs)/share/paywall');
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

  useFocusEffect(
    useCallback(() => {
      return () => {
        stopCurrentVideo?.();
      };
    }, [])
  );

  const userName = currentUser?.name?.trim().split(' ')[0] || 'User';
  const userInitial = userName.charAt(0).toUpperCase();
  const userImage = currentUser?.image?.trim();

  const communityTagline = useMemo(() => {
    const randomIndex = Math.floor(Math.random() * COMMUNITY_TAGLINES.length);

    return COMMUNITY_TAGLINES[randomIndex].replace(/\[name\]/g, userName);
  }, [userName]);

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
          <View className="border-b border-b-[#EEEAE5] bg-[#FAFAFA] px-4 pb-5 pt-5">
            <View>
              <Text className="font-heading text-2xl font-extrabold text-[#1A1A1A]">Community</Text>
              <Text className="mt-0.5 font-body text-sm text-[#5F5F5F]">Sweat Sisters</Text>
            </View>

            <View className="mt-4 flex-row items-center rounded-full border border-[#DB6D06] bg-white px-3 py-2.5">
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={handleCreatePost}
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
                  {communityTagline}
                </Text>
              </TouchableOpacity>

              <View className="ml-2 flex-row items-center gap-x-2">
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={handleCreatePost}
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
                onEndReachedThreshold={2.0}
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
