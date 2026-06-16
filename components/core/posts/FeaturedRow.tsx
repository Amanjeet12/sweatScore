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
import RNShare from 'react-native-share';

import { stopCurrentVideo, setStopCurrentVideo } from '~/components/core/posts/Row';
import { Text } from '~/components/ui/text';
import { api } from '~/convex/_generated/api';
import { Id } from '~/convex/_generated/dataModel';
import { useAuthStore } from '~/store/useAuthStore';
import { CatchPromise } from '~/utils/catch-promise';
import { cn } from '~/utils/cn';
import { intToString } from '~/utils/formatter';
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

function ActiveFeaturedPlayer({
  videoUrl,
  aspectRatio = 1,
}: {
  videoUrl: string;
  aspectRatio?: number;
}) {
  const [isBuffering, setIsBuffering] = useState(true);
  const player = useVideoPlayer(videoUrl, (p) => {
    p.loop = false;
    p.play();
  });

  useEffect(() => {
    const statusSub = player.addListener('statusChange', ({ status }) => {
      setIsBuffering(status !== 'readyToPlay');
    });
    const endSub = player.addListener('playToEnd', () => {
      // Rewind so the native play button works for replay
      player.currentTime = 0;
      player.pause();
    });
    return () => {
      statusSub.remove();
      endSub.remove();
    };
  }, [player]);

  return (
    <View style={{ width: '100%', aspectRatio }}>
      <VideoView
        player={player}
        style={{ width: '100%', height: '100%' }}
        contentFit="cover"
        nativeControls
      />
      {isBuffering && (
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0,0,0,0.3)',
          }}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
      )}
    </View>
  );
}

function FeaturedChallengeVideoPlayer({
  videoUrl,
  thumbnailUrl,
  aspectRatio = 1,
}: {
  videoUrl: string;
  thumbnailUrl?: string;
  aspectRatio?: number;
}) {
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    return () => {
      if (stopCurrentVideo === (() => setIsActive(false))) {
        setStopCurrentVideo(null);
      }
    };
  }, []);

  const handlePlay = () => {
    stopCurrentVideo?.();
    setStopCurrentVideo(() => setIsActive(false));
    setIsActive(true);
  };

  return (
    <View>
      {isActive ? (
        <ActiveFeaturedPlayer videoUrl={videoUrl} aspectRatio={aspectRatio} />
      ) : (
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={handlePlay}
          style={{ width: '100%', aspectRatio, backgroundColor: '#1A1A1A' }}>
          {thumbnailUrl && (
            <ExpoImage
              source={{ uri: thumbnailUrl }}
              style={{ width: '100%', height: '100%', position: 'absolute' }}
              contentFit="cover"
            />
          )}
          <View
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: 28,
                backgroundColor: 'rgba(26, 26, 26, 0.5)',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Icon.Play size={24} color="#FFFFFF" weight="fill" />
            </View>
          </View>
        </TouchableOpacity>
      )}
    </View>
  );
}

