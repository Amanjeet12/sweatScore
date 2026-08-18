import { useMutation } from 'convex/react';
import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { ImageSquare } from 'phosphor-react-native';
import { useState } from 'react';
import { Alert, Image, ScrollView, TouchableOpacity, View } from 'react-native';

import { ButtonText, LoadingButton } from '~/components/ui/button';
import { Input, InputField } from '~/components/ui/input';
import { Switch } from '~/components/ui/switch';
import { Text } from '~/components/ui/text';
import { Textarea, TextareaInput } from '~/components/ui/textarea';
import { api } from '~/convex/_generated/api';
import { Doc, Id } from '~/convex/_generated/dataModel';
import { getErrorMessage } from '~/utils/error-message';

type CategoryWithIconUrl = Doc<'checkInCategories'> & { iconUrl?: string | null };

export default function CheckInCategoryForm({ category }: { category?: CategoryWithIconUrl }) {
  const [name, setName] = useState(category?.name ?? '');
  const [description, setDescription] = useState(category?.description ?? '');
  const [sortOrder, setSortOrder] = useState(String(category?.sortOrder ?? 0));
  const [isActive, setIsActive] = useState(category?.isActive ?? true);
  const [iconStorageId, setIconStorageId] = useState<Id<'_storage'> | undefined>(
    category?.iconStorageId
  );
  const [iconUri, setIconUri] = useState(category?.iconUrl ?? undefined);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const generateUploadUrl = useMutation(api.upload.generateUploadUrl);
  const createCategory = useMutation(api.checkInCategories.create);
  const updateCategory = useMutation(api.checkInCategories.update);

  const selectIcon = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      selectionLimit: 1,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    setIconUri(asset.uri);
    setUploading(true);
    try {
      const uploadUrl = await generateUploadUrl();
      const upload = await FileSystem.createUploadTask(uploadUrl, asset.uri, {
        httpMethod: 'POST',
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
        headers: { 'Content-Type': asset.mimeType ?? 'image/jpeg' },
      }).uploadAsync();
      if (!upload?.body) throw new Error('Icon upload failed');
      const body = JSON.parse(upload.body) as { storageId?: string };
      if (!body.storageId) throw new Error('Storage ID was not returned');
      setIconStorageId(body.storageId as Id<'_storage'>);
    } catch (error) {
      Alert.alert('Upload failed', getErrorMessage(error));
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!name.trim() || !description.trim())
      return Alert.alert('Missing details', 'Name and description are required.');
    setSaving(true);
    try {
      const common = {
        name,
        description,
        sortOrder: Number(sortOrder) || 0,
        isActive,
        iconStorageId,
      };
      if (category) await updateCategory({ ...common, categoryId: category._id });
      else await createCategory(common);
      router.back();
    } catch (error) {
      Alert.alert('Unable to save', getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 80 }}>
      <Text className="mb-2 font-bold">Category Name *</Text>
      <Input className="mb-4">
        <InputField value={name} onChangeText={setName} />
      </Input>
      <Text className="mb-2 font-bold">Emoji / Icon</Text>
      <TouchableOpacity
        onPress={selectIcon}
        disabled={uploading}
        className="mb-4 items-center justify-center rounded-xl border border-gray-300 p-4">
        {iconUri ? (
          <Image source={{ uri: iconUri }} className="h-20 w-20 rounded-xl" />
        ) : (
          <ImageSquare size={32} color="#FF5C35" weight="duotone" />
        )}
        <Text className="mt-2 font-bold text-primary-500">
          {uploading ? 'Uploading icon...' : iconUri ? 'Replace Icon' : 'Upload Icon'}
        </Text>
      </TouchableOpacity>
      <Text className="mb-2 font-bold">Description *</Text>
      <Textarea className="mb-4">
        <TextareaInput value={description} onChangeText={setDescription} />
      </Textarea>
      <Text className="mb-2 font-bold">Sort Order</Text>
      <Input className="mb-4">
        <InputField value={sortOrder} keyboardType="number-pad" onChangeText={setSortOrder} />
      </Input>
      <View className="mb-5 flex-row items-center justify-between">
        <Text className="font-bold">Active</Text>
        <Switch value={isActive} onValueChange={setIsActive} />
      </View>
      <LoadingButton onPress={save} loading={saving} disabled={saving || uploading}>
        <ButtonText>{category ? 'Update Category' : 'Create Category'}</ButtonText>
      </LoadingButton>
    </ScrollView>
  );
}
