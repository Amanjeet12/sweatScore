import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import {
  ArrowLeft,
  Camera,
  Check,
  Crown,
  MagnifyingGlass,
  PencilSimple,
  Plus,
  ShieldCheck,
  SignOut,
  Trash,
  UserMinus,
  UsersThree,
  X,
} from 'phosphor-react-native';
import { useConvex, useMutation, useQuery } from 'convex/react';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  InteractionManager,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import SafeAreaView from '~/components/core/SafeAreaView';
import { Text } from '~/components/ui/text';
import { api } from '~/convex/_generated/api';
import type { Id } from '~/convex/_generated/dataModel';

const COLORS = {
  primary: '#F76B1C',
  primaryLight: '#FFF0E7',
  background: '#FAF8F6',
  text: '#1A1A1A',
  secondaryText: '#77716D',
  mutedText: '#A09A96',
  border: '#EDE7E2',
  white: '#FFFFFF',
  danger: '#D92D20',
  dangerLight: '#FFF1F0',
};

const MAX_GROUP_IMAGE_BYTES = 5 * 1024 * 1024;

type PickedGroupImage = {
  uri: string;
  mimeType: string;
  fileSize?: number;
};

type GroupRole = 'owner' | 'admin' | 'member';

type MemberAvatarProps = {
  imageUrl?: string | null;
  initial: string;
  color: string;
  size?: number;
};

const MemberAvatar = ({ imageUrl, initial, color, size = 48 }: MemberAvatarProps) => {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: color,
      }}>
      {imageUrl ? (
        <Image
          source={{
            uri: imageUrl,
          }}
          contentFit="cover"
          transition={150}
          style={{
            width: '100%',
            height: '100%',
          }}
        />
      ) : (
        <Text
          className="font-heading font-bold text-white"
          style={{
            fontSize: Math.max(14, size * 0.36),
          }}>
          {initial}
        </Text>
      )}
    </View>
  );
};

const RoleBadge = ({ role }: { role: GroupRole }) => {
  if (role === 'owner') {
    return (
      <View className="flex-row items-center rounded-full bg-[#FFF4D8] px-2.5 py-1">
        <Crown size={13} color="#B7791F" weight="fill" />

        <Text className="ml-1 font-body text-[10px] font-bold text-[#96620F]">Owner</Text>
      </View>
    );
  }

  if (role === 'admin') {
    return (
      <View className="flex-row items-center rounded-full bg-[#EEE9FF] px-2.5 py-1">
        <ShieldCheck size={13} color="#7C3AED" weight="fill" />

        <Text className="ml-1 font-body text-[10px] font-bold text-[#6D28D9]">Admin</Text>
      </View>
    );
  }

  return (
    <View className="rounded-full bg-[#F3F1EF] px-2.5 py-1">
      <Text className="font-body text-[10px] font-semibold text-[#77716D]">Member</Text>
    </View>
  );
};

function showError(title: string, error: unknown) {
  Alert.alert(
    title,

    error instanceof Error ? error.message : 'Please try again.'
  );
}

