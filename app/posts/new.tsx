import { useMutation } from 'convex/react';
import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { ImagePickerAsset } from 'expo-image-picker';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { ArrowRight, ImageSquare, PlayCircle, VideoCamera, X } from 'phosphor-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { ToastMessage } from '~/components/core/Toast';
import { useCelebration } from '~/components/providers/CelebrationProvider';
import { ButtonText, LoadingButton } from '~/components/ui/button';
import { Input, InputField } from '~/components/ui/input';
import { Text } from '~/components/ui/text';
import { useToast } from '~/components/ui/toast';
import { api } from '~/convex/_generated/api';
import { Id } from '~/convex/_generated/dataModel';
import { useSubscriptionGuard } from '~/hooks/useSubscriptionGuard';
import {
  getActivitySubmissionOption,
  getLoggedActivity,
  getLoggedActivityPoints,
  getRandomActivityCaption,
} from '~/shared/loggedActivities';
import { useAuthStore } from '~/store/useAuthStore';
import { CatchPromise } from '~/utils/catch-promise';
import { colors } from '~/utils/constants';
import { getErrorMessage } from '~/utils/error-message';

type RouteParam = string | string[] | undefined;

function getRouteParam(value: RouteParam) {
  return Array.isArray(value) ? value[0] : value;
}

