import { useMutation } from 'convex/react';
import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { ImagePickerAsset } from 'expo-image-picker';
import { router, Stack } from 'expo-router';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { ImageSquare, PlayCircle, VideoCamera, X } from 'phosphor-react-native';
import { useState } from 'react';
import {
  ActivityIndicator,
  Image as RNImage,
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
import { ButtonText, LoadingButton } from '~/components/ui/button';
import { Input, InputField } from '~/components/ui/input';
import { Text } from '~/components/ui/text';
import { api } from '~/convex/_generated/api';
import { Id } from '~/convex/_generated/dataModel';
import { useAuthStore } from '~/store/useAuthStore';
import { CatchPromise } from '~/utils/catch-promise';
import { colors } from '~/utils/constants';
import { getErrorMessage } from '~/utils/error-message';

export default function NewPost() {
  const insets = useSafeAreaInsets();
  const currentUser = useAuthStore((state) => state.currentUser);

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
  const createPost = useMutation(api.posts.createPost);

  const isUploading = mediaLoading || uploadingMedia;
  const userName = currentUser?.name?.split(' ')[0] ?? '';

  const isAdmin = currentUser?.isAdmin === true;
  const videoMaxDurationSeconds = isAdmin ? 300 : 60;
  const videoMaxDurationMs = videoMaxDurationSeconds * 1000;
  const videoLimitText = isAdmin ? 'Max 5 min' : 'Max 60 sec';
  const videoLimitError = isAdmin
    ? 'Video must be 5 minutes or less'
    : 'Video must be 1 minute or less';

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

    if (result.canceled) {
      setMediaLoading(false);
      return;
    }

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
      videoMaxDuration: videoMaxDurationSeconds,
      preferredAssetRepresentationMode:
        ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Current,
    });

    if (result.canceled) {
      setMediaLoading(false);
      return;
    }

    const localmedia = result.assets[0];

    if (localmedia.duration && localmedia.duration > videoMaxDurationMs) {
      setError(videoLimitError);
      setMediaLoading(false);
      return;
    }

    setMedia(localmedia);
    setMediaLoading(false);

    try {
      const thumb = await VideoThumbnails.getThumbnailAsync(localmedia.uri, {
        time: 0,
      });

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
  };

  const handlePost = async () => {
    Keyboard.dismiss();
    setError(null);
    setIsLoading(true);

    if (!body.trim()) {
      setError('Please enter a post');
      setIsLoading(false);
      return;
    }

    const [err, response] = await CatchPromise(
      createPost({
        body: body.trim(),
        media: mediaKey as Id<'_storage'>,
        mediaWidth: media?.width,
        mediaHeight: media?.height,
        mediaType: media?.type === 'video' ? 'video' : 'image',
        mediaThumbnail: thumbnailKey ? (thumbnailKey as Id<'_storage'>) : undefined,
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

  return (
    <SafeAreaView className="flex-1 bg-[#F9F9F9]">
      <Stack.Screen
        options={{
          title: '',
          headerTitleAlign: 'center',
          headerStyle: { backgroundColor: '#F9F9F9' },
          headerShadowVisible: false,
          headerBackVisible: false,
          headerLeft: () => <BackButton fallbackHref="/(tabs)/share" text="" />,
          headerTitle: () => (
            <Text className="font-heading text-xl font-bold text-[#1A1A1A]">New Post</Text>
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
          <View className="mx-4 mt-4 rounded-3xl border border-[#CDCFD0] bg-white px-4 py-4">
            <View className="flex-row items-start gap-x-3">
              <Avatar uri={currentUser?.image ?? undefined} size={46} showGoldBorder />

              <View className="flex-1">
                <Text className="font-body text-sm font-bold text-[#1A1A1A]">
                  {currentUser?.name ?? 'You'}
                </Text>

                <Input className="mt-1 h-auto border-0 bg-transparent">
                  <InputField
                    multiline
                    autoFocus
                    className="border-0 bg-transparent px-0 text-base"
                    placeholder={`What's on your mind, ${
                      userName || 'there'
                    }? Share your progress or just check in with the group`}
                    value={body}
                    onChangeText={(text) => {
                      setError(null);
                      setBody(text);
                    }}
                    style={{
                      fontSize: 16,
                      minHeight: 105,
                      ...(Platform.OS === 'android' ? { textAlignVertical: 'top' } : {}),
                    }}
                  />
                </Input>
              </View>
            </View>

            {!media && (
              <View className="mt-4 flex-row gap-x-3">
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={selectImage}
                  disabled={isUploading}
                  className="flex-1 flex-row items-center rounded-2xl border border-[#F2DED4] bg-[#fff] px-4 py-3"
                  style={{ opacity: isUploading ? 0.5 : 1 }}>
                  <View className="mr-3 h-10 w-10 items-center justify-center rounded-full bg-white">
                    <ImageSquare size={22} color="#FF5C1A" weight="duotone" />
                  </View>

                  <View>
                    <Text className="font-body text-sm font-bold text-[#1A1A1A]">Photo</Text>
                    <Text className="font-body text-xs text-[#838383]">Upload image</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={selectVideo}
                  disabled={isUploading}
                  className="flex-1 flex-row items-center rounded-2xl border border-[#F2DED4] bg-[#fff] px-4 py-3"
                  style={{ opacity: isUploading ? 0.5 : 1 }}>
                  <View className="mr-3 h-10 w-10 items-center justify-center rounded-full bg-white">
                    <VideoCamera size={22} color="#FF5C1A" weight="duotone" />
                  </View>

                  <View>
                    <Text className="font-body text-sm font-bold text-[#1A1A1A]">Video</Text>
                    <Text className="font-body text-xs text-[#838383]">{videoLimitText}</Text>
                  </View>
                </TouchableOpacity>
              </View>
            )}
          </View>

          <View className="mt-4 px-4">
            {mediaLoading ? (
              <View className="h-28 items-center justify-center rounded-3xl bg-white">
                <ActivityIndicator color={colors.primary} />
                <Text className="mt-2 font-body text-sm text-[#838383]">Preparing media...</Text>
              </View>
            ) : media && mediaUri ? (
              <View className="overflow-hidden rounded-3xl bg-white">
                <View className="relative">
                  {media.type === 'video' ? (
                    <View>
                      <RNImage
                        source={{ uri: mediaUri }}
                        style={{
                          width: '100%',
                          height: 220,
                          backgroundColor: '#EFEFEF',
                        }}
                        resizeMode="cover"
                        blurRadius={uploadingMedia ? 5 : 0}
                      />

                      <View className="absolute inset-0 items-center justify-center">
                        <View className="h-14 w-14 items-center justify-center rounded-full bg-[rgba(0,0,0,0.55)]">
                          <PlayCircle size={34} color="#FFFFFF" weight="fill" />
                        </View>
                      </View>
                    </View>
                  ) : (
                    <RNImage
                      source={{ uri: mediaUri }}
                      style={{
                        width: '100%',
                        height: 400,
                        backgroundColor: '#EFEFEF',
                      }}
                      resizeMode="contain"
                      blurRadius={uploadingMedia ? 5 : 0}
                    />
                  )}

                  {uploadingMedia && (
                    <View className="absolute inset-0 items-center justify-center bg-[rgba(0,0,0,0.18)]">
                      <Progress.Circle
                        progress={uploadProgress}
                        size={58}
                        thickness={5}
                        showsText
                        textStyle={{ color: 'white', fontWeight: 'bold' }}
                        borderColor={colors.primary}
                        color={colors.primary}
                        borderWidth={0}
                      />
                    </View>
                  )}

                  {!isUploading && (
                    <TouchableOpacity
                      onPress={resetMedia}
                      className="absolute right-3 top-3 rounded-full bg-[rgba(0,0,0,0.75)] p-2">
                      <X color="#fff" size={18} />
                    </TouchableOpacity>
                  )}
                </View>

                <View className="px-4 py-3">
                  <Text className="font-body text-sm font-semibold text-[#1A1A1A]">
                    {media.type === 'video' ? 'Video attached' : 'Photo attached'}
                  </Text>

                  <Text className="mt-0.5 font-body text-xs text-[#838383]">
                    {uploadingMedia ? 'Uploading media...' : 'Ready to post'}
                  </Text>
                </View>
              </View>
            ) : null}
          </View>

          <ErrorMessage error={error ?? null} className="mx-4 mt-4" />
        </ScrollView>

        <View
          className="border-t border-t-[#EEEAE5] bg-[#F9F9F9] px-4 pt-3"
          style={{ paddingBottom: Math.max(insets.bottom, 16) }}>
          {uploadingMedia && (
            <View className="mb-3">
              <View className="mb-1 flex-row items-center justify-between">
                <Text className="font-body text-xs text-[#838383]">Uploading media...</Text>
                <Text className="font-body text-xs font-semibold text-[#1A1A1A]">
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

          <LoadingButton
            variant="solid"
            size="xl"
            action="primary"
            className="h-14 w-full rounded-full"
            style={{
              backgroundColor: !body.trim() || isUploading || isLoading ? '#F5D5C8' : '#FF5C1A',
            }}
            loading={isLoading}
            disabled={!body.trim() || isUploading || isLoading}
            onPress={handlePost}>
            <ButtonText className="text-lg text-white" style={{ fontFamily: 'Inter_700Bold' }}>
              Post
            </ButtonText>
          </LoadingButton>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}