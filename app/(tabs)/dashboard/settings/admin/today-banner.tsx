import { useMutation, useQuery } from 'convex/react';
import * as FileSystem from 'expo-file-system';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Stack } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';

import { BackButton } from '~/components/core/BackButton';
import SafeAreaView from '~/components/core/SafeAreaView';
import { Text } from '~/components/ui/text';
import { api } from '~/convex/_generated/api';
import { Id } from '~/convex/_generated/dataModel';
import { getErrorMessage } from '~/utils/error-message';

const defaultImage = require('~/assets/backgrounds/today-plan-gym.jpg');

export default function AdminTodayBanner() {
  const { width } = useWindowDimensions();
  const bannerWidth = Math.max(1, Math.round(width - 44));
  const savedImageUrl = useQuery(api.coachToday.bannerImage, {});
  const generateUploadUrl = useMutation(api.coachToday.generateBannerUploadUrl);
  const setBannerImage = useMutation(api.coachToday.setBannerImage);
  const [selectedImage, setSelectedImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [saving, setSaving] = useState(false);

  const chooseImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [bannerWidth, 240],
        quality: 0.9,
        selectionLimit: 1,
      });
      if (!result.canceled && result.assets[0]) setSelectedImage(result.assets[0]);
    } catch (error) {
      Alert.alert('Unable to select image', getErrorMessage(error));
    }
  };

  const saveImage = async () => {
    if (!selectedImage || saving) return;
    setSaving(true);
    try {
      const uploadUrl = await generateUploadUrl({});
      const upload = await FileSystem.uploadAsync(uploadUrl, selectedImage.uri, {
        httpMethod: 'POST',
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
        headers: { 'Content-Type': selectedImage.mimeType ?? 'image/jpeg' },
      });
      if (upload.status < 200 || upload.status >= 300) throw new Error('Image upload failed');
      const storageId = JSON.parse(upload.body).storageId as Id<'_storage'> | undefined;
      if (!storageId) throw new Error('Image upload did not return a storage ID');
      await setBannerImage({ image: storageId });
      setSelectedImage(null);
      Alert.alert('Saved', 'The new plan banner is live.');
    } catch (error) {
      Alert.alert('Unable to save banner', getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const useDefaultImage = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await setBannerImage({ image: null });
      setSelectedImage(null);
      Alert.alert('Saved', 'The default plan banner is live.');
    } catch (error) {
      Alert.alert('Unable to reset banner', getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Plan banner',
          headerLeft: () => <BackButton fallbackHref="/(tabs)/dashboard/settings/admin" />,
        }}
      />
      <ScrollView contentContainerStyle={{ padding: 22, gap: 16 }}>
        <Text className="text-xl font-semibold text-black">Today plan banner</Text>
        <Text className="text-sm text-[#686868]">
          Choose an image and crop it to the banner shape. The preview below matches its size on
          this device.
        </Text>
        <View
          style={{
            width: '100%',
            height: 240,
            borderRadius: 22,
            overflow: 'hidden',
            backgroundColor: '#3A3A40',
          }}>
          <Image
            source={
              selectedImage
                ? { uri: selectedImage.uri }
                : savedImageUrl
                  ? { uri: savedImageUrl }
                  : defaultImage
            }
            contentFit="cover"
            contentPosition={{ left: '50%', top: '40%' }}
            style={{ width: '100%', height: '100%' }}
          />
        </View>
        <Text className="text-sm text-[#686868]">
          Banner display size: {bannerWidth} × 240. A higher resolution image with the same
          proportions will look sharper.
        </Text>
        <TouchableOpacity
          accessibilityRole="button"
          disabled={saving}
          onPress={chooseImage}
          className="items-center rounded-xl bg-[#E8541E] p-4">
          <Text className="font-semibold text-white">Choose image</Text>
        </TouchableOpacity>
        {selectedImage ? (
          <TouchableOpacity
            accessibilityRole="button"
            disabled={saving}
            onPress={saveImage}
            className="items-center rounded-xl bg-black p-4">
            {saving ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="font-semibold text-white">Save banner</Text>
            )}
          </TouchableOpacity>
        ) : null}
        {savedImageUrl ? (
          <TouchableOpacity
            accessibilityRole="button"
            disabled={saving}
            onPress={useDefaultImage}
            className="items-center p-3">
            <Text className="font-semibold text-[#E8541E]">Restore default image</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
