import { convexQuery } from '@convex-dev/react-query';
import { Feather } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useQuery } from '@tanstack/react-query';
import { useConvex, useMutation } from 'convex/react';
import * as ImagePicker from 'expo-image-picker';
import { ImagePickerAsset } from 'expo-image-picker';
import { router } from 'expo-router';
import { Plus } from 'phosphor-react-native';
import { useEffect, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  TouchableOpacity,
  Keyboard,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { z } from 'zod';

import { Avatar } from '~/components/core/Avatar';
import ScreenLoading from '~/components/core/ScreenLoading';
import {
  PrototypeOnboarding,
  PrototypeButton,
  PrototypeError,
  onboardingStyles as styles,
} from '~/components/core/auth/PrototypeOnboarding';
import { prototypeTypography as type } from '~/components/core/design/prototypeStyles';
import { Text } from '~/components/ui/text';
import { api } from '~/convex/_generated/api';
import { useCoachRouteGuard } from '~/hooks/useCoachRouteGuard';
import { useAuthStore } from '~/store/useAuthStore';
import { CatchPromise } from '~/utils/catch-promise';
import { resumeMember } from '~/utils/coachResumeNavigation';
import { getErrorMessage, getZodErrorMessage } from '~/utils/error-message';
import { formatDateToLocaleString } from '~/utils/formatter';

const BIO_ROUTE = ['bio'] as const;

export default function SetupProfile() {
  const { accepted } = useCoachRouteGuard(BIO_ROUTE);
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
  const [nameFocused, setNameFocused] = useState(false);

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
    if (isLoading) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await updateBioSchema.safeParse({ name: name.trim(), birthdate });

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
          name: name.trim(),
          birthdate: birthdate?.getTime(),
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
        await resumeMember(convex);
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  const selectImage = async () => {
    try {
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
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const onChange = (_event: any, selectedDate: any) => {
    if (!selectedDate) return;
    setDate(selectedDate);
    if (Platform.OS === 'android' && _event.type === 'set') setBirthdate(selectedDate);
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

  if (isPending || !accepted) return <ScreenLoading />;

  const avatarUri = photo?.uri ?? currentUser?.image ?? undefined;
  const hasAvatar = !!avatarUri;
  const initials =
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('') || 'SS';

  const openDatePicker = () => {
    Keyboard.dismiss();
    setError(null);
    if (Platform.OS === 'ios') setShowDatePicker(true);
    else
      DateTimePickerAndroid.open({
        value: date,
        onChange,
        mode: 'date',
        display: 'spinner',
        maximumDate: tenYearsAgo,
        minimumDate: new Date(1900, 0, 1),
      });
  };

  return (
    <>
      <PrototypeOnboarding
        stickyFooter
        image={require('~/assets/onboarding/profile-portrait.jpg')}
        profile
        onBack={router.back}
        footer={<PrototypeButton label="Continue" onPress={handleSubmit} loading={isLoading} />}>
        <Text style={styles.heading}>Personalise your profile</Text>
        <Text style={styles.subtitle}>Help your Sweat Sisters recognise you.</Text>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={hasAvatar ? 'Change profile photo' : 'Add a profile photo'}
          disabled={isLoading}
          activeOpacity={0.75}
          onPress={selectImage}
          style={{ marginTop: 24, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View>
            {hasAvatar ? (
              <Avatar uri={avatarUri} size={72} name={name} />
            ) : (
              <View
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 36,
                  backgroundColor: '#fff3ea',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 22, color: '#e8541e' }}>
                  {initials}
                </Text>
              </View>
            )}
            <View
              style={{
                position: 'absolute',
                right: -2,
                bottom: -2,
                width: 26,
                height: 26,
                borderRadius: 13,
                borderWidth: 2,
                borderColor: '#fff',
                backgroundColor: '#ff5a1f',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Plus size={12} color="#fff" weight="bold" />
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                ...type.cardTitle,
              }}>
              {hasAvatar ? 'Change profile photo' : 'Add a profile photo'}
            </Text>
            <Text style={[styles.small, { marginTop: 2 }]}>Optional · JPG or PNG</Text>
          </View>
        </TouchableOpacity>
        <Text style={styles.label}>Your name</Text>
        <TextInput
          accessibilityLabel="Your name"
          style={[
            styles.field,
            {
              borderColor: error && !name.trim() ? '#d92d20' : nameFocused ? '#2a2a2a' : '#ececec',
            },
          ]}
          placeholder="What should we call you?"
          placeholderTextColor="#8a8a8a"
          autoComplete="name"
          returnKeyType="next"
          editable={!isLoading}
          value={name}
          onFocus={() => setNameFocused(true)}
          onBlur={() => setNameFocused(false)}
          onSubmitEditing={openDatePicker}
          onChangeText={(text) => {
            setError(null);
            setName(text);
          }}
        />
        <Text style={styles.label}>Date of birth</Text>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Date of birth"
          disabled={isLoading}
          onPress={openDatePicker}
          style={[
            styles.fieldContainer,
            { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
          ]}>
          <Text
            style={{
              ...type.field,
              flex: 1,
              marginRight: 12,
              color: birthdate ? '#2a2a2a' : '#8a8a8a',
            }}>
            {birthdate ? formatDateToLocaleString(birthdate) : 'DD / MM / YYYY'}
          </Text>
          <Feather name="calendar" size={22} color="#e8541e" />
        </TouchableOpacity>
        <View style={{ marginTop: 8 }}>
          <PrototypeError error={error} />
        </View>
      </PrototypeOnboarding>
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
              <PrototypeButton
                label="Confirm"
                onPress={() => {
                  setBirthdate(date);
                  setShowDatePicker(false);
                }}
              />
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </>
  );
}
