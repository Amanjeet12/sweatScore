import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useMutation } from 'convex/react';
import { format, isBefore, startOfDay } from 'date-fns';
import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { ImageSquare, VideoCamera, X } from 'phosphor-react-native';
import { useEffect, useRef, useState } from 'react';
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
import { z } from 'zod';

import { ErrorMessage } from '~/components/core/ErrorMessage';
import { ButtonText, LoadingButton } from '~/components/ui/button';
import { Input, InputField } from '~/components/ui/input';
import { Switch } from '~/components/ui/switch';
import { Text } from '~/components/ui/text';
import { Textarea, TextareaInput } from '~/components/ui/textarea';
import { api } from '~/convex/_generated/api';
import { Doc, Id } from '~/convex/_generated/dataModel';
import {
  CHALLENGE_TAGS,
  CHALLENGE_POINTS_MIN,
  CHALLENGE_POINTS_MAX,
  CHALLENGE_POINTS_DEFAULT,
  CHALLENGE_DURATION_MAX,
  CHALLENGE_DURATION_DEFAULT,
} from '~/convex/challenges';
import { CatchPromise } from '~/utils/catch-promise';
import { colors } from '~/utils/constants';
import { getErrorMessage, getZodErrorMessage } from '~/utils/error-message';

const challengeSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().min(1, 'Description is required'),
  createdBy: z.string().min(1, 'Created by is required'),
  tag: z.string().min(1, 'Tag is required'),
  points: z.number().min(CHALLENGE_POINTS_MIN).max(CHALLENGE_POINTS_MAX),
  durationLimit: z.number().min(60).max(CHALLENGE_DURATION_MAX),
  youtubeUrl: z.string().url('Invalid URL').optional().or(z.literal('')),
});

type ChallengeWithUrls = Doc<'challenges'> & {
  coverImageUrl: string | null;
  instructionalVideoUrl: string | null;
};

interface ChallengeFormProps {
  mode: 'create' | 'edit';
  initialData?: ChallengeWithUrls;
  onSuccess: () => void;
}

type DailyChallengeType = 'challenge' | 'check_in';

export default function ChallengeForm({ mode, initialData, onSuccess }: ChallengeFormProps) {
  // Form state
  const [name, setName] = useState(initialData?.name ?? '');
  const [description, setDescription] = useState(initialData?.description ?? '');
  const [createdBy, setCreatedBy] = useState(initialData?.createdBy ?? '');
  const [youtubeUrl, setYoutubeUrl] = useState(initialData?.youtubeUrl ?? '');
  const [points, setPoints] = useState(String(initialData?.points ?? CHALLENGE_POINTS_DEFAULT));
  const [durationMinutes, setDurationMinutes] = useState(
    String(Math.round((initialData?.durationLimit ?? CHALLENGE_DURATION_DEFAULT) / 60))
  );
  const [tag, setTag] = useState(initialData?.tag ?? '');
  const [isLocked, setIsLocked] = useState(initialData?.isLocked ?? false);
  const [hasEndDate, setHasEndDate] = useState(!!initialData?.endDate);
  const [endDate, setEndDate] = useState<Date | null>(
    initialData?.endDate ? new Date(initialData.endDate + 'T00:00:00') : null
  );

  // Mutation for setting today's daily challenge
  const setTodayDailyChallenge = useMutation(api.admin.setTodayDailyChallenge);
  const closeTodayDailyChallenge = useMutation(api.admin.closeTodayDailyChallenge);
  // Cover image state
  const [coverMediaUri, setCoverMediaUri] = useState<string | undefined>(
    initialData?.coverImageUrl ?? undefined
  );
  const [coverMediaKey, setCoverMediaKey] = useState<string | undefined>(
    initialData ? String(initialData.coverImage) : undefined
  );
  const [coverUploading, setCoverUploading] = useState(false);
  const [coverUploadProgress, setCoverUploadProgress] = useState(0);
  const [coverMediaLoading, setCoverMediaLoading] = useState(false);

  // Video state
  const [videoMediaUri, setVideoMediaUri] = useState<string | undefined>(undefined);
  const [videoMediaKey, setVideoMediaKey] = useState<string | undefined>(
    initialData ? String(initialData.instructionalVideo) : undefined
  );
  const [videoDuration, setVideoDuration] = useState<number | undefined>(
    initialData?.videoDuration ?? undefined
  );
  const [videoUploading, setVideoUploading] = useState(false);
  const [videoUploadProgress, setVideoUploadProgress] = useState(0);
  const [videoMediaLoading, setVideoMediaLoading] = useState(false);

  // General state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  const generateUploadUrl = useMutation(api.upload.generateUploadUrl);
  const createChallenge = useMutation(api.admin.createChallenge);
  const updateChallenge = useMutation(api.admin.updateChallenge);

  const [setAsTodayChallenge, setSetAsTodayChallenge] = useState(
    initialData?.isDailyChallenge ?? false
  );

  const [shortDescription, setShortDescription] = useState(initialData?.shortDescription ?? '');
  const [dailyChallengeType, setDailyChallengeType] = useState<DailyChallengeType>(
    initialData?.dailyChallengeType ?? 'challenge'
  );

  useEffect(() => {
    const showListener = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hideListener = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => {
      showListener.remove();
      hideListener.remove();
    };
  }, []);

  useEffect(() => {
    if (keyboardVisible && scrollViewRef.current) {
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [keyboardVisible]);

  const selectCoverImage = async () => {
    Keyboard.dismiss();
    setError(null);
    setCoverUploadProgress(0);
    setCoverMediaLoading(true);

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.5,
      selectionLimit: 1,
      aspect: [16, 9],
      preferredAssetRepresentationMode:
        ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Current,
    });

    if (!result.canceled) {
      const localmedia = result.assets[0];
      setCoverMediaUri(localmedia.uri);
      setCoverMediaLoading(false);
      setCoverUploading(true);

      // Compress image using expo-image-manipulator
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

      setCoverMediaUri(resizedImage.uri);

      const [err, uploadUrl] = await CatchPromise(generateUploadUrl());
      if (err) {
        setError(getErrorMessage(err));
        setCoverUploading(false);
        return;
      }

      if (uploadUrl) {
        setCoverMediaKey(undefined);
        const uploadTask = FileSystem.createUploadTask(
          uploadUrl,
          resizedImage.uri,
          {
            fieldName: 'file',
            httpMethod: 'POST',
            uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
            headers: { 'Content-Type': localmedia.mimeType ?? 'image/jpeg' },
          },
          ({ totalBytesSent, totalBytesExpectedToSend }) => {
            const progress = parseFloat(
              (totalBytesSent / (totalBytesExpectedToSend || 1)).toFixed(2)
            );
            setCoverUploadProgress(progress);
          }
        );

        const uploadResult = await uploadTask.uploadAsync();
        setCoverMediaKey(JSON.parse(uploadResult?.body ?? '{}').storageId);
      }
      setCoverUploading(false);
    } else {
      setCoverMediaLoading(false);
      setCoverUploading(false);
    }
  };

  const resetCoverImage = () => {
    setCoverMediaUri(undefined);
    setCoverMediaKey(undefined);
    setCoverUploadProgress(0);
  };

  const selectVideo = async () => {
    Keyboard.dismiss();
    setError(null);
    setVideoUploadProgress(0);
    setVideoMediaLoading(true);

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

      // Client-side duration validation
      if (localmedia.duration && localmedia.duration > 300000) {
        setError('Video must be 5 minutes or less');
        setVideoMediaLoading(false);
        return;
      }

      setVideoMediaUri(localmedia.uri);
      // Duration from picker is in ms — convert to seconds
      if (localmedia.duration) {
        setVideoDuration(Math.round(localmedia.duration / 1000));
      }
      setVideoMediaLoading(false);
      setVideoUploading(true);

      const videoUri = localmedia.uri;

      const [err, uploadUrl] = await CatchPromise(generateUploadUrl());
      if (err) {
        setError(getErrorMessage(err));
        setVideoUploading(false);
        return;
      }

      if (uploadUrl) {
        setVideoMediaKey(undefined);
        const uploadTask = FileSystem.createUploadTask(
          uploadUrl,
          videoUri,
          {
            fieldName: 'file',
            httpMethod: 'POST',
            uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
            headers: { 'Content-Type': localmedia.mimeType ?? 'video/mp4' },
          },
          ({ totalBytesSent, totalBytesExpectedToSend }) => {
            const progress = parseFloat(
              (totalBytesSent / (totalBytesExpectedToSend || 1)).toFixed(2)
            );
            setVideoUploadProgress(progress);
          }
        );

        const uploadResult = await uploadTask.uploadAsync();
        setVideoMediaKey(JSON.parse(uploadResult?.body ?? '{}').storageId);
      }
      setVideoUploading(false);
    } else {
      setVideoMediaLoading(false);
      setVideoUploading(false);
    }
  };

  const resetVideo = () => {
    setVideoMediaUri(undefined);
    setVideoMediaKey(undefined);
    setVideoDuration(undefined);
    setVideoUploadProgress(0);
  };

  const handleDateChange = (_event: any, selectedDate?: Date) => {
    if (selectedDate) {
      setEndDate(selectedDate);
    }
  };

  const openAndroidDatePicker = () => {
    DateTimePickerAndroid.open({
      value: endDate ?? new Date(),
      onChange: handleDateChange,
      mode: 'date',
      display: 'spinner',
      minimumDate: new Date(),
    });
  };

  const handleSubmit = async () => {
    Keyboard.dismiss();
    setError(null);
    setIsLoading(true);

    if (!coverMediaKey) {
      setError('Please upload a cover image');
      setIsLoading(false);
      return;
    }

    if (!videoMediaKey) {
      setError('Please upload an instructional video');
      setIsLoading(false);
      return;
    }

    if (setAsTodayChallenge && !shortDescription.trim()) {
      setError('Please add a short description for today’s daily challenge');
      setIsLoading(false);
      return;
    }

    const parsedPoints = parseInt(points, 10);
    const parsedDuration = parseInt(durationMinutes, 10) * 60;

    const result = challengeSchema.safeParse({
      name,
      description,
      createdBy,
      tag,
      points: isNaN(parsedPoints) ? 0 : parsedPoints,
      durationLimit: isNaN(parsedDuration) ? 0 : parsedDuration,
      youtubeUrl: youtubeUrl.trim() || undefined,
    });

    if (!result.success) {
      setError(getZodErrorMessage(result.error));
      setIsLoading(false);
      return;
    }

    if (hasEndDate && endDate && isBefore(startOfDay(endDate), startOfDay(new Date()))) {
      setError('End date must be in the future');
      setIsLoading(false);
      return;
    }

    const endDateStr = hasEndDate && endDate ? format(endDate, 'yyyy-MM-dd') : undefined;

    if (mode === 'create') {
      const [err, response] = await CatchPromise(
        createChallenge({
          name: result.data.name,
          description: result.data.description,
          createdBy: result.data.createdBy,
          coverImage: coverMediaKey as Id<'_storage'>,
          instructionalVideo: videoMediaKey as Id<'_storage'>,
          videoDuration,
          youtubeUrl: result.data.youtubeUrl || undefined,
          points: result.data.points,
          durationLimit: result.data.durationLimit,
          tag: result.data.tag,
          isLocked,
          endDate: endDateStr,
        })
      );

      if (err) {
        setError(getErrorMessage(err));
        setIsLoading(false);
        return;
      }

      if (response) {
        if (setAsTodayChallenge) {
          const [dailyErr] = await CatchPromise(
            setTodayDailyChallenge({
              challengeId: response.challengeId,
              shortDescription: shortDescription.trim(),
              dailyChallengeType,
            })
          );

          if (dailyErr) {
            setError(getErrorMessage(dailyErr));
            setIsLoading(false);
            return;
          }
        }

        onSuccess();
      }
    } else if (mode === 'edit' && initialData) {
      const updates: Record<string, any> = {
        challengeId: initialData._id,
      };

      if (name !== initialData.name) updates.name = name;
      if (description !== initialData.description) updates.description = description;
      if (createdBy !== initialData.createdBy) updates.createdBy = createdBy;
      if (tag !== initialData.tag) updates.tag = tag;
      if (isLocked !== initialData.isLocked) updates.isLocked = isLocked;

      const parsedPts = parseInt(points, 10);
      if (!isNaN(parsedPts) && parsedPts !== initialData.points) updates.points = parsedPts;

      const parsedDur = parseInt(durationMinutes, 10) * 60;
      if (!isNaN(parsedDur) && parsedDur !== initialData.durationLimit) {
        updates.durationLimit = parsedDur;
      }

      if ((youtubeUrl.trim() || undefined) !== initialData.youtubeUrl) {
        updates.youtubeUrl = youtubeUrl.trim() || undefined;
      }

      if (coverMediaKey !== String(initialData.coverImage)) {
        updates.coverImage = coverMediaKey as Id<'_storage'>;
        updates.oldCoverImage = initialData.coverImage;
      }

      if (videoMediaKey !== String(initialData.instructionalVideo)) {
        updates.instructionalVideo = videoMediaKey as Id<'_storage'>;
        updates.oldInstructionalVideo = initialData.instructionalVideo;
        updates.videoDuration = videoDuration;
      }

      if (!hasEndDate && initialData.endDate) {
        updates.removeEndDate = true;
      } else if (endDateStr !== initialData.endDate) {
        updates.endDate = endDateStr;
      }

      const [err, response] = await CatchPromise(updateChallenge(updates as any));

      if (err) {
        setError(getErrorMessage(err));
        setIsLoading(false);
        return;
      }

      if (response) {
        const updatedChallengeId = response.challengeId ?? initialData._id;

        // Switch ON: make this the only active daily challenge
        if (setAsTodayChallenge) {
          const [dailyErr] = await CatchPromise(
            setTodayDailyChallenge({
              challengeId: updatedChallengeId,
              shortDescription: shortDescription.trim(),
              dailyChallengeType: dailyChallengeType,
            })
          );

          if (dailyErr) {
            setError(getErrorMessage(dailyErr));
            setIsLoading(false);
            return;
          }
        }

        // Switch OFF: close this daily challenge
        if (initialData.isDailyChallenge && !setAsTodayChallenge) {
          const [closeErr] = await CatchPromise(
            closeTodayDailyChallenge({
              challengeId: updatedChallengeId,
            })
          );

          if (closeErr) {
            setError(getErrorMessage(closeErr));
            setIsLoading(false);
            return;
          }
        }

        onSuccess();
      }
    }

    setIsLoading(false);
  };

  const isUploading = coverUploading || videoUploading || coverMediaLoading || videoMediaLoading;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 50}
      className="flex-1">
      <ScrollView
        ref={scrollViewRef}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 250 }}
        className="flex-1">
        <View className="flex-1 justify-start px-6">
          {/* Name */}
          <View className="mb-4">
            <Text className="mb-2 text-xl font-bold text-primary-500">Challenge Name</Text>
            <Input size="xl" variant="rounded" isInvalid={!!error}>
              <InputField
                placeholder="Enter challenge name"
                value={name}
                onChangeText={(text) => {
                  setError(null);
                  setName(text);
                }}
              />
            </Input>
          </View>

          {/* Description */}
          <View className="mb-4">
            <Text className="mb-2 text-xl font-bold text-primary-500">Description</Text>
            <Textarea size="xl" isInvalid={!!error} className="rounded-lg">
              <TextareaInput
                placeholder="Challenge overview and how-tos"
                multiline
                value={description}
                onChangeText={(text) => {
                  setError(null);
                  setDescription(text);
                }}
              />
            </Textarea>
          </View>

          {/* Created By */}
          <View className="mb-4">
            <Text className="mb-2 text-xl font-bold text-primary-500">Created By</Text>
            <Input size="xl" variant="rounded">
              <InputField
                placeholder="e.g. Coach Sarah"
                value={createdBy}
                onChangeText={(text) => {
                  setError(null);
                  setCreatedBy(text);
                }}
              />
            </Input>
          </View>

          {/* Cover Image */}
          <View className="mb-4">
            <Text className="mb-2 text-xl font-bold text-primary-500">Cover Image</Text>
            {coverMediaLoading ? (
              <View className="flex h-[50px] w-full items-center justify-center">
                <ActivityIndicator />
              </View>
            ) : (
              <View className="w-full">
                {coverMediaUri ? (
                  <View className="relative">
                    {coverUploading && (
                      <View className="absolute z-50 flex h-full w-full items-center justify-center">
                        <Progress.Circle
                          progress={coverUploadProgress}
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
                    <Image
                      source={{ uri: coverMediaUri }}
                      style={{
                        width: '100%',
                        height: undefined,
                        aspectRatio: 16 / 9,
                        borderRadius: 10,
                      }}
                      blurRadius={coverUploading ? 5 : 0}
                    />
                    {!coverUploading && (
                      <TouchableOpacity
                        onPress={resetCoverImage}
                        className="absolute right-0 top-0 m-2 rounded-full bg-[rgba(0,0,0,0.8)] p-1">
                        <X color="#fff" size={18} />
                      </TouchableOpacity>
                    )}
                  </View>
                ) : (
                  <TouchableOpacity
                    className="flex-row items-center gap-x-2 rounded-lg border border-gray-200 p-4"
                    onPress={selectCoverImage}>
                    <ImageSquare size={32} weight="duotone" color={colors.primary} />
                    <Text className="font-semibold text-gray-500">Upload cover image</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>

          {/* Instructional Video */}
          <View className="mb-4">
            <Text className="mb-2 text-xl font-bold text-primary-500">Instructional Video</Text>
            <Text className="mb-2 text-sm text-gray-500">Max 5 minutes</Text>
            {videoMediaLoading ? (
              <View className="flex h-[50px] w-full items-center justify-center">
                <ActivityIndicator />
              </View>
            ) : (
              <View className="w-full">
                {videoMediaUri || (mode === 'edit' && videoMediaKey) ? (
                  <View className="relative">
                    {videoUploading && (
                      <View className="absolute z-50 flex h-full w-full items-center justify-center">
                        <Progress.Circle
                          progress={videoUploadProgress}
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
                    <View className="items-center justify-center rounded-lg bg-gray-100 p-8">
                      <VideoCamera size={48} weight="duotone" color={colors.primary} />
                      <Text className="mt-2 font-semibold text-gray-600">
                        {videoUploading ? 'Uploading...' : 'Video uploaded'}
                      </Text>
                    </View>
                    {!videoUploading && (
                      <TouchableOpacity
                        onPress={resetVideo}
                        className="absolute right-0 top-0 m-2 rounded-full bg-[rgba(0,0,0,0.8)] p-1">
                        <X color="#fff" size={18} />
                      </TouchableOpacity>
                    )}
                  </View>
                ) : (
                  <TouchableOpacity
                    className="flex-row items-center gap-x-2 rounded-lg border border-gray-200 p-4"
                    onPress={selectVideo}>
                    <VideoCamera size={32} weight="duotone" color={colors.primary} />
                    <Text className="font-semibold text-gray-500">Upload instructional video</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>

          {/* YouTube Link */}
          <View className="mb-4">
            <Text className="mb-2 text-xl font-bold text-primary-500">YouTube Link (Optional)</Text>
            <Input size="xl" variant="rounded">
              <InputField
                placeholder="https://youtube.com/..."
                value={youtubeUrl}
                onChangeText={(text) => {
                  setError(null);
                  setYoutubeUrl(text);
                }}
                autoCapitalize="none"
                keyboardType="url"
              />
            </Input>
          </View>

          {/* Points */}
          <View className="mb-4">
            <Text className="mb-2 text-xl font-bold text-primary-500">Points (1-50)</Text>
            <Input size="xl" variant="rounded">
              <InputField
                placeholder="5"
                value={points}
                onChangeText={(text) => {
                  setError(null);
                  setPoints(text.replace(/[^0-9]/g, ''));
                }}
                keyboardType="number-pad"
              />
            </Input>
          </View>

          {/* Duration */}
          <View className="mb-4">
            <Text className="mb-2 text-xl font-bold text-primary-500">
              Duration Limit (minutes)
            </Text>
            <Text className="mb-2 text-sm text-gray-500">Max 5 minutes</Text>
            <Input size="xl" variant="rounded">
              <InputField
                placeholder="5"
                value={durationMinutes}
                onChangeText={(text) => {
                  setError(null);
                  setDurationMinutes(text.replace(/[^0-9]/g, ''));
                }}
                keyboardType="number-pad"
              />
            </Input>
          </View>

          {/* Tag */}
          <View className="mb-4">
            <Text className="mb-2 text-xl font-bold text-primary-500">Tag</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View className="flex-row gap-x-2">
                {CHALLENGE_TAGS.map((t) => (
                  <TouchableOpacity
                    key={t}
                    onPress={() => {
                      setError(null);
                      setTag(t);
                    }}
                    className={`rounded-full border px-4 py-2 ${
                      tag === t ? 'border-primary-500 bg-primary-500' : 'border-gray-300 bg-white'
                    }`}>
                    <Text
                      className={`text-sm font-semibold ${
                        tag === t ? 'text-white' : 'text-gray-600'
                      }`}>
                      {t}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>

          {/* Lock Toggle */}
          <View className="mb-4 flex-row items-center justify-between">
            <Text className="text-xl font-bold text-primary-500">Lock for premium users</Text>
            <Switch value={isLocked} onValueChange={setIsLocked} />
          </View>

          {/* End Date */}
          <View className="mb-4">
            <View className="mb-2 flex-row items-center justify-between">
              <Text className="text-xl font-bold text-primary-500">End Date (Optional)</Text>
              <Switch
                value={hasEndDate}
                onValueChange={(val) => {
                  setHasEndDate(val);
                  if (!val) {
                    setEndDate(null);
                  }
                }}
              />
            </View>
            {hasEndDate && (
              <View>
                {Platform.OS === 'ios' ? (
                  <DateTimePicker
                    testID="endDatePicker"
                    value={endDate ?? new Date()}
                    mode="date"
                    onChange={handleDateChange}
                    display="spinner"
                    minimumDate={new Date()}
                  />
                ) : (
                  <TouchableOpacity
                    onPress={openAndroidDatePicker}
                    className="rounded-lg border border-gray-200 p-4">
                    <Text className="text-base text-gray-700">
                      {endDate ? format(endDate, 'MMM dd, yyyy') : 'Select end date'}
                    </Text>
                  </TouchableOpacity>
                )}
                {endDate && (
                  <TouchableOpacity onPress={() => setEndDate(null)} className="mt-2">
                    <Text className="text-sm text-red-500">Clear date</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>

          <View className="mb-4 flex-row items-center justify-between">
            <Text className="text-xl font-bold text-primary-500">
              Set as Today&apos;s Daily Challenge
            </Text>

            <Switch value={setAsTodayChallenge} onValueChange={setSetAsTodayChallenge} />
          </View>

          {setAsTodayChallenge && (
            <View className="mb-4">
              <Text className="mb-2 text-xl font-bold text-primary-500">Short Description</Text>

              <Input size="xl" variant="rounded">
                <InputField
                  placeholder="e.g. Complete 20 reps"
                  value={shortDescription}
                  onChangeText={(text) => {
                    setError(null);
                    setShortDescription(text);
                  }}
                />
              </Input>

              <Text className="mt-1 text-sm text-gray-500">
                This will show on the Daily Challenge card.
              </Text>

              <View className="mb-4 mt-4">
                <Text className="mb-2 text-xl font-bold text-primary-500">
                  Daily Challenge Type
                </Text>

                <View className="flex-row gap-x-3">
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => setDailyChallengeType('challenge')}
                    className={`flex-1 rounded-2xl border px-4 py-4 ${
                      dailyChallengeType === 'challenge'
                        ? 'border-primary-500 bg-primary-500'
                        : 'border-gray-300 bg-white'
                    }`}>
                    <Text
                      className={`text-center font-bold ${
                        dailyChallengeType === 'challenge' ? 'text-white' : 'text-gray-700'
                      }`}>
                      Challenge
                    </Text>

                    <Text
                      className={`mt-1 text-center text-xs ${
                        dailyChallengeType === 'challenge' ? 'text-white' : 'text-gray-500'
                      }`}>
                     Side by Side video
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => setDailyChallengeType('check_in')}
                    className={`flex-1 rounded-2xl border px-4 py-4 ${
                      dailyChallengeType === 'check_in'
                        ? 'border-primary-500 bg-primary-500'
                        : 'border-gray-300 bg-white'
                    }`}>
                    <Text
                      className={`text-center font-bold ${
                        dailyChallengeType === 'check_in' ? 'text-white' : 'text-gray-700'
                      }`}>
                      Check In
                    </Text>

                    <Text
                      className={`mt-1 text-center text-xs ${
                        dailyChallengeType === 'check_in' ? 'text-white' : 'text-gray-500'
                      }`}>
                     Single video only
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          <ErrorMessage error={error} className="mb-4" />

          {/* Submit Button */}
          <View className="mb-8">
            <LoadingButton
              variant="solid"
              size="xl"
              action="primary"
              className="h-16 w-full rounded-3xl"
              onPress={handleSubmit}
              disabled={isLoading || isUploading}
              loading={isLoading}>
              <ButtonText>
                {mode === 'create'
                  ? 'Publish Challenge'
                  : initialData?.isPublished
                    ? 'Update Challenge'
                    : 'Publish Challenge'}
              </ButtonText>
            </LoadingButton>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
