import { LegendList } from '@legendapp/list';
import { usePaginatedQuery, useQuery } from 'convex/react';
import { Image } from 'expo-image';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Compass, Plus, UsersThree } from 'phosphor-react-native';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { MenuProvider } from 'react-native-popup-menu';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import SafeAreaView from '~/components/core/SafeAreaView';
import ScreenLoading from '~/components/core/ScreenLoading';
import FeaturedRow from '~/components/core/posts/FeaturedRow';
import PostRow, { stopCurrentVideo } from '~/components/core/posts/Row';
import { useRevenueCat } from '~/components/providers/RevenueCatProvider';
import { Text } from '~/components/ui/text';
import { api } from '~/convex/_generated/api';
import type { Id } from '~/convex/_generated/dataModel';
import { storage } from '~/utils/storage';

const TabShare = () => {
  const insets = useSafeAreaInsets();

  const { postId } = useLocalSearchParams<{
    postId?: string | string[];
  }>();

  const [channel] = useState<number>(0);

  const { isPro } = useRevenueCat();

  /*
   * Returns the active groups that the
   * authenticated user has joined.
   *
   * Each group should include:
   *
   * unreadCount: number
   */
  const joinedGroups = useQuery(api.chat.groups.listMyGroups);

  const pinnedPost = useQuery(api.posts.getPinnedPost);

  const { results, status, loadMore } = usePaginatedQuery(
    api.posts.getLatestPosts,
    {
      channel,
    },
    {
      initialNumItems: 15,
    }
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

  const openGroup = (groupId: string) => {
    router.push({
      pathname: '/group-chat/[groupId]',

      params: {
        groupId,
      },
    });
  };

  const openGroupsScreen = () => {
    router.push('/group-chat');
  };

  const renderPinnedPost = () => {
    if (!pinnedPost) {
      return null;
    }

    return (
      <View>
        <FeaturedRow post={pinnedPost} />
      </View>
    );
  };

  useEffect(() => {
    const communityGuidelinesShown = storage.getBoolean('communityGuidelinesShown');

    if (!communityGuidelinesShown && isPro) {
      router.push({
        pathname: '/legals/community-guidelines',
      });
    }
  }, [isPro]);

  useEffect(() => {
    const selectedPostId = Array.isArray(postId) ? postId[0] : postId;

    if (!selectedPostId) {
      return;
    }

    router.push({
      pathname: '/(tabs)/share/[postId]',

      params: {
        postId: selectedPostId as Id<'posts'>,
      },
    });
  }, [postId]);

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
          style={
            Platform.OS === 'android'
              ? {
                  paddingTop: insets.top,
                }
              : undefined
          }>
          <View className="border-b border-b-[#EEEAE5] bg-[#FAFAFA] pb-4 pt-5">
            {/* Header */}
            <View className="flex-row items-center justify-between px-4">
              <View className="flex-1">
                <Text className="font-heading text-2xl font-extrabold text-[#1A1A1A]">
                  Community
                </Text>

                <Text className="mt-0.5 font-body text-sm text-[#5F5F5F]">
                  Connect with your groups
                </Text>
              </View>

              <TouchableOpacity
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel="Create community post"
                onPress={handleCreatePost}
                className="ml-3 h-11 w-11 items-center justify-center rounded-full border border-[#EEE1D8] bg-white">
                <Plus size={24} color="#F76B1C" weight="bold" />
              </TouchableOpacity>
            </View>

            {/* Joined groups */}
            <View className="mt-5">
              {joinedGroups === undefined ? (
                <View className="h-[104px] items-center justify-center">
                  <ActivityIndicator size="small" color="#F76B1C" />

                  <Text className="mt-2 font-body text-xs text-[#77716D]">
                    Loading your groups…
                  </Text>
                </View>
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={styles.groupsContent}>
                  {joinedGroups.map((group) => {
                    const groupName = group.name.trim() || 'Group';

                    const groupInitial = groupName.charAt(0).toUpperCase();

                    /*
                     * This fallback keeps the UI
                     * safe while Convex generated
                     * types are being refreshed.
                     */
                    const unreadCount =
                      'unreadCount' in group && typeof group.unreadCount === 'number'
                        ? group.unreadCount
                        : 0;

                    return (
                      <TouchableOpacity
                        key={String(group._id)}
                        activeOpacity={0.75}
                        onPress={() => openGroup(String(group._id))}
                        accessibilityRole="button"
                        accessibilityLabel={`Open ${groupName}`}
                        style={styles.groupItem}>
                        <View style={styles.groupAvatarContainer}>
                          <View style={styles.groupAvatarOuter}>
                            <View style={styles.groupAvatarInner}>
                              {group.imageUrl ? (
                                <Image
                                  source={{
                                    uri: group.imageUrl,
                                  }}
                                  contentFit="cover"
                                  transition={150}
                                  style={styles.groupImage}
                                />
                              ) : (
                                <>
                                  <UsersThree size={29} color="#725C50" weight="regular" />

                                  <View style={styles.groupInitialBadge}>
                                    <Text className="font-heading text-[9px] font-bold text-white">
                                      {groupInitial}
                                    </Text>
                                  </View>
                                </>
                              )}
                            </View>
                          </View>

                          {unreadCount > 0 ? (
                            <View style={styles.unreadBadge}>
                              <Text
                                className="font-body font-bold text-white"
                                style={styles.unreadBadgeText}>
                                {unreadCount > 99 ? '99+' : String(unreadCount)}
                              </Text>
                            </View>
                          ) : null}
                        </View>

                        <Text
                          className="mt-2 text-center font-body text-xs font-semibold text-[#292929]"
                          numberOfLines={2}>
                          {groupName}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}

                  {/* Explore groups */}
                  <TouchableOpacity
                    activeOpacity={0.75}
                    onPress={openGroupsScreen}
                    accessibilityRole="button"
                    accessibilityLabel="Explore groups"
                    style={styles.groupItem}>
                    <View style={styles.groupAvatarContainer}>
                      <View style={styles.groupAvatarOuter}>
                        <View style={styles.groupAvatarInner}>
                          <Compass size={31} color="#725C50" weight="regular" />

                          <View style={styles.explorePlus}>
                            <Plus size={10} color="#FFFFFF" weight="bold" />
                          </View>
                        </View>
                      </View>
                    </View>

                    <Text
                      className="mt-2 text-center font-body text-xs font-semibold text-[#292929]"
                      numberOfLines={2}>
                      Explore Groups
                    </Text>
                  </TouchableOpacity>
                </ScrollView>
              )}
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
  groupsContent: {
    paddingHorizontal: 12,
    paddingBottom: 2,
  },

  groupItem: {
    width: 88,
    alignItems: 'center',
    marginHorizontal: 3,
  },

  groupAvatarContainer: {
    position: 'relative',
  },

  groupAvatarOuter: {
    width: 70,
    height: 70,
    borderRadius: 35,

    alignItems: 'center',
    justifyContent: 'center',

    borderWidth: 2,
    borderColor: '#B04483',

    backgroundColor: '#FFFFFF',
  },

  groupAvatarInner: {
    width: 62,
    height: 62,
    borderRadius: 31,

    alignItems: 'center',
    justifyContent: 'center',

    overflow: 'hidden',

    borderWidth: 1,
    borderColor: '#E4BE9D',

    backgroundColor: '#F8F1E8',
  },

  groupImage: {
    width: '100%',
    height: '100%',
  },

  groupInitialBadge: {
    position: 'absolute',

    right: 2,
    bottom: 2,

    width: 19,
    height: 19,
    borderRadius: 10,

    alignItems: 'center',
    justifyContent: 'center',

    borderWidth: 2,
    borderColor: '#FFFFFF',

    backgroundColor: '#F76B1C',
  },

  unreadBadge: {
    position: 'absolute',

    top: 5,
    right: -5,

    minWidth: 22,
    height: 22,

    paddingHorizontal: 6,

    alignItems: 'center',
    justifyContent: 'center',

    borderRadius: 11,

    borderWidth: 2,
    borderColor: '#FFFFFF',

    backgroundColor: '#E5484D',

    shadowColor: '#7F1D1D',

    shadowOffset: {
      width: 0,
      height: 2,
    },

    shadowOpacity: 0.2,
    shadowRadius: 3,

    elevation: 4,
  },

  unreadBadgeText: {
    fontSize: 11,
    lineHeight: 12,
  },

  explorePlus: {
    position: 'absolute',

    right: 5,
    top: 4,

    width: 18,
    height: 18,
    borderRadius: 9,

    alignItems: 'center',
    justifyContent: 'center',

    borderWidth: 2,
    borderColor: '#FFFFFF',

    backgroundColor: '#F76B1C',
  },
});

export default TabShare;
