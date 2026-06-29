import { useConvex, useMutation } from 'convex/react';
import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { ImagePickerAsset } from 'expo-image-picker';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { ImageSquare, X } from 'phosphor-react-native';
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

import { BackButton } from '~/components/core/BackButton';
import { ErrorMessage } from '~/components/core/ErrorMessage';
import SafeAreaView from '~/components/core/SafeAreaView';
import ScreenLoading from '~/components/core/ScreenLoading';
import { ButtonGroup, ButtonText, LoadingButton } from '~/components/ui/button';
import { Input, InputField } from '~/components/ui/input';
import { Text } from '~/components/ui/text';
import { Textarea, TextareaInput } from '~/components/ui/textarea';
import { api } from '~/convex/_generated/api';
import { Id } from '~/convex/_generated/dataModel';
import { CatchPromise } from '~/utils/catch-promise';
import { colors } from '~/utils/constants';
import { getErrorMessage, getZodErrorMessage } from '~/utils/error-message';
import { urlToImagePickerAsset } from '~/utils/helpers';

export default function EditCreator() {
  const { creatorId } = useLocalSearchParams();
  const convex = useConvex();
  const [isLoading, setIsLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [description, setDescription] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadingMedia, setUploadingMedia] = useState<boolean>(false);
  const [media, setMedia] = useState<ImagePickerAsset | null>(null);
  const [mediaUri, setMediaUri] = useState<string | undefined>(undefined);
  const [mediaLoading, setMediaLoading] = useState<boolean>(false);
  const [mediaKey, setMediaKey] = useState<string | undefined>(undefined);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  const generrateUploadUrl = useMutation(api.upload.generateUploadUrl);
  const updateCreator = useMutation(api.admin.updateCreator);
  const deleteCreator = useMutation(api.admin.deleteCreator);

  const creatorSchema = z.object({
    name: z.string().min(1, 'Name is required').nullable().optional(),
    description: z.string().min(1, 'Description is required').nullable().optional(),
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
      allowsEditing: true,
      quality: 0.5,
      selectionLimit: 1,
      aspect: [370, 200],
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
    if (!creatorId) return;

    setIsLoading(true);
    const [error, response] = await CatchPromise(
      deleteCreator({
        creatorId: creatorId as Id<'creators'>,
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
    // Dismiss keyboard when submitting
    Keyboard.dismiss();

    setError(null);
    setIsLoading(true);

    if (!name && !description) {
      setError('Please enter name and description');
      setIsLoading(false);
      return;
    }

    if (!mediaKey) {
      setError('Please upload a poster image');
      setIsLoading(false);
      return;
    }

    const result = await creatorSchema.safeParse({
      name,
      description,
    });

    if (!result.success) {
      setError(getZodErrorMessage(result.error));
      setIsLoading(false);
      return;
    }

    const [error, response] = await CatchPromise(
      updateCreator({
        creatorId: creatorId as Id<'creators'>,
        name: result.data.name ?? undefined,
        description: result.data.description ?? undefined,
        posterImage: mediaKey as Id<'_storage'>,
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

  const getCreator = async () => {
    setPageLoading(true);
    const creator = await convex.query(api.admin.getCreator, {
      creatorId: creatorId as Id<'creators'>,
    });

    if (creator) {
      setName(creator.name);
      setDescription(creator.description ?? '');
      setMediaKey(creator.posterImage ?? undefined);

      if (creator.posterImageUrl) {
        setMediaUri(creator.posterImageUrl);

        const asset = await urlToImagePickerAsset(creator.posterImageUrl);
        setMedia(asset);
      }
    }
    setPageLoading(false);
  };

  useEffect(() => {
    if (creatorId) {
      getCreator();
    }
  }, [creatorId]);

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
              <BackButton fallbackHref="/(tabs)/dashboard/settings/admin/creator-hub" text="Back" />
            ),
          }}
        />

        {pageLoading ? (
          <ScreenLoading />
        ) : (
          <ScrollView
            ref={scrollViewRef}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ flexGrow: 1, paddingBottom: 80 }}
            className="flex-1">
            <View className="flex-1 justify-start px-6">
              <View className="mt-4">
                <Text className="mb-2 text-center font-heading text-3xl font-bold text-[#1A1A1A]">
                  Update creator
                </Text>
              </View>

              <View className="mb-4">
                <Text className="mb-2 text-xl font-bold text-primary-500">Name</Text>
                <View className="items-center">
                  <Input size="xl" variant="rounded" isInvalid={!!error}>
                    <InputField
                      placeholder="Enter creator name"
                      autoCapitalize="none"
                      keyboardType="default"
                      value={name ?? ''}
                      onChangeText={(text) => {
                        setError(null);
                        setName(text);
                      }}
                    />
                  </Input>
                </View>
              </View>

              <View className="mb-4">
                <Text className="mb-2 text-xl font-bold text-primary-500">Description</Text>
                <View className="items-center">
                  <Textarea size="xl" isInvalid={!!error} className="rounded-lg">
                    <TextareaInput
                      placeholder="Enter creator description"
                      multiline
                      keyboardType="default"
                      value={description ?? ''}
                      onChangeText={(text) => {
                        setError(null);
                        setDescription(text);
                      }}
                    />
                  </Textarea>
                </View>
              </View>

              <View className="mb-4">
                <Text className="mb-2 text-xl font-bold text-primary-500">Poster image</Text>
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
                            aspectRatio: 370 / 200,
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
                        <Text className="font-semibold text-gray-500">Upload poster image</Text>
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
                      <ButtonText>Update Creator</ButtonText>
                    </LoadingButton>
                  </ButtonGroup>
                </View>

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
              </View>
            </View>
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
