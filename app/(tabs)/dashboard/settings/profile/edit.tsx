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
import {
  Alert,
  Linking,
  Platform,
  TouchableOpacity,
  View,
} from 'react-native';
import { z } from 'zod';

import { Switch } from '@/components/ui/switch';
import { Avatar } from '~/components/core/Avatar';
import { BackButton } from '~/components/core/BackButton';
import SafeAreaView from '~/components/core/SafeAreaView';
import { Spinner } from '~/components/ui/spinner';
import { Text } from '~/components/ui/text';
import { api } from '~/convex/_generated/api';
import { useAuthStore } from '~/store/useAuthStore';
import {
  canBypassAppleHealthAvailabilityCheck,
  initializeAppleHealthKit,
  isAppleHealthAvailable,
} from '~/utils/apple-health-kit';
import { CatchPromise } from '~/utils/catch-promise';
import { healthPermissionsAndroid } from '~/utils/constants';
import {
  getErrorMessage,
  getZodErrorMessage,
} from '~/utils/error-message';
import { formatDateToLocaleString } from '~/utils/formatter';
import { storeData } from '~/utils/storage';
import { PROFILE_FIELD } from '~/utils/types';

function getHealthConnect() {
  // Load Health Connect only when Android needs it.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require(
    'react-native-health-connect'
  ) as typeof import('react-native-health-connect');
}

const HEALTH_CONNECT_CHECK_TIMEOUT_MS = 30000;
const HEALTH_CONNECT_PERMISSION_TIMEOUT_MS = 120000;

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMessage: string,
  timeoutMs = HEALTH_CONNECT_CHECK_TIMEOUT_MS
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout>;

  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(timeoutMessage));
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timeoutId);
  });
}

async function openHealthConnectListing() {
  const marketUrl =
    'market://details?id=com.google.android.apps.healthdata';

  const webUrl =
    'https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata';

  try {
    const canOpenMarket =
      await Linking.canOpenURL(marketUrl);

    await Linking.openURL(
      canOpenMarket ? marketUrl : webUrl
    );
  } catch (error) {
    console.warn(
      'Failed to open Health Connect listing:',
      error
    );

    Alert.alert(
      'Unable to open Health Connect',
      'Please install or update Health Connect from the Google Play Store.'
    );
  }
}

