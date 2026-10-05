import { useQuery } from 'convex/react';
import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import { ScrollView, View } from 'react-native';
import { MenuProvider } from 'react-native-popup-menu';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackButton } from '~/components/core/BackButton';
import ScreenLoading from '~/components/core/ScreenLoading';
import { communityTypography as type } from '~/components/core/design/CommunityStyles';
import PostRow, { stopCurrentVideo } from '~/components/core/posts/Row';
import { Text } from '~/components/ui/text';
import { api } from '~/convex/_generated/api';
import { Id } from '~/convex/_generated/dataModel';

export default function SinglePost() {
  const insets = useSafeAreaInsets();
  const { postId } = useLocalSearchParams<{
    postId?: string;
  }>();

  useFocusEffect(
    useCallback(() => {
      return () => {
        stopCurrentVideo?.();
      };
    }, [])
  );

  const post = useQuery(
    api.posts.getSinglePost,
    postId
      ? {
          postId: postId as Id<'posts'>,
        }
      : 'skip'
  );

  const isLoading = Boolean(postId) && post === undefined;

  return (
    <MenuProvider>
      <View className="flex-1 bg-[#fff]">
        <Stack.Screen
          options={{
            title: '',
            headerTitle: () => <Text style={type.heading}>Post</Text>,
            headerTitleAlign: 'center',
            headerStyle: {
              backgroundColor: '#fff',
            },
            headerShadowVisible: false,
            headerBackVisible: false,
            headerLeft: () => (
              <BackButton
                iconColor="#2a2a2a"
                iconSize={22}
                accessibilityLabel="Go back"
                fallbackHref="/(tabs)/share"
                text=""
              />
            ),
          }}
        />

        <View className="flex-1 bg-[#fff]">
          {isLoading ? (
            <ScreenLoading className="bg-transparent" />
          ) : post ? (
            <ScrollView
              className="flex-1"
              showsVerticalScrollIndicator={false}
              contentInsetAdjustmentBehavior="never"
              automaticallyAdjustContentInsets={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{
                paddingBottom: Math.max(insets.bottom, 24),
              }}>
              <PostRow post={post} menuMarginTop={0} />
            </ScrollView>
          ) : (
            <View className="flex-1 items-center justify-center px-8">
              <Text style={[type.heading, { color: '#6f6f6f' }]}>Post not found</Text>

              <Text className="mt-2" style={[type.body, { color: '#6f6f6f', textAlign: 'center' }]}>
                This post may have been deleted or you don&apos;t have access to it.
              </Text>
            </View>
          )}
        </View>
      </View>
    </MenuProvider>
  );
}
