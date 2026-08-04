import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Stack } from 'expo-router';
import { useMutation, useQuery } from 'convex/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { BackButton } from '~/components/core/BackButton';
import SafeAreaView from '~/components/core/SafeAreaView';
import { Text } from '~/components/ui/text';
import { api } from '~/convex/_generated/api';
import type { Id } from '~/convex/_generated/dataModel';

type ScreenMode = 'create' | 'add' | 'edit';

type PickedGroupImage = {
  uri: string;
  mimeType: string;
  fileSize?: number;
};

const MAX_GROUP_IMAGE_BYTES = 5 * 1024 * 1024;

export default function AdminChatGroupsScreen() {
  const [mode, setMode] = useState<ScreenMode>('create');
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [search, setSearch] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState<Id<'chatGroups'> | null>(null);
  const [selectedUserIds, setSelectedUserIds] = useState<Id<'users'>[]>([]);
  const [selectedImage, setSelectedImage] = useState<PickedGroupImage | null>(null);
  const [removeExistingImage, setRemoveExistingImage] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const hasInitializedCreateMembers = useRef(false);

  const groups = useQuery(api.chat.admin.listGroupsForAdmin) ?? [];
  const userQueryArgs = mode === 'add' && selectedGroupId ? { groupId: selectedGroupId } : {};
  const users = useQuery(api.chat.admin.listUsersForAdmin, userQueryArgs) ?? [];

  const createGroup = useMutation(api.chat.admin.createGroup);
  const addMembers = useMutation(api.chat.admin.addMembers);
  const updateGroup = useMutation(api.chat.admin.updateGroup);
  const deleteGroup = useMutation(api.chat.admin.deleteGroup);
  const generateGroupImageUploadUrl = useMutation(api.chat.admin.generateGroupImageUploadUrl);
  const cleanupUnusedGroupImage = useMutation(api.chat.admin.cleanupUnusedGroupImage);

  const selectedGroup = useMemo(
    () => groups.find((group) => group._id === selectedGroupId) ?? null,
    [groups, selectedGroupId]
  );

  const visibleUsers = useMemo(() => {
    const query = search.trim().toLowerCase();

    return users.filter((user) => {
      if (!query) return true;

      return `${user.name} ${user.email ?? ''}`.toLowerCase().includes(query);
    });
  }, [search, users]);

  useEffect(() => {
    if ((mode === 'add' || mode === 'edit') && !selectedGroupId) {
      setSelectedGroupId(groups[0]?._id ?? null);
    }
  }, [groups, mode, selectedGroupId]);

  useEffect(() => {
    if (mode !== 'create' || hasInitializedCreateMembers.current || users.length === 0) {
      return;
    }

    setSelectedUserIds(users.map((user) => user._id));
    hasInitializedCreateMembers.current = true;
  }, [mode, users]);

  useEffect(() => {
    if (mode !== 'edit') return;

    setGroupName(selectedGroup?.name ?? '');
    setGroupDescription(selectedGroup?.description ?? '');
    setSelectedImage(null);
    setRemoveExistingImage(false);
  }, [mode, selectedGroup?._id, selectedGroup?.name, selectedGroup?.description]);

  const resetImageState = () => {
    setSelectedImage(null);
    setRemoveExistingImage(false);
  };

  const changeMode = (nextMode: ScreenMode) => {
    hasInitializedCreateMembers.current = false;
    setMode(nextMode);
    setSearch('');
    setSelectedUserIds([]);
    resetImageState();

    if (nextMode === 'create') {
      setSelectedGroupId(null);
      setGroupName('');
      setGroupDescription('');
      return;
    }

    const nextGroupId = selectedGroupId ?? groups[0]?._id ?? null;
    setSelectedGroupId(nextGroupId);

    if (nextMode === 'edit') {
      const nextGroup = groups.find((group) => group._id === nextGroupId);
      setGroupName(nextGroup?.name ?? '');
      setGroupDescription(nextGroup?.description ?? '');
    } else {
      setGroupName('');
    }
  };

  const selectGroup = (groupId: Id<'chatGroups'>) => {
    setSelectedGroupId(groupId);
    setSelectedUserIds([]);
    resetImageState();

    if (mode === 'edit') {
      const group = groups.find((item) => item._id === groupId);
      setGroupName(group?.name ?? '');
      setGroupDescription(group?.description ?? '');
    }
  };

  const toggleUser = (userId: Id<'users'>, isAlreadyMember: boolean) => {
    if (isAlreadyMember) return;

    setSelectedUserIds((current) =>
      current.some((id) => id === userId)
        ? current.filter((id) => id !== userId)
        : [...current, userId]
    );
  };

  const pickGroupImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled) return;

    const asset = result.assets[0];

    if (asset.fileSize && asset.fileSize > MAX_GROUP_IMAGE_BYTES) {
      Alert.alert('Image is too large', 'Choose an image smaller than 5 MB.');
      return;
    }

    setSelectedImage({
      uri: asset.uri,
      mimeType: asset.mimeType ?? 'image/jpeg',
      fileSize: asset.fileSize,
    });
    setRemoveExistingImage(false);
  };

  const removeGroupImage = () => {
    setSelectedImage(null);

    if (mode === 'edit' && selectedGroup?.imageUrl) {
      setRemoveExistingImage(true);
    }
  };

  const uploadSelectedImage = async () => {
    if (!selectedImage) return undefined;

    const uploadUrl = await generateGroupImageUploadUrl();
    const localResponse = await fetch(selectedImage.uri);

    if (!localResponse.ok) {
      throw new Error('Unable to read the selected image.');
    }

    const imageBlob = await localResponse.blob();
    const uploadResponse = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Content-Type': selectedImage.mimeType || imageBlob.type || 'image/jpeg',
      },
      body: imageBlob,
    });

    if (!uploadResponse.ok) {
      throw new Error('Unable to upload the group image.');
    }

    const result = (await uploadResponse.json()) as {
      storageId: Id<'_storage'>;
    };

    return result.storageId;
  };

  const cleanupUploadedImage = async (storageId: Id<'_storage'> | undefined) => {
    if (!storageId) return;

    try {
      await cleanupUnusedGroupImage({ storageId });
    } catch {
      // The image may already be referenced by a successfully saved group.
    }
  };

  const handleCreateGroup = async () => {
    const name = groupName.trim();

    if (name.length < 2) {
      Alert.alert('Group name required', 'Enter a valid group name.');
      return;
    }

    let uploadedImageStorageId: Id<'_storage'> | undefined;

    try {
      setIsSubmitting(true);
      uploadedImageStorageId = await uploadSelectedImage();

      const groupId = await createGroup({
        name,
        description: groupDescription.trim() || undefined,
        memberIds: selectedUserIds,
        ...(uploadedImageStorageId ? { imageStorageId: uploadedImageStorageId } : {}),
      });

      setGroupName('');
      setGroupDescription('');
      setSelectedUserIds(users.map((user) => user._id));
      resetImageState();
      setSelectedGroupId(groupId);

      Alert.alert('Group created', `${name} is ready.`);
    } catch (error) {
      await cleanupUploadedImage(uploadedImageStorageId);
      Alert.alert(
        'Unable to create group',
        error instanceof Error ? error.message : 'Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddMembers = async () => {
    if (!selectedGroupId) {
      Alert.alert('Select a group', 'Choose the group to update.');
      return;
    }

    if (selectedUserIds.length === 0) {
      Alert.alert('Select members', 'Select at least one new member.');
      return;
    }

    try {
      setIsSubmitting(true);

      const result = await addMembers({
        groupId: selectedGroupId,
        memberIds: selectedUserIds,
      });

      setSelectedUserIds([]);

      Alert.alert('Members updated', `${result.added + result.reactivated} member(s) added.`);
    } catch (error) {
      Alert.alert(
        'Unable to add members',
        error instanceof Error ? error.message : 'Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateGroup = async () => {
    if (!selectedGroupId) {
      Alert.alert('Select a group', 'Choose the group to edit.');
      return;
    }

    const name = groupName.trim();

    if (name.length < 2) {
      Alert.alert('Group name required', 'Enter a valid group name.');
      return;
    }

    let uploadedImageStorageId: Id<'_storage'> | undefined;

    try {
      setIsSubmitting(true);
      uploadedImageStorageId = await uploadSelectedImage();

      await updateGroup({
        groupId: selectedGroupId,
        name,
        description: groupDescription.trim() || undefined,
        removeImage: removeExistingImage,
        ...(uploadedImageStorageId ? { imageStorageId: uploadedImageStorageId } : {}),
      });

      resetImageState();
      Alert.alert('Group updated', 'The group details were saved.');
    } catch (error) {
      await cleanupUploadedImage(uploadedImageStorageId);
      Alert.alert(
        'Unable to update group',
        error instanceof Error ? error.message : 'Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteGroup = () => {
    if (!selectedGroup) {
      Alert.alert('Select a group', 'Choose the group to delete.');
      return;
    }

    if (!selectedGroup.canDelete) {
      Alert.alert('Protected group', 'The default Sweat Sisters group cannot be deleted.');
      return;
    }

    Alert.alert(
      'Delete group?',
      `${selectedGroup.name} will disappear for all members. Its message history will be retained.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsSubmitting(true);
              await deleteGroup({ groupId: selectedGroup._id });
              setSelectedGroupId(null);
              setGroupName('');
              setGroupDescription('');
              resetImageState();
              setMode('create');
              Alert.alert('Group deleted', 'The group is no longer active.');
            } catch (error) {
              Alert.alert(
                'Unable to delete group',
                error instanceof Error ? error.message : 'Please try again.'
              );
            } finally {
              setIsSubmitting(false);
            }
          },
        },
      ]
    );
  };

  const previewImageUri = selectedImage?.uri
    ? selectedImage.uri
    : mode === 'edit' && !removeExistingImage
      ? selectedGroup?.imageUrl
      : null;

  return (
    <SafeAreaView className="flex-1 bg-white">
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitleAlign: 'center',
          title: '',
          headerTitle: () => (
            <Text className="text-center font-heading text-2xl font-bold text-[#1A1A1A]">
              Chat Groups
            </Text>
          ),
          headerShadowVisible: false,
          headerLeft: () => <BackButton fallbackHref="/dashboard/settings/admin" />,
        }}
      />

      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 pb-10 pt-4"
        keyboardShouldPersistTaps="handled">
        <Text className="text-2xl font-bold text-neutral-900">Manage chat groups</Text>
        <Text className="mt-1 text-sm text-neutral-500">
          Create groups, upload their images, add members, or edit group details.
        </Text>

        <View className="mt-5 flex-row rounded-2xl bg-neutral-100 p-1">
          <ModeButton
            active={mode === 'create'}
            icon="add-circle-outline"
            label="Create"
            onPress={() => changeMode('create')}
          />
          <ModeButton
            active={mode === 'add'}
            icon="person-add-outline"
            label="Members"
            onPress={() => changeMode('add')}
          />
          <ModeButton
            active={mode === 'edit'}
            icon="create-outline"
            label="Edit"
            onPress={() => changeMode('edit')}
          />
        </View>

        {mode !== 'create' ? (
          <GroupSelector groups={groups} selectedGroupId={selectedGroupId} onSelect={selectGroup} />
        ) : null}

        {mode === 'create' || mode === 'edit' ? (
          <View className="mt-6">
            <Text className="mb-2 text-sm font-semibold text-neutral-800">Group image</Text>

            <View className="flex-row items-center">
              <TouchableOpacity
                className="h-24 w-24 items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-orange-300 bg-orange-50"
                disabled={isSubmitting}
                onPress={pickGroupImage}>
                {previewImageUri ? (
                  <Image
                    className="h-full w-full"
                    resizeMode="cover"
                    source={{ uri: previewImageUri }}
                  />
                ) : (
                  <Ionicons name="camera-outline" size={30} color="#F97316" />
                )}
              </TouchableOpacity>

              <View className="ml-4 flex-1">
                <TouchableOpacity
                  className="self-start rounded-xl bg-orange-500 px-4 py-2.5"
                  disabled={isSubmitting}
                  onPress={pickGroupImage}>
                  <Text className="font-semibold text-white">
                    {previewImageUri ? 'Change image' : 'Upload image'}
                  </Text>
                </TouchableOpacity>

                {previewImageUri ? (
                  <TouchableOpacity
                    className="mt-2 self-start px-1 py-1"
                    disabled={isSubmitting}
                    onPress={removeGroupImage}>
                    <Text className="font-semibold text-red-500">Remove image</Text>
                  </TouchableOpacity>
                ) : null}

                <Text className="mt-1 text-xs text-neutral-500">
                  Square JPG or PNG, maximum 5 MB.
                </Text>
              </View>
            </View>

            <Text className="mb-2 mt-5 text-sm font-semibold text-neutral-800">Group name</Text>
            <TextInput
              className="rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-base text-neutral-900"
              editable={!isSubmitting}
              maxLength={60}
              placeholder="Example: Morning Warriors"
              placeholderTextColor="#A3A3A3"
              value={groupName}
              onChangeText={setGroupName}
            />

            <Text className="mb-2 mt-5 text-sm font-semibold text-neutral-800">
              Group description
            </Text>
            <TextInput
              className="min-h-28 rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-base text-neutral-900"
              editable={!isSubmitting}
              maxLength={500}
              multiline
              placeholder="Tell members what this group is about"
              placeholderTextColor="#A3A3A3"
              textAlignVertical="top"
              value={groupDescription}
              onChangeText={setGroupDescription}
            />
            <Text className="mt-2 text-right text-xs text-neutral-500">
              {groupDescription.length}/500
            </Text>
          </View>
        ) : null}

        {mode === 'create' || mode === 'add' ? (
          <MemberPicker
            mode={mode}
            search={search}
            selectedUserIds={selectedUserIds}
            users={visibleUsers}
            onSearchChange={setSearch}
            onToggleUser={toggleUser}
          />
        ) : null}

        {mode === 'edit' && !selectedGroup ? (
          <Text className="mt-8 text-center text-neutral-500">
            Create a group before editing it.
          </Text>
        ) : null}

        {mode === 'edit' && selectedGroup ? (
          <TouchableOpacity
            className={`mt-6 flex-row items-center justify-center rounded-2xl border border-red-200 py-4 ${
              selectedGroup.canDelete ? 'bg-red-50' : 'bg-neutral-100'
            }`}
            disabled={isSubmitting}
            onPress={handleDeleteGroup}>
            <Ionicons
              name={selectedGroup.canDelete ? 'trash-outline' : 'lock-closed-outline'}
              size={20}
              color={selectedGroup.canDelete ? '#DC2626' : '#737373'}
            />
            <Text
              className={`ml-2 text-base font-bold ${
                selectedGroup.canDelete ? 'text-red-600' : 'text-neutral-500'
              }`}>
              {selectedGroup.canDelete ? 'Delete group' : 'Default group cannot be deleted'}
            </Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>

      <View className="border-t border-neutral-100 bg-white px-4 pb-3 pt-3">
        <TouchableOpacity
          className={`items-center rounded-2xl py-4 ${
            isSubmitting ? 'bg-orange-300' : 'bg-orange-500'
          }`}
          disabled={isSubmitting || (mode !== 'create' && !selectedGroupId)}
          onPress={
            mode === 'create'
              ? handleCreateGroup
              : mode === 'add'
                ? handleAddMembers
                : handleUpdateGroup
          }>
          {isSubmitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text className="text-base font-bold text-white">
              {mode === 'create'
                ? `Create group${
                    selectedUserIds.length ? ` with ${selectedUserIds.length} member(s)` : ''
                  }`
                : mode === 'add'
                  ? `Add ${selectedUserIds.length} member(s)`
                  : 'Save group changes'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function GroupSelector({
  groups,
  selectedGroupId,
  onSelect,
}: {
  groups: Array<{
    _id: Id<'chatGroups'>;
    name: string;
    description: string;
    memberCount: number;
    imageUrl: string | null;
  }>;
  selectedGroupId: Id<'chatGroups'> | null;
  onSelect: (groupId: Id<'chatGroups'>) => void;
}) {
  return (
    <View className="mt-5">
      <Text className="mb-2 text-sm font-semibold text-neutral-800">Select group</Text>

      {groups.length ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerClassName="gap-2">
          {groups.map((group) => {
            const selected = selectedGroupId === group._id;

            return (
              <TouchableOpacity
                key={group._id}
                className={`min-w-40 flex-row items-center rounded-2xl border px-3 py-3 ${
                  selected ? 'border-orange-500 bg-orange-50' : 'border-neutral-200 bg-white'
                }`}
                onPress={() => onSelect(group._id)}>
                {group.imageUrl ? (
                  <Image
                    className="h-11 w-11 rounded-full"
                    resizeMode="cover"
                    source={{ uri: group.imageUrl }}
                  />
                ) : (
                  <View className="h-11 w-11 items-center justify-center rounded-full bg-orange-100">
                    <Ionicons name="chatbubbles-outline" size={22} color="#F97316" />
                  </View>
                )}

                <View className="ml-3">
                  <Text
                    className={`font-semibold ${selected ? 'text-orange-600' : 'text-neutral-800'}`}
                    numberOfLines={1}>
                    {group.name}
                  </Text>
                  <Text className="mt-0.5 text-xs text-neutral-500">
                    {group.memberCount} members
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      ) : (
        <View className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-6">
          <Text className="text-center text-neutral-500">No active groups found.</Text>
        </View>
      )}
    </View>
  );
}

function MemberPicker({
  mode,
  search,
  selectedUserIds,
  users,
  onSearchChange,
  onToggleUser,
}: {
  mode: 'create' | 'add';
  search: string;
  selectedUserIds: Id<'users'>[];
  users: Array<{
    _id: Id<'users'>;
    name: string;
    email: string | null;
    isMember: boolean;
  }>;
  onSearchChange: (value: string) => void;
  onToggleUser: (userId: Id<'users'>, isAlreadyMember: boolean) => void;
}) {
  return (
    <View className="mt-6">
      <Text className="text-base font-bold text-neutral-900">
        {mode === 'create' ? 'Select initial members' : 'Select new members'}
      </Text>
      <Text className="mt-0.5 text-xs text-neutral-500">{selectedUserIds.length} selected</Text>

      <TextInput
        className="mt-3 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-base text-neutral-900"
        placeholder="Search by name or email"
        placeholderTextColor="#A3A3A3"
        value={search}
        onChangeText={onSearchChange}
      />

      <View className="mt-3 overflow-hidden rounded-2xl border border-neutral-200 bg-white">
        {users.map((user, index) => {
          const selected = selectedUserIds.some((userId) => userId === user._id);
          const disabled = mode === 'add' && user.isMember;

          return (
            <Pressable
              key={user._id}
              className={`flex-row items-center px-4 py-3 ${
                index !== users.length - 1 ? 'border-b border-neutral-100' : ''
              } ${disabled ? 'opacity-50' : ''}`}
              disabled={disabled}
              onPress={() => onToggleUser(user._id, disabled)}>
              <View className="h-10 w-10 items-center justify-center rounded-full bg-orange-100">
                <Text className="font-bold text-orange-600">
                  {user.name.slice(0, 1).toUpperCase()}
                </Text>
              </View>

              <View className="ml-3 flex-1">
                <Text className="font-semibold text-neutral-900">{user.name}</Text>
                {user.email ? (
                  <Text className="mt-0.5 text-xs text-neutral-500">{user.email}</Text>
                ) : null}
              </View>

              {disabled ? (
                <Text className="text-xs font-medium text-neutral-500">Added</Text>
              ) : (
                <View
                  className={`h-6 w-6 items-center justify-center rounded-full border ${
                    selected ? 'border-orange-500 bg-orange-500' : 'border-neutral-300 bg-white'
                  }`}>
                  {selected ? <Ionicons name="checkmark" size={16} color="#FFFFFF" /> : null}
                </View>
              )}
            </Pressable>
          );
        })}

        {users.length === 0 ? (
          <Text className="px-4 py-8 text-center text-neutral-500">No users found.</Text>
        ) : null}
      </View>
    </View>
  );
}

function ModeButton({
  active,
  icon,
  label,
  onPress,
}: {
  active: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      className={`flex-1 items-center rounded-xl py-2.5 ${active ? 'bg-white' : 'bg-transparent'}`}
      onPress={onPress}>
      <Ionicons name={icon} size={19} color={active ? '#EA580C' : '#737373'} />
      <Text
        className={`mt-1 text-xs font-semibold ${active ? 'text-orange-600' : 'text-neutral-500'}`}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}
