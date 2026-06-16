import { convexQuery } from '@convex-dev/react-query';
import { Feather } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useQuery } from '@tanstack/react-query';
import { useMutation, useConvex } from 'convex/react';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { ImagePickerAsset } from 'expo-image-picker';
import { router, Stack } from 'expo-router';
import { Plus } from 'phosphor-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, TouchableOpacity, View } from 'react-native';
import { KeyboardStickyView, useKeyboardState } from 'react-native-keyboard-controller';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { z } from 'zod';

import { Avatar } from '~/components/core/Avatar';
import { ErrorMessage } from '~/components/core/ErrorMessage';
import ScreenLoading from '~/components/core/ScreenLoading';
import { Button, ButtonText } from '~/components/ui/button';
import { Input, InputField } from '~/components/ui/input';
import { Text } from '~/components/ui/text';
import { api } from '~/convex/_generated/api';
import { useAuthStore } from '~/store/useAuthStore';
import { CatchPromise } from '~/utils/catch-promise';
import { getErrorMessage, getZodErrorMessage } from '~/utils/error-message';
import { formatDateToLocaleString } from '~/utils/formatter';

export default function SetupProfile() {
  const convex = useConvex();
  const [error, setError] = useState<string | null>(null);
  const [photo, setPhoto] = useState<ImagePickerAsset | null>(null);
  const [name, setName] = useState('');
  const [birthdate, setBirthdate] = useState<Date | undefined>(undefined);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [date, setDate] = useState(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 25);
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [isLoading, setIsLoading] = useState(false);
  const insets = useSafeAreaInsets();
  const { isVisible: keyboardVisible } = useKeyboardState();

  const setCurrentUser = useAuthStore((state) => state.setCurrentUser);
  const setCurrentUserImage = useAuthStore((state) => state.setCurrentUserImage);

  const tenYearsAgo = new Date();
  tenYearsAgo.setFullYear(tenYearsAgo.getFullYear() - 12);
  tenYearsAgo.setHours(0, 0, 0, 0);

  const updateBioSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    birthdate: z
      .date({ required_error: 'Please enter your birthdate' })
      .refine((d) => d < tenYearsAgo, {
        message:
          'Please update your date of birth. This keeps your step tracking and points accurate',
      }),
  });

  const generrateUploadUrl = useMutation(api.upload.generateUploadUrl);
  const updateUser = useMutation(api.users.update);

  const { data: currentUser, isPending } = useQuery(convexQuery(api.users.current, {}));

  const handleSubmit = async () => {
    setIsLoading(true);
    setError(null);

    const result = await updateBioSchema.safeParse({ name, birthdate });

    if (!result.success) {
      setError(getZodErrorMessage(result.error));
      setIsLoading(false);
      return;
    }

    let imageId = undefined;

    if (photo) {
      const uploadUrl = await generrateUploadUrl();
      const response = await fetch(photo.uri);
      const blob = await response.blob();
      const uploadResponse = await fetch(uploadUrl, {
        method: 'POST',
        headers: photo.type ? { 'Content-Type': `${photo.type}/*` } : {},
        body: blob,
      });

      if (!uploadResponse.ok) {
        setError('Failed to upload image');
        setIsLoading(false);
        return;
      }

      const { storageId } = await uploadResponse.json();
      imageId = storageId;
    }

    const [err, response] = await CatchPromise(
      updateUser({
        storageId: imageId,
        name,
        birthdate: date?.getTime(),
      })
    );

    if (err) {
      setError(getErrorMessage(err.data));
      setIsLoading(false);
      return;
    }

    if (response) {
      const user = await convex.query(api.users.current);
      setCurrentUser(user);
      router.push('/(auth)/setup-activity-goal');
    }

    setIsLoading(false);
  };

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
    }
  };

  const onChange = (_event: any, selectedDate: any) => {
    if (!selectedDate) return;
    setDate(selectedDate);
    if (Platform.OS === 'android') setBirthdate(selectedDate);
  };

  useEffect(() => {
    if (currentUser?.name) {
      setName(currentUser.name);
    }
    if (currentUser?.birthdate) {
      setBirthdate(new Date(currentUser.birthdate));
      setDate(new Date(currentUser.birthdate));
    }
  }, [currentUser?.name, currentUser?.birthdate]);

  if (isPending) return <ScreenLoading />;

  const avatarUri = photo?.uri ?? currentUser?.image ?? undefined;
  const hasAvatar = !!avatarUri;

  return (
    <View className="flex-1 bg-white">
      <Stack.Screen options={{ headerShown: false }} />

      {/* Image fixed at top — does NOT move with keyboard */}
      <Image
        source={require('~/assets/onboarding/setupprofilescree.png')}
        contentFit="cover"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          width: '100%',
          aspectRatio: 4044 / 3938,
        }}
      />

      <KeyboardStickyView style={{ flex: 1 }}>
        <View className="flex-1">
          {/* Invisible spacer matching image height */}
          <View style={{ width: '100%', aspectRatio: 4044 / 3938 }} />

          {/* Top spacer pushes form down when keyboard is open */}
          {keyboardVisible && <View className="flex-1" />}

          {/* Form panel */}
          <View className="bg-white">
            <View className="px-8 pt-8">
              <Text className="mb-6 text-center font-heading text-3xl font-bold text-[#1A1A1A]">
                Personalise your profile
              </Text>

              {/* Profile pic picker */}
              <View className="items-center">
                <TouchableOpacity onPress={selectImage} activeOpacity={0.7}>
                  {hasAvatar ? (
                    <Avatar uri={avatarUri} size={88} />
                  ) : (
                    <View
                      style={{
                        width: 88,
                        height: 88,
                        borderRadius: 44,
                        borderWidth: 1.5,
                        borderColor: '#9CA3AF',
                        borderStyle: 'dashed',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                      <Plus size={28} color="#F76B1C" weight="bold" />
                    </View>
                  )}
                </TouchableOpacity>
                <Text className="mt-2 text-center font-body text-base text-[#5A5A5A]">
                  {hasAvatar ? 'Change profile pic' : 'Add a profile pic'}
                </Text>
              </View>

              {/* Name */}
              <View className="mt-6">
                <Input size="xl" variant="rounded">
                  <InputField
                    placeholder="Your name here"
                    autoComplete="name"
                    value={name}
                    onChangeText={(text) => {
                      setError(null);
                      setName(text);
                    }}
                  />
                </Input>
              </View>

              {/* Date of birth */}
              <View className="mt-3">
                {Platform.OS === 'ios' ? (
                  <Input size="xl" variant="rounded">
                    <InputField
                      placeholder="Date of birth"
                      value={formatDateToLocaleString(birthdate)}
                      editable={false}
                      onPressIn={() => setShowDatePicker(true)}
                    />
                  </Input>
                ) : (
                  <Input size="xl" variant="rounded">
                    <TouchableOpacity
                      className="w-full"
                      onPress={() =>
                        DateTimePickerAndroid.open({
                          value: date,
                          onChange,
                          mode: 'date',
                          display: 'spinner',
                          maximumDate: tenYearsAgo,
                          minimumDate: new Date(1900, 0, 1),
                        })
                      }>
                      <InputField
                        placeholder="Date of birth"
                        value={formatDateToLocaleString(birthdate)}
                        editable={false}
                      />
                    </TouchableOpacity>
                  </Input>
                )}
              </View>

              <View className="mt-3 items-center">
                <ErrorMessage error={error} />
              </View>
            </View>
          </View>

          {/* Middle spacer pushes button to bottom when keyboard closed */}
          {!keyboardVisible && <View className="flex-1 bg-white" />}

          <SafeAreaView edges={['bottom']} className="bg-white">
            <View className="bg-white px-8 pb-8 pt-2">
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={handleSubmit}
                disabled={isLoading}
                style={{
                  backgroundColor: '#F76B1C',
                  borderRadius: 9999,
                  paddingVertical: 14,
                  alignItems: 'center',
                }}>
                {isLoading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="text-2xl font-bold text-white">Next</Text>
                )}
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </View>
      </KeyboardStickyView>

      {/* iOS date picker modal — always visible regardless of layout */}
      {Platform.OS === 'ios' && (
        <Modal
          transparent
          visible={showDatePicker}
          animationType="fade"
          onRequestClose={() => setShowDatePicker(false)}>
          <Pressable
            onPress={() => setShowDatePicker(false)}
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
            <Pressable
              onPress={(e) => e.stopPropagation()}
              style={{
                backgroundColor: 'white',
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                paddingHorizontal: 16,
                paddingTop: 16,
                paddingBottom: insets.bottom + 16,
              }}>
              <DateTimePicker
                testID="dateTimePicker"
                value={date}
                mode="date"
                onChange={onChange}
                display="spinner"
                maximumDate={tenYearsAgo}
                minimumDate={new Date(1900, 0, 1)}
              />
              <Button
                variant="solid"
                action="primary"
                size="xl"
                className="h-14 rounded-3xl"
                onPress={() => {
                  setBirthdate(date);
                  setShowDatePicker(false);
                }}>
                <ButtonText className="text-lg font-bold text-white">Confirm</ButtonText>
              </Button>
            </Pressable>
          </Pressable>
        </Modal>
      )}

      {/* Plain back button overlay */}
      <TouchableOpacity
        onPress={router.back}
        style={{
          position: 'absolute',
          top: insets.top + 8,
          left: 16,
          zIndex: 10,
        }}>
        <View className="flex-row items-center">
          <Feather name="chevron-left" size={32} color="#FFFFFF" />
          <Text className="ml-1 text-xl font-bold text-white">Back</Text>
        </View>
      </TouchableOpacity>
    </View>
  );
}