export default function GroupInfoScreen() {
  const params = useLocalSearchParams<{
    groupId?: string | string[];
  }>();

  const convex = useConvex();

  const rawGroupId = Array.isArray(params.groupId) ? params.groupId[0] : params.groupId;

  const groupId = rawGroupId ? (rawGroupId as Id<'chatGroups'>) : null;

  const insets = useSafeAreaInsets();

  const groupInfo = useQuery(
    api.chat.groupInfo.getGroupInfo,

    groupId
      ? {
          groupId,
        }
      : 'skip'
  );

  const [editModalOpen, setEditModalOpen] = useState(false);

  const [addModalOpen, setAddModalOpen] = useState(false);

  const [memberSearch, setMemberSearch] = useState('');

  const [availableSearch, setAvailableSearch] = useState('');

  const [editName, setEditName] = useState('');

  const [selectedImage, setSelectedImage] = useState<PickedGroupImage | null>(null);

  const [removeExistingImage, setRemoveExistingImage] = useState(false);

  const [selectedUserIds, setSelectedUserIds] = useState<Id<'users'>[]>([]);

  const [isSaving, setIsSaving] = useState(false);

  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);

  const availableUsers = useQuery(
    api.chat.groupInfo.listAvailableUsers,

    groupId && addModalOpen && groupInfo?.canManageMembers
      ? {
          groupId,
        }
      : 'skip'
  );

  const updateGroupInfo = useMutation(api.chat.groupInfo.updateGroupInfo);

  const generateGroupImageUploadUrl = useMutation(api.chat.groupInfo.generateGroupImageUploadUrl);

  const cleanupUnusedGroupImage = useMutation(api.chat.groupInfo.cleanupUnusedGroupImage);

  const addMembers = useMutation(api.chat.groupInfo.addMembers);

  const removeMember = useMutation(api.chat.groupInfo.removeMember);

  const deactivateGroup = useMutation(api.chat.groupInfo.deactivateGroup);

  const filteredMembers = useMemo(() => {
    const members = groupInfo?.members ?? [];

    const search = memberSearch.trim().toLowerCase();

    if (!search) {
      return members;
    }

    return members.filter((member) =>
      `${member.name} ${member.email ?? ''}`.toLowerCase().includes(search)
    );
  }, [groupInfo?.members, memberSearch]);

  const filteredAvailableUsers = useMemo(() => {
    const users = availableUsers ?? [];

    const search = availableSearch.trim().toLowerCase();

    if (!search) {
      return users;
    }

    return users.filter((user) =>
      `${user.name} ${user.email ?? ''}`.toLowerCase().includes(search)
    );
  }, [availableSearch, availableUsers]);

  const openEditModal = () => {
    if (!groupInfo) {
      return;
    }

    setEditName(groupInfo.name);
    setSelectedImage(null);
    setRemoveExistingImage(false);
    setEditModalOpen(true);
  };

  const closeEditModal = () => {
    if (isSaving) {
      return;
    }

    setEditModalOpen(false);
    setSelectedImage(null);
    setRemoveExistingImage(false);
  };

  const openAddModal = () => {
    setSelectedUserIds([]);
    setAvailableSearch('');
    setAddModalOpen(true);
  };

  const closeAddModal = () => {
    if (isSaving) {
      return;
    }

    setSelectedUserIds([]);
    setAvailableSearch('');
    setAddModalOpen(false);
  };

  const pickGroupImage = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert('Photo permission required', 'Allow photo access to choose a group image.');

        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,

        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.82,
      });

      if (result.canceled || !result.assets?.length) {
        return;
      }

      const asset = result.assets[0];

      if (!asset.uri) {
        throw new Error('The selected image could not be read.');
      }

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
    } catch (error) {
      showError('Unable to select image', error);
    }
  };

  const uploadSelectedImage = async () => {
    if (!selectedImage || !groupId) {
      return undefined;
    }

    const uploadUrl = await generateGroupImageUploadUrl({
      groupId,
    });

    const localResponse = await fetch(selectedImage.uri);

    if (!localResponse.ok) {
      throw new Error('Unable to read the selected image.');
    }

    const imageBlob = await localResponse.blob();

    if (imageBlob.size > MAX_GROUP_IMAGE_BYTES) {
      throw new Error('Group image cannot exceed 5 MB.');
    }

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
      storageId?: string;
    };

    if (!result.storageId) {
      throw new Error('The image upload did not return a storage ID.');
    }

    return result.storageId as Id<'_storage'>;
  };

  const cleanupUploadedImage = async (storageId: Id<'_storage'> | undefined) => {
    if (!storageId || !groupId) {
      return;
    }

    try {
      await cleanupUnusedGroupImage({
        groupId,
        storageId,
      });
    } catch {
      // It may already be attached to the group.
    }
  };

  const handleSaveGroup = async () => {
    if (!groupId || !groupInfo) {
      return;
    }

    const name = editName.trim();

    if (name.length < 2) {
      Alert.alert('Group name required', 'Enter at least 2 characters.');

      return;
    }

    let uploadedStorageId: Id<'_storage'> | undefined;

    try {
      setIsSaving(true);

      uploadedStorageId = await uploadSelectedImage();

      await updateGroupInfo({
        groupId,
        name,

        removeImage: removeExistingImage,

        ...(uploadedStorageId
          ? {
              imageStorageId: uploadedStorageId,
            }
          : {}),
      });

      setEditModalOpen(false);
      setSelectedImage(null);
      setRemoveExistingImage(false);

      Alert.alert('Group updated', 'The group information was saved.');
    } catch (error) {
      await cleanupUploadedImage(uploadedStorageId);

      showError('Unable to update group', error);
    } finally {
      setIsSaving(false);
    }
  };

  const toggleAvailableUser = (userId: Id<'users'>) => {
    setSelectedUserIds((current) =>
      current.some((id) => String(id) === String(userId))
        ? current.filter((id) => String(id) !== String(userId))
        : [...current, userId]
    );
  };

  const handleAddMembers = async () => {
    if (!groupId) {
      return;
    }

    if (selectedUserIds.length === 0) {
      Alert.alert('Select members', 'Select at least one person to add.');

      return;
    }

    if (selectedUserIds.length > 100) {
      Alert.alert('Too many members', 'Add no more than 100 members at once.');

      return;
    }

    try {
      setIsSaving(true);

      const result = await addMembers({
        groupId,

        memberIds: selectedUserIds,
      });

      setAddModalOpen(false);
      setSelectedUserIds([]);
      setAvailableSearch('');

      Alert.alert(
        'Members added',
        `${result.added + result.reactivated} ${
          result.added + result.reactivated === 1 ? 'member was' : 'members were'
        } added.`
      );
    } catch (error) {
      showError('Unable to add members', error);
    } finally {
      setIsSaving(false);
    }
  };

  const confirmRemoveMember = (member: { userId: Id<'users'>; name: string }) => {
    if (!groupId) {
      return;
    }

    Alert.alert(
      'Remove member?',
      `${member.name} will no longer be able to access this group.`,

      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Remove',
          style: 'destructive',

          onPress: async () => {
            try {
              setRemovingMemberId(String(member.userId));

              await removeMember({
                groupId,

                userId: member.userId,
              });
            } catch (error) {
              showError('Unable to remove member', error);
            } finally {
              setRemovingMemberId(null);
            }
          },
        },
      ]
    );
  };

  const confirmLeaveGroup = () => {
    if (!groupId || !groupInfo) {
      return;
    }

    const leavingGroupId = groupId;
    const leavingGroupName = groupInfo.name;

    Alert.alert('Leave group?', `You will no longer receive messages from ${leavingGroupName}.`, [
      {
        text: 'Cancel',
        style: 'cancel',
      },
      {
        text: 'Leave',
        style: 'destructive',

        onPress: () => {
          /*
           * First remove both these screens:
           *
           * /group-chat/[groupId]/info
           * /group-chat/[groupId]
           *
           * This stops listMessages, presence and
           * groupInfo subscriptions before membership
           * changes to "left".
           */
          router.dismissAll();

          /*
           * Wait until the navigation transition has
           * completed and the chat screens are unmounted.
           */
          InteractionManager.runAfterInteractions(() => {
            void convex
              .mutation(api.chat.groupInfo.leaveGroup, {
                groupId: leavingGroupId,
              })
              .catch((error) => {
                console.error('Leave group failed:', error);

                Alert.alert(
                  'Unable to leave group',
                  error instanceof Error ? error.message : 'Please try again.'
                );
              });
          });
        },
      },
    ]);
  };

  const confirmDeleteGroup = () => {
    if (!groupId || !groupInfo) {
      return;
    }

    Alert.alert(
      'Delete group?',
      `${groupInfo.name} will disappear for all members. The message history will remain stored.`,

      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',

          onPress: () => {
            const deletingGroupId = groupId;

            router.dismissAll();

            InteractionManager.runAfterInteractions(() => {
              void convex
                .mutation(api.chat.groupInfo.deactivateGroup, {
                  groupId: deletingGroupId,
                })
                .catch((error) => {
                  console.error('Delete group failed:', error);

                  Alert.alert(
                    'Unable to delete group',
                    error instanceof Error ? error.message : 'Please try again.'
                  );
                });
            });
          },
        },
      ]
    );
  };

  if (!groupId) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-[#FAF8F6] px-8">
        <Text className="font-heading text-xl font-bold text-[#1A1A1A]">Group unavailable</Text>

        <Text className="mt-2 text-center font-body text-sm text-[#77716D]">
          A valid group ID was not provided.
        </Text>

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => router.back()}
          className="mt-5 rounded-full bg-[#F76B1C] px-6 py-3">
          <Text className="font-body font-bold text-white">Go back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (groupInfo === undefined) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-[#FAF8F6]">
        <ActivityIndicator size="large" color="#F76B1C" />

        <Text className="mt-4 font-body text-sm text-[#77716D]">Loading group information…</Text>
      </SafeAreaView>
    );
  }

  const groupInitial = groupInfo.name.trim().charAt(0).toUpperCase() || 'G';

  const previewImageUri = selectedImage?.uri
    ? selectedImage.uri
    : !removeExistingImage
      ? groupInfo.imageUrl
      : null;

  return (
    <SafeAreaView className="flex-1 bg-[#FAF8F6]">
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />

      <View
        className="flex-row items-center border-b border-[#EDE7E2] bg-white px-4 pb-3"
        style={{
          paddingTop: Platform.OS === 'android' ? insets.top + 8 : 8,
        }}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          className="h-11 w-11 items-center justify-center rounded-full bg-[#F7F3F0]">
          <ArrowLeft size={23} color="#1A1A1A" weight="bold" />
        </TouchableOpacity>

        <Text className="ml-3 flex-1 font-heading text-xl font-bold text-[#1A1A1A]">
          Group information
        </Text>
      </View>

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}>
        <View style={styles.heroCard}>
          <View className="items-center">
            <View>
              {groupInfo.imageUrl ? (
                <Image
                  source={{
                    uri: groupInfo.imageUrl,
                  }}
                  contentFit="cover"
                  transition={180}
                  style={styles.groupImage}
                />
              ) : (
                <View style={styles.groupImageFallback}>
                  <Text className="font-heading text-4xl font-bold text-white">{groupInitial}</Text>
                </View>
              )}

              {groupInfo.canEditGroup ? (
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={openEditModal}
                  accessibilityRole="button"
                  accessibilityLabel="Edit group image"
                  style={styles.cameraButton}>
                  <Camera size={18} color="#FFFFFF" weight="bold" />
                </TouchableOpacity>
              ) : null}
            </View>

            <Text className="mt-4 text-center font-heading text-2xl font-bold text-[#1A1A1A]">
              {groupInfo.name}
            </Text>

            <View className="mt-2 flex-row items-center">
              <UsersThree size={17} color="#77716D" weight="bold" />

              <Text className="ml-1.5 font-body text-sm text-[#77716D]">
                {groupInfo.memberCount} {groupInfo.memberCount === 1 ? 'member' : 'members'}
              </Text>
            </View>

            <View className="mt-3">
              <RoleBadge role={groupInfo.currentUserRole} />
            </View>
          </View>

          {groupInfo.canEditGroup || groupInfo.canManageMembers ? (
            <View className="mt-6 flex-row">
              {groupInfo.canEditGroup ? (
                <TouchableOpacity
                  activeOpacity={0.8}
                  disabled={isSaving}
                  onPress={openEditModal}
                  className="mr-2 flex-1 flex-row items-center justify-center rounded-2xl bg-[#FFF0E7] px-4 py-3">
                  <PencilSimple size={18} color="#F76B1C" weight="bold" />

                  <Text className="ml-2 font-body text-sm font-bold text-[#F76B1C]">
                    Edit group
                  </Text>
                </TouchableOpacity>
              ) : null}

              {groupInfo.canManageMembers ? (
                <TouchableOpacity
                  activeOpacity={0.8}
                  disabled={isSaving}
                  onPress={openAddModal}
                  className="ml-2 flex-1 flex-row items-center justify-center rounded-2xl bg-[#F76B1C] px-4 py-3">
                  <Plus size={18} color="#FFFFFF" weight="bold" />

                  <Text className="ml-2 font-body text-sm font-bold text-white">Add members</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}
        </View>

        <View style={styles.sectionCard}>
          <View className="flex-row items-center justify-between">
            <Text className="font-heading text-lg font-bold text-[#1A1A1A]">Members</Text>

            <Text className="font-body text-xs font-semibold text-[#77716D]">
              {groupInfo.memberCount}
            </Text>
          </View>

          {groupInfo.memberCount > 6 ? (
            <View className="mt-4 h-11 flex-row items-center rounded-2xl bg-[#F7F3F0] px-4">
              <MagnifyingGlass size={18} color="#A09A96" weight="bold" />

              <TextInput
                value={memberSearch}
                onChangeText={setMemberSearch}
                placeholder="Search members"
                placeholderTextColor="#A09A96"
                className="ml-2 flex-1 font-body text-sm text-[#1A1A1A]"
                selectionColor="#F76B1C"
              />

              {memberSearch ? (
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => setMemberSearch('')}
                  className="h-7 w-7 items-center justify-center">
                  <X size={16} color="#77716D" weight="bold" />
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}

          <View className="mt-2">
            {filteredMembers.map((member, index) => {
              const isRemoving = removingMemberId === String(member.userId);

              return (
                <View
                  key={String(member.userId)}
                  className="flex-row items-center py-3"
                  style={{
                    borderBottomWidth:
                      index === filteredMembers.length - 1 ? 0 : StyleSheet.hairlineWidth,

                    borderBottomColor: '#EDE7E2',
                  }}>
                  <MemberAvatar
                    imageUrl={member.imageUrl}
                    initial={member.initial}
                    color={member.avatarColor}
                  />

                  <View className="ml-3 min-w-0 flex-1">
                    <View className="flex-row items-center">
                      <Text
                        numberOfLines={1}
                        className="min-w-0 flex-shrink font-body text-[15px] font-bold text-[#1A1A1A]">
                        {member.name}
                      </Text>

                      {member.isCurrentUser ? (
                        <Text className="ml-1 font-body text-xs font-semibold text-[#F76B1C]">
                          (You)
                        </Text>
                      ) : null}
                    </View>

                    {member.email ? (
                      <Text numberOfLines={1} className="mt-0.5 font-body text-xs text-[#77716D]">
                        {member.email}
                      </Text>
                    ) : null}

                    <View className="mt-1.5 self-start">
                      <RoleBadge role={member.role} />
                    </View>
                  </View>

                  {member.canRemove ? (
                    <TouchableOpacity
                      activeOpacity={0.75}
                      disabled={isRemoving}
                      onPress={() => confirmRemoveMember(member)}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${member.name}`}
                      className="ml-2 h-10 w-10 items-center justify-center rounded-full bg-[#FFF1F0]">
                      {isRemoving ? (
                        <ActivityIndicator size="small" color="#D92D20" />
                      ) : (
                        <UserMinus size={19} color="#D92D20" weight="bold" />
                      )}
                    </TouchableOpacity>
                  ) : null}
                </View>
              );
            })}

            {filteredMembers.length === 0 ? (
              <View className="items-center py-8">
                <MagnifyingGlass size={30} color="#A09A96" />

                <Text className="mt-2 font-body text-sm text-[#77716D]">No members found</Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text className="font-heading text-lg font-bold text-[#1A1A1A]">Group actions</Text>

          {groupInfo.canLeaveGroup ? (
            <TouchableOpacity
              activeOpacity={0.75}
              disabled={isSaving}
              onPress={confirmLeaveGroup}
              className="mt-4 flex-row items-center rounded-2xl border border-[#F1D4C3] bg-[#FFF8F4] px-4 py-4">
              <View className="h-10 w-10 items-center justify-center rounded-full bg-[#FFE6D7]">
                <SignOut size={20} color="#F35E16" weight="bold" />
              </View>

              <View className="ml-3 flex-1">
                <Text className="font-body text-sm font-bold text-[#D95A14]">Leave group</Text>

                <Text className="mt-0.5 font-body text-xs text-[#8A6A59]">
                  Stop receiving messages from this group
                </Text>
              </View>
            </TouchableOpacity>
          ) : (
            <View className="mt-4 rounded-2xl bg-[#F7F3F0] px-4 py-3">
              <Text className="font-body text-xs leading-5 text-[#77716D]">
                Group owners cannot leave their group. Delete the group or transfer ownership before
                leaving.
              </Text>
            </View>
          )}

          {groupInfo.canDeleteGroup ? (
            <TouchableOpacity
              activeOpacity={0.75}
              disabled={isSaving}
              onPress={confirmDeleteGroup}
              className="mt-3 flex-row items-center rounded-2xl border border-[#F4C7C3] bg-[#FFF1F0] px-4 py-4">
              <View className="h-10 w-10 items-center justify-center rounded-full bg-[#FFE0DE]">
                <Trash size={20} color="#D92D20" weight="bold" />
              </View>

              <View className="ml-3 flex-1">
                <Text className="font-body text-sm font-bold text-[#D92D20]">Delete group</Text>

                <Text className="mt-0.5 font-body text-xs text-[#93605D]">
                  Deactivate this group for every member
                </Text>
              </View>
            </TouchableOpacity>
          ) : groupInfo.isDefaultGroup && groupInfo.currentUserRole === 'owner' ? (
            <View className="mt-3 rounded-2xl bg-[#F7F3F0] px-4 py-3">
              <Text className="font-body text-xs leading-5 text-[#77716D]">
                The default Sweat Sisters group is protected and cannot be deleted.
              </Text>
            </View>
          ) : null}
        </View>
      </ScrollView>

      {/* Edit group modal */}
      <Modal
        visible={editModalOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeEditModal}>
        <SafeAreaView className="flex-1 bg-white">
          <KeyboardAvoidingView
            className="flex-1"
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View className="flex-row items-center border-b border-[#EDE7E2] px-4 py-3">
              <TouchableOpacity
                activeOpacity={0.7}
                disabled={isSaving}
                onPress={closeEditModal}
                className="h-10 w-10 items-center justify-center">
                <X size={23} color="#1A1A1A" weight="bold" />
              </TouchableOpacity>

              <Text className="ml-2 flex-1 font-heading text-xl font-bold text-[#1A1A1A]">
                Edit group
              </Text>

              <TouchableOpacity
                activeOpacity={0.8}
                disabled={isSaving}
                onPress={() => void handleSaveGroup()}
                className="rounded-full bg-[#F76B1C] px-5 py-2.5"
                style={{
                  opacity: isSaving ? 0.65 : 1,
                }}>
                {isSaving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text className="font-body text-sm font-bold text-white">Save</Text>
                )}
              </TouchableOpacity>
            </View>

            <ScrollView
              className="flex-1"
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{
                padding: 20,
                paddingBottom: 40,
              }}>
              <Text className="font-body text-sm font-bold text-[#1A1A1A]">Group image</Text>

              <View className="mt-4 items-center">
                <TouchableOpacity
                  activeOpacity={0.85}
                  disabled={isSaving}
                  onPress={() => void pickGroupImage()}>
                  {previewImageUri ? (
                    <Image
                      source={{
                        uri: previewImageUri,
                      }}
                      contentFit="cover"
                      style={styles.editImage}
                    />
                  ) : (
                    <View style={styles.editImageFallback}>
                      <Camera size={34} color="#F76B1C" weight="bold" />
                    </View>
                  )}

                  <View style={styles.editCameraButton}>
                    <Camera size={17} color="#FFFFFF" weight="bold" />
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.75}
                  disabled={isSaving}
                  onPress={() => void pickGroupImage()}
                  className="mt-4 rounded-full bg-[#FFF0E7] px-5 py-2.5">
                  <Text className="font-body text-sm font-bold text-[#F76B1C]">
                    {previewImageUri ? 'Change image' : 'Choose image'}
                  </Text>
                </TouchableOpacity>

                {previewImageUri ? (
                  <TouchableOpacity
                    activeOpacity={0.75}
                    disabled={isSaving}
                    onPress={() => {
                      setSelectedImage(null);

                      setRemoveExistingImage(true);
                    }}
                    className="mt-2 px-4 py-2">
                    <Text className="font-body text-sm font-bold text-[#D92D20]">Remove image</Text>
                  </TouchableOpacity>
                ) : null}

                <Text className="mt-2 text-center font-body text-xs text-[#77716D]">
                  Square JPG, PNG or HEIC. Maximum 5 MB.
                </Text>
              </View>

              <Text className="mb-2 mt-7 font-body text-sm font-bold text-[#1A1A1A]">
                Group name
              </Text>

              <TextInput
                value={editName}
                editable={!isSaving}
                onChangeText={setEditName}
                maxLength={60}
                placeholder="Group name"
                placeholderTextColor="#A09A96"
                selectionColor="#F76B1C"
                className="rounded-2xl border border-[#EDE7E2] bg-white px-4 py-3.5 font-body text-base text-[#1A1A1A]"
              />

              <Text className="mt-2 font-body text-xs text-[#77716D]">
                {editName.length}/60 characters
              </Text>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* Add members modal */}
      <Modal
        visible={addModalOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeAddModal}>
        <SafeAreaView className="flex-1 bg-white">
          <View className="flex-row items-center border-b border-[#EDE7E2] px-4 py-3">
            <TouchableOpacity
              activeOpacity={0.7}
              disabled={isSaving}
              onPress={closeAddModal}
              className="h-10 w-10 items-center justify-center">
              <X size={23} color="#1A1A1A" weight="bold" />
            </TouchableOpacity>

            <View className="ml-2 flex-1">
              <Text className="font-heading text-xl font-bold text-[#1A1A1A]">Add members</Text>

              <Text className="font-body text-xs text-[#77716D]">
                {selectedUserIds.length} selected
              </Text>
            </View>

            <TouchableOpacity
              activeOpacity={0.8}
              disabled={isSaving || selectedUserIds.length === 0}
              onPress={() => void handleAddMembers()}
              className="rounded-full bg-[#F76B1C] px-5 py-2.5"
              style={{
                opacity: isSaving || selectedUserIds.length === 0 ? 0.55 : 1,
              }}>
              {isSaving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text className="font-body text-sm font-bold text-white">Add</Text>
              )}
            </TouchableOpacity>
          </View>

          <View className="px-4 pb-2 pt-4">
            <View className="h-12 flex-row items-center rounded-2xl bg-[#F7F3F0] px-4">
              <MagnifyingGlass size={19} color="#A09A96" weight="bold" />

              <TextInput
                value={availableSearch}
                onChangeText={setAvailableSearch}
                placeholder="Search people"
                placeholderTextColor="#A09A96"
                selectionColor="#F76B1C"
                className="ml-2 flex-1 font-body text-sm text-[#1A1A1A]"
              />

              {availableSearch ? (
                <TouchableOpacity activeOpacity={0.7} onPress={() => setAvailableSearch('')}>
                  <X size={17} color="#77716D" weight="bold" />
                </TouchableOpacity>
              ) : null}
            </View>
          </View>

          {availableUsers === undefined ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator size="large" color="#F76B1C" />

              <Text className="mt-3 font-body text-sm text-[#77716D]">Loading people…</Text>
            </View>
          ) : (
            <FlatList
              data={filteredAvailableUsers}
              keyExtractor={(item) => String(item._id)}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{
                paddingHorizontal: 16,
                paddingBottom: 30,
              }}
              renderItem={({ item }) => {
                const selected = selectedUserIds.some((id) => String(id) === String(item._id));

                return (
                  <TouchableOpacity
                    activeOpacity={0.75}
                    disabled={isSaving}
                    onPress={() => toggleAvailableUser(item._id)}
                    className="flex-row items-center border-b border-[#EDE7E2] py-3.5">
                    <MemberAvatar
                      imageUrl={item.imageUrl}
                      initial={item.initial}
                      color={item.avatarColor}
                    />

                    <View className="ml-3 min-w-0 flex-1">
                      <Text
                        numberOfLines={1}
                        className="font-body text-[15px] font-bold text-[#1A1A1A]">
                        {item.name}
                      </Text>

                      {item.email ? (
                        <Text numberOfLines={1} className="mt-0.5 font-body text-xs text-[#77716D]">
                          {item.email}
                        </Text>
                      ) : null}
                    </View>

                    <View
                      className="h-7 w-7 items-center justify-center rounded-full border-2"
                      style={{
                        borderColor: selected ? '#F76B1C' : '#D7D0CB',

                        backgroundColor: selected ? '#F76B1C' : '#FFFFFF',
                      }}>
                      {selected ? <Check size={16} color="#FFFFFF" weight="bold" /> : null}
                    </View>
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <View className="items-center px-8 py-20">
                  <UsersThree size={42} color="#A09A96" />

                  <Text className="mt-4 text-center font-heading text-lg font-bold text-[#1A1A1A]">
                    No people available
                  </Text>

                  <Text className="mt-1 text-center font-body text-sm text-[#77716D]">
                    Everyone matching this search may already be in the group.
                  </Text>
                </View>
              }
            />
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },

  heroCard: {
    borderRadius: 26,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    padding: 20,

    shadowColor: '#5E3E2B',

    shadowOffset: {
      width: 0,
      height: 4,
    },

    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },

  sectionCard: {
    marginTop: 16,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    padding: 18,
  },

  groupImage: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: COLORS.primaryLight,
  },

  groupImageFallback: {
    width: 112,
    height: 112,
    borderRadius: 56,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
  },

  cameraButton: {
    position: 'absolute',
    right: 0,
    bottom: 2,
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 3,
    borderColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
  },

  editImage: {
    width: 132,
    height: 132,
    borderRadius: 66,
    backgroundColor: COLORS.primaryLight,
  },

  editImageFallback: {
    width: 132,
    height: 132,
    borderRadius: 66,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#F6B48F',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primaryLight,
  },

  editCameraButton: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 3,
    borderColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
  },
});
