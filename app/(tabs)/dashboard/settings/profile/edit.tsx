import { Ionicons } from '@expo/vector-icons';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useConvex, useMutation, useQuery } from 'convex/react';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as ImagePicker from 'expo-image-picker';
import { ImagePickerAsset } from 'expo-image-picker';
import * as Notifications from 'expo-notifications';
import { router, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, TouchableOpacity, View } from 'react-native';
import { z } from 'zod';

import { Switch } from '@/components/ui/switch';
import { Avatar } from '~/components/core/Avatar';
import { BackButton } from '~/components/core/BackButton';
import SafeAreaView from '~/components/core/SafeAreaView';
import { Spinner } from '~/components/ui/spinner';
import { Text } from '~/components/ui/text';
import { api } from '~/convex/_generated/api';
import { useAuthStore } from '~/store/useAuthStore';
import { CatchPromise } from '~/utils/catch-promise';
import { getErrorMessage, getZodErrorMessage } from '~/utils/error-message';
import { formatDateToLocaleString } from '~/utils/formatter';
import { PROFILE_FIELD } from '~/utils/types';

export default function ProfileEdit() {
  const convex = useConvex();
  const [isLoading, setIsLoading] = useState(false);
  const [isUserNotificationEnabledLoading, setIsUserNotificationEnabledLoading] = useState(false);
  const [isUserCommentNotificationEnabledLoading, setIsUserCommentNotificationEnabledLoading] =
    useState(false);
  const [isUserAutoSyncEnabledLoading, setIsUserAutoSyncEnabledLoading] = useState(false);
  const [photo, setPhoto] = useState<ImagePickerAsset | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [userNotificationEnabled, setUserNotificationEnabled] = useState(false);
  const [userCommentNotificationEnabled, setUserCommentNotificationEnabled] = useState(false);
  const [userAutoSyncEnabled, setUserAutoSyncEnabled] = useState(true);
  const currentUser = useAuthStore((state) => state.currentUser);
  const setCurrentUser = useAuthStore((state) => state.setCurrentUser);
  const setCurrentUserImage = useAuthStore((state) => state.setCurrentUserImage);
  const [date, setDate] = useState(new Date());
  const [birthdate, setBirthdate] = useState<Date | undefined>(undefined);
  const tenYearsAgo = new Date();
  tenYearsAgo.setFullYear(tenYearsAgo.getFullYear() - 12);
  tenYearsAgo.setHours(0, 0, 0, 0);

  const birthdateSchema = z.object({
    birthdate: z
      .date({ required_error: 'Please enter your birthdate' })
      .refine((date) => date < tenYearsAgo, {
        message:
          'Please update your date of birth. This keeps your step tracking and points accurate',
      }),
  });

  const generrateUploadUrl = useMutation(api.upload.generateUploadUrl);
  const updateUser = useMutation(api.users.update);
  const isUserNotificationEnabled = useQuery(api.users.userNotificationEnabled);
  const updateUserNotificationEnabled = useMutation(api.users.updateUserNotificationEnabled);
  const isUserCommentNotificationEnabled = useQuery(api.users.userCommentNotificationEnabled);
  const updateUserCommentNotificationEnabled = useMutation(
    api.users.updateUserCommentNotificationEnabled
  );
  const isUserAutoSyncEnabled = useQuery(api.users.userAutoSyncEnabled);
  const updateUserAutoSyncEnabled = useMutation(api.users.updateUserAutoSyncEnabled);
  const updateExpoPushToken = useMutation(api.users.updateExpoPushToken);

  const selectImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      selectionLimit: 1,
    });

    if (!result.canceled) {
      const localphoto = result.assets[0];
      setPhoto(localphoto);
      setCurrentUserImage(localphoto.uri);

      let imageId = undefined;

      if (localphoto) {
        const uploadUrl = await generrateUploadUrl();

        const response = await fetch(localphoto.uri);
        const blob = await response.blob();

        const uploadResponse = await fetch(uploadUrl, {
          method: 'POST',
          headers: localphoto.type ? { 'Content-Type': `${localphoto.type}/*` } : {},
          body: blob,
        });

        if (!uploadResponse.ok) {
          setError('Failed to upload image');
          return;
        }

        const { storageId } = await uploadResponse.json();
        imageId = storageId;
      }

      const [error, response] = await CatchPromise(
        updateUser({
          storageId: imageId,
        })
      );

      if (error) {
        setError(getErrorMessage(error.data));
        return;
      }

      if (response) {
        const user = await convex.query(api.users.current);
        setCurrentUser(user);
      }
    }
  };

  const onChange = (event: any, selectedDate: any) => {
    const currentDate = selectedDate;
    setDate(currentDate);
    if (event.type === 'set') {
      handleSubmit(selectedDate);
    }
    if (Platform.OS === 'android') setBirthdate(currentDate);
  };

  const handleSubmit = async (selectedDate: any) => {
    setIsLoading(true);
    const result = await birthdateSchema.safeParse({
      birthdate,
    });

    if (!result.success) {
      setError(getZodErrorMessage(result.error));
      setIsLoading(false);
      return;
    }

    const [error, response] = await CatchPromise(
      updateUser({
        birthdate: selectedDate?.getTime(),
      })
    );

    if (error) {
      setError(getErrorMessage(error));
    }

    if (response) {
      const user = await convex.query(api.users.current);
      setCurrentUser(user);

      setIsLoading(false);
    }
  };

  // const registerForHealthAsync = async (): Promise<boolean> => {
  //   if (Platform.OS === 'ios') {
  //     return new Promise((resolve) => {
  //       AppleHealthKit.isAvailable((err, isAvailable) => {
  //         if (err) {
  //           alert('Error checking availability');
  //           resolve(false);
  //           return;
  //         }
  //         if (!isAvailable) {
  //           alert('Apple Health not available');
  //           resolve(false);
  //           return;
  //         }
  //         AppleHealthKit.initHealthKit(healthPermissions, async (err) => {
  //           if (err) {
  //             resolve(false);
  //             return;
  //           }
  //           resolve(true);
  //         });
  //       });
  //     });
  //   } else {
  //     const isInitialized = await initialize();
  //     if (!isInitialized) {
  //       alert('Error initializing Health Connect');
  //       return false;
  //     }

  //     try {
  //       await requestPermission(healthPermissionsAndroid);
  //       return true;
  //     } catch (error) {
  //       return false;
  //     }
  //   }
  // };

  const registerForPushNotificationsAsync = async () => {
    let token;
    if (Device.isDevice) {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus; // undetermined, granted, or denied
      if (existingStatus === 'granted') return true;

      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;

      if (finalStatus !== 'granted') return false;

      token = await Notifications.getExpoPushTokenAsync({
        projectId: Constants.expoConfig?.extra?.eas.projectId,
      });
    } else {
      return false;
    }

    if (Platform.OS === 'android') {
      Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }

    if (token && token.data) {
      await CatchPromise(updateExpoPushToken({ expoPushToken: token.data }));
    }

    return true;
  };

  const handleUserNotificationEnabled = async (enabled: boolean) => {
    setIsUserNotificationEnabledLoading(true);

    if (enabled) {
      const success = await registerForPushNotificationsAsync();
      if (!success) {
        setUserNotificationEnabled(false);
        setIsUserNotificationEnabledLoading(false);
        return;
      }
    }

    setUserNotificationEnabled(enabled);
    const [error, response] = await CatchPromise(
      updateUserNotificationEnabled({
        enabled,
      })
    );

    if (response) {
      const user = await convex.query(api.users.current);
      setCurrentUser(user);
    }

    if (error) {
      setError(getErrorMessage(error));
    }

    setIsUserNotificationEnabledLoading(false);
  };

  const handleUserCommentNotificationEnabled = async (enabled: boolean) => {
    setIsUserCommentNotificationEnabledLoading(true);

    const [error, response] = await CatchPromise(updateUserCommentNotificationEnabled({ enabled }));
    if (response) {
      const user = await convex.query(api.users.current);
      setCurrentUser(user);
    }

    if (error) {
      setError(getErrorMessage(error));
    }

    setIsUserCommentNotificationEnabledLoading(false);
  };

  // const handleUserAutoSyncEnabled = async (enabled: boolean) => {
  //   setIsUserAutoSyncEnabledLoading(true);

  //   if (enabled) {
  //     const success = await registerForHealthAsync();
  //     if (!success) {
  //       setUserAutoSyncEnabled(false);
  //       setIsUserAutoSyncEnabledLoading(false);
  //       return;
  //     }
  //   }

  //   const [error, response] = await CatchPromise(updateUserAutoSyncEnabled({ enabled }));
  //   if (response) {
  //     const user = await convex.query(api.users.current);
  //     setCurrentUser(user);
  //     storeData('autoSync', {
  //       enabled,
  //     });
  //   }

  //   if (error) {
  //     setError(getErrorMessage(error));
  //   }

  //   setIsUserAutoSyncEnabledLoading(false);
  // };

  useEffect(() => {
    if (isUserNotificationEnabled !== undefined) {
      setUserNotificationEnabled(isUserNotificationEnabled);
    }
  }, [isUserNotificationEnabled]);

  useEffect(() => {
    if (isUserAutoSyncEnabled !== undefined) {
      setUserAutoSyncEnabled(isUserAutoSyncEnabled ?? true);
    }
  }, [isUserAutoSyncEnabled]);

  useEffect(() => {
    if (currentUser?.birthdate) {
      setBirthdate(new Date(currentUser.birthdate));
      setDate(new Date(currentUser.birthdate));
    }
  }, [currentUser?.birthdate]);

  useEffect(() => {
    if (isUserCommentNotificationEnabled !== undefined) {
      setUserCommentNotificationEnabled(isUserCommentNotificationEnabled ?? true);
    }
  }, [isUserCommentNotificationEnabled]);

  return (
    <SafeAreaView className="flex-1 bg-white">
      <Stack.Screen
        options={{
          headerShown: true,
          title: '',
          headerTitleAlign: 'center',
          headerShadowVisible: false,
          headerLeft: () => <BackButton fallbackHref="/(tabs)/dashboard/settings" text="Back" />,
        }}
      />
      <View className="mx-4 flex-1 flex-col gap-y-8">
        <View className="flex flex-col items-center gap-y-4">
          <View>
            <Avatar uri={photo?.uri ?? currentUser?.image ?? undefined} />
          </View>
          <TouchableOpacity onPress={selectImage}>
            <Text className="text-link  text-[14px]">
              {photo?.uri || currentUser?.image ? 'Edit profile image' : 'Add profile image'}
            </Text>
          </TouchableOpacity>
        </View>
        <View>
          <Text className="text-xl font-bold text-primary-600">Edit Profile</Text>
        </View>
        <View className="flex-row">
          <View className="w-1/3">
            <Text className="text-[16px] font-semibold">Name</Text>
          </View>
          <View className="w-2/3">
            <TouchableOpacity
              onPress={() => {
                router.push({
                  pathname: '/dashboard/settings/profile/edit-field',
                  params: { field: PROFILE_FIELD.FULL_NAME },
                });
              }}>
              <View className="flex-row items-start gap-x-2">
                <View className="flex-1">
                  <Text className="text-[16px] font-bold">{currentUser?.name}</Text>
                </View>
                <View>
                  <Ionicons size={16} name="chevron-forward-outline" />
                </View>
              </View>
            </TouchableOpacity>
          </View>
        </View>
        <View className="flex-row">
          <View className="w-1/3">
            <Text className="text-[16px] font-semibold">Birthdate</Text>
          </View>
          <View className="w-2/3">
            {isLoading ? (
              <View className="flex-row items-center">
                <Spinner className="text-primary-500" size="small" />
              </View>
            ) : (
              <TouchableOpacity
                onPress={() => {
                  Platform.OS === 'ios'
                    ? router.push({
                        pathname: '/dashboard/settings/profile/edit-field',
                        params: { field: PROFILE_FIELD.BIRTHDATE },
                      })
                    : DateTimePickerAndroid.open({
                        value: date,
                        mode: 'date',
                        onChange,
                        display: 'spinner',
                        maximumDate: tenYearsAgo,
                        minimumDate: new Date(1900, 0, 1),
                      });
                }}>
                <View className="flex-row items-start gap-x-2">
                  <View className="flex-1">
                    <Text className="text-[16px] font-bold">
                      {formatDateToLocaleString(currentUser?.birthdate)}
                    </Text>
                  </View>
                  <View>
                    <Ionicons size={16} name="chevron-forward-outline" />
                  </View>
                </View>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View className="flex-row">
          <View className="w-1/3">
            <Text className="text-[16px] font-semibold">Goal</Text>
          </View>
          <View className="w-2/3">
            {isLoading ? (
              <View className="flex-row items-center">
                <Spinner className="text-primary-500" size="small" />
              </View>
            ) : (
              <TouchableOpacity
                onPress={() => {
                  router.push({
                    pathname: '/dashboard/settings/profile/edit-goal',
                  });
                }}>
                <View className="flex-row items-start gap-x-2">
                  <View className="flex-1">
                    <Text className="text-[16px] font-bold">{currentUser?.activityGoal}</Text>
                  </View>
                  <View>
                    <Ionicons size={16} name="chevron-forward-outline" />
                  </View>
                </View>
              </TouchableOpacity>
            )}
          </View>
        </View>
        <View>
          <Text className="text-xl font-bold text-primary-600">Permissions</Text>
        </View>
        <View className="flex-row items-center justify-between">
          <View className="flex-1">
            <Text className="text-[16px] font-semibold">Push Notifications</Text>
          </View>
          <View>
            {isLoading ? (
              <View className="flex-row items-center">
                <Spinner className="text-primary-500" size="small" />
              </View>
            ) : (
              <View className="flex-row items-start gap-x-2">
                <Switch
                  size="sm"
                  isDisabled={isUserNotificationEnabledLoading}
                  value={userNotificationEnabled}
                  onValueChange={(v) => {
                    handleUserNotificationEnabled(v);
                  }}
                />
              </View>
            )}
          </View>
        </View>

        {userNotificationEnabled ? (
          <View className="flex-row items-center justify-between">
            <View className="flex-1">
              <Text className="text-[16px] font-semibold">Comment Notifications</Text>
              <Text className="text-[14px] text-hint">
                Notify me when someone comments on my posts
              </Text>
            </View>
            <View>
              {isUserCommentNotificationEnabledLoading ? (
                <View className="flex-row items-center">
                  <Spinner className="text-primary-500" size="small" />
                </View>
              ) : (
                <View className="flex-row items-start gap-x-2">
                  <Switch
                    size="sm"
                    isDisabled={isUserCommentNotificationEnabledLoading}
                    value={userCommentNotificationEnabled}
                    onValueChange={(v) => {
                      handleUserCommentNotificationEnabled(v);
                    }}
                  />
                </View>
              )}
            </View>
          </View>
        ) : null}

        {/* <View className="flex-row items-center justify-between">
          <View className="flex-1">
            <Text className="text-[16px] font-semibold">Health Data Sync</Text>
          </View>
          <View>
            {isLoading ? (
              <View className="flex-row items-center">
                <Spinner className="text-primary-500" size="small" />
              </View>
            ) : (
              <View className="flex-row items-start gap-x-2">
                <Switch
                  size="sm"
                  isDisabled={isUserAutoSyncEnabledLoading}
                  value={userAutoSyncEnabled}
                  onValueChange={(v) => {
                    handleUserAutoSyncEnabled(v);
                  }}
                />
              </View>
            )}
          </View>
        </View> */}
      </View>
    </SafeAreaView>
  );
}
