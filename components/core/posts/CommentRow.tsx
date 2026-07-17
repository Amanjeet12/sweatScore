import { Ionicons } from '@expo/vector-icons';
import { useMutation } from 'convex/react';
import { useState } from 'react';
import { Alert, TouchableOpacity, View } from 'react-native';
import { Menu, MenuOptions, MenuOption, MenuTrigger } from 'react-native-popup-menu';

import { Avatar } from '~/components/core/Avatar';
import { Text } from '~/components/ui/text';
import { api } from '~/convex/_generated/api';
import { Id } from '~/convex/_generated/dataModel';
import { CatchPromise } from '~/utils/catch-promise';
import { formatDistanceToNow } from '~/utils/formatter';

type CommentWithUser = {
  _id: Id<'postComments'>;
  userId: Id<'users'>;
  createdAt: number;
  body: string;
  user: {
    name: string;
    image: Id<'_storage'> | undefined;
    imageUrl: string | undefined;
    isAuthor: boolean;
    isAdmin: boolean;
  };
};

interface CommentRowProps {
  comment: CommentWithUser;
  onEdit?: (commentId: Id<'postComments'>, body: string) => void;
}

export default function CommentRow({ comment, onEdit }: CommentRowProps) {
  const [isLoading, setIsLoading] = useState(false);

  const deleteComment = useMutation(api.posts.deleteComment);
  const reportComment = useMutation(api.posts.reportComment);

  const handleDeleteComment = () => {
    Alert.alert('Delete Comment', 'Are you sure you want to delete this comment?', [
      {
        text: 'Cancel',
        style: 'cancel',
      },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setIsLoading(true);
          const [err] = await CatchPromise(deleteComment({ commentId: comment._id }));
          setIsLoading(false);
        },
      },
    ]);
  };

  const handleEditComment = () => {
    if (onEdit) {
      onEdit(comment._id, comment.body);
    }
  };

  const handleReportComment = () => {
    Alert.alert(
      'Report Comment',
      "Are you sure you want to report this comment? You won't see it again.",
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Report',
          style: 'destructive',
          onPress: async () => {
            setIsLoading(true);
            await CatchPromise(reportComment({ commentId: comment._id }));
            setIsLoading(false);
          },
        },
      ]
    );
  };

  return (
    <View className="mb-4 border-b border-background-100 px-4 pb-4">
      <View className="flex-row items-start gap-x-3">
        <Avatar uri={comment.user.imageUrl} size={36} showGoldBorder name={comment.user.name} />
        <View className="flex-1">
          <View className="flex-row items-start justify-between">
            <View className="flex-1">
              <View className="flex-row items-center gap-x-1">
                <Text className="font-bold text-black">{comment.user.name}</Text>
              </View>
              <Text className="text-sm text-hint">{formatDistanceToNow(comment.createdAt)}</Text>
            </View>
            <Menu>
              <MenuTrigger>
                <Ionicons size={16} name="ellipsis-vertical" color="black" />
              </MenuTrigger>
              <MenuOptions
                customStyles={{
                  optionsContainer: {
                    borderRadius: 12,
                    padding: 8,
                    marginTop: -100,
                  },
                }}>
                {comment.user.isAuthor ? (
                  <>
                    <MenuOption onSelect={handleEditComment} disabled={isLoading}>
                      <View className="flex-row items-center gap-x-3 px-2 py-2">
                        <Ionicons name="pencil-outline" size={18} color="black" />
                        <Text className="text-base text-black">Edit</Text>
                      </View>
                    </MenuOption>
                    <MenuOption onSelect={handleDeleteComment} disabled={isLoading}>
                      <View className="flex-row items-center gap-x-3 px-2 py-2">
                        <Ionicons name="trash-outline" size={18} color="red" />
                        <Text className="text-base text-red-500">Delete</Text>
                      </View>
                    </MenuOption>
                  </>
                ) : (
                  <MenuOption onSelect={handleReportComment} disabled={isLoading}>
                    <View className="flex-row items-center gap-x-3 px-2 py-2">
                      <Ionicons name="flag-outline" size={18} color="black" />
                      <Text className="text-base text-black">Report</Text>
                    </View>
                  </MenuOption>
                )}
              </MenuOptions>
            </Menu>
          </View>
          <Text className="mt-2 text-base text-black">{comment.body}</Text>
        </View>
      </View>
    </View>
  );
}