export default function ProfileEdit() {
  const convex = useConvex();

  const [isLoading, setIsLoading] = useState(false);

  const [
    isUserNotificationEnabledLoading,
    setIsUserNotificationEnabledLoading,
  ] = useState(false);

  const [
    isUserCommentNotificationEnabledLoading,
    setIsUserCommentNotificationEnabledLoading,
  ] = useState(false);

  const [
    isUserAutoSyncEnabledLoading,
    setIsUserAutoSyncEnabledLoading,
  ] = useState(false);

  const [photo, setPhoto] =
    useState<ImagePickerAsset | null>(null);

  const [, setError] = useState<string | null>(null);

  const [
    userNotificationEnabled,
    setUserNotificationEnabled,
  ] = useState(false);

  const [
    userCommentNotificationEnabled,
    setUserCommentNotificationEnabled,
  ] = useState(false);

  const [
    userAutoSyncEnabled,
    setUserAutoSyncEnabled,
  ] = useState(true);

  const currentUser = useAuthStore(
    (state) => state.currentUser
  );

  const setCurrentUser = useAuthStore(
    (state) => state.setCurrentUser
  );

  const setCurrentUserImage = useAuthStore(
    (state) => state.setCurrentUserImage
  );

  const [date, setDate] = useState(new Date());

  const [birthdate, setBirthdate] =
    useState<Date | undefined>(undefined);

  const tenYearsAgo = new Date();

  tenYearsAgo.setFullYear(
    tenYearsAgo.getFullYear() - 12
  );

  tenYearsAgo.setHours(0, 0, 0, 0);

  const birthdateSchema = z.object({
    birthdate: z
      .date({
        required_error:
          'Please enter your birthdate',
      })
      .refine(
        (selectedBirthdate) =>
          selectedBirthdate < tenYearsAgo,
        {
          message:
            'Please update your date of birth. This keeps your step tracking and points accurate',
        }
      ),
  });

  const generateUploadUrl = useMutation(
    api.upload.generateUploadUrl
  );

  const updateUser = useMutation(api.users.update);

  const isUserNotificationEnabled = useQuery(
    api.users.userNotificationEnabled
  );

  const updateUserNotificationEnabled =
    useMutation(
      api.users.updateUserNotificationEnabled
    );

  const isUserCommentNotificationEnabled =
    useQuery(
      api.users.userCommentNotificationEnabled
    );

  const updateUserCommentNotificationEnabled =
    useMutation(
      api.users
        .updateUserCommentNotificationEnabled
    );

  const isUserAutoSyncEnabled = useQuery(
    api.users.userAutoSyncEnabled
  );

  const updateUserAutoSyncEnabled = useMutation(
    api.users.updateUserAutoSyncEnabled
  );

  const updateExpoPushToken = useMutation(
    api.users.updateExpoPushToken
  );

  const selectImage = async () => {
    try {
      const result =
        await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.5,
          selectionLimit: 1,
        });

      if (result.canceled) {
        return;
      }

      const localPhoto = result.assets[0];

      setPhoto(localPhoto);
      setCurrentUserImage(localPhoto.uri);

      const uploadUrl =
        await generateUploadUrl();

      const fileResponse = await fetch(
        localPhoto.uri
      );

      const blob = await fileResponse.blob();

      const uploadResponse = await fetch(
        uploadUrl,
        {
          method: 'POST',
          headers: localPhoto.type
            ? {
                'Content-Type':
                  `${localPhoto.type}/*`,
              }
            : {},
          body: blob,
        }
      );

      if (!uploadResponse.ok) {
        setError('Failed to upload image');
        return;
      }

      const { storageId } =
        await uploadResponse.json();

      const [error, response] =
        await CatchPromise(
          updateUser({
            storageId,
          })
        );

      if (error) {
        setError(getErrorMessage(error.data));
        return;
      }

      if (response) {
        const user = await convex.query(
          api.users.current
        );

        setCurrentUser(user);
      }
    } catch (error) {
      console.warn(
        'Profile image update failed:',
        error
      );

      setError(
        error instanceof Error
          ? error.message
          : 'Unable to update profile image'
      );
    }
  };

  const onChange = (
    event: any,
    selectedDate?: Date
  ) => {
    if (!selectedDate) {
      return;
    }

    setDate(selectedDate);
    setBirthdate(selectedDate);

    if (event.type === 'set') {
      void handleSubmit(selectedDate);
    }
  };

  const handleSubmit = async (
    selectedDate: Date
  ) => {
    setIsLoading(true);

    try {
      const result =
        await birthdateSchema.safeParseAsync({
          birthdate: selectedDate,
        });

      if (!result.success) {
        setError(
          getZodErrorMessage(result.error)
        );

        return;
      }

      const [error, response] =
        await CatchPromise(
          updateUser({
            birthdate: selectedDate.getTime(),
          })
        );

      if (error) {
        setError(getErrorMessage(error));
        return;
      }

      if (response) {
        const user = await convex.query(
          api.users.current
        );

        setCurrentUser(user);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const registerForAppleHealthAsync =
    async (): Promise<boolean> => {
      try {
        const isAvailable =
          await isAppleHealthAvailable();

        if (
          !isAvailable &&
          !canBypassAppleHealthAvailabilityCheck()
        ) {
          Alert.alert(
            'Apple Health not available',
            'Apple Health is not available on this device.'
          );

          return false;
        }

        const hasPermissions =
          await initializeAppleHealthKit();

        if (!hasPermissions) {
          Alert.alert(
            'Permissions not enabled',
            'Apple Health permissions were not enabled. Please allow Steps and Heart Rate for SweatScore in iOS Settings, then try again.',
            [
              {
                text: 'Not now',
                style: 'cancel',
              },
              {
                text: 'Open Settings',
                onPress: () => {
                  void Linking.openSettings();
                },
              },
            ]
          );

          return false;
        }

        return true;
      } catch (error) {
        console.warn(
          'Apple Health permission request failed:',
          error
        );

        Alert.alert(
          'Could not connect Apple Health',
          error instanceof Error
            ? error.message
            : 'Something went wrong while opening Apple Health permissions.'
        );

        return false;
      }
    };

  const registerForAndroidHealthConnectAsync =
    async (): Promise<boolean> => {
      try {
        const {
          getSdkStatus,
          initialize,
          requestPermission,
          SdkAvailabilityStatus,
        } = getHealthConnect();

        const status = await withTimeout(
          getSdkStatus(),
          'Health Connect did not respond. Please try again.'
        );

        if (
          status ===
          SdkAvailabilityStatus.SDK_UNAVAILABLE
        ) {
          Alert.alert(
            'Health Connect not available',
            'Health Connect is not available on this device. Upgrade your Android version to enable Health Connect.'
          );

          return false;
        }

        if (
          status ===
          SdkAvailabilityStatus
            .SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED
        ) {
          Alert.alert(
            'Health Connect required',
            'Install or update Health Connect to enable automatic health data syncing.',
            [
              {
                text: 'Not now',
                style: 'cancel',
              },
              {
                text: 'Install',
                onPress: () => {
                  void openHealthConnectListing();
                },
              },
            ]
          );

          return false;
        }

        const isInitialized = await withTimeout(
          initialize(),
          'Health Connect did not finish opening. Please try again.'
        );

        if (!isInitialized) {
          Alert.alert(
            'Error initializing Health Connect',
            'Health Connect could not be initialized. Please try again.'
          );

          return false;
        }

        const grantedPermissions =
          await withTimeout(
            requestPermission(
              healthPermissionsAndroid
            ),
            'Health Connect permissions did not finish. Please try again.',
            HEALTH_CONNECT_PERMISSION_TIMEOUT_MS
          );

        if (grantedPermissions.length === 0) {
          Alert.alert(
            'Permissions not enabled',
            'Health Connect permissions were not enabled. You can connect again later from settings.'
          );

          return false;
        }

        return true;
      } catch (error) {
        console.warn(
          'Health Connect permission request failed:',
          error
        );

        Alert.alert(
          'Could not connect health data',
          error instanceof Error
            ? error.message
            : 'Something went wrong while opening Health Connect permissions.'
        );

        return false;
      }
    };

  const registerForHealthDataAsync =
    async (): Promise<boolean> => {
      if (Platform.OS === 'ios') {
        return registerForAppleHealthAsync();
      }

      if (Platform.OS === 'android') {
        return registerForAndroidHealthConnectAsync();
      }

      Alert.alert(
        'Health sync not supported',
        'Health data syncing is not supported on this device.'
      );

      return false;
    };

  const registerForPushNotificationsAsync =
    async (): Promise<boolean> => {
      try {
        if (!Device.isDevice) {
          Alert.alert(
            'Physical device required',
            'Push notifications require a physical device.'
          );

          return false;
        }

        const {
          status: existingStatus,
        } =
          await Notifications.getPermissionsAsync();

        let finalStatus = existingStatus;

        if (existingStatus !== 'granted') {
          const { status } =
            await Notifications
              .requestPermissionsAsync();

          finalStatus = status;
        }

        if (finalStatus !== 'granted') {
          return false;
        }

        const token =
          await Notifications
            .getExpoPushTokenAsync({
              projectId:
                Constants.expoConfig?.extra?.eas
                  ?.projectId,
            });

        if (Platform.OS === 'android') {
          await Notifications
            .setNotificationChannelAsync(
              'default',
              {
                name: 'default',
                importance:
                  Notifications
                    .AndroidImportance.MAX,
                vibrationPattern: [
                  0,
                  250,
                  250,
                  250,
                ],
                lightColor: '#FF231F7C',
              }
            );
        }

        if (token.data) {
          await CatchPromise(
            updateExpoPushToken({
              expoPushToken: token.data,
            })
          );
        }

        return true;
      } catch (error) {
        console.warn(
          'Push notification permission failed:',
          error
        );

        return false;
      }
    };

  const handleUserNotificationEnabled =
    async (enabled: boolean) => {
      if (
        isUserNotificationEnabledLoading
      ) {
        return;
      }

      setIsUserNotificationEnabledLoading(
        true
      );

      try {
        if (enabled) {
          const success =
            await registerForPushNotificationsAsync();

          if (!success) {
            setUserNotificationEnabled(false);
            return;
          }
        }

        const [error, response] =
          await CatchPromise(
            updateUserNotificationEnabled({
              enabled,
            })
          );

        if (error) {
          setError(getErrorMessage(error));

          setUserNotificationEnabled(
            isUserNotificationEnabled ?? false
          );

          return;
        }

        if (response) {
          const user = await convex.query(
            api.users.current
          );

          setCurrentUser(user);
          setUserNotificationEnabled(enabled);
        }
      } finally {
        setIsUserNotificationEnabledLoading(
          false
        );
      }
    };

  const handleUserCommentNotificationEnabled =
    async (enabled: boolean) => {
      if (
        isUserCommentNotificationEnabledLoading
      ) {
        return;
      }

      setIsUserCommentNotificationEnabledLoading(
        true
      );

      try {
        const [error, response] =
          await CatchPromise(
            updateUserCommentNotificationEnabled({
              enabled,
            })
          );

        if (error) {
          setError(getErrorMessage(error));

          setUserCommentNotificationEnabled(
            isUserCommentNotificationEnabled ??
              false
          );

          return;
        }

        if (response) {
          const user = await convex.query(
            api.users.current
          );

          setCurrentUser(user);

          setUserCommentNotificationEnabled(
            enabled
          );
        }
      } finally {
        setIsUserCommentNotificationEnabledLoading(
          false
        );
      }
    };

  const handleUserAutoSyncEnabled =
    async (enabled: boolean) => {
      if (isUserAutoSyncEnabledLoading) {
        return;
      }

      setIsUserAutoSyncEnabledLoading(true);

      const previousValue =
        userAutoSyncEnabled;

      /*
       * Optimistically update the switch so it
       * responds immediately to the user's tap.
       */
      setUserAutoSyncEnabled(enabled);

      try {
        /*
         * Only open Apple Health or Health Connect
         * when the user enables synchronization.
         */
        if (enabled) {
          const hasPermission =
            await registerForHealthDataAsync();

          if (!hasPermission) {
            setUserAutoSyncEnabled(
              previousValue
            );

            return;
          }
        }

        const [error, response] =
          await CatchPromise(
            updateUserAutoSyncEnabled({
              enabled,
            })
          );

        if (error) {
          setError(getErrorMessage(error));

          setUserAutoSyncEnabled(
            previousValue
          );

          return;
        }

        if (response) {
          const user = await convex.query(
            api.users.current
          );

          setCurrentUser(user);
          setUserAutoSyncEnabled(enabled);

          storeData('autoSync', {
            enabled,
          });
        }
      } catch (error) {
        console.warn(
          'Health sync update failed:',
          error
        );

        setUserAutoSyncEnabled(previousValue);

        Alert.alert(
          'Unable to update health sync',
          error instanceof Error
            ? error.message
            : 'Please try again.'
        );
      } finally {
        setIsUserAutoSyncEnabledLoading(false);
      }
    };

  useEffect(() => {
    if (
      isUserNotificationEnabled !== undefined
    ) {
      setUserNotificationEnabled(
        isUserNotificationEnabled
      );
    }
  }, [isUserNotificationEnabled]);

  useEffect(() => {
    if (
      isUserAutoSyncEnabled !== undefined
    ) {
      setUserAutoSyncEnabled(
        isUserAutoSyncEnabled ?? true
      );
    }
  }, [isUserAutoSyncEnabled]);

  useEffect(() => {
    if (currentUser?.birthdate) {
      const currentBirthdate = new Date(
        currentUser.birthdate
      );

      setBirthdate(currentBirthdate);
      setDate(currentBirthdate);
    }
  }, [currentUser?.birthdate]);

  useEffect(() => {
    if (
      isUserCommentNotificationEnabled !==
      undefined
    ) {
      setUserCommentNotificationEnabled(
        isUserCommentNotificationEnabled ??
          true
      );
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
          headerLeft: () => (
            <BackButton
              fallbackHref="/(tabs)/dashboard/settings"
              text="Back"
            />
          ),
        }}
      />

      <View className="mx-4 flex-1 flex-col gap-y-8">
        <View className="flex flex-col items-center gap-y-4">
          <View>
            <Avatar
              uri={
                photo?.uri ??
                currentUser?.image ??
                undefined
              }
              name={currentUser?.name}
            />
          </View>

          <TouchableOpacity
            onPress={() => {
              void selectImage();
            }}>
            <Text className="text-link text-[14px]">
              {photo?.uri || currentUser?.image
                ? 'Edit profile image'
                : 'Add profile image'}
            </Text>
          </TouchableOpacity>
        </View>

        <View>
          <Text className="text-xl font-bold text-primary-600">
            Edit Profile
          </Text>
        </View>

        <View className="flex-row">
          <View className="w-1/3">
            <Text className="text-[16px] font-semibold">
              Name
            </Text>
          </View>

          <View className="w-2/3">
            <TouchableOpacity
              onPress={() => {
                router.push({
                  pathname:
                    '/dashboard/settings/profile/edit-field',
                  params: {
                    field:
                      PROFILE_FIELD.FULL_NAME,
                  },
                });
              }}>
              <View className="flex-row items-start gap-x-2">
                <View className="flex-1">
                  <Text className="text-[16px] font-bold">
                    {currentUser?.name}
                  </Text>
                </View>

                <View>
                  <Ionicons
                    size={16}
                    name="chevron-forward-outline"
                  />
                </View>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        <View className="flex-row">
          <View className="w-1/3">
            <Text className="text-[16px] font-semibold">
              Birthdate
            </Text>
          </View>

          <View className="w-2/3">
            {isLoading ? (
              <View className="flex-row items-center">
                <Spinner
                  className="text-primary-500"
                  size="small"
                />
              </View>
            ) : (
              <TouchableOpacity
                onPress={() => {
                  if (Platform.OS === 'ios') {
                    router.push({
                      pathname:
                        '/dashboard/settings/profile/edit-field',
                      params: {
                        field:
                          PROFILE_FIELD.BIRTHDATE,
                      },
                    });

                    return;
                  }

                  DateTimePickerAndroid.open({
                    value: date,
                    mode: 'date',
                    onChange,
                    display: 'spinner',
                    maximumDate: tenYearsAgo,
                    minimumDate: new Date(
                      1900,
                      0,
                      1
                    ),
                  });
                }}>
                <View className="flex-row items-start gap-x-2">
                  <View className="flex-1">
                    <Text className="text-[16px] font-bold">
                      {formatDateToLocaleString(
                        currentUser?.birthdate
                      )}
                    </Text>
                  </View>

                  <View>
                    <Ionicons
                      size={16}
                      name="chevron-forward-outline"
                    />
                  </View>
                </View>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View className="flex-row">
          <View className="w-1/3">
            <Text className="text-[16px] font-semibold">
              Goal
            </Text>
          </View>

          <View className="w-2/3">
            {isLoading ? (
              <View className="flex-row items-center">
                <Spinner
                  className="text-primary-500"
                  size="small"
                />
              </View>
            ) : (
              <TouchableOpacity
                onPress={() => {
                  router.push({
                    pathname:
                      '/dashboard/settings/profile/edit-goal',
                  });
                }}>
                <View className="flex-row items-start gap-x-2">
                  <View className="flex-1">
                    <Text className="text-[16px] font-bold">
                      {currentUser?.activityGoal}
                    </Text>
                  </View>

                  <View>
                    <Ionicons
                      size={16}
                      name="chevron-forward-outline"
                    />
                  </View>
                </View>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View>
          <Text className="text-xl font-bold text-primary-600">
            Permissions
          </Text>
        </View>

        <View className="flex-row items-center justify-between">
          <View className="flex-1">
            <Text className="text-[16px] font-semibold">
              Push Notifications
            </Text>
          </View>

          <View>
            {isUserNotificationEnabledLoading ? (
              <View className="flex-row items-center">
                <Spinner
                  className="text-primary-500"
                  size="small"
                />
              </View>
            ) : (
              <View className="flex-row items-start gap-x-2">
                <Switch
                  size="sm"
                  isDisabled={
                    isUserNotificationEnabledLoading
                  }
                  value={
                    userNotificationEnabled
                  }
                  onValueChange={(value) => {
                    void handleUserNotificationEnabled(
                      value
                    );
                  }}
                />
              </View>
            )}
          </View>
        </View>

        {userNotificationEnabled ? (
          <View className="flex-row items-center justify-between">
            <View className="flex-1">
              <Text className="text-[16px] font-semibold">
                Comment Notifications
              </Text>

              <Text className="text-[14px] text-hint">
                Notify me when someone comments on
                my posts
              </Text>
            </View>

            <View>
              {isUserCommentNotificationEnabledLoading ? (
                <View className="flex-row items-center">
                  <Spinner
                    className="text-primary-500"
                    size="small"
                  />
                </View>
              ) : (
                <View className="flex-row items-start gap-x-2">
                  <Switch
                    size="sm"
                    isDisabled={
                      isUserCommentNotificationEnabledLoading
                    }
                    value={
                      userCommentNotificationEnabled
                    }
                    onValueChange={(value) => {
                      void handleUserCommentNotificationEnabled(
                        value
                      );
                    }}
                  />
                </View>
              )}
            </View>
          </View>
        ) : null}

        <View className="flex-row items-center justify-between">
          <View className="flex-1 pr-4">
            <Text className="text-[16px] font-semibold">
              Health Data Sync
            </Text>

            <Text className="text-[14px] text-hint">
              {Platform.OS === 'ios'
                ? 'Sync activity using Apple Health'
                : 'Sync activity using Health Connect'}
            </Text>
          </View>

          <View>
            {isUserAutoSyncEnabledLoading ? (
              <View className="flex-row items-center">
                <Spinner
                  className="text-primary-500"
                  size="small"
                />
              </View>
            ) : (
              <View className="flex-row items-start gap-x-2">
                <Switch
                  size="sm"
                  isDisabled={
                    isUserAutoSyncEnabledLoading
                  }
                  value={userAutoSyncEnabled}
                  onValueChange={(value) => {
                    void handleUserAutoSyncEnabled(
                      value
                    );
                  }}
                />
              </View>
            )}
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}