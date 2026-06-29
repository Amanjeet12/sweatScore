import { useMutation, useQuery } from 'convex/react';
import * as FileSystem from 'expo-file-system';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { ImagePickerAsset } from 'expo-image-picker';
import { Stack } from 'expo-router';
import { X } from 'phosphor-react-native';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import * as Progress from 'react-native-progress';

import { useToast } from '@/components/ui/toast';
import { BackButton } from '~/components/core/BackButton';
import SafeAreaView from '~/components/core/SafeAreaView';
import ScreenLoading from '~/components/core/ScreenLoading';
import { ToastMessage } from '~/components/core/Toast';
import { ButtonText, LoadingButton } from '~/components/ui/button';
import { Input, InputField } from '~/components/ui/input';
import { Text } from '~/components/ui/text';
import { api } from '~/convex/_generated/api';
import { Id } from '~/convex/_generated/dataModel';
import { CatchPromise } from '~/utils/catch-promise';
import { cn } from '~/utils/cn';
import { colors } from '~/utils/constants';
import { getErrorMessage } from '~/utils/error-message';

export default function AdminViewRewardsBanner() {
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadingMedia, setUploadingMedia] = useState<boolean>(false);
  const [media, setMedia] = useState<ImagePickerAsset | null>(null);
  const [mediaUri, setMediaUri] = useState<string | undefined>(undefined);
  const [mediaLoading, setMediaLoading] = useState<boolean>(false);
  const [mediaKey, setMediaKey] = useState<string | undefined>(undefined);
  const [title, setTitle] = useState<string>('');
  const [targetPoints, setTargetPoints] = useState<string>('');
  const rewardsBanner = useQuery(api.admin.getRewardsBanner);
  const generrateUploadUrl = useMutation(api.upload.generateUploadUrl);
  const updateRewardsBanner = useMutation(api.admin.updateRewardsBanner);

  useEffect(() => {
    if (rewardsBanner) {
      setTitle(rewardsBanner.title ?? '');
      setTargetPoints(rewardsBanner.targetPoints ? String(rewardsBanner.targetPoints) : '');
    }
  }, [rewardsBanner?.title, rewardsBanner?.targetPoints]);

  const showSuccessToast = (message: string) => {
    toast.show({
      placement: 'top',
      duration: 3000,
      render: ({ id }) => {
        return <ToastMessage message={message} action="success" />;
      },
    });
  };

  const showErrorToast = (message: string) => {
    toast.show({
      placement: 'top',
      duration: 3000,
      render: ({ id }) => {
        return <ToastMessage message={message} action="error" />;
      },
    });
  };

  const selectImage = async () => {
    // Dismiss keyboard first to ensure full screen visibility
    Keyboard.dismiss();

    setError(null);
    setUploadProgress(0);
    setMediaLoading(true);

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.5,
      selectionLimit: 1,
      aspect: [2, 1],
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

        const [err, updateResult] = await CatchPromise(
          updateRewardsBanner({
            image: JSON.parse(_uploadresult?.body ?? '{}').storageId as Id<'_storage'>,
            title: title.trim() || undefined,
            targetPoints: targetPoints ? parseInt(targetPoints, 10) : undefined,
          })
        );

        if (err) showErrorToast(getErrorMessage(err));
        if (updateResult) {
          showSuccessToast('Rewards banner updated successfully');
        }
      }
      setUploadingMedia(false);
    } else {
      setMediaLoading(false);
      setUploadingMedia(false);
    }
  };

  const resetMedia = () => {
    setMedia(null);
    setMediaUri(undefined);
    setMediaKey(undefined);
    setUploadProgress(0);
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitleAlign: 'center',
          title: '',
          headerTitle: () => (
            <Text className="text-center font-heading text-2xl font-bold text-[#1A1A1A]">
              Rewards Banner
            </Text>
          ),
          headerShadowVisible: false,
          headerLeft: () => <BackButton fallbackHref="/(tabs)/dashboard/settings/admin" />,
        }}
      />

      {rewardsBanner === undefined ? (
        <ScreenLoading />
      ) : (
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            className="flex-1"
            keyboardVerticalOffset={100}>
            <ScrollView
              className="flex-1"
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ flexGrow: 1 }}>
              <View className="mx-4 mt-4 flex-1 flex-col gap-y-4">
                <View className="flex-col gap-y-4">
                  <View className="mb-4">
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
                                aspectRatio: 960 / 516,
                                borderRadius: 10,
                              }}
                              blurRadius={uploadingMedia ? 5 : 0}
                              contentFit="fill"
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
                          <>
                            {rewardsBanner ? (
                              <View>
                                <Image
                                  source={{ uri: rewardsBanner.imageUrl }}
                                  style={{
                                    width: '100%',
                                    height: undefined,
                                    aspectRatio: 960 / 516,
                                    borderRadius: 10,
                                  }}
                                  contentFit="fill"
                                />
                              </View>
                            ) : (
                              <View className="flex h-40 w-full items-center justify-center rounded-3xl bg-gray-200">
                                <Text className="text-xl font-bold text-gray-500">
                                  No banner uploaded
                                </Text>
                              </View>
                            )}
                          </>
                        )}
                      </View>
                    )}
                  </View>
                </View>

                {/* Challenge Title */}
                <View className="mb-2">
                  <Text className="mb-1 font-heading text-base font-bold text-[#1A1A1A]">
                    Challenge Title
                  </Text>
                  <Input size="xl" variant="rounded">
                    <InputField
                      placeholder="e.g. Spring Fitness Challenge"
                      value={title}
                      onChangeText={setTitle}
                    />
                  </Input>
                </View>

                {/* Target Points */}
                <View className="mb-2">
                  <Text className="mb-1 font-heading text-base font-bold text-[#1A1A1A]">
                    Target Points
                  </Text>
                  <Input size="xl" variant="rounded">
                    <InputField
                      placeholder="e.g. 500"
                      value={targetPoints}
                      onChangeText={(text) => setTargetPoints(text.replace(/[^0-9]/g, ''))}
                      keyboardType="number-pad"
                    />
                  </Input>
                </View>

                <LoadingButton
                  variant="solid"
                  size="xl"
                  action="primary"
                  className={cn('h-16 w-full rounded-3xl bg-primary-500')}
                  disabled={uploadingMedia || mediaLoading}
                  loading={uploadingMedia || mediaLoading}
                  onPress={selectImage}>
                  <ButtonText>
                    <View className="flex-row items-center justify-center gap-x-2 pt-1">
                      <Text className="text-xl font-bold text-white">
                        {rewardsBanner ? 'Update Banner' : 'Upload Banner'}
                      </Text>
                    </View>
                  </ButtonText>
                </LoadingButton>
                {rewardsBanner && (
                  <LoadingButton
                    variant="outline"
                    size="xl"
                    action="primary"
                    className="h-16 w-full"
                    onPress={async () => {
                      const [err, result] = await CatchPromise(
                        updateRewardsBanner({
                          title: title.trim() || undefined,
                          targetPoints: targetPoints ? parseInt(targetPoints, 10) : undefined,
                        })
                      );
                      if (err) showErrorToast(getErrorMessage(err));
                      if (result) showSuccessToast('Challenge config updated');
                    }}>
                    <ButtonText>
                      <Text className="text-xl font-bold text-primary-500">Save Config</Text>
                    </ButtonText>
                  </LoadingButton>
                )}
                <Text className="text-sm text-gray-500">
                  Upload a cover image for the monthly challenge card on the Earn tab. Preferred
                  aspect ratio is 960x516.
                </Text>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </TouchableWithoutFeedback>
      )}
    </SafeAreaView>
  );
}
