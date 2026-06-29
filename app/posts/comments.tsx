import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery } from 'convex/react';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  SafeAreaView,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { KeyboardAccessoryView } from 'react-native-keyboard-accessory';
import { MenuProvider } from 'react-native-popup-menu';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '~/components/core/Avatar';
import { BackButton } from '~/components/core/BackButton';
import CommentRow from '~/components/core/posts/CommentRow';
import { useRevenueCat } from '~/components/providers/RevenueCatProvider';
import { Text } from '~/components/ui/text';
import { api } from '~/convex/_generated/api';
import { Id } from '~/convex/_generated/dataModel';
import { useAuthStore } from '~/store/useAuthStore';
import { CatchPromise } from '~/utils/catch-promise';

export default function PostComments() {
  const { postId } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const currentUser = useAuthStore((state) => state.currentUser);
  const { isPro } = useRevenueCat();

  const [commentText, setCommentText] = useState('');
  const [inputHeight, setInputHeight] = useState(40);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<Id<'postComments'> | null>(null);

  const inputRef = useRef<TextInput>(null);

  const comments = useQuery(api.posts.getComments, {
    postId: postId as Id<'posts'>,
  });

  const createComment = useMutation(api.posts.createComment);
  const updateComment = useMutation(api.posts.updateComment);

  const isLoading = comments === undefined;

  const handleSendComment = async () => {
    if (!commentText.trim() || isSubmitting) return;

    if (!isPro) {
      router.push('/(tabs)/share/paywall');
      return;
    }

    setIsSubmitting(true);

    if (editingCommentId) {
      // Update existing comment
      const [err] = await CatchPromise(
        updateComment({
          commentId: editingCommentId,
          body: commentText.trim(),
        })
      );

      if (!err) {
        setCommentText('');
        setInputHeight(40);
        setEditingCommentId(null);
      }
    } else {
      // Create new comment
      const [err] = await CatchPromise(
        createComment({
          postId: postId as Id<'posts'>,
          body: commentText.trim(),
        })
      );

      if (!err) {
        setCommentText('');
        setInputHeight(40);
      }
    }

    setIsSubmitting(false);
  };

  const handleEditComment = (commentId: Id<'postComments'>, body: string) => {
    setEditingCommentId(commentId);
    setCommentText(body);
    setInputHeight(40); // Reset height, will auto-adjust

    // Focus the input after a short delay to ensure state is updated
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  };

  return (
    <MenuProvider>
      <SafeAreaView className="flex-1 bg-white">
        <Stack.Screen
          options={{
            title: 'Comments',
            headerTitleAlign: 'center',
            headerStyle: {
              backgroundColor: '#FFFFFF',
            },
            headerShadowVisible: false,
            headerBackVisible: false,
            headerLeft: () => <BackButton fallbackHref="/(tabs)/share" text="Back" />,
          }}
        />
        <View
          className="flex-1 flex-col"
          style={Platform.OS === 'android' ? { paddingTop: insets.top } : undefined}>
          {isLoading ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator size="large" />
              <Text className="mt-4 text-base text-hint">Loading comments...</Text>
            </View>
          ) : comments.length === 0 ? (
            <View className="flex-1 items-center justify-center px-8">
              <Text className="text-center text-xl text-hint">No comments yet</Text>
              <Text className="mt-2 text-center text-base text-hint">
                Be the first to share your thoughts!
              </Text>
            </View>
          ) : (
            <FlatList
              data={comments}
              keyExtractor={(item) => item._id}
              contentContainerStyle={{ paddingBottom: 100 }}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              renderItem={({ item }) => <CommentRow comment={item} onEdit={handleEditComment} />}
            />
          )}
        </View>

        {/* Comment Input */}
        <KeyboardAccessoryView
          avoidKeyboard
          alwaysVisible
          bumperHeight={20}
          hideBorder
          androidAdjustResize={false}
          style={{ backgroundColor: 'white' }}>
          <View className="border-t border-background-100 bg-white px-4 py-3">
            <View className="flex-row items-center gap-x-3">
              <Avatar uri={currentUser?.image ?? undefined} size={40} showGoldBorder />
              <View className="flex-1 flex-row items-center rounded-full bg-background-50 px-4 py-2">
                <TextInput
                  ref={inputRef}
                  value={commentText}
                  onChangeText={setCommentText}
                  placeholder={editingCommentId ? 'Edit comment...' : 'Write a comment...'}
                  placeholderTextColor="#9CA3AF"
                  multiline
                  style={{
                    flex: 1,
                    fontSize: 16,
                    maxHeight: 100,
                    minHeight: 36,
                    height: Math.max(36, inputHeight - 8),
                    paddingTop: Platform.OS === 'ios' ? 8 : 6,
                    paddingBottom: Platform.OS === 'ios' ? 8 : 6,
                  }}
                  onContentSizeChange={(event) => {
                    setInputHeight(
                      Math.max(40, Math.min(100, event.nativeEvent.contentSize.height))
                    );
                  }}
                />
              </View>
              <TouchableOpacity
                onPress={handleSendComment}
                disabled={!commentText.trim() || isSubmitting}
                className="h-10 w-10 items-center justify-center rounded-full bg-primary-500 disabled:opacity-50">
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Ionicons name="send" size={18} color="white" />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAccessoryView>
      </SafeAreaView>
    </MenuProvider>
  );
}
