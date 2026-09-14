import { useMutation, useQuery } from 'convex/react';
import * as FileSystem from 'expo-file-system';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, Stack } from 'expo-router';
import { Camera, ImageSquare, Plus } from 'phosphor-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, TouchableOpacity, View } from 'react-native';

import { BackButton } from '~/components/core/BackButton';
import SafeAreaView from '~/components/core/SafeAreaView';
import ScreenLoading from '~/components/core/ScreenLoading';
import { Text } from '~/components/ui/text';
import { api } from '~/convex/_generated/api';
import { useSubscriptionGuard } from '~/hooks/useSubscriptionGuard';

type PickedPhoto = { uri: string; mimeType?: string | null; label: string };

export default function ProgressPhotoScreen() {
  const { isPro, requireSubscription } = useSubscriptionGuard();
  // Cast is temporary until the testing Convex deployment generates this API entry.
  const progress = useQuery(api.progressPhotos.getDashboard, isPro ? {} : 'skip');
  const generateUploadUrl = useMutation(api.upload.generateUploadUrl);
  const createProgressPhoto = useMutation(api.progressPhotos.create);
  const [frontPhoto, setFrontPhoto] = useState<PickedPhoto | null>(null);
  const [sidePhoto, setSidePhoto] = useState<PickedPhoto | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isPro) return;
    requireSubscription({
      redirectTo: '/progress-photo',
      source: 'progress_photo_screen',
    });
  }, [isPro, requireSubscription]);

  const canLog = progress?.canLogCurrentWeek ?? true;

  if (!isPro) return <ScreenLoading />;

  const pickPhoto = async (kind: 'front' | 'side', source: 'camera' | 'library') => {
    const permission =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        'Photo access needed',
        'Allow access so you can add your private progress photo.'
      );
      return;
    }

    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (result.canceled || !result.assets[0]) return;

    const photo = {
      uri: result.assets[0].uri,
      mimeType: result.assets[0].mimeType,
      label: kind === 'front' ? 'Front view' : 'Side view',
    };
    if (kind === 'front') setFrontPhoto(photo);
    else setSidePhoto(photo);
  };

  const openPicker = (kind: 'front' | 'side') => {
    Alert.alert(`Add ${kind === 'front' ? 'front' : 'side'} photo`, '', [
      { text: 'Take Photo', onPress: () => pickPhoto(kind, 'camera') },
      { text: 'Upload from Gallery', onPress: () => pickPhoto(kind, 'library') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const upload = async (photo: PickedPhoto) => {
    const uploadUrl = await generateUploadUrl();
    const result = await FileSystem.uploadAsync(uploadUrl, photo.uri, {
      httpMethod: 'POST',
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      headers: { 'Content-Type': photo.mimeType || 'image/jpeg' },
    });
    const storageId = JSON.parse(result.body || '{}').storageId;
    if (!storageId) throw new Error('Photo upload did not finish.');
    return storageId;
  };

  const save = async () => {
    if (!frontPhoto || saving || !canLog) return;
    setSaving(true);
    try {
      const frontStorageId = await upload(frontPhoto);
      const sideStorageId = sidePhoto ? await upload(sidePhoto) : undefined;
      await createProgressPhoto({
        frontPhoto: frontStorageId,
        ...(sideStorageId ? { sidePhoto: sideStorageId } : {}),
      });
      Alert.alert('Week logged', 'Your progress photos have been added to your profile.');
      router.back();
    } catch (error) {
      Alert.alert(
        'Could not save photos',
        error instanceof Error ? error.message : 'Please try again.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-[#F9F9F9]">
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: 'Weekly progress',
          headerShadowVisible: false,
          headerStyle: { backgroundColor: '#F9F9F9' },
          headerTitleStyle: {
            fontFamily: 'Inter_700Bold',
            fontSize: 20,
            color: '#1A1A1A',
          },
          headerLeft: () => <BackButton />,
        }}
      />
      <View className="flex-1 px-5 pb-7 pt-5">
        <View className="rounded-[24px] bg-white px-5 py-6">
          <View className="h-14 w-14 items-center justify-center rounded-full bg-[#FFF0E9]">
            <Camera size={27} color="#FF5C35" weight="duotone" />
          </View>
          <Text
            className="mt-4 text-[22px] leading-7 text-[#1D1B1A]"
            style={{ fontFamily: 'Inter_700Bold' }}>
            Log this week’s progress
          </Text>
          <Text className="mt-2 font-body text-sm leading-5 text-[#77716D]">
            These photos stay private in your account.
          </Text>
        </View>

        {canLog ? (
          <View className="mt-5 flex-row gap-x-3">
            {(
              [
                ['front', frontPhoto, 'Front view', true],
                ['side', sidePhoto, 'Side view', false],
              ] as const
            ).map(([kind, photo, label, required]) => (
              <TouchableOpacity
                key={kind}
                activeOpacity={0.8}
                onPress={() => openPicker(kind)}
                className="h-[210px] flex-1 overflow-hidden rounded-[20px] bg-white">
                {photo ? (
                  <Image
                    source={{ uri: photo.uri }}
                    style={{ width: '100%', height: '100%' }}
                    contentFit="cover"
                  />
                ) : (
                  <View className="h-full items-center justify-center px-3">
                    <View className="h-10 w-10 items-center justify-center rounded-full bg-[#FFF0E9]">
                      {kind === 'front' ? (
                        <Camera size={20} color="#FF5C35" />
                      ) : (
                        <Plus size={20} color="#FF5C35" />
                      )}
                    </View>
                    <Text
                      className="mt-3 text-center text-sm text-[#1D1B1A]"
                      style={{ fontFamily: 'Inter_600SemiBold' }}>
                      {label}
                    </Text>
                    <Text className="mt-1 text-center font-body text-[11px] text-[#77716D]">
                      {required ? 'Required' : 'Optional'}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <View className="mt-5 items-center rounded-[24px] bg-white px-5 py-8">
            <ImageSquare size={28} color="#A09A96" />
            <Text
              className="mt-3 text-base text-[#1D1B1A]"
              style={{ fontFamily: 'Inter_600SemiBold' }}>
              This week is logged
            </Text>
            <Text className="mt-1 text-center font-body text-sm text-[#77716D]">
              Your next progress entry opens on Monday.
            </Text>
          </View>
        )}

        <View className="flex-1" />
        <TouchableOpacity
          activeOpacity={0.84}
          disabled={!frontPhoto || saving || !canLog}
          onPress={save}
          className="h-[54px] items-center justify-center rounded-[20px]"
          style={{ backgroundColor: frontPhoto && canLog ? '#FF5C35' : '#DED9D5' }}>
          {saving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text className="text-base text-white" style={{ fontFamily: 'Inter_600SemiBold' }}>
              Save weekly progress
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