export default function NewPost() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    activityKey?: string | string[];
    activityMode?: string | string[];
    activityCaption?: string | string[];
    activityMediaUri?: string | string[];
    activityMediaType?: string | string[];
    activityMediaWidth?: string | string[];
    activityMediaHeight?: string | string[];
    activityMediaDuration?: string | string[];
    activityMediaMimeType?: string | string[];
    activityMediaFileName?: string | string[];
  }>();
  const currentUser = useAuthStore((state) => state.currentUser);
  const { requireSubscription } = useSubscriptionGuard();
  const { celebrateCompletion } = useCelebration();
  const toast = useToast();

  const activityKey = getRouteParam(params.activityKey);
  const activityMode = getRouteParam(params.activityMode);
  const activityCaption = getRouteParam(params.activityCaption);
  const activityMediaUri = getRouteParam(params.activityMediaUri);
  const activityMediaType = getRouteParam(params.activityMediaType);
  const activityMediaWidth = getRouteParam(params.activityMediaWidth);
  const activityMediaHeight = getRouteParam(params.activityMediaHeight);
  const activityMediaDuration = getRouteParam(params.activityMediaDuration);
  const activityMediaMimeType = getRouteParam(params.activityMediaMimeType);
  const activityMediaFileName = getRouteParam(params.activityMediaFileName);

  const loggedActivity = useMemo(() => getLoggedActivity(activityKey), [activityKey]);
  const activitySubmission = useMemo(
    () => getActivitySubmissionOption(activityMode),
    [activityMode]
  );
  const activityPoints =
    loggedActivity && activitySubmission
      ? (getLoggedActivityPoints(loggedActivity.key, activitySubmission.mode) ?? 0)
      : 0;
  const isActivityPost = Boolean(loggedActivity && activitySubmission);
  const hasPreparedActivityMedia = useRef(false);

  const [body, setBody] = useState(
    activityCaption || (loggedActivity ? getRandomActivityCaption(loggedActivity.key) : '')
  );
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

  const uploadFile = useCallback(
    async (uri: string, contentType: string) => {
      setUploadingMedia(true);
      setMediaKey(undefined);

      try {
        const uploadUrl = await generateUploadUrl();
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
        const storageId = JSON.parse(uploadResult?.body ?? '{}').storageId as string | undefined;
        if (!storageId) throw new Error('Media upload did not return a storage id.');

        setMediaKey(storageId);
        return true;
      } catch (uploadError) {
        setError(getErrorMessage(uploadError));
        return false;
      } finally {
        setUploadingMedia(false);
      }
    },
    [generateUploadUrl]
  );

  const prepareImage = useCallback(
    async (localMedia: ImagePickerAsset) => {
      setMedia(localMedia);
      setMediaUri(localMedia.uri);

      try {
        const maxWidth = 1080;
        const sourceWidth = localMedia.width > 0 ? localMedia.width : maxWidth;
        const sourceHeight = localMedia.height > 0 ? localMedia.height : maxWidth;
        const scale = Math.min(1, maxWidth / sourceWidth);
        const resizedImage = await ImageManipulator.manipulateAsync(
          localMedia.uri,
          [
            {
              resize: {
                width: Math.round(sourceWidth * scale),
                height: Math.round(sourceHeight * scale),
              },
            },
          ],
          { compress: 0.7 }
        );

        setMedia({
          ...localMedia,
          uri: resizedImage.uri,
          width: resizedImage.width,
          height: resizedImage.height,
        });
        setMediaUri(resizedImage.uri);
        setMediaLoading(false);
        await uploadFile(resizedImage.uri, 'image/jpeg');
      } catch (prepareError) {
        setError(getErrorMessage(prepareError));
        setMediaLoading(false);
      }
    },
    [uploadFile]
  );

  const prepareVideo = useCallback(
    async (localMedia: ImagePickerAsset) => {
      if (localMedia.duration && localMedia.duration > videoMaxDurationMs) {
        setError(videoLimitError);
        setMediaLoading(false);
        return;
      }

      setMedia(localMedia);

      try {
        const thumb = await VideoThumbnails.getThumbnailAsync(localMedia.uri, { time: 0 });
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
        setMediaUri(localMedia.uri);
      }

      setMediaLoading(false);
      await uploadFile(localMedia.uri, localMedia.mimeType ?? 'video/mp4');
    },
    [generateUploadUrl, uploadFile, videoLimitError, videoMaxDurationMs]
  );

  const selectImage = async () => {
    if (!requireSubscription({ redirectTo: '/posts/new', source: 'community_upload_image' }))
      return;
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

    await prepareImage(result.assets[0]);
  };

  const selectVideo = async () => {
    if (!requireSubscription({ redirectTo: '/posts/new', source: 'community_upload_video' }))
      return;
    setError(null);
    setUploadProgress(0);
    setMediaLoading(true);

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      allowsEditing: false,
      quality: 1,
      selectionLimit: 1,
      videoMaxDuration: videoMaxDurationSeconds,
      preferredAssetRepresentationMode:
        ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Current,
    });

    if (result.canceled) {
      setMediaLoading(false);
      return;
    }

    await prepareVideo(result.assets[0]);
  };

  useEffect(() => {
    if (
      hasPreparedActivityMedia.current ||
      !isActivityPost ||
      !activityMediaUri ||
      !activityMediaType
    ) {
      return;
    }

    hasPreparedActivityMedia.current = true;
    setError(null);
    setUploadProgress(0);
    setMediaLoading(true);

    const width = Number(activityMediaWidth);
    const height = Number(activityMediaHeight);
    const duration = Number(activityMediaDuration);
    const activityMedia: ImagePickerAsset = {
      uri: activityMediaUri,
      type: activityMediaType === 'video' ? 'video' : 'image',
      width: Number.isFinite(width) && width > 0 ? width : 1080,
      height: Number.isFinite(height) && height > 0 ? height : 1080,
      duration: Number.isFinite(duration) ? duration : null,
      mimeType: activityMediaMimeType,
      fileName: activityMediaFileName || null,
    };

    if (activityMedia.type === 'video') {
      prepareVideo(activityMedia).catch((prepareError) => setError(getErrorMessage(prepareError)));
    } else {
      prepareImage(activityMedia).catch((prepareError) => setError(getErrorMessage(prepareError)));
    }
  }, [
    activityMediaDuration,
    activityMediaFileName,
    activityMediaHeight,
    activityMediaMimeType,
    activityMediaType,
    activityMediaUri,
    activityMediaWidth,
    isActivityPost,
    prepareImage,
    prepareVideo,
  ]);

  const handlePost = async () => {
    if (!requireSubscription({ redirectTo: '/posts/new', source: 'community_create_post' })) return;
    Keyboard.dismiss();
    setError(null);
    setIsLoading(true);

    if (!body.trim()) {
      setError('Please enter a post');
      setIsLoading(false);
      return;
    }

    if (isActivityPost && !mediaKey) {
      setError(
        isUploading ? 'Please wait for your proof to finish uploading.' : 'Add activity proof.'
      );
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
        activityKey: isActivityPost ? loggedActivity?.key : undefined,
        activitySubmissionType: isActivityPost ? activitySubmission?.mode : undefined,
      })
    );

    if (err) {
      setError(getErrorMessage(err));
      setIsLoading(false);
      return;
    }

    if (response?.success) {
      if (isActivityPost) {
        if (response.pointsEarned > 0) {
          celebrateCompletion({ type: 'activity', pointsEarned: response.pointsEarned });
        }
        toast.show({
          placement: 'top',
          duration: 3500,
          render: () => (
            <ToastMessage
              message={
                response.pointsEarned > 0
                  ? `+${response.pointsEarned} pts added. Your activity post is live.`
                  : 'Activity posted. You reached today’s points cap.'
              }
              action="success"
            />
          ),
        });
      }
      router.back();
    }

    setIsLoading(false);
  };

  const mediaAspectRatio = media?.width && media?.height ? media.width / media.height : 16 / 9;
  const canSubmit =
    Boolean(body.trim()) && !isUploading && !isLoading && (!isActivityPost || Boolean(mediaKey));

  return (
    <SafeAreaView className="flex-1 bg-[#F9F9F9]">
      <Stack.Screen
        options={{
          title: '',
          headerTitleAlign: 'center',
          headerStyle: { backgroundColor: '#F9F9F9' },
          headerShadowVisible: false,
          headerBackVisible: false,
          headerLeft: () => (
            <BackButton
              fallbackHref={isActivityPost ? '/(tabs)/dashboard' : '/(tabs)/share'}
              text=""
            />
          ),
          headerTitle: () => (
            <Text className="font-heading text-xl font-bold text-[#1A1A1A]">
              {isActivityPost ? 'Log Activity' : 'New Post'}
            </Text>
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
          {loggedActivity && activitySubmission ? (
            <View
              className="mx-4 mt-4 rounded-[26px] bg-white p-4"
              style={{
                shadowColor: '#000000',
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.05,
                shadowRadius: 14,
                elevation: 2,
              }}>
              <View className="flex-row items-center justify-between">
                <View className="min-w-0 flex-1 pr-3">
                  <Text className="font-heading text-[10px] font-extrabold uppercase tracking-[1px] text-[#FF4B1F]">
                    Daily activity
                  </Text>
                  <Text className="mt-1 font-heading text-lg font-extrabold text-[#1A1A1A]">
                    {loggedActivity.title}
                  </Text>
                </View>
                <View className="items-end py-2">
                  <Text className="font-heading text-base font-extrabold text-[#E94F12]">
                    +{activityPoints} pts
                  </Text>
                </View>
              </View>

              <View className="mb-2 mt-4 flex-row items-center justify-between">
                <Text className="font-body text-xs font-bold text-[#5F5955]">Caption</Text>
                <Text className="font-body text-[10px] text-[#9A928D]">{body.length}/150</Text>
              </View>
              <Input className="h-auto min-h-[96px] w-full rounded-[18px] border-0 bg-[#F8F8F8]">
                <InputField
                  multiline
                  maxLength={150}
                  className="px-3.5 py-3 font-body text-[15px] leading-5 text-[#2A2725]"
                  value={body}
                  onChangeText={(text) => {
                    setError(null);
                    setBody(text);
                  }}
                  accessibilityLabel="Activity caption"
                  style={{
                    minHeight: 94,
                    ...(Platform.OS === 'android' ? { textAlignVertical: 'top' } : {}),
                  }}
                />
              </Input>
            </View>
          ) : null}

          {!isActivityPost ? (
            <View className="mx-4 mt-4 rounded-3xl border border-[#CDCFD0] bg-white px-4 py-4">
              <View className="flex-row items-start gap-x-3">
                <Avatar
                  uri={currentUser?.image ?? undefined}
                  size={46}
                  showGoldBorder
                  name={currentUser?.name}
                />

                <View className="flex-1">
                  <Text className="font-body text-sm font-bold text-[#1A1A1A]">
                    {currentUser?.name ?? 'You'}
                  </Text>

                  <Input className="mt-1 h-auto border-0 bg-transparent">
                    <InputField
                      multiline
                      autoFocus
                      className="border-0 bg-transparent px-0 text-base"
                      placeholder={`Share an update with your Sweat Sisters ${userName || 'there'} `}
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
          ) : null}

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
                      <View
                        style={{
                          width: '100%',
                          backgroundColor: '#000',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}>
                        <RNImage
                          source={{ uri: mediaUri }}
                          style={{
                            width: '100%',
                            aspectRatio: mediaAspectRatio,
                            maxHeight: 440,
                            backgroundColor: '#000',
                          }}
                          resizeMode="contain"
                          blurRadius={uploadingMedia ? 5 : 0}
                        />
                      </View>

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
                        height: isActivityPost ? 300 : 400,
                        backgroundColor: '#EFEFEF',
                      }}
                      resizeMode={isActivityPost ? 'cover' : 'contain'}
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
                      onPress={isActivityPost ? () => router.back() : resetMedia}
                      accessibilityRole="button"
                      accessibilityLabel={isActivityPost ? 'Retake activity proof' : 'Remove media'}
                      className="absolute right-3 top-3 rounded-full bg-[rgba(0,0,0,0.75)] p-2">
                      <X color="#fff" size={18} />
                    </TouchableOpacity>
                  )}
                </View>

                {!isActivityPost ? (
                  <View className="px-4 py-3">
                    <Text className="font-body text-sm font-semibold text-[#1A1A1A]">
                      {media.type === 'video' ? 'Video attached' : 'Photo attached'}
                    </Text>

                    <Text className="mt-0.5 font-body text-xs text-[#838383]">
                      {uploadingMedia ? 'Uploading media...' : 'Ready to post'}
                    </Text>
                  </View>
                ) : null}
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
            className="h-14 w-full rounded-[17px] px-[22px]"
            style={{
              backgroundColor: canSubmit ? '#FF5C1A' : '#F5D5C8',
            }}
            loading={isLoading}
            disabled={!canSubmit}
            onPress={handlePost}>
            <ButtonText
              className="flex-1 text-left text-base text-white"
              style={{ fontFamily: 'Inter_700Bold' }}>
              {isActivityPost ? 'Share activity' : 'Post'}
            </ButtonText>
            <ArrowRight size={23} color="#FFFFFF" weight="bold" />
          </LoadingButton>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