export default function FeaturedRow({ post }: { post: PostWithUser }) {
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

  // Optimistic update state
  const [optimisticLikeCount, setOptimisticLikeCount] = useState(post.likeCount);
  const [optimisticIsLiked, setOptimisticIsLiked] = useState(post.isLiked);
  const [optimisticHeartCount, setOptimisticHeartCount] = useState(post.heartLikesCount);
  const [optimisticFireCount, setOptimisticFireCount] = useState(post.fireLikesCount);
  const [optimisticClapCount, setOptimisticClapCount] = useState(post.clapLikesCount);

  const likesButtonRef = useRef<View>(null);

  const likePost = useMutation(api.posts.likePost);
  const unlikePost = useMutation(api.posts.unlikePost);
  const unpinPost = useMutation(api.posts.unpinPost);

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

  const handleViewComments = () => {
    router.push({
      pathname: '/posts/comments',
      params: { postId: post._id },
    });
  };

  const handleUnpinPost = async () => {
    setIsLoading(true);
    const [err] = await CatchPromise(unpinPost({ postId: post._id }));
    if (!err) Alert.alert('Success', 'Post has been unpinned successfully!');
    setIsLoading(false);
  };

  const handleSharePost = async () => {
    if (!post.challenge?.compositeVideoUrl || mediaBusy) return;
    setSharing(true);
    try {
      const localUri = FileSystem.cacheDirectory + 'share_video_' + Date.now() + '.mp4';
      await FileSystem.downloadAsync(post.challenge.compositeVideoUrl, localUri);
      await RNShare.open({
        url: localUri,
        message: buildCaption(post.body ?? ''),
        type: 'video/mp4',
      });
    } catch {
      // User cancelled or error
    }
    setSharing(false);
  };

  const handleDownloadVideo = async () => {
    if (!post.challenge?.compositeVideoUrl || mediaBusy) return;

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
    const localUri = FileSystem.cacheDirectory + 'download_video_' + Date.now() + '.mp4';
    const [err] = await CatchPromise(
      FileSystem.downloadAsync(post.challenge.compositeVideoUrl, localUri).then(() =>
        MediaLibrary.saveToLibraryAsync(localUri)
      )
    );
    setDownloading(false);

    if (err) {
      Alert.alert('Download failed', 'Could not save the video. Please try again.');
      return;
    }
    Alert.alert('Saved', 'Video saved to your gallery.');
  };

  return (
    <View className="border-b border-b-[#EEEAE5] bg-white px-4 py-4">
      <View className="flex-row items-start gap-x-2">
        <View className="flex-1 flex-col">
          <View className="flex-row justify-between gap-x-2">
            <View className="flex-1 flex-row items-center gap-x-1">
              <Icon.Sparkle size={18} weight="fill" color="#F58503" />
              <Text className="text-base">
                Featured <Text style={{ fontFamily: 'Inter_700Bold' }}>by {post.user.name}</Text>
              </Text>
            </View>
            {post.challenge?.compositeVideoUrl &&
              (post.user?.isAuthor || post.challenge?.allowRepost) && (
                <TouchableOpacity
                  className="flex-shrink-0"
                  onPress={handleDownloadVideo}
                  disabled={mediaBusy}
                  style={{ width: 20, height: 20, alignItems: 'center', justifyContent: 'center' }}>
                  {downloading ? (
                    <ActivityIndicator size="small" color="black" />
                  ) : (
                    <Ionicons size={20} name="download-outline" color="black" />
                  )}
                </TouchableOpacity>
              )}
            {currentUser?.isAdmin && (
              <Menu>
                <MenuTrigger>
                  <Ionicons size={16} name="ellipsis-horizontal" color="black" />
                </MenuTrigger>
                <MenuOptions
                  customStyles={{
                    optionsContainer: {
                      borderRadius: 12,
                      padding: 8,
                      marginTop: 25,
                    },
                  }}>
                  <MenuOption onSelect={handleUnpinPost} disabled={isLoading}>
                    <View className="flex-row items-center gap-x-3 px-2 py-2">
                      <Ionicons name="pin-outline" size={18} color="black" />
                      <Text className="text-base text-black">Unpin</Text>
                    </View>
                  </MenuOption>
                </MenuOptions>
              </Menu>
            )}
          </View>
        </View>
      </View>
      {/* Body text */}
      {post.body ? (
        <View className="mt-2">
          <Text className="text-lg text-black">{post.body}</Text>
        </View>
      ) : null}
      {/* Media — edge to edge */}
      {post.challenge?.compositeVideoUrl ? (
        <View className="-mx-4 mt-2">
          <FeaturedChallengeVideoPlayer
            videoUrl={post.challenge.compositeVideoUrl}
            thumbnailUrl={post.challenge.thumbnailUrl}
          />
        </View>
      ) : post.mediaUrl && post.mediaType === 'video' ? (
        <View className="-mx-4 mt-2">
          <FeaturedChallengeVideoPlayer
            videoUrl={post.mediaUrl}
            thumbnailUrl={post.mediaThumbnailUrl}
            aspectRatio={(post.mediaWidth ?? 1) / (post.mediaHeight ?? 1)}
          />
        </View>
      ) : post.mediaUrl ? (
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
              style={{
                width: '100%',
                height: undefined,
                resizeMode: 'contain',
                aspectRatio: (post.mediaWidth ?? 1) / (post.mediaHeight ?? 1),
              }}
            />
          </View>
        </View>
      ) : null}
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
          (post.user?.isAuthor || post.challenge?.allowRepost) && (
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
            <Image
              source={require('~/assets/icons/Flame.png')}
              style={{ width: 14, height: 14 }}
              resizeMode="contain"
            />
            <Text className="font-body text-sm font-bold text-primary-500">Try this</Text>
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
    </View>
  );
}
