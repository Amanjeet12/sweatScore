import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery } from 'convex/react';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { KeyboardAccessoryView } from 'react-native-keyboard-accessory';
import { MenuProvider } from 'react-native-popup-menu';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '~/components/core/Avatar';
import { BackButton } from '~/components/core/BackButton';
import { communityTypography as type } from '~/components/core/design/CommunityStyles';
import CommentRow from '~/components/core/posts/CommentRow';
import { Text } from '~/components/ui/text';
import { api } from '~/convex/_generated/api';
import { Id } from '~/convex/_generated/dataModel';
import { useSubscriptionGuard } from '~/hooks/useSubscriptionGuard';
import { useAuthStore } from '~/store/useAuthStore';
import { CatchPromise } from '~/utils/catch-promise';

export default function PostComments() {
  const { postId } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const currentUser = useAuthStore((state) => state.currentUser);
  const { requireSubscription } = useSubscriptionGuard();

  const [commentText, setCommentText] = useState('');
  const { fontScale } = useWindowDimensions();
  const maxInputHeight = Math.max(100, Math.min(240, 100 * fontScale));
  const [inputHeight, setInputHeight] = useState(44);
  const [composerHeight, setComposerHeight] = useState(100);
  const [placeholderHeight, setPlaceholderHeight] = useState(24);
  const minInputHeight = Math.max(44, commentText ? 24 * fontScale + 16 : placeholderHeight + 16);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<Id<'postComments'> | null>(null);
  const placeholder = editingCommentId ? 'Edit comment...' : 'Write a comment...';

  const inputRef = useRef<TextInput>(null);

  const comments = useQuery(api.posts.getComments, {
    postId: postId as Id<'posts'>,
  });

  const createComment = useMutation(api.posts.createComment);
  const updateComment = useMutation(api.posts.updateComment);

  const isLoading = comments === undefined;

  const handleSendComment = async () => {
    if (!commentText.trim() || isSubmitting) return;

    if (
      !requireSubscription({
        redirectTo: `/posts/comments?postId=${String(postId)}`,
        source: editingCommentId ? 'community_edit_comment' : 'community_create_comment',
      })
    )
      return;

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
        setInputHeight(44);
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
        setInputHeight(44);
      }
    }

    setIsSubmitting(false);
  };

  const handleEditComment = (commentId: Id<'postComments'>, body: string) => {
    if (
      !requireSubscription({
        redirectTo: `/posts/comments?postId=${String(postId)}`,
        source: 'community_edit_comment',
      })
    )
      return;
    setEditingCommentId(commentId);
    setCommentText(body);
    setInputHeight(44); // Reset height, will auto-adjust

    // Focus the input after a short delay to ensure state is updated
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  };

  return (
    <MenuProvider>
      <SafeAreaView edges={['left', 'right', 'bottom']} className="flex-1 bg-white">
        <Stack.Screen
          options={{
            title: 'Comments',
            headerTitle: () => <Text style={type.heading}>Comments</Text>,
            headerTitleAlign: 'center',
            headerStyle: {
              backgroundColor: '#FFFFFF',
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
        <View className="flex-1 flex-col">
          {isLoading ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator size="large" />
              <Text className="mt-4" style={type.metadata}>
                Loading comments...
              </Text>
            </View>
          ) : comments.length === 0 ? (
            <View className="flex-1 items-center justify-center px-8">
              <Text style={[type.heading, { color: '#6f6f6f' }]}>No comments yet</Text>
              <Text className="mt-2" style={[type.body, { color: '#6f6f6f', textAlign: 'center' }]}>
                Be the first to share your thoughts!
              </Text>
            </View>
          ) : (
            <FlatList
              data={comments}
              keyExtractor={(item) => item._id}
              contentContainerStyle={{ paddingBottom: composerHeight + insets.bottom + 24 }}
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
          style={{ backgroundColor: 'white', paddingBottom: insets.bottom }}>
          <View
            onLayout={(event) => setComposerHeight(event.nativeEvent.layout.height)}
            className="border-t border-background-100 bg-white px-[22px] py-3">
            <View className="flex-row items-center gap-x-3">
              <Avatar uri={currentUser?.image ?? undefined} size={40} name={currentUser?.name} />
              <View className="flex-1 flex-row items-center rounded-[22px] bg-[#f6f6f6] px-4 py-2">
                <TextInput
                  ref={inputRef}
                  value={commentText}
                  onChangeText={setCommentText}
                  placeholder=""
                  placeholderTextColor="#8a8a8a"
                  accessibilityLabel={editingCommentId ? 'Edit comment' : 'Write a comment'}
                  multiline
                  style={{
                    flex: 1,
                    ...type.field,
                    maxHeight: maxInputHeight,
                    minHeight: minInputHeight,
                    height: Math.max(minInputHeight, Math.min(maxInputHeight, inputHeight)),
                    paddingTop: Platform.OS === 'ios' ? 8 : 6,
                    paddingBottom: Platform.OS === 'ios' ? 8 : 6,
                  }}
                  onContentSizeChange={(event) => {
                    setInputHeight(
                      Math.max(44, Math.min(maxInputHeight, event.nativeEvent.contentSize.height))
                    );
                  }}
                />
                {!commentText ? (
                  <View
                    pointerEvents="none"
                    style={{ position: 'absolute', left: 16, right: 16, top: 16 }}>
                    <Text
                      accessible={false}
                      onLayout={(event) => setPlaceholderHeight(event.nativeEvent.layout.height)}
                      style={[type.field, { color: '#8a8a8a' }]}>
                      {placeholder}
                    </Text>
                  </View>
                ) : null}
              </View>
              <TouchableOpacity
                onPress={handleSendComment}
                disabled={!commentText.trim() || isSubmitting}
                accessibilityRole="button"
                accessibilityLabel={editingCommentId ? 'Save comment' : 'Send comment'}
                className="h-11 w-11 items-center justify-center rounded-full bg-[#2a2a2a] disabled:opacity-50">
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
