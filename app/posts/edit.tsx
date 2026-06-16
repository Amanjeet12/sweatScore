import { useConvex, useMutation } from 'convex/react';
import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { ImagePickerAsset } from 'expo-image-picker';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { X } from 'phosphor-react-native';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Progress from 'react-native-progress';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '~/components/core/Avatar';
import { BackButton } from '~/components/core/BackButton';
import { ErrorMessage } from '~/components/core/ErrorMessage';
import SafeAreaView from '~/components/core/SafeAreaView';
import ScreenLoading from '~/components/core/ScreenLoading';
import { ButtonText, LoadingButton } from '~/components/ui/button';
import { Input, InputField } from '~/components/ui/input';
import { Text } from '~/components/ui/text';
import { api } from '~/convex/_generated/api';
import { Id } from '~/convex/_generated/dataModel';
import { useAuthStore } from '~/store/useAuthStore';
import { CatchPromise } from '~/utils/catch-promise';
import { colors } from '~/utils/constants';
import { getErrorMessage } from '~/utils/error-message';

export default function EditPost() {
  const { postId } = useLocalSearchParams();
  const convex = useConvex();
  const insets = useSafeAreaInsets();
  const currentUser = useAuthStore((state) => state.currentUser);

  const [pageLoading, setPageLoading] = useState(true);
  const [body, setBody] = useState('');
  const [media, setMedia] = useState<ImagePickerAsset | null>(null);
  const [mediaUri, setMediaUri] = useState<string | undefined>(undefined);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [mediaKey, setMediaKey] = useState<string | undefined>(undefined);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [thumbnailKey, setThumbnailKey] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const generateUploadUrl = useMutation(api.upload.generateUploadUrl);
  const updatePost = useMutation(api.posts.updatePost);

  const resetMedia = () => {
    setMedia(null);
    setMediaUri(undefined);
    setMediaKey(undefined);
    setThumbnailKey(undefined);
    setUploadProgress(0);
    setUploadingMedia(false);
    setMediaLoading(false);
  };

  const uploadFile = async (uri: string, contentType: string) => {
    setUploadingMedia(true);
    const [err, uploadUrl] = await CatchPromise(generateUploadUrl());
    if (err || !uploadUrl) {
      setError(getErrorMessage(err));
      setUploadingMedia(false);
      return;
    }

    setMediaKey(undefined);
    const uploadTask = FileSystem.createUploadTask(
      uploadUrl,
      uri,
      {
        fieldName: 'file',
        httpMethod: 'POST',
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
        headers: { 'Content-Type': contentType },
      },
      ({ totalBytesSent, totalBytesExpectedToSend }) => {
        setUploadProgress(
          parseFloat((totalBytesSent / (totalBytesExpectedToSend || 1)).toFixed(2))
        );
      }
    );

    const uploadResult = await uploadTask.uploadAsync();
    setMediaKey(JSON.parse(uploadResult?.body ?? '{}').storageId);
    setUploadingMedia(false);
  };

  const selectImage = async () => {
    setError(null);
    setUploadProgress(0);
    setMediaLoading(true);

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.5,
      selectionLimit: 1,
      preferredAssetRepresentationMode:
        ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Current,
    });

    if (!result.canceled) {
      const localmedia = result.assets[0];
      setMedia(localmedia);
      setMediaUri(localmedia.uri);

      const maxWidth = 1080;
      const scale = Math.min(1, maxWidth / (localmedia.width ?? maxWidth));
      const resizedImage = await ImageManipulator.manipulateAsync(
        localmedia.uri,
        [
          {
            resize: {
              width: Math.round((localmedia.width ?? maxWidth) * scale),
              height: Math.round((localmedia.height ?? maxWidth) * scale),
            },
          },
        ],
        { compress: 0.7 }
      );

      setMedia({
        ...localmedia,
        uri: resizedImage.uri,
        width: resizedImage.width,
        height: resizedImage.height,
      });
      setMediaUri(resizedImage.uri);
      setMediaLoading(false);

      await uploadFile(resizedImage.uri, 'image/jpeg');
    } else {
      setMediaLoading(false);
    }
  };

  const selectVideo = async () => {
    setError(null);
    setUploadProgress(0);
    setMediaLoading(true);

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      allowsEditing: true,
      quality: 0.5,
      selectionLimit: 1,
      videoMaxDuration: 300,
      preferredAssetRepresentationMode:
        ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Current,
    });

    if (!result.canceled) {
      const localmedia = result.assets[0];
      if (localmedia.duration && localmedia.duration > 300000) {
        setError('Video must be 5 minutes or less');
        setMediaLoading(false);
        return;
      }
      setMedia(localmedia);
      setMediaLoading(false);

      // Generate thumbnail from video
      try {
        const thumb = await VideoThumbnails.getThumbnailAsync(localmedia.uri, { time: 0 });
        setMediaUri(thumb.uri);

        const [thumbErr, thumbUploadUrl] = await CatchPromise(generateUploadUrl());
        if (!thumbErr && thumbUploadUrl) {
          const thumbTask = FileSystem.createUploadTask(thumbUploadUrl, thumb.uri, {
            fieldName: 'file',
            httpMethod: 'POST',
            uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
            headers: { 'Content-Type': 'image/jpeg' },
          });
          const thumbResult = await thumbTask.uploadAsync();
          setThumbnailKey(JSON.parse(thumbResult?.body ?? '{}').storageId);
        }
      } catch {
        setMediaUri(localmedia.uri);
      }

      await uploadFile(localmedia.uri, localmedia.mimeType ?? 'video/mp4');
    } else {
      setMediaLoading(false);
    }
  };

  const handleSubmit = async () => {
    Keyboard.dismiss();
    setError(null);
    setIsLoading(true);

    if (!body) {
      setError('Please enter a post');
      setIsLoading(false);
      return;
    }

    const [err, response] = await CatchPromise(
      updatePost({
        postId: postId as Id<'posts'>,
        body,
        media: mediaKey ? (mediaKey as Id<'_storage'>) : null,
        mediaWidth: media?.width ?? null,
        mediaHeight: media?.height ?? null,
        mediaType: media ? (media.type === 'video' ? 'video' : 'image') : null,
        mediaThumbnail:
          thumbnailKey && thumbnailKey !== 'existing'
            ? (thumbnailKey as Id<'_storage'>)
            : media
              ? undefined
              : null,
      })
    );

    if (err) {
      setError(getErrorMessage(err));
      setIsLoading(false);
      return;
    }

    if (response) {
      router.back();
    }
    setIsLoading(false);
  };

  useEffect(() => {
    if (!postId) return;
    (async () => {
      setPageLoading(true);
      const post = await convex.query(api.posts.getPost, {
        postId: postId as Id<'posts'>,
      });
      if (post) {
        setBody(post.body);
        setMediaKey(post.media ?? undefined);
        if (post.mediaThumbnailUrl) {
          setThumbnailKey('existing');
        }
        if (post.mediaUrl && post.mediaWidth && post.mediaHeight) {
          setMediaUri(
            post.mediaType === 'video' ? (post.mediaThumbnailUrl ?? post.mediaUrl) : post.mediaUrl
          );
          setMedia({
            uri: post.mediaUrl,
            width: post.mediaWidth,
            height: post.mediaHeight,
            assetId: null,
            fileName: null,
            fileSize: undefined,
            type: post.mediaType === 'video' ? 'video' : 'image',
            mimeType: post.mediaType === 'video' ? 'video/mp4' : 'image/jpeg',
          });
        }
      }
      setPageLoading(false);
    })();
  }, [postId]);

  const isUploading = mediaLoading || uploadingMedia;
  const userName = currentUser?.name?.split(' ')[0] ?? '';

  if (pageLoading) {
    return (
      <SafeAreaView className="flex-1 bg-[#F9F9F9]">
        <Stack.Screen
          options={{
            title: '',
            headerStyle: { backgroundColor: '#F9F9F9' },
            headerShadowVisible: false,
            headerBackVisible: false,
            headerLeft: () => <BackButton onPress={() => router.back()} text="" />,
            headerTitle: () => (
              <Text className="font-heading text-xl font-bold text-[#1A1A1A]">Edit Post</Text>
            ),
          }}
        />
        <ScreenLoading className="bg-transparent" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#F9F9F9]">
      <Stack.Screen
        options={{
          title: '',
          headerTitleAlign: 'center',
          headerStyle: { backgroundColor: '#F9F9F9' },
          headerShadowVisible: false,
          headerBackVisible: false,
          headerLeft: () => <BackButton onPress={() => router.back()} text="" />,
          headerTitle: () => (
            <Text className="font-heading text-xl font-bold text-[#1A1A1A]">Edit Post</Text>
          ),
        }}
      />
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 20}>
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {/* Avatar + input */}
          <View className="flex-row items-start gap-x-3 px-4 pt-4">
            <Avatar uri={currentUser?.image ?? undefined} size={46} showGoldBorder />
            <View className="flex-1">
              <Input className="h-auto border-0 bg-transparent">
                <InputField
                  multiline
                  autoFocus
                  className="border-0 bg-transparent text-base"
                  placeholder={`What's on your mind, ${userName}?`}
                  value={body}
                  onChangeText={(text) => {
                    setError(null);
                    setBody(text);
                  }}
                  style={{
                    fontSize: 16,
                    minHeight: 80,
                    ...(Platform.OS === 'android' ? { textAlignVertical: 'top' } : {}),
                  }}
                />
              </Input>
            </View>
          </View>

          {/* Media preview */}
          <View className="mt-4 px-4">
            {mediaLoading ? (
              <View className="flex h-[50px] w-full items-center justify-center">
                <ActivityIndicator />
              </View>
            ) : media && mediaUri ? (
              <View className="relative">
                {media.type === 'video' ? (
                  <View className="items-center justify-center rounded-lg bg-gray-100 p-8">
                    <Image
                      source={require('~/assets/post-types/video.png')}
                      style={{ width: 48, height: 48 }}
                      resizeMode="contain"
                    />
                    <Text className="mt-2 font-body text-sm text-[#838383]">
                      {uploadingMedia ? 'Uploading video...' : 'Video ready'}
                    </Text>
                  </View>
                ) : (
                  <>
                    <Image
                      source={{ uri: mediaUri }}
                      style={{
                        width: '100%',
                        height: undefined,
                        aspectRatio: (media?.width ?? 1) / (media?.height ?? 1),
                        borderRadius: 10,
                      }}
                      blurRadius={uploadingMedia ? 5 : 0}
                    />
                    {uploadingMedia && (
                      <View className="absolute z-50 flex h-full w-full items-center justify-center">
                        <Progress.Circle
                          progress={uploadProgress}
                          size={50}
                          thickness={5}
                          showsText
                          textStyle={{ color: 'white', fontWeight: 'bold' }}
                          borderColor={colors.primary}
                          color={colors.primary}
                          borderWidth={0}
                        />
                      </View>
                    )}
                  </>
                )}
                {!isUploading && (
                  <TouchableOpacity
                    onPress={resetMedia}
                    className="absolute right-0 top-0 m-2 rounded-full bg-[rgba(0,0,0,0.8)] p-1">
                    <X color="#fff" size={18} />
                  </TouchableOpacity>
                )}
              </View>
            ) : null}
          </View>

          <ErrorMessage error={error ?? null} className="mx-4 mt-4" />
        </ScrollView>

        {/* Bottom bar — media buttons + update */}
        <View className="border-t border-t-[#EEEAE5] bg-[#F9F9F9] px-4 pb-4 pt-3">
          {/* Upload progress bar */}
          {uploadingMedia && (
            <View className="mb-3">
              <View className="mb-1 flex-row items-center justify-between">
                <Text className="font-body text-xs text-[#838383]">Uploading...</Text>
                <Text className="font-body text-xs text-[#1A1A1A]">
                  {Math.round(uploadProgress * 100)}%
                </Text>
              </View>
              <View className="h-1.5 w-full overflow-hidden rounded-full bg-[#EEEAE5]">
                <View
                  className="h-full rounded-full bg-primary-500"
                  style={{ width: `${uploadProgress * 100}%` }}
                />
              </View>
            </View>
          )}
          <View className="mb-4 flex-row items-center gap-x-6">
            {!media && (
              <>
                <TouchableOpacity
                  onPress={selectImage}
                  disabled={isUploading}
                  className="items-center">
                  <Image
                    source={require('~/assets/post-types/images.png')}
                    style={{ width: 24, height: 24, opacity: isUploading ? 0.4 : 1 }}
                    resizeMode="contain"
                  />
                  <Text className="mt-1 font-body text-xs text-[#838383]">Pic</Text>
                </TouchableOpacity>

                {currentUser?.isAdmin && (
                  <TouchableOpacity
                    onPress={selectVideo}
                    disabled={isUploading}
                    className="items-center">
                    <Image
                      source={require('~/assets/post-types/video.png')}
                      style={{ width: 24, height: 24, opacity: isUploading ? 0.4 : 1 }}
                      resizeMode="contain"
                    />
                    <Text className="mt-1 font-body text-xs text-[#838383]">Vid</Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>

          <LoadingButton
            variant="solid"
            size="xl"
            action="primary"
            className="h-14 w-full rounded-full"
            style={{
              backgroundColor: !body || isUploading || isLoading ? '#F5D5C8' : '#FF5C1A',
            }}
            loading={isLoading}
            disabled={!body || isUploading || isLoading}
            onPress={handleSubmit}>
            <ButtonText className="text-lg text-white" style={{ fontFamily: 'Inter_700Bold' }}>
              Update
            </ButtonText>
          </LoadingButton>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
