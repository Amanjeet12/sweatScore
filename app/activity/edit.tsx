import { useConvex, useMutation } from 'convex/react';
import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { ImagePickerAsset } from 'expo-image-picker';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { ImageSquare, X } from 'phosphor-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
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

import { BackButton } from '~/components/core/BackButton';
import { ErrorMessage } from '~/components/core/ErrorMessage';
import { FullLogo } from '~/components/core/Logo';
import SafeAreaView from '~/components/core/SafeAreaView';
import ScreenLoading from '~/components/core/ScreenLoading';
import { ButtonGroup, ButtonText, LoadingButton } from '~/components/ui/button';
import { Input, InputField } from '~/components/ui/input';
import { Text } from '~/components/ui/text';
import { api } from '~/convex/_generated/api';
import { Doc, Id } from '~/convex/_generated/dataModel';
import { CatchPromise } from '~/utils/catch-promise';
import { colors } from '~/utils/constants';
import { getErrorMessage, getZodErrorMessage } from '~/utils/error-message';
import { formatDateToLocaleString } from '~/utils/formatter';
import { urlToImagePickerAsset } from '~/utils/helpers';

export default function EditActivity() {
  const { activityId } = useLocalSearchParams();
  const convex = useConvex();
  const [isLoading, setIsLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [steps, setSteps] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadingMedia, setUploadingMedia] = useState<boolean>(false);
  const [media, setMedia] = useState<ImagePickerAsset | null>(null);
  const [mediaUri, setMediaUri] = useState<string | undefined>(undefined);
  const [mediaLoading, setMediaLoading] = useState<boolean>(false);
  const [mediaKey, setMediaKey] = useState<string | undefined>(undefined);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [manualActivity, setManualActivity] = useState<Doc<'dailyActivities'> | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  const updateHealthDataManually = useMutation(api.activities.updateHealthDataManually);
  const generrateUploadUrl = useMutation(api.upload.generateUploadUrl);
  const deleteManualActivity = useMutation(api.activities.deleteManualActivity);
  const today = useMemo(() => new Date(), []);

  const activitySchema = z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date'),
    steps: z
      .number({ message: 'Invalid steps' })
      .min(0, 'Steps must be greater than 0')
      .nullable()
      .optional(),
  });

  // Add keyboard listeners to track keyboard state
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', () => {
      setKeyboardVisible(true);
    });
    const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardVisible(false);
    });

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  const resetMedia = () => {
    setMedia(null);
    setMediaUri(undefined);
    setMediaKey(undefined);
    setUploadProgress(0);
  };

  const selectImage = async () => {
    // Dismiss keyboard first to ensure full screen visibility
    Keyboard.dismiss();

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

      setMediaLoading(false);
      setUploadingMedia(true);

      const [err, uploadUrl] = await CatchPromise(generrateUploadUrl());

      if (err) {
        setError(getErrorMessage(err));
        return;
      }

      if (uploadUrl) {
        setMediaKey(undefined);

        const uploadTask = FileSystem.createUploadTask(
          uploadUrl,
          localmedia.uri,
          {
            fieldName: 'file',
            httpMethod: 'POST',
            uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
            headers: { 'Content-Type': localmedia.mimeType! },
          },
          ({ totalBytesSent, totalBytesExpectedToSend }) => {
            const progress = parseFloat(
              (totalBytesSent / (totalBytesExpectedToSend || 1)).toFixed(2)
            );
            setUploadProgress(progress);
          }
        );

        const _uploadresult = await uploadTask.uploadAsync();
        setMediaKey(JSON.parse(_uploadresult?.body ?? '{}').storageId);
      }
      setUploadingMedia(false);
    } else {
      setMediaLoading(false);
      setUploadingMedia(false);
    }
  };

  const handleDelete = async () => {
    if (!manualActivity) return;

    setIsLoading(true);
    const [error, response] = await CatchPromise(
      deleteManualActivity({
        activityId: manualActivity?._id,
      })
    );

    if (error) {
      setError(getErrorMessage(error));
    }

    if (response) {
      router.back();
    }

    setIsLoading(false);
  };

  const handleSubmit = async () => {
    if (!manualActivity) return;

    // Dismiss keyboard when submitting
    Keyboard.dismiss();

    setError(null);
    setIsLoading(true);

    if (!steps) {
      setError('Please enter steps');
      setIsLoading(false);
      return;
    }

    const formattedDate = today.toISOString().split('T')[0]; // YYYY-MM-DD
    const stepsNumber = steps ? parseInt(steps) : 0;

    if (stepsNumber <= 0) {
      setError('Steps must be greater than 0');
      setIsLoading(false);
      return;
    }

    if (!mediaKey) {
      setError('Please upload a photo of your activity');
      setIsLoading(false);
      return;
    }

    const result = await activitySchema.safeParse({
      date: formattedDate,
      steps: stepsNumber,
    });

    if (!result.success) {
      setError(getZodErrorMessage(result.error));
      setIsLoading(false);
      return;
    }

    const [error, response] = await CatchPromise(
      updateHealthDataManually({
        activityId: manualActivity?._id as Id<'dailyActivities'>,
        healthData: {
          date: result.data.date,
          steps: result.data.steps ?? undefined,
          storageId: mediaKey as Id<'_storage'>,
        },
      })
    );

    if (error) {
      setError(getErrorMessage(error));
    }

    if (response) {
      router.back();
    }

    setIsLoading(false);
  };

  const getManualActivity = async () => {
    setPageLoading(true);
    const activity = await convex.query(api.activities.getManualActivity, {
      activityId: activityId as Id<'dailyActivities'>,
    });

    if (activity) {
      setManualActivity(activity);
      setSteps(activity.steps?.toString() ?? '');
      setMediaKey(activity.image ?? undefined);

      if (activity.imageUrl) {
        setMediaUri(activity.imageUrl);

        const asset = await urlToImagePickerAsset(activity.imageUrl);
        setMedia(asset);
      }
    }
    setPageLoading(false);
  };

  useEffect(() => {
    if (activityId) {
      getManualActivity();
    }
  }, [activityId]);

  // This effect will scroll to make sure the photo button is visible when keyboard opens
  useEffect(() => {
    if (keyboardVisible && scrollViewRef.current) {
      // Small delay to ensure layout has updated
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [keyboardVisible]);

  return (
    <SafeAreaView className="flex-1 bg-white">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 20}
        className="flex-1">
        <Stack.Screen
          options={{
            title: '',
            headerTitleAlign: 'center',
            headerStyle: {
              backgroundColor: '#FFFFFF',
            },
            headerShadowVisible: false,
            headerBackVisible: false,
            headerLeft: () => (
              <BackButton
                onPress={() => {
                  router.back();
                }}
                text="Back"
              />
            ),
          }}
        />

        {pageLoading ? (
          <ScreenLoading />
        ) : (
          <ScrollView
            ref={scrollViewRef}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ flexGrow: 1, paddingBottom: 80 }}
            className="flex-1">
            <View className="flex-1 justify-start px-6">
              <FullLogo className="h-8 w-48" />
              <View className="mt-4">
                <Text className="mb-2 text-center font-heading text-2xl font-bold text-[#1A1A1A]">
                  Update or delete activity
                </Text>
                <Text className="mb-2 text-center text-xl font-bold text-black">
                  {formatDateToLocaleString(new Date(manualActivity?.date ?? today))}
                </Text>
                <Text className="mb-6 text-center font-medium text-gray-500">
                  We'll review this before adding it to your points. It's a quick check - no stress.
                </Text>
              </View>

              <View className="mb-4">
                <Text className="mb-2 text-xl font-bold text-primary-500">Steps you took</Text>
                <View className="items-center">
                  <Input size="xl" variant="rounded" isInvalid={!!error}>
                    <InputField
                      placeholder="Enter your step count"
                      autoCapitalize="none"
                      keyboardType="numeric"
                      value={steps ?? ''}
                      onChangeText={(text) => {
                        setError(null);
                        setSteps(text);
                      }}
                    />
                  </Input>
                </View>
              </View>

              <View className="mb-4">
                <Text className="mb-2 text-xl font-bold text-primary-500">Proof of movement</Text>
                {mediaLoading ? (
                  <View className="flex h-[50px] w-full items-center justify-center">
                    <ActivityIndicator />
                  </View>
                ) : (
                  <View className="w-full">
                    {media && mediaUri ? (
                      <View className="relative">
                        {uploadingMedia ? (
                          <View className="absolute z-50 flex h-full w-full items-center justify-center">
                            <Progress.Circle
                              progress={uploadProgress}
                              size={50}
                              thickness={5}
                              className="z-50"
                              showsText
                              textStyle={{ color: 'white', fontWeight: 'bold' }}
                              borderColor={colors.primary}
                              color={colors.primary}
                              borderWidth={0}
                            />
                          </View>
                        ) : null}

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

                        {!mediaLoading && (
                          <TouchableOpacity
                            onPress={resetMedia}
                            className="absolute right-0 top-0 m-2 rounded-full bg-[rgba(0,0,0,0.8)] p-1">
                            <X color="#fff" size={18} />
                          </TouchableOpacity>
                        )}
                      </View>
                    ) : (
                      <TouchableOpacity
                        className="flex-row items-center gap-x-2 rounded-lg border border-gray-200 p-4"
                        onPress={selectImage}>
                        <ImageSquare size={32} weight="duotone" color={colors.primary} />
                        <Text className="font-semibold text-gray-500">
                          Upload a photo of screenshot
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>

              <ErrorMessage error={error} className="mb-4" />

              <View className="flex-col gap-y-4">
                <View className="flex-1">
                  <ButtonGroup>
                    <LoadingButton
                      variant="solid"
                      size="xl"
                      action="primary"
                      className="h-16 w-full rounded-3xl"
                      onPress={handleSubmit}
                      disabled={isLoading || mediaLoading || uploadingMedia}
                      loading={isLoading}>
                      <ButtonText>{manualActivity ? 'Update' : 'Submit'} Activity</ButtonText>
                    </LoadingButton>
                  </ButtonGroup>
                </View>

                {manualActivity ? (
                  <View className="flex-1">
                    <ButtonGroup>
                      <LoadingButton
                        variant="outline"
                        size="xl"
                        action="negative"
                        className="h-16 w-full rounded-3xl"
                        onPress={handleDelete}
                        disabled={isLoading || mediaLoading || uploadingMedia}
                        loading={isLoading}>
                        <ButtonText className="text-red-500">Delete</ButtonText>
                      </LoadingButton>
                    </ButtonGroup>
                  </View>
                ) : null}
              </View>
            </View>
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
