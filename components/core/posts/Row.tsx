import { Ionicons } from '@expo/vector-icons';
import { useMutation } from 'convex/react';
import * as FileSystem from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import { Image as ExpoImage } from 'expo-image';
import * as MediaLibrary from 'expo-media-library';
import { router } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import * as Icon from 'phosphor-react-native';
import { useState, useRef, useEffect } from 'react';
import {
  TouchableOpacity,
  View,
  Pressable,
  Modal,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { Menu, MenuOptions, MenuOption, MenuTrigger } from 'react-native-popup-menu';
import Share from 'react-native-share';
import { CaretRight } from 'phosphor-react-native';
import { Avatar } from '~/components/core/Avatar';
import {
  AlertDialog,
  AlertDialogBackdrop,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
} from '~/components/ui/alert-dialog';
import { Button, ButtonText, LoadingButton } from '~/components/ui/button';
import { Text } from '~/components/ui/text';
import { api } from '~/convex/_generated/api';
import { Id } from '~/convex/_generated/dataModel';
import { useAuthStore } from '~/store/useAuthStore';
import { CatchPromise } from '~/utils/catch-promise';
import { cn } from '~/utils/cn';
import { colors } from '~/utils/constants';
import { formatDistanceToNow, intToString } from '~/utils/formatter';
import { buildCaption } from '~/utils/share';

type PostWithUser = {
  _id: Id<'posts'>;
  userId: Id<'users'>;
  createdAt: number;
  body: string;
  media: Id<'_storage'> | undefined | null;
  mediaWidth: number | undefined | null;
  mediaHeight: number | undefined | null;
  likeCount: number;
  fireLikesCount: number;
  clapLikesCount: number;
  heartLikesCount: number;
  isLiked: boolean;
  isPinned: boolean;
  commentCount: number;
  user: {
    name: string;
    image: Id<'_storage'> | undefined;
    imageUrl: string | undefined;
    isAuthor: boolean;
    isAdmin: boolean;
    hasHit500: boolean;
  };
  mediaUrl: string | undefined;
  mediaType?: string;
  mediaThumbnailUrl?: string;
  challengeId?: string;
  challenge?: {
    name: string;
    points: number;
    instructionalVideoUrl?: string;
    compositeVideoUrl?: string;
    thumbnailUrl?: string;
    allowRepost?: boolean;
  };
};

const reportReasons = [
  'Spam or misleading',
  'Inappropriate content',
  'Harassment or bullying',
  'False information',
  'Other',
];

const blockReasons = [
  "I don't want to see their posts",
  'Harassment or bullying',
  'Spam',
  'Inappropriate behavior',
  'Other',
];

// Module-level: ensures only one video plays at a time across all posts
export let stopCurrentVideo: (() => void) | null = null;
export function setStopCurrentVideo(fn: (() => void) | null) {
  stopCurrentVideo = fn;
}

// Mounts only when active — single player instance at a time
function ActiveVideoPlayer({ videoUrl, aspectRatio }: { videoUrl: string; aspectRatio: number }) {
  const [isBuffering, setIsBuffering] = useState(true);

  const player = useVideoPlayer(videoUrl, (videoPlayer) => {
    videoPlayer.loop = false;
    videoPlayer.play();
  });

  useEffect(() => {
    const statusSubscription = player.addListener('statusChange', ({ status }) => {
      setIsBuffering(status !== 'readyToPlay');
    });

    const endSubscription = player.addListener('playToEnd', () => {
      player.currentTime = 0;
      player.pause();
    });

    return () => {
      statusSubscription.remove();
      endSubscription.remove();
    };
  }, [player]);

  return (
    <View
      style={{
        width: '100%',
        aspectRatio,
        backgroundColor: '#000',
        overflow: 'hidden',
      }}>
      <VideoView
        player={player}
        style={{
          width: '100%',
          height: '100%',
        }}
        contentFit="contain"
        nativeControls
      />

      {isBuffering && (
        <View
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0,0,0,0.2)',
          }}>
          <ActivityIndicator size="large" color="#FFFFFF" />
        </View>
      )}
    </View>
  );
}

function ChallengeVideoPlayer({
  videoUrl,
  thumbnailUrl,
  aspectRatio = 9 / 16,
}: {
  videoUrl: string;
  thumbnailUrl?: string;
  aspectRatio?: number;
}) {
  const [isActive, setIsActive] = useState(false);

  const fallbackRatio = Number.isFinite(aspectRatio) && aspectRatio > 0 ? aspectRatio : 9 / 16;

  const [resolvedAspectRatio, setResolvedAspectRatio] = useState(fallbackRatio);

  /*
   * Use the thumbnail's exact visible ratio.
   *
   * Do not clamp it to 9:16 because many
   * phones record taller videos such as
   * 9:19.5 or 9:20.
   */
  useEffect(() => {
    if (!thumbnailUrl) {
      setResolvedAspectRatio(fallbackRatio);

      return;
    }

    Image.getSize(
      thumbnailUrl,

      (width, height) => {
        if (width > 0 && height > 0) {
          setResolvedAspectRatio(width / height);
        }
      },

      () => {
        setResolvedAspectRatio(fallbackRatio);
      }
    );
  }, [thumbnailUrl, fallbackRatio]);

  const handlePlay = () => {
    stopCurrentVideo?.();

    const stopThisVideo = () => {
      setIsActive(false);
    };

    setStopCurrentVideo(stopThisVideo);

    setIsActive(true);
  };

  return (
    <View
      style={{
        width: '100%',
        backgroundColor: '#000',
        overflow: 'hidden',
      }}>
      {isActive ? (
        <ActiveVideoPlayer videoUrl={videoUrl} aspectRatio={resolvedAspectRatio} />
      ) : (
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={handlePlay}
          style={{
            width: '100%',

            /*
             * Exact ratio from the generated
             * thumbnail.
             */
            aspectRatio: resolvedAspectRatio,

            backgroundColor: '#000',
            overflow: 'hidden',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          {thumbnailUrl && (
            <ExpoImage
              source={{
                uri: thumbnailUrl,
              }}
              style={{
                position: 'absolute',
                width: '100%',
                height: '100%',
              }}
              contentFit="contain"
              contentPosition="center"
            />
          )}

          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              backgroundColor: 'rgba(26,26,26,0.6)',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Icon.Play size={24} color="#FFFFFF" weight="fill" />
          </View>
        </TouchableOpacity>
      )}
    </View>
  );
}

export default function PostRow({
  post,
  menuMarginTop = 25,
}: {
  post: PostWithUser;
  menuMarginTop?: number;
}) {
  const currentUser = useAuthStore((state) => state.currentUser);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [pickerPosition, setPickerPosition] = useState({ x: 0, y: 0 });
  const [imageLoading, setImageLoading] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [sharing, setSharing] = useState(false);
  const mediaBusy = isLoading || downloading || sharing;
  const [mediaPermission, requestMediaPermission] = MediaLibrary.usePermissions({
    writeOnly: true,
  });
  const [showReportModal, setShowReportModal] = useState(false);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [reportReason, setReportReason] = useState<string | null>(null);
  const [blockReason, setBlockReason] = useState<string | null>(null);

  // Optimistic update state
  const [optimisticLikeCount, setOptimisticLikeCount] = useState(post.likeCount);
  const [optimisticIsLiked, setOptimisticIsLiked] = useState(post.isLiked);
  const [optimisticHeartCount, setOptimisticHeartCount] = useState(post.heartLikesCount);
  const [optimisticFireCount, setOptimisticFireCount] = useState(post.fireLikesCount);
  const [optimisticClapCount, setOptimisticClapCount] = useState(post.clapLikesCount);

  const likesButtonRef = useRef<View>(null);

  const likePost = useMutation(api.posts.likePost);
  const unlikePost = useMutation(api.posts.unlikePost);
  const deletePost = useMutation(api.posts.deletePost);
  const pinPost = useMutation(api.posts.pinPost);
  const reportPost = useMutation(api.posts.reportPost);
  const blockUser = useMutation(api.posts.blockUser);

  // Sync optimistic state with server state when post data updates
  useEffect(() => {
    setOptimisticLikeCount(post.likeCount);
    setOptimisticIsLiked(post.isLiked);
    setOptimisticHeartCount(post.heartLikesCount);
    setOptimisticFireCount(post.fireLikesCount);
    setOptimisticClapCount(post.clapLikesCount);
  }, [
    post.likeCount,
    post.isLiked,
    post.heartLikesCount,
    post.fireLikesCount,
    post.clapLikesCount,
  ]);

  const handleReactionSelect = async (reaction: 'heart' | 'fire' | 'clap') => {
    setIsLoading(true);
    setShowReactionPicker(false);

    // Optimistic update
    setOptimisticLikeCount((prev) => prev + 1);
    setOptimisticIsLiked(true);

    // Update individual reaction counts
    if (reaction === 'heart') {
      setOptimisticHeartCount((prev) => prev + 1);
    } else if (reaction === 'fire') {
      setOptimisticFireCount((prev) => prev + 1);
    } else if (reaction === 'clap') {
      setOptimisticClapCount((prev) => prev + 1);
    }

    const [err] = await CatchPromise(likePost({ postId: post._id, likeIcon: reaction }));

    // Revert on error
    if (err) {
      setOptimisticLikeCount((prev) => prev - 1);
      setOptimisticIsLiked(false);

      // Revert individual reaction counts
      if (reaction === 'heart') {
        setOptimisticHeartCount((prev) => prev - 1);
      } else if (reaction === 'fire') {
        setOptimisticFireCount((prev) => prev - 1);
      } else if (reaction === 'clap') {
        setOptimisticClapCount((prev) => prev - 1);
      }
    }

    setIsLoading(false);
  };

  const handleLongPress = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (optimisticIsLiked) {
      setIsLoading(true);

      // Optimistic update
      setOptimisticLikeCount((prev) => prev - 1);
      setOptimisticIsLiked(false);

      const [err] = await CatchPromise(unlikePost({ postId: post._id }));

      // Revert on error
      if (err) {
        setOptimisticLikeCount((prev) => prev + 1);
        setOptimisticIsLiked(true);
      }

      setIsLoading(false);
    } else {
      likesButtonRef.current?.measure((x, y, width, height, pageX, pageY) => {
        setPickerPosition({ x: pageX, y: pageY - 60 }); // 60px above the button
        setShowReactionPicker(true);
      });
    }
  };

  const handleEditPost = () => {
    router.push({
      pathname: '/posts/edit',
      params: { postId: post._id },
    });
  };

  const handleViewComments = () => {
    router.push({
      pathname: '/posts/comments',
      params: { postId: post._id },
    });
  };

  const handleDeletePost = () => {
    const isDuet = !!post.challengeId;
    const title = isDuet ? 'Delete Duet?' : 'Delete Post';
    const message = isDuet
      ? 'Deleting this duet will remove your earned points and may affect your streak. This action cannot be undone.'
      : 'Are you sure you want to delete this post? This action cannot be undone.';
    Alert.alert(title, message, [
      {
        text: 'Cancel',
        style: 'cancel',
      },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setIsLoading(true);
          await CatchPromise(deletePost({ postId: post._id }));
          setIsLoading(false);
        },
      },
    ]);
  };

  const handlePinPost = async () => {
    setIsLoading(true);
    const [err] = await CatchPromise(pinPost({ postId: post._id }));
    if (!err) Alert.alert('Success', 'Post has been pinned successfully!');
    setIsLoading(false);
  };

  const handleReportPost = () => {
    setShowReportModal(true);
  };

  const handleBlockUser = () => {
    setShowBlockModal(true);
  };

  const handleSharePost = async () => {
    if (!post.challenge?.compositeVideoUrl || mediaBusy) return;
    setSharing(true);
    try {
      const localUri = FileSystem.cacheDirectory + 'share_video_' + Date.now() + '.mp4';
      await FileSystem.downloadAsync(post.challenge.compositeVideoUrl, localUri);
      await Share.open({
        url: localUri,
        message: buildCaption(post.body ?? ''),
        type: 'video/mp4',
      });
    } catch {
      // User cancelled or error
    }
    setSharing(false);
  };

  const downloadableVideoUrl =
    post.challenge?.compositeVideoUrl?.trim() ||
    (post.mediaType === 'video' ? post.mediaUrl?.trim() : undefined);

  const handleDownloadVideo = async () => {
    if (!downloadableVideoUrl || mediaBusy) {
      return;
    }

    let permission = mediaPermission;

    if (!permission?.granted) {
      permission = await requestMediaPermission();
    }

    if (!permission?.granted) {
      Alert.alert(
        'Permission required',
        'Please allow access to your photo library to save videos.'
      );
      return;
    }

    setDownloading(true);

    const localUri = FileSystem.cacheDirectory + `download_video_${Date.now()}.mp4`;

    const [err] = await CatchPromise(
      FileSystem.downloadAsync(downloadableVideoUrl, localUri).then(async ({ uri }) => {
        await MediaLibrary.saveToLibraryAsync(uri);
      })
    );

    setDownloading(false);

    if (err) {
      console.error('Video download failed:', err);

      Alert.alert('Download failed', 'Could not save the video. Please try again.');
      return;
    }

    Alert.alert('Saved', 'Video saved to your gallery.');
  };

  const handleReportSubmit = async () => {
    if (!reportReason) return;
    setIsLoading(true);
    const [err] = await CatchPromise(reportPost({ postId: post._id, description: reportReason }));
    if (!err) {
      setShowReportModal(false);
      setReportReason(null);
    }
    setIsLoading(false);
  };

  const handleBlockSubmit = async () => {
    if (!blockReason) return;
    setIsLoading(true);
    const [err] = await CatchPromise(blockUser({ userId: post.userId, description: blockReason }));
    if (!err) {
      setShowBlockModal(false);
      setBlockReason(null);
    }
    setIsLoading(false);
  };

  return (
    <View className="border-b border-b-[#EEEAE5] bg-white px-4 py-4">
      <View className="flex-row items-start gap-x-2">
        <View>
          <Avatar uri={post.user.imageUrl} size={46} showGoldBorder name={post?.user?.name} />
        </View>
        <View className="flex-1 flex-col">
          <View className="flex-row justify-between gap-x-2">
            <View className="flex-1">
              <View className="flex-row items-center gap-x-1">
                <Text className="text-lg" style={{ fontFamily: 'Inter_700Bold' }}>
                  {post.user.name}
                </Text>
                {post.user.hasHit500 && (
                  <ExpoImage
                    source={require('~/assets/icons/500points.png')}
                    style={{ width: 20, height: 20 }}
                    contentFit="contain"
                  />
                )}
              </View>
              <Text className="text-sm">
                <Text className="text-[#1A1A1A]">
                  {post.challenge ? post.challenge.name : 'Shared a post'}
                </Text>
                <Text className="text-[#838383]"> {formatDistanceToNow(post.createdAt)}</Text>
              </Text>
            </View>

            {(post.user.isAuthor || currentUser?.isAdmin || !post.user.isAdmin) && (
              <Menu>
                <MenuTrigger>
                  <Ionicons size={20} name="ellipsis-horizontal" color="black" />
                </MenuTrigger>
                <MenuOptions
                  customStyles={{
                    optionsContainer: {
                      borderRadius: 12,
                      padding: 8,
                      marginTop: menuMarginTop,
                    },
                  }}>
                  {post.user.isAuthor ? (
                    <>
                      <MenuOption onSelect={handleEditPost} disabled={isLoading}>
                        <View className="flex-row items-center gap-x-3 px-2 py-2">
                          <Ionicons name="pencil-outline" size={18} color="black" />
                          <Text className="text-base text-black">Edit</Text>
                        </View>
                      </MenuOption>
                      {currentUser?.isAdmin && (
                        <MenuOption onSelect={handlePinPost} disabled={isLoading}>
                          <View className="flex-row items-center gap-x-3 px-2 py-2">
                            <Ionicons name="pin-outline" size={18} color="black" />
                            <Text className="text-base text-black">Pin</Text>
                          </View>
                        </MenuOption>
                      )}
                      {downloadableVideoUrl &&
                        (post.user.isAuthor ||
                          (currentUser?.isAdmin && post.challenge?.allowRepost)) && (
                          <MenuOption onSelect={handleDownloadVideo} disabled={isLoading}>
                            <View className="flex-row items-center gap-x-3 px-2 py-2">
                              <Ionicons size={20} name="download-outline" color="black" />
                              <Text className="text-base text-black">Download</Text>
                            </View>
                          </MenuOption>
                        )}
                      <MenuOption onSelect={handleDeletePost} disabled={isLoading}>
                        <View className="flex-row items-center gap-x-3 px-2 py-2">
                          <Ionicons name="trash-outline" size={18} color="red" />
                          <Text className="text-base text-red-500">Delete</Text>
                        </View>
                      </MenuOption>
                    </>
                  ) : currentUser?.isAdmin ? (
                    <>
                      <MenuOption onSelect={handleDeletePost} disabled={isLoading}>
                        <View className="flex-row items-center gap-x-3 px-2 py-2">
                          <Ionicons name="trash-outline" size={18} color="red" />
                          <Text className="text-base text-red-500">Delete Post</Text>
                        </View>
                      </MenuOption>
                      <MenuOption onSelect={handleReportPost} disabled={isLoading}>
                        <View className="flex-row items-center gap-x-3 px-2 py-2">
                          <Ionicons name="flag-outline" size={18} color="black" />
                          <Text className="text-base text-black">Report Post</Text>
                        </View>
                      </MenuOption>
                      <MenuOption onSelect={handleDownloadVideo} disabled={isLoading}>
                        <View className="flex-row items-center gap-x-3 px-2 py-2">
                          <Ionicons size={20} name="download-outline" color="black" />
                          <Text className="text-base text-black">Download</Text>
                        </View>
                      </MenuOption>
                      <MenuOption onSelect={handleBlockUser} disabled={isLoading}>
                        <View className="flex-row items-center gap-x-3 px-2 py-2">
                          <Ionicons name="ban-outline" size={18} color="red" />
                          <Text className="text-base text-red-500">Block User</Text>
                        </View>
                      </MenuOption>
                    </>
                  ) : (
                    <>
                      <MenuOption onSelect={handleReportPost} disabled={isLoading}>
                        <View className="flex-row items-center gap-x-3 px-2 py-2">
                          <Ionicons name="flag-outline" size={18} color="black" />
                          <Text className="text-base text-black">Report Post</Text>
                        </View>
                      </MenuOption>
                      <MenuOption onSelect={handleBlockUser} disabled={isLoading}>
                        <View className="flex-row items-center gap-x-3 px-2 py-2">
                          <Ionicons name="ban-outline" size={18} color="red" />
                          <Text className="text-base text-red-500">Block User</Text>
                        </View>
                      </MenuOption>
                    </>
                  )}
                </MenuOptions>
              </Menu>
            )}
          </View>
        </View>
      </View>
      {/* Body text */}
      {post.body ? (
        <View className="mt-2">
          <Text className="text-lg">{post.body}</Text>
        </View>
      ) : null}
      {/* Media — edge to edge */}
      {post.challenge?.compositeVideoUrl ? (
        <View className="-mx-4 mt-2">
          <ChallengeVideoPlayer
            videoUrl={post.challenge.compositeVideoUrl}
            thumbnailUrl={post.challenge.thumbnailUrl}
          />
        </View>
      ) : post.mediaUrl && post.mediaType === 'video' ? (
        <View className="-mx-4 mt-2">
          <ChallengeVideoPlayer
            videoUrl={post.mediaUrl}
            thumbnailUrl={post.mediaThumbnailUrl}
            aspectRatio={(post.mediaWidth ?? 1) / (post.mediaHeight ?? 1)}
          />
        </View>
      ) : (
        post.mediaUrl && (
          <View className="-mx-4 mt-2">
            <View className="relative">
              {imageLoading && (
                <View className="absolute z-10 flex h-full w-full items-center justify-center">
                  <ActivityIndicator size="large" />
                </View>
              )}
              <ExpoImage
                source={{ uri: post.mediaUrl }}
                contentFit="contain"
                onLoadStart={() => setImageLoading(true)}
                onLoad={() => setImageLoading(false)}
                cachePolicy="memory-disk"
                transition={200}
                style={{
                  width: '100%',
                  height: undefined,
                  resizeMode: 'contain',
                  aspectRatio: (post.mediaWidth ?? 1) / (post.mediaHeight ?? 1),
                }}
              />
            </View>
          </View>
        )
      )}
      {/* Actions row */}
      <View className="mt-3 flex-row items-center gap-x-4">
        <Pressable
          disabled={isLoading}
          ref={likesButtonRef}
          onPress={handleLongPress}
          className={cn('flex-shrink-0 flex-row items-center gap-x-1.5 rounded-full px-2.5 py-1', {
            'bg-background-50': !optimisticIsLiked,
            'bg-[#FFE6DA]': optimisticIsLiked,
          })}>
          <Text numberOfLines={1} className="text-sm">
            🔥 💪 😍
          </Text>
          <Text numberOfLines={1} className="text-base text-black">
            {intToString(optimisticLikeCount)}
          </Text>
        </Pressable>

        <TouchableOpacity
          onPress={handleViewComments}
          disabled={isLoading}
          className="flex-shrink-0 flex-row items-center gap-x-2">
          <Ionicons size={16} name="chatbubble-outline" color="black" />
          <Text numberOfLines={1} className="text-base text-black">
            {intToString(post.commentCount)}
          </Text>
        </TouchableOpacity>

        {post.challenge?.compositeVideoUrl &&
          (post.user.isAuthor || (currentUser?.isAdmin && post.challenge?.allowRepost)) && (
            <TouchableOpacity
              className="flex-shrink-0"
              onPress={handleSharePost}
              disabled={mediaBusy}
              style={{ width: 16, height: 16, alignItems: 'center', justifyContent: 'center' }}>
              {sharing ? (
                <ActivityIndicator size="small" color="black" />
              ) : (
                <Ionicons size={16} name="arrow-redo-outline" color="black" />
              )}
            </TouchableOpacity>
          )}

        {post.challengeId ? (
          <TouchableOpacity
            className="ml-auto flex-row items-center gap-x-1"
            onPress={() => {
              router.push({
                pathname: '/challenge-view/[challengeId]' as any,
                params: { challengeId: post.challengeId },
              });
            }}>
            {/* <Image
              source={require('~/assets/icons/Flame.png')}
              style={{ width: 14, height: 14 }}
              resizeMode="contain"
            /> */}

            <Text className="font-body text-sm font-bold text-primary-500">Do This</Text>

            <CaretRight size={16} weight="bold" color={colors.primary} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Reaction Picker Modal */}
      <Modal transparent visible={showReactionPicker} animationType="fade">
        <Pressable
          onPress={() => setShowReactionPicker(false)}
          className="flex-1"
          style={{ backgroundColor: 'rgba(0,0,0,0.1)' }}>
          <View
            style={{
              position: 'absolute',
              left: pickerPosition.x,
              top: pickerPosition.y,
            }}
            className="flex-row gap-x-3 rounded-full bg-white px-4 py-3 shadow-lg">
            <TouchableOpacity
              onPress={() => handleReactionSelect('fire')}
              className="flex flex-row items-center justify-center gap-x-1">
              <Text className="text-3xl">🔥</Text>
              <Text className="font-bold text-black">{intToString(optimisticFireCount)}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleReactionSelect('clap')}
              className="flex flex-row items-center justify-center gap-x-1">
              <Text className="text-3xl">💪</Text>
              <Text className="font-bold text-black">{intToString(optimisticClapCount)}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleReactionSelect('heart')}
              className="flex flex-row items-center justify-center gap-x-1">
              <Text className="text-3xl">😍</Text>
              <Text className="font-bold text-black">{intToString(optimisticHeartCount)}</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* Report Post Modal */}
      <AlertDialog
        isOpen={showReportModal}
        onClose={() => {
          setShowReportModal(false);
          setReportReason('');
        }}
        size="lg">
        <AlertDialogBackdrop />
        <AlertDialogContent className="w-[90%] max-w-[500px] rounded-card">
          <AlertDialogHeader>
            <View className="flex-row items-center justify-center gap-x-2">
              <View
                className="h-8 w-8 flex-row items-center justify-center rounded-full"
                style={{ backgroundColor: colors.primary }}>
                <Icon.Flag size={16} weight="fill" color="white" />
              </View>
              <Text className="font-bold" size="2xl">
                Report Post
              </Text>
            </View>
          </AlertDialogHeader>
          <AlertDialogBody className="mb-4 mt-4">
            <Text size="lg" className="mb-2 font-semibold">
              Help us understand what's wrong with this post. Your report is anonymous.
            </Text>
            <Text size="md" className="mb-4 font-semibold text-red-500">
              This action is irreversible and you won't see this post again.
            </Text>
            <View className="mt-4 flex-col gap-y-2">
              {reportReasons.map((reason) => (
                <TouchableOpacity
                  key={reason}
                  onPress={() => setReportReason(reason)}
                  className={cn('w-full gap-x-2 rounded-full bg-primary-100 px-3 py-3', {
                    'bg-primary-500': reportReason === reason,
                  })}>
                  <Text
                    className={cn('text-center text-base font-semibold', {
                      'text-white': reportReason === reason,
                    })}>
                    {reason}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </AlertDialogBody>
          <AlertDialogFooter>
            <View className="w-full flex-col items-center justify-between gap-y-4">
              <LoadingButton
                variant="solid"
                size="xl"
                action="primary"
                className="h-16 w-full rounded-2xl"
                disabled={isLoading || !reportReason}
                loading={isLoading}
                onPress={handleReportSubmit}>
                <ButtonText className="text-xl font-bold text-white">Submit Report</ButtonText>
              </LoadingButton>
              <Button
                variant="outline"
                size="xl"
                action="negative"
                className="h-16 w-full rounded-2xl"
                disabled={isLoading}
                onPress={() => {
                  setShowReportModal(false);
                  setReportReason(null);
                }}>
                <ButtonText className="text-xl font-bold text-red-500">Cancel</ButtonText>
              </Button>
            </View>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Block User Modal */}
      <AlertDialog
        isOpen={showBlockModal}
        onClose={() => {
          setShowBlockModal(false);
          setBlockReason('');
        }}
        size="lg">
        <AlertDialogBackdrop />
        <AlertDialogContent className="w-[90%] max-w-[500px] rounded-card">
          <AlertDialogHeader>
            <View className="flex-row items-center justify-center gap-x-2">
              <View
                className="h-8 w-8 flex-row items-center justify-center rounded-full"
                style={{ backgroundColor: '#ef4444' }}>
                <Icon.ProhibitInset size={16} weight="fill" color="white" />
              </View>
              <Text className="font-bold" size="2xl">
                Block User
              </Text>
            </View>
          </AlertDialogHeader>
          <AlertDialogBody className="mb-4 mt-4">
            <Text size="lg" className="mb-2 font-semibold">
              You won't see posts from {post.user.name} anymore. They won't be notified that you've
              blocked them.
            </Text>
            <Text size="md" className="mb-4 font-semibold text-red-500">
              This action is irreversible. You cannot unblock this user later.
            </Text>
            <View className="mt-4 flex-col gap-y-2">
              {blockReasons.map((reason) => (
                <TouchableOpacity
                  key={reason}
                  onPress={() => setBlockReason(reason)}
                  className={cn('w-full gap-x-2 rounded-full bg-primary-100 px-3 py-3', {
                    'bg-primary-500': blockReason === reason,
                  })}>
                  <Text
                    className={cn('text-center text-base font-semibold', {
                      'text-white': blockReason === reason,
                    })}>
                    {reason}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </AlertDialogBody>
          <AlertDialogFooter>
            <View className="w-full flex-col items-center justify-between gap-y-4">
              <LoadingButton
                variant="solid"
                size="xl"
                action="negative"
                className="h-16 w-full rounded-2xl"
                disabled={isLoading || !blockReason}
                loading={isLoading}
                onPress={handleBlockSubmit}>
                <ButtonText className="text-xl font-bold text-white">Block User</ButtonText>
              </LoadingButton>
              <Button
                variant="outline"
                size="xl"
                className="h-16 w-full rounded-2xl"
                disabled={isLoading}
                onPress={() => {
                  setShowBlockModal(false);
                  setBlockReason(null);
                }}>
                <ButtonText className="text-xl font-bold text-gray-500">Cancel</ButtonText>
              </Button>
            </View>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </View>
  );
}
