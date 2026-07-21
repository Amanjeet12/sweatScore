import { useQuery } from 'convex/react';
import {
  Stack,
  useFocusEffect,
  useLocalSearchParams,
} from 'expo-router';
import { useCallback } from 'react';
import { ScrollView, View } from 'react-native';
import { MenuProvider } from 'react-native-popup-menu';

import { BackButton } from '~/components/core/BackButton';
import ScreenLoading from '~/components/core/ScreenLoading';
import PostRow, {
  stopCurrentVideo,
} from '~/components/core/posts/Row';
import { Text } from '~/components/ui/text';
import { api } from '~/convex/_generated/api';
import { Id } from '~/convex/_generated/dataModel';

export default function SinglePost() {
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

  const isLoading =
    Boolean(postId) && post === undefined;

  return (
    <MenuProvider>
      <View className="flex-1 bg-[#F9F9F9]">
        <Stack.Screen
          options={{
            title: '',
            headerTitleAlign: 'center',
            headerStyle: {
              backgroundColor: '#F9F9F9',
            },
            headerShadowVisible: false,
            headerBackVisible: false,
            headerLeft: () => (
              <BackButton
                fallbackHref="/(tabs)/share"
                text="Back"
              />
            ),
          }}
        />

        <View className="flex-1 bg-[#F9F9F9]">
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
                paddingBottom: 24,
              }}>
              <PostRow
                post={post}
                menuMarginTop={0}
              />
            </ScrollView>
          ) : (
            <View className="flex-1 items-center justify-center px-8">
              <Text className="text-center text-xl text-hint">
                Post not found
              </Text>

              <Text className="mt-2 text-center text-base text-hint">
                This post may have been deleted or you
                don&apos;t have access to it.
              </Text>
            </View>
          )}
        </View>
      </View>
    </MenuProvider>
  );
}