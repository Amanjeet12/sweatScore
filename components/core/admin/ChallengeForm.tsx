import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useMutation, useQuery } from 'convex/react';
import { format, isBefore, startOfDay } from 'date-fns';
import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { ImageSquare, VideoCamera, X } from 'phosphor-react-native';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
  CHALLENGE_DURATION_DEFAULT,
  CHALLENGE_DURATION_MAX,
  CHALLENGE_POINTS_DEFAULT,
  CHALLENGE_POINTS_MAX,
  CHALLENGE_POINTS_MIN,
  CHALLENGE_TAGS,
} from '~/convex/challenges';
import { CatchPromise } from '~/utils/catch-promise';
import { colors } from '~/utils/constants';
import { getErrorMessage, getZodErrorMessage } from '~/utils/error-message';

type ChallengeType = 'challenge' | 'check_in';

type ScheduleAction = 'current' | 'next' | null;

const challengeSchema = z.object({
  name: z.string().min(1, 'Name is required'),

  description: z.string().min(1, 'Challenge description is required'),

  checkInDescription: z.string().min(1, 'Check-in description is required'),

  type: z.enum(['challenge', 'check_in']),

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

export default function ChallengeForm({ mode, initialData, onSuccess }: ChallengeFormProps) {
  const [name, setName] = useState(initialData?.name ?? '');

  const [description, setDescription] = useState(initialData?.description ?? '');

  const [checkInDescription, setCheckInDescription] = useState(
    initialData?.checkInDescription ?? initialData?.description ?? ''
  );

  const [challengeType, setChallengeType] = useState<ChallengeType>(
    initialData?.type ?? 'challenge'
  );

  const [createdBy, setCreatedBy] = useState(initialData?.createdBy ?? '');

  const [youtubeUrl, setYoutubeUrl] = useState(initialData?.youtubeUrl ?? '');

  const [points, setPoints] = useState(String(initialData?.points ?? CHALLENGE_POINTS_DEFAULT));

  const [durationMinutes, setDurationMinutes] = useState(
    String(Math.round((initialData?.durationLimit ?? CHALLENGE_DURATION_DEFAULT) / 60))
  );

  const [tag, setTag] = useState(initialData?.tag ?? '');

  const [isLocked, setIsLocked] = useState(initialData?.isLocked ?? false);

  const [hasEndDate, setHasEndDate] = useState(Boolean(initialData?.endDate));

  const [endDate, setEndDate] = useState<Date | null>(
    initialData?.endDate ? new Date(`${initialData.endDate}T00:00:00`) : null
  );

  /*
   * Daily scheduling state.
   *
   * Recording type is not stored here.
   * It is a permanent challenge field.
   */
  const [shortDescription, setShortDescription] = useState(initialData?.shortDescription ?? '');

  const [scheduleAction, setScheduleAction] = useState<ScheduleAction>(null);

  const [isRemovingSchedule, setIsRemovingSchedule] = useState(false);

  const [scheduleMessage, setScheduleMessage] = useState<string | null>(null);

  /*
   * Cover image state
   */
  const [coverMediaUri, setCoverMediaUri] = useState<string | undefined>(
    initialData?.coverImageUrl ?? undefined
  );

  const [coverMediaKey, setCoverMediaKey] = useState<string | undefined>(
    initialData ? String(initialData.coverImage) : undefined
  );

  const [coverUploading, setCoverUploading] = useState(false);

  const [coverUploadProgress, setCoverUploadProgress] = useState(0);

  const [coverMediaLoading, setCoverMediaLoading] = useState(false);

  /*
   * Instructional video state
   */
  const [videoMediaUri, setVideoMediaUri] = useState<string | undefined>();

  const [videoMediaKey, setVideoMediaKey] = useState<string | undefined>(
    initialData ? String(initialData.instructionalVideo) : undefined
  );

  const [videoDuration, setVideoDuration] = useState<number | undefined>(
    initialData?.videoDuration
  );

  const [videoUploading, setVideoUploading] = useState(false);

  const [videoUploadProgress, setVideoUploadProgress] = useState(0);

  const [videoMediaLoading, setVideoMediaLoading] = useState(false);

  /*
   * General state
   */
  const [isLoading, setIsLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const [keyboardVisible, setKeyboardVisible] = useState(false);

  const scrollViewRef = useRef<ScrollView>(null);

  /*
   * Convex queries and mutations
   */
  const dailySchedule = useQuery(api.admin.getDailyChallengeSchedule, {});

  const generateUploadUrl = useMutation(api.upload.generateUploadUrl);

  const createChallenge = useMutation(api.admin.createChallenge);

  const updateChallenge = useMutation(api.admin.updateChallenge);

  const setCurrentDailyChallenge = useMutation(api.admin.setCurrentDailyChallenge);

  const setNextDailyChallenge = useMutation(api.admin.setNextDailyChallenge);

  const removeDailyChallengeSchedule = useMutation(api.admin.removeDailyChallengeSchedule);

  const challengeId = initialData?._id;

  const isCurrentChallenge = Boolean(challengeId) && dailySchedule?.current?._id === challengeId;

  const isNextChallenge = Boolean(challengeId) && dailySchedule?.next?._id === challengeId;

  const hasDailySchedule = initialData?.isDailyChallenge === true;

  const isExpiredSchedule = hasDailySchedule && !isCurrentChallenge && !isNextChallenge;

  const nextChallengeStartText =
    isNextChallenge && dailySchedule?.next?.dailyStartAt
      ? new Date(dailySchedule.next.dailyStartAt).toLocaleString()
      : null;

  const isScheduling = scheduleAction !== null;

  const isUploading = coverUploading || videoUploading || coverMediaLoading || videoMediaLoading;

  useEffect(() => {
    const showListener = Keyboard.addListener('keyboardDidShow', () => {
      setKeyboardVisible(true);
    });

    const hideListener = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardVisible(false);
    });

    return () => {
      showListener.remove();
      hideListener.remove();
    };
  }, []);

  useEffect(() => {
    if (!keyboardVisible || !scrollViewRef.current) {
      return undefined;
    }

    const timeout = setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({
        animated: true,
      });
    }, 100);

    return () => {
      clearTimeout(timeout);
    };
  }, [keyboardVisible]);

  const clearMessages = () => {
    setError(null);
    setScheduleMessage(null);
  };

  const selectCoverImage = async () => {
    Keyboard.dismiss();
    clearMessages();
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

    if (result.canceled) {
      setCoverMediaLoading(false);
      setCoverUploading(false);
      return;
    }

    const localMedia = result.assets[0];

    setCoverMediaUri(localMedia.uri);
    setCoverMediaLoading(false);
    setCoverUploading(true);

    try {
      const maxWidth = 1080;

      const mediaWidth = localMedia.width ?? maxWidth;

      const mediaHeight = localMedia.height ?? maxWidth;

      const scale = Math.min(1, maxWidth / mediaWidth);

      const resizedImage = await ImageManipulator.manipulateAsync(
        localMedia.uri,
        [
          {
            resize: {
              width: Math.round(mediaWidth * scale),
              height: Math.round(mediaHeight * scale),
            },
          },
        ],
        {
          compress: 0.7,
        }
      );

      setCoverMediaUri(resizedImage.uri);

      const [uploadUrlError, uploadUrl] = await CatchPromise(generateUploadUrl());

      if (uploadUrlError) {
        setError(getErrorMessage(uploadUrlError));
        return;
      }

      if (!uploadUrl) {
        setError('Unable to generate upload URL');
        return;
      }

      setCoverMediaKey(undefined);

      const uploadTask = FileSystem.createUploadTask(
        uploadUrl,
        resizedImage.uri,
        {
          fieldName: 'file',
          httpMethod: 'POST',
          uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
          headers: {
            'Content-Type': localMedia.mimeType ?? 'image/jpeg',
          },
        },
        ({ totalBytesSent, totalBytesExpectedToSend }) => {
          const progress = parseFloat(
            (totalBytesSent / (totalBytesExpectedToSend || 1)).toFixed(2)
          );

          setCoverUploadProgress(progress);
        }
      );

      const uploadResult = await uploadTask.uploadAsync();

      if (!uploadResult?.body) {
        setError('Cover image upload failed');
        return;
      }

      const parsedResponse = JSON.parse(uploadResult.body) as {
        storageId?: string;
      };

      if (!parsedResponse.storageId) {
        setError('Storage ID was not returned');
        return;
      }

      setCoverMediaKey(parsedResponse.storageId);
    } catch (uploadError) {
      setError(getErrorMessage(uploadError));
    } finally {
      setCoverUploading(false);
      setCoverMediaLoading(false);
    }
  };

  const resetCoverImage = () => {
    clearMessages();
    setCoverMediaUri(undefined);
    setCoverMediaKey(undefined);
    setCoverUploadProgress(0);
  };

  const selectVideo = async () => {
    Keyboard.dismiss();
    clearMessages();
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

    if (result.canceled) {
      setVideoMediaLoading(false);
      setVideoUploading(false);
      return;
    }

    const localMedia = result.assets[0];

    if (localMedia.duration && localMedia.duration > 300000) {
      setError('Video must be 5 minutes or less');
      setVideoMediaLoading(false);
      return;
    }

    setVideoMediaUri(localMedia.uri);

    if (localMedia.duration) {
      setVideoDuration(Math.round(localMedia.duration / 1000));
    }

    setVideoMediaLoading(false);
    setVideoUploading(true);

    try {
      const [uploadUrlError, uploadUrl] = await CatchPromise(generateUploadUrl());

      if (uploadUrlError) {
        setError(getErrorMessage(uploadUrlError));
        return;
      }

      if (!uploadUrl) {
        setError('Unable to generate upload URL');
        return;
      }

      setVideoMediaKey(undefined);

      const uploadTask = FileSystem.createUploadTask(
        uploadUrl,
        localMedia.uri,
        {
          fieldName: 'file',
          httpMethod: 'POST',
          uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
          headers: {
            'Content-Type': localMedia.mimeType ?? 'video/mp4',
          },
        },
        ({ totalBytesSent, totalBytesExpectedToSend }) => {
          const progress = parseFloat(
            (totalBytesSent / (totalBytesExpectedToSend || 1)).toFixed(2)
          );

          setVideoUploadProgress(progress);
        }
      );

      const uploadResult = await uploadTask.uploadAsync();

      if (!uploadResult?.body) {
        setError('Video upload failed');
        return;
      }

      const parsedResponse = JSON.parse(uploadResult.body) as {
        storageId?: string;
      };

      if (!parsedResponse.storageId) {
        setError('Storage ID was not returned');
        return;
      }

      setVideoMediaKey(parsedResponse.storageId);
    } catch (uploadError) {
      setError(getErrorMessage(uploadError));
    } finally {
      setVideoUploading(false);
      setVideoMediaLoading(false);
    }
  };

  const resetVideo = () => {
    clearMessages();
    setVideoMediaUri(undefined);
    setVideoMediaKey(undefined);
    setVideoDuration(undefined);
    setVideoUploadProgress(0);
  };

  const handleDateChange = (_event: unknown, selectedDate?: Date) => {
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

  const validateScheduleFields = () => {
    if (!initialData) {
      setError('Create the challenge before scheduling it');
      return false;
    }

    if (!initialData.isPublished) {
      setError('Publish the challenge before scheduling it');
      return false;
    }

    if (!shortDescription.trim()) {
      setError('Short description is required');
      return false;
    }

    return true;
  };

  const handleSetCurrentDay = async () => {
    Keyboard.dismiss();
    clearMessages();

    if (!validateScheduleFields()) {
      return;
    }

    if (!initialData) {
      return;
    }

    setScheduleAction('current');

    const [scheduleError, response] = await CatchPromise(
      setCurrentDailyChallenge({
        challengeId: initialData._id,
        shortDescription: shortDescription.trim(),
      })
    );

    setScheduleAction(null);

    if (scheduleError) {
      setError(getErrorMessage(scheduleError));
      return;
    }

    if (response) {
      setScheduleMessage('Challenge is now active as the current-day challenge.');
    }
  };

  const handleSetNextDay = async () => {
    Keyboard.dismiss();
    clearMessages();

    if (!validateScheduleFields()) {
      return;
    }

    if (!initialData) {
      return;
    }

    if (!dailySchedule?.current) {
      setError('Set a current-day challenge first');
      return;
    }

    if (isCurrentChallenge) {
      setError('The current challenge cannot also be the next challenge');
      return;
    }

    setScheduleAction('next');

    const [scheduleError, response] = await CatchPromise(
      setNextDailyChallenge({
        challengeId: initialData._id,
        shortDescription: shortDescription.trim(),
      })
    );

    setScheduleAction(null);

    if (scheduleError) {
      setError(getErrorMessage(scheduleError));
      return;
    }

    if (response) {
      const startsAt = new Date(response.startsAt).toLocaleString();

      setScheduleMessage(`Challenge scheduled for ${startsAt}.`);
    }
  };

  const removeSchedule = async () => {
    if (!initialData) {
      return;
    }

    clearMessages();
    setIsRemovingSchedule(true);

    const [removeError] = await CatchPromise(
      removeDailyChallengeSchedule({
        challengeId: initialData._id,
      })
    );

    setIsRemovingSchedule(false);

    if (removeError) {
      setError(getErrorMessage(removeError));
      return;
    }

    setShortDescription('');

    setScheduleMessage('Challenge removed from the daily schedule.');
  };

  const handleRemoveDailySchedule = () => {
    if (!initialData) {
      return;
    }

    Alert.alert(
      'Remove Daily Schedule',
      isCurrentChallenge
        ? 'This will remove the currently active daily challenge. Continue?'
        : 'Remove this challenge from the daily schedule?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: removeSchedule,
        },
      ]
    );
  };

  const handleSubmit = async () => {
    Keyboard.dismiss();
    clearMessages();
    setIsLoading(true);

    try {
      if (!coverMediaKey) {
        setError('Please upload a cover image');
        return;
      }

      if (!videoMediaKey) {
        setError('Please upload an instructional video');
        return;
      }

      const parsedPoints = parseInt(points, 10);

      const parsedDuration = parseInt(durationMinutes, 10) * 60;

      const result = challengeSchema.safeParse({
        name: name.trim(),

        description: description.trim(),

        checkInDescription: checkInDescription.trim(),

        type: challengeType,

        createdBy: createdBy.trim(),

        tag,

        points: Number.isNaN(parsedPoints) ? 0 : parsedPoints,

        durationLimit: Number.isNaN(parsedDuration) ? 0 : parsedDuration,

        youtubeUrl: youtubeUrl.trim() || undefined,
      });

      if (!result.success) {
        setError(getZodErrorMessage(result.error));
        return;
      }

      if (hasEndDate && endDate && isBefore(startOfDay(endDate), startOfDay(new Date()))) {
        setError('End date must be in the future');
        return;
      }

      const endDateString = hasEndDate && endDate ? format(endDate, 'yyyy-MM-dd') : undefined;

      if (mode === 'create') {
        const [createError, response] = await CatchPromise(
          createChallenge({
            name: result.data.name,

            description: result.data.description,

            checkInDescription: result.data.checkInDescription,

            type: result.data.type,

            createdBy: result.data.createdBy,

            coverImage: coverMediaKey as Id<'_storage'>,

            instructionalVideo: videoMediaKey as Id<'_storage'>,

            videoDuration,

            youtubeUrl: result.data.youtubeUrl || undefined,

            points: result.data.points,

            durationLimit: result.data.durationLimit,

            tag: result.data.tag,

            isLocked,

            endDate: endDateString,
          })
        );

        if (createError) {
          setError(getErrorMessage(createError));
          return;
        }

        if (response) {
          onSuccess();
        }

        return;
      }

      if (mode === 'edit' && initialData) {
        const updates: Record<string, unknown> = {
          challengeId: initialData._id,
        };

        if (result.data.name !== initialData.name) {
          updates.name = result.data.name;
        }

        if (result.data.description !== initialData.description) {
          updates.description = result.data.description;
        }

        const existingCheckInDescription = initialData.checkInDescription ?? '';

        if (result.data.checkInDescription !== existingCheckInDescription) {
          updates.checkInDescription = result.data.checkInDescription;
        }

        const existingType = initialData.type ?? 'challenge';

        if (result.data.type !== existingType) {
          updates.type = result.data.type;
        }

        if (result.data.createdBy !== initialData.createdBy) {
          updates.createdBy = result.data.createdBy;
        }

        if (result.data.tag !== initialData.tag) {
          updates.tag = result.data.tag;
        }

        if (isLocked !== initialData.isLocked) {
          updates.isLocked = isLocked;
        }

        if (result.data.points !== initialData.points) {
          updates.points = result.data.points;
        }

        if (result.data.durationLimit !== initialData.durationLimit) {
          updates.durationLimit = result.data.durationLimit;
        }

        const normalizedYoutubeUrl = result.data.youtubeUrl || undefined;

        if (normalizedYoutubeUrl !== initialData.youtubeUrl) {
          updates.youtubeUrl = normalizedYoutubeUrl;
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
        } else if (endDateString !== initialData.endDate) {
          updates.endDate = endDateString;
        }

        const [updateError, response] = await CatchPromise(updateChallenge(updates as any));

        if (updateError) {
          setError(getErrorMessage(updateError));
          return;
        }

        if (response) {
          onSuccess();
        }
      }
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 50}
      className="flex-1">
      <ScrollView
        ref={scrollViewRef}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          flexGrow: 1,
          paddingBottom: 250,
        }}
        className="flex-1">
        <View className="flex-1 justify-start px-6">
          <View className="mb-4">
            <Text className="mb-2 text-xl font-bold text-primary-500">Challenge Name</Text>

            <Input size="xl" variant="rounded" isInvalid={Boolean(error)}>
              <InputField
                placeholder="Enter challenge name"
                value={name}
                onChangeText={(text) => {
                  clearMessages();
                  setName(text);
                }}
              />
            </Input>
          </View>

          <View className="mb-4">
            <Text className="mb-2 text-xl font-bold text-primary-500">Challenge Description</Text>

            <Text className="mb-2 text-sm text-gray-500">
              Used when the recording type is Challenge.
            </Text>

            <Textarea size="xl" isInvalid={Boolean(error)} className="rounded-lg">
              <TextareaInput
                placeholder="Challenge overview and instructions"
                multiline
                value={description}
                onChangeText={(text) => {
                  clearMessages();
                  setDescription(text);
                }}
              />
            </Textarea>
          </View>

          <View className="mb-4">
            <Text className="mb-2 text-xl font-bold text-primary-500">Check-In Description</Text>

            <Text className="mb-2 text-sm text-gray-500">
              Used when the recording type is Check-In.
            </Text>

            <Textarea size="xl" isInvalid={Boolean(error)} className="rounded-lg">
              <TextareaInput
                placeholder="Check-in overview and instructions"
                multiline
                value={checkInDescription}
                onChangeText={(text) => {
                  clearMessages();

                  setCheckInDescription(text);
                }}
              />
            </Textarea>
          </View>

          <View className="mb-5">
            <Text className="mb-2 text-xl font-bold text-primary-500">Recording Type</Text>

            <Text className="mb-3 text-sm text-gray-500">
              This permanently controls how user videos are processed.
            </Text>

            <View className="flex-row gap-x-3">
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => {
                  clearMessages();

                  setChallengeType('check_in');
                }}
                className={`flex-1 rounded-2xl border px-3 py-4 ${
                  challengeType === 'check_in'
                    ? 'border-primary-500 bg-primary-500'
                    : 'border-gray-300 bg-white'
                }`}>
                <Text
                  className={`text-center font-bold ${
                    challengeType === 'check_in' ? 'text-white' : 'text-gray-700'
                  }`}>
                  Check-In
                </Text>

                <Text
                  className={`mt-1 text-center text-xs ${
                    challengeType === 'check_in' ? 'text-white' : 'text-gray-500'
                  }`}>
                  Normal single video
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => {
                  clearMessages();

                  setChallengeType('challenge');
                }}
                className={`flex-1 rounded-2xl border px-3 py-4 ${
                  challengeType === 'challenge'
                    ? 'border-primary-500 bg-primary-500'
                    : 'border-gray-300 bg-white'
                }`}>
                <Text
                  className={`text-center font-bold ${
                    challengeType === 'challenge' ? 'text-white' : 'text-gray-700'
                  }`}>
                  Challenge
                </Text>

                <Text
                  className={`mt-1 text-center text-xs ${
                    challengeType === 'challenge' ? 'text-white' : 'text-gray-500'
                  }`}>
                  Side-by-side comparison
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View className="mb-4">
            <Text className="mb-2 text-xl font-bold text-primary-500">Created By</Text>

            <Input size="xl" variant="rounded">
              <InputField
                placeholder="e.g. Coach Sarah"
                value={createdBy}
                onChangeText={(text) => {
                  clearMessages();
                  setCreatedBy(text);
                }}
              />
            </Input>
          </View>

          <View className="mb-4">
            <Text className="mb-2 text-xl font-bold text-primary-500">Cover Image</Text>

            {coverMediaLoading ? (
              <View className="h-[50px] w-full items-center justify-center">
                <ActivityIndicator />
              </View>
            ) : (
              <View className="w-full">
                {coverMediaUri ? (
                  <View className="relative">
                    {coverUploading && (
                      <View className="absolute z-50 h-full w-full items-center justify-center">
                        <Progress.Circle
                          progress={coverUploadProgress}
                          size={50}
                          thickness={5}
                          showsText
                          textStyle={{
                            color: 'white',
                            fontWeight: 'bold',
                          }}
                          borderColor={colors.primary}
                          color={colors.primary}
                          borderWidth={0}
                        />
                      </View>
                    )}

                    <Image
                      source={{
                        uri: coverMediaUri,
                      }}
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

          <View className="mb-4">
            <Text className="mb-2 text-xl font-bold text-primary-500">Instructional Video</Text>

            <Text className="mb-2 text-sm text-gray-500">Max 5 minutes</Text>

            {videoMediaLoading ? (
              <View className="h-[50px] w-full items-center justify-center">
                <ActivityIndicator />
              </View>
            ) : (
              <View className="w-full">
                {videoMediaUri || (mode === 'edit' && videoMediaKey) ? (
                  <View className="relative">
                    {videoUploading && (
                      <View className="absolute z-50 h-full w-full items-center justify-center">
                        <Progress.Circle
                          progress={videoUploadProgress}
                          size={50}
                          thickness={5}
                          showsText
                          textStyle={{
                            color: 'white',
                            fontWeight: 'bold',
                          }}
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

          <View className="mb-4">
            <Text className="mb-2 text-xl font-bold text-primary-500">Resource Link (Optional)</Text>

            <Input size="xl" variant="rounded">
              <InputField
                placeholder="https://youtube.com/..."
                value={youtubeUrl}
                onChangeText={(text) => {
                  clearMessages();
                  setYoutubeUrl(text);
                }}
                autoCapitalize="none"
                keyboardType="url"
              />
            </Input>
          </View>

          <View className="mb-4">
            <Text className="mb-2 text-xl font-bold text-primary-500">Points (1-50)</Text>

            <Input size="xl" variant="rounded">
              <InputField
                placeholder="5"
                value={points}
                onChangeText={(text) => {
                  clearMessages();

                  setPoints(text.replace(/[^0-9]/g, ''));
                }}
                keyboardType="number-pad"
              />
            </Input>
          </View>

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
                  clearMessages();

                  setDurationMinutes(text.replace(/[^0-9]/g, ''));
                }}
                keyboardType="number-pad"
              />
            </Input>
          </View>

          <View className="mb-4">
            <Text className="mb-2 text-xl font-bold text-primary-500">Tag</Text>

            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View className="flex-row gap-x-2">
                {CHALLENGE_TAGS.map((challengeTag) => (
                  <TouchableOpacity
                    key={challengeTag}
                    onPress={() => {
                      clearMessages();

                      setTag(challengeTag);
                    }}
                    className={`rounded-full border px-4 py-2 ${
                      tag === challengeTag
                        ? 'border-primary-500 bg-primary-500'
                        : 'border-gray-300 bg-white'
                    }`}>
                    <Text
                      className={`text-sm font-semibold ${
                        tag === challengeTag ? 'text-white' : 'text-gray-600'
                      }`}>
                      {challengeTag}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>

          <View className="mb-4 flex-row items-center justify-between">
            <Text className="text-xl font-bold text-primary-500">Lock for premium users</Text>

            <Switch value={isLocked} onValueChange={setIsLocked} />
          </View>

          <View className="mb-4">
            <View className="mb-2 flex-row items-center justify-between">
              <Text className="text-xl font-bold text-primary-500">End Date (Optional)</Text>

              <Switch
                value={hasEndDate}
                onValueChange={(value) => {
                  clearMessages();
                  setHasEndDate(value);

                  if (!value) {
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

          {mode === 'edit' && initialData && (
            <View className="mb-6 rounded-3xl border border-gray-200 bg-gray-50 p-4">
              <Text className="text-xl font-bold text-primary-500">Daily Check In Schedule</Text>

              <View className="mt-4 rounded-2xl bg-white px-4 py-3">
                <Text className="text-xs font-semibold uppercase text-gray-400">
                  Current status
                </Text>

                {dailySchedule === undefined ? (
                  <Text className="mt-1 text-sm text-gray-500">Loading schedule...</Text>
                ) : isCurrentChallenge ? (
                  <>
                    <Text className="mt-1 font-bold text-green-700">Current Day Challenge</Text>

                    {initialData.dailyEndAt && (
                      <Text className="mt-1 text-xs text-gray-500">
                        Ends: {new Date(initialData.dailyEndAt).toLocaleString()}
                      </Text>
                    )}
                  </>
                ) : isNextChallenge ? (
                  <>
                    <Text className="mt-1 font-bold text-blue-700">Next Day Challenge</Text>

                    {nextChallengeStartText && (
                      <Text className="mt-1 text-xs text-gray-500">
                        Starts: {nextChallengeStartText}
                      </Text>
                    )}
                  </>
                ) : isExpiredSchedule ? (
                  <Text className="mt-1 font-bold text-amber-700">Expired Daily Schedule</Text>
                ) : (
                  <Text className="mt-1 text-sm text-gray-600">Not scheduled</Text>
                )}
              </View>

              <View className="mt-4">
                <Text className="mb-2 text-base font-bold text-primary-500">
                  Daily Card Short Description
                </Text>

                <Input size="xl" variant="rounded">
                  <InputField
                    placeholder="Text displayed on the daily dashboard card"
                    value={shortDescription}
                    onChangeText={(text) => {
                      clearMessages();

                      setShortDescription(text);
                    }}
                  />
                </Input>

                <Text className="mt-1 text-xs text-gray-500">
                  This is only used on the scheduled dashboard card.
                </Text>
              </View>

              <View className="mt-5 flex-row gap-x-3">
                <View className="flex-1">
                  <LoadingButton
                    variant={isCurrentChallenge ? 'solid' : 'outline'}
                    size="lg"
                    action="primary"
                    className="h-14 w-full rounded-2xl"
                    onPress={handleSetCurrentDay}
                    loading={scheduleAction === 'current'}
                    disabled={isScheduling || isCurrentChallenge || !initialData.isPublished}>
                    <ButtonText>
                      {isCurrentChallenge ? 'Current Day' : 'Set Today'}
                    </ButtonText>
                  </LoadingButton>
                </View>

                <View className="flex-1">
                  <LoadingButton
                    variant={isNextChallenge ? 'solid' : 'outline'}
                    size="lg"
                    action="secondary"
                    className="h-14 w-full rounded-2xl"
                    onPress={handleSetNextDay}
                    loading={scheduleAction === 'next'}
                    disabled={
                      isScheduling ||
                      isCurrentChallenge ||
                      isNextChallenge ||
                      !dailySchedule?.current ||
                      !initialData.isPublished
                    }>
                    <ButtonText>{isNextChallenge ? 'Next Day' : 'Set Next Day'}</ButtonText>
                  </LoadingButton>
                </View>
              </View>

              {hasDailySchedule && (
                <View className="mt-3">
                  <LoadingButton
                    variant="outline"
                    size="lg"
                    action="negative"
                    className="h-12 w-full rounded-2xl"
                    onPress={handleRemoveDailySchedule}
                    loading={isRemovingSchedule}
                    disabled={isRemovingSchedule || isScheduling}>
                    <ButtonText className="text-red-500">Remove from Daily Schedule</ButtonText>
                  </LoadingButton>
                </View>
              )}
            </View>
          )}

          {scheduleMessage && (
            <View className="mb-4 rounded-2xl bg-green-50 px-4 py-3">
              <Text className="text-sm font-semibold text-green-700">{scheduleMessage}</Text>
            </View>
          )}

          <ErrorMessage error={error} className="mb-4" />

          <View className="mb-8">
            <LoadingButton
              variant="solid"
              size="xl"
              action="primary"
              className="h-16 w-full rounded-3xl"
              onPress={handleSubmit}
              disabled={isLoading || isUploading || isScheduling || isRemovingSchedule}
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
