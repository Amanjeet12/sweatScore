import { useQuery } from 'convex/react';
import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import { Platform, ScrollView, View } from 'react-native';
import { MenuProvider } from 'react-native-popup-menu';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackButton } from '~/components/core/BackButton';
import SafeAreaView from '~/components/core/SafeAreaView';
import ScreenLoading from '~/components/core/ScreenLoading';
import PostRow, { stopCurrentVideo } from '~/components/core/posts/Row';
import { Text } from '~/components/ui/text';
import { api } from '~/convex/_generated/api';
import { Id } from '~/convex/_generated/dataModel';

export default function SinglePost() {
  const { postId } = useLocalSearchParams();
  const insets = useSafeAreaInsets();

  // Stop any playing video when leaving this screen
  useFocusEffect(
    useCallback(() => {
      return () => {
        stopCurrentVideo?.();
      };
    }, [])
  );
  // const hasNavigated = useRef(false);

  const post = useQuery(api.posts.getSinglePost, {
    postId: postId as Id<'posts'>,
  });

  const isLoading = post === undefined;

  // useEffect(() => {
  //   if (post && !hasNavigated.current) {
  //     hasNavigated.current = true;
  //     router.push({
  //       pathname: '/posts/comments',
  //       params: { postId: post._id },
  //     });
  //   }
  // }, [post]);

  return (
    <MenuProvider>
      <SafeAreaView className="flex-1 bg-[#F9F9F9]">
        <Stack.Screen
          options={{
            title: '',
            headerTitleAlign: 'center',
            headerStyle: {
              backgroundColor: '#F9F9F9',
            },
            headerShadowVisible: false,
            headerBackVisible: false,
            headerLeft: () => <BackButton fallbackHref="/(tabs)/share" text="Back" />,
          }}
        />
        <View
          className="flex-1 flex-col bg-[#F9F9F9]"
          style={Platform.OS === 'android' ? { paddingTop: insets.top } : undefined}>
          {isLoading ? (
            <ScreenLoading className="bg-transparent" />
          ) : post ? (
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }}>
              <PostRow post={post} menuMarginTop={-60} />
            </ScrollView>
          ) : (
            <View className="flex-1 items-center justify-center px-8">
              <Text className="text-center text-xl text-hint">Post not found</Text>
              <Text className="mt-2 text-center text-base text-hint">
                This post may have been deleted or you don't have access to it.
              </Text>
            </View>
          )}
        </View>
      </SafeAreaView>
    </MenuProvider>
  );
}
