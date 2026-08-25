import { convexQuery } from '@convex-dev/react-query';
import { Feather } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useQuery } from '@tanstack/react-query';
import { useConvex, useMutation } from 'convex/react';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { ImagePickerAsset } from 'expo-image-picker';
import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Plus } from 'phosphor-react-native';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { KeyboardStickyView, useKeyboardState } from 'react-native-keyboard-controller';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { z } from 'zod';

import { Avatar } from '~/components/core/Avatar';
import { ErrorMessage } from '~/components/core/ErrorMessage';
import ScreenLoading from '~/components/core/ScreenLoading';
import { OnboardingHeroChrome } from '~/components/core/auth/OnboardingHeroChrome';
import { Button, ButtonText } from '~/components/ui/button';
import { Input, InputField, InputSlot } from '~/components/ui/input';
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
  const { height: windowHeight } = useWindowDimensions();
  const { isVisible: keyboardVisible } = useKeyboardState();
  const heroHeight = Math.min(Math.max(windowHeight * 0.53, 360), 465);

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
  const initials =
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('') || 'SS';

  return (
    <View className="flex-1 bg-white">
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar style="light" />

      <Image
        source={require('~/assets/onboarding/setupprofilescreen-clean-v2.png')}
        contentFit="cover"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          width: '100%',
          height: heroHeight,
        }}
      />

      <KeyboardStickyView style={{ flex: 1 }}>
        <View className="flex-1">
          <View style={{ width: '100%', height: heroHeight }} />

          {keyboardVisible && <View className="flex-1" />}

          <View
            className="bg-white"
            style={{
              marginTop: -30,
              borderTopLeftRadius: 32,
              borderTopRightRadius: 32,
              shadowColor: '#000000',
              shadowOffset: { width: 0, height: -5 },
              shadowOpacity: 0.05,
              shadowRadius: 12,
            }}>
            <View className={`px-6 ${keyboardVisible ? 'pt-5' : 'pt-7'}`}>
              {!keyboardVisible && (
                <>
                  <Text className="font-body text-xs font-bold uppercase tracking-[1.5px] text-primary-500">
                    Make it yours
                  </Text>
                  <Text className="mt-2 font-heading text-3xl font-bold leading-9 text-[#1A1A1A]">
                    Personalise your profile
                  </Text>
                  <Text className="mt-1 font-body text-sm leading-5 text-[#838383]">
                    Help your Sweat Sisters recognise you.
                  </Text>
                </>
              )}

              <TouchableOpacity
                accessibilityRole="button"
                activeOpacity={0.75}
                onPress={selectImage}
                className={`${keyboardVisible ? 'mt-0' : 'mt-3'} h-[68px] flex-row items-center rounded-2xl border border-[#E8DDD6] bg-[#FFF9F6] px-3`}>
                <View>
                  {hasAvatar ? (
                    <Avatar uri={avatarUri} size={48} name={name} />
                  ) : (
                    <View className="h-12 w-12 items-center justify-center rounded-full bg-[#FFF0E8]">
                      <Text className="font-heading text-sm font-bold text-primary-500">
                        {initials}
                      </Text>
                    </View>
                  )}
                  <View className="absolute -bottom-0.5 -right-0.5 h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-primary-500">
                    <Plus size={11} color="#FFFFFF" weight="bold" />
                  </View>
                </View>

                <View className="ml-4 flex-1">
                  <Text className="font-body text-sm font-bold text-[#1A1A1A]">
                    {hasAvatar ? 'Change profile photo' : 'Add a profile photo'}
                  </Text>
                  <Text className="mt-1 font-body text-xs text-[#838383]">
                    Optional · JPG or PNG
                  </Text>
                </View>
              </TouchableOpacity>

              <Text className="mb-2 mt-3 font-body text-xs font-bold text-[#4A4745]">
                Your name
              </Text>
              <Input
                size="xl"
                variant="outline"
                className="h-14 rounded-2xl border-[#E8DDD6] bg-white">
                <InputField
                  className="font-body text-base text-[#1A1A1A] placeholder:text-[#AAA5A1]"
                  placeholder="How should we call you?"
                  autoComplete="name"
                  returnKeyType="next"
                  value={name}
                  onChangeText={(text) => {
                    setError(null);
                    setName(text);
                  }}
                />
              </Input>

              <Text className="mb-2 mt-3 font-body text-xs font-bold text-[#4A4745]">
                Date of birth
              </Text>
              {Platform.OS === 'ios' ? (
                <Input
                  size="xl"
                  variant="outline"
                  className="h-14 rounded-2xl border-[#E8DDD6] bg-white">
                  <InputField
                    className="font-body text-base text-[#1A1A1A] placeholder:text-[#AAA5A1]"
                    placeholder="DD / MM / YYYY"
                    value={formatDateToLocaleString(birthdate)}
                    editable={false}
                    onPressIn={() => setShowDatePicker(true)}
                  />
                  <InputSlot className="pr-4" onPress={() => setShowDatePicker(true)}>
                    <Feather name="calendar" size={19} color="#FF5C1A" />
                  </InputSlot>
                </Input>
              ) : (
                <Input
                  size="xl"
                  variant="outline"
                  className="h-14 rounded-2xl border-[#E8DDD6] bg-white">
                  <TouchableOpacity
                    className="flex-1"
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
                      className="font-body text-base text-[#1A1A1A] placeholder:text-[#AAA5A1]"
                      placeholder="DD / MM / YYYY"
                      value={formatDateToLocaleString(birthdate)}
                      editable={false}
                    />
                  </TouchableOpacity>
                  <InputSlot className="pr-4">
                    <Feather name="calendar" size={19} color="#FF5C1A" />
                  </InputSlot>
                </Input>
              )}

              <View className="mt-2 items-center">
                <ErrorMessage error={error} />
              </View>
            </View>
          </View>

          {!keyboardVisible && <View className="flex-1 bg-white" />}

          <SafeAreaView edges={['bottom']} className="bg-white">
            <View className="bg-white px-6 pb-4 pt-2">
              <TouchableOpacity
                accessibilityRole="button"
                activeOpacity={0.8}
                onPress={handleSubmit}
                disabled={isLoading}
                style={{
                  height: 56,
                  backgroundColor: '#FF5C1A',
                  borderRadius: 17,
                  paddingHorizontal: 22,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  shadowColor: '#FF5C1A',
                  shadowOffset: { width: 0, height: 8 },
                  shadowOpacity: 0.2,
                  shadowRadius: 14,
                }}>
                {isLoading ? (
                  <ActivityIndicator color="white" style={{ flex: 1 }} />
                ) : (
                  <>
                    <Text className="font-heading text-base font-bold text-white">Continue</Text>
                    <Feather name="arrow-right" size={23} color="#FFFFFF" />
                  </>
                )}
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </View>
      </KeyboardStickyView>

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

      <OnboardingHeroChrome activeStep={3} onBack={router.back} />
    </View>
  );
}
