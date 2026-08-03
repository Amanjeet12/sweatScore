import { Ionicons } from '@expo/vector-icons';
import { useQuery } from 'convex/react';
import { Image } from 'expo-image';
import { router, Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import SafeAreaView from '~/components/core/SafeAreaView';
import { Text } from '~/components/ui/text';
import { api } from '~/convex/_generated/api';

const COLORS = {
  primary: '#F76B1C',
  primaryLight: '#FFF0E7',

  background: '#FAF8F6',
  white: '#FFFFFF',

  text: '#1A1A1A',

  secondaryText: '#77716D',
  mutedText: '#A09A96',

  border: '#EDE7E2',

  joined: '#36A269',
  joinedLight: '#EAF8EF',

  restricted: '#D14343',
  restrictedLight: '#FFF0F0',
};

function isSameDate(first: Date, second: Date) {
  return (
    first.getDate() === second.getDate() &&
    first.getMonth() === second.getMonth() &&
    first.getFullYear() === second.getFullYear()
  );
}

function formatMessageTime(timestamp: number | null) {
  if (!timestamp) {
    return '';
  }

  const date = new Date(timestamp);

  const today = new Date();

  if (isSameDate(date, today)) {
    return date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  const yesterday = new Date(today);

  yesterday.setDate(today.getDate() - 1);

  if (isSameDate(date, yesterday)) {
    return 'Yesterday';
  }

  return date.toLocaleDateString([], {
    day: 'numeric',
    month: 'short',
  });
}

export default function GroupListScreen() {
  const groups = useQuery(api.chat.groups.listAvailableGroups);

  const [searchText, setSearchText] = useState('');

  const insets = useSafeAreaInsets();

  const filteredGroups = useMemo(() => {
    if (!groups) {
      return [];
    }

    const search = searchText.trim().toLowerCase();

    if (!search) {
      return groups;
    }

    return groups.filter((group) => group.name.toLowerCase().includes(search));
  }, [groups, searchText]);

  const joinedGroupCount = useMemo(() => {
    return groups?.filter((group) => group.isMember).length ?? 0;
  }, [groups]);

  const openGroup = (groupId: string) => {
    router.push({
      pathname: '/group-chat/[groupId]',

      params: {
        groupId,
      },
    });
  };

  return (
    <SafeAreaView className="flex-1 bg-[#FAF8F6]">
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />

      {/* Header */}
      <View
        className="border-b border-[#EDE7E2] bg-white px-5 pb-5 pt-2"
        style={{
          paddingTop: Platform.OS === 'android' ? insets.top + 8 : 8,
        }}>
        <View className="flex-row items-center">
          <TouchableOpacity
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={() => router.back()}
            className="h-11 w-11 items-center justify-center rounded-full bg-[#F7F3F0]">
            <Ionicons name="arrow-back" size={23} color={COLORS.text} />
          </TouchableOpacity>

          <View className="ml-3 flex-1">
            <Text className="font-heading text-2xl font-bold text-[#1A1A1A]">Groups</Text>

            <Text className="mt-0.5 text-sm text-[#77716D]">
              View messages and join communities
            </Text>
          </View>

          <View className="h-11 w-11 items-center justify-center rounded-full bg-[#FFF0E7]">
            <Ionicons name="chatbubbles" size={23} color={COLORS.primary} />
          </View>
        </View>

        {groups && groups.length > 0 ? (
          <View className="mt-5 flex-row items-center rounded-2xl bg-[#FFF7F2] px-4 py-3">
            <View className="h-9 w-9 items-center justify-center rounded-full bg-[#FFE4D3]">
              <Ionicons name="people" size={19} color={COLORS.primary} />
            </View>

            <View className="ml-3 flex-1">
              <Text className="font-lsBold text-base text-[#1A1A1A]">Available communities</Text>

              <Text className="mt-0.5 text-xs text-[#77716D]">
                {groups.length} {groups.length === 1 ? 'group' : 'groups'}
                {' · '}
                {joinedGroupCount} joined
              </Text>
            </View>
          </View>
        ) : null}
      </View>

      {/* Search */}
      {groups && groups.length > 0 ? (
        <View className="px-5 pb-2 pt-4">
          <View className="h-12 flex-row items-center rounded-2xl border border-[#EDE7E2] bg-white px-4">
            <Ionicons name="search-outline" size={20} color={COLORS.mutedText} />

            <TextInput
              value={searchText}
              onChangeText={setSearchText}
              placeholder="Search all groups"
              placeholderTextColor={COLORS.mutedText}
              className="ml-3 flex-1 text-base text-[#1A1A1A]"
              returnKeyType="search"
            />

            {searchText.length > 0 ? (
              <TouchableOpacity
                onPress={() => setSearchText('')}
                accessibilityRole="button"
                accessibilityLabel="Clear search">
                <Ionicons name="close-circle" size={20} color={COLORS.mutedText} />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      ) : null}

      {groups === undefined ? (
        <View className="flex-1 items-center justify-center">
          <View className="h-16 w-16 items-center justify-center rounded-full bg-[#FFF0E7]">
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>

          <Text className="mt-4 text-base text-[#77716D]">Loading groups...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredGroups}
          keyExtractor={(item) => String(item._id)}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={
            filteredGroups.length === 0 ? styles.emptyList : styles.listContent
          }
          renderItem={({ item }) => {
            const isMember = item.isMember === true;

            const isRestricted = item.isRestricted === true;

            const hasUnread = isMember && (item.hasUnread === true || item.unreadCount > 0);

            return (
              <TouchableOpacity
                activeOpacity={0.78}
                onPress={() => openGroup(String(item._id))}
                accessibilityRole="button"
                accessibilityLabel={`Open ${item.name}`}
                style={styles.groupCard}>
                {/* Group image */}
                <View style={styles.imageContainer}>
                  {item.imageUrl ? (
                    <Image
                      source={{
                        uri: item.imageUrl,
                      }}
                      contentFit="cover"
                      transition={180}
                      style={styles.groupImage}
                    />
                  ) : (
                    <View style={styles.imagePlaceholder}>
                      <Ionicons name="people" size={29} color={COLORS.primary} />
                    </View>
                  )}

                  <View
                    style={[
                      styles.groupStatus,

                      isMember
                        ? styles.joinedStatus
                        : isRestricted
                          ? styles.restrictedStatus
                          : styles.availableStatus,
                    ]}>
                    <Ionicons
                      name={isMember ? 'checkmark' : isRestricted ? 'lock-closed' : 'add'}
                      size={10}
                      color="#FFFFFF"
                    />
                  </View>

                  {hasUnread ? (
                    <View style={styles.unreadBadge}>
                      <Text style={styles.unreadText}>1+</Text>
                    </View>
                  ) : null}
                </View>

                {/* Group information */}
                <View className="ml-4 flex-1">
                  <View className="flex-row items-center">
                    <Text numberOfLines={1} className="font-lsBold flex-1 text-lg text-[#1A1A1A]">
                      {item.name}
                    </Text>

                    {item.lastMessageAt ? (
                      <Text className="ml-2 text-xs text-[#A09A96]">
                        {formatMessageTime(item.lastMessageAt)}
                      </Text>
                    ) : null}
                  </View>

                  <Text numberOfLines={1} className="mt-1 text-sm text-[#77716D]">
                    {item.lastMessage || 'No messages yet'}
                  </Text>

                  <View className="mt-2.5 flex-row items-center">
                    <View className="flex-row items-center rounded-full bg-[#F7F3F0] px-2.5 py-1">
                      <Ionicons name="people-outline" size={14} color={COLORS.secondaryText} />

                      <Text className="ml-1 text-xs text-[#77716D]">
                        {item.memberCount} {item.memberCount === 1 ? 'member' : 'members'}
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.membershipBadge,

                        isMember
                          ? styles.joinedBadge
                          : isRestricted
                            ? styles.restrictedBadge
                            : styles.joinBadge,
                      ]}>
                      <Text
                        style={[
                          styles.membershipBadgeText,

                          isMember
                            ? styles.joinedBadgeText
                            : isRestricted
                              ? styles.restrictedBadgeText
                              : styles.joinBadgeText,
                        ]}>
                        {isMember ? 'Joined' : isRestricted ? 'Restricted' : 'Tap to join'}
                      </Text>
                    </View>
                  </View>
                </View>

                <View className="ml-3 h-9 w-9 items-center justify-center rounded-full bg-[#FFF0E7]">
                  <Ionicons name="chevron-forward" size={19} color={COLORS.primary} />
                </View>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center px-8">
              <View className="h-24 w-24 items-center justify-center rounded-full bg-[#FFF0E7]">
                <Ionicons
                  name={searchText ? 'search-outline' : 'chatbubbles-outline'}
                  size={43}
                  color={COLORS.primary}
                />
              </View>

              <Text className="font-lsBold mt-6 text-center text-xl text-[#1A1A1A]">
                {searchText ? 'No groups found' : 'No groups available'}
              </Text>

              <Text className="mt-2 text-center text-base leading-6 text-[#77716D]">
                {searchText
                  ? 'Try searching with a different group name.'
                  : 'There are currently no active groups available.'}
              </Text>

              {searchText ? (
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setSearchText('')}
                  className="mt-5 rounded-full bg-[#F76B1C] px-6 py-3">
                  <Text className="font-lsBold text-sm text-white">Clear Search</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 28,
    paddingTop: 10,
  },

  emptyList: {
    flexGrow: 1,
  },

  groupCard: {
    minHeight: 108,
    marginBottom: 13,
    padding: 15,

    flexDirection: 'row',
    alignItems: 'center',

    borderRadius: 22,

    borderWidth: 1,
    borderColor: COLORS.border,

    backgroundColor: COLORS.white,

    shadowColor: '#5E3E2B',

    shadowOffset: {
      width: 0,
      height: 4,
    },

    shadowOpacity: 0.07,
    shadowRadius: 10,

    elevation: 2,
  },

  imageContainer: {
    position: 'relative',
  },

  groupImage: {
    width: 64,
    height: 64,
    borderRadius: 20,

    backgroundColor: COLORS.primaryLight,
  },

  imagePlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 20,

    alignItems: 'center',
    justifyContent: 'center',

    backgroundColor: COLORS.primaryLight,
  },

  groupStatus: {
    position: 'absolute',

    right: -3,
    bottom: -3,

    width: 20,
    height: 20,
    borderRadius: 10,

    alignItems: 'center',
    justifyContent: 'center',

    borderWidth: 3,
    borderColor: COLORS.white,
  },

  joinedStatus: {
    backgroundColor: COLORS.joined,
  },

  availableStatus: {
    backgroundColor: COLORS.primary,
  },

  restrictedStatus: {
    backgroundColor: COLORS.restricted,
  },

  unreadBadge: {
    position: 'absolute',

    top: -7,
    right: -8,

    minWidth: 25,
    height: 23,

    paddingHorizontal: 5,

    alignItems: 'center',
    justifyContent: 'center',

    borderRadius: 12,

    borderWidth: 2,
    borderColor: COLORS.white,

    backgroundColor: '#E5484D',

    elevation: 4,
  },

  unreadText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },

  membershipBadge: {
    marginLeft: 8,
    paddingHorizontal: 9,
    paddingVertical: 4,

    borderRadius: 10,
  },

  joinedBadge: {
    backgroundColor: COLORS.joinedLight,
  },

  joinBadge: {
    backgroundColor: COLORS.primaryLight,
  },

  restrictedBadge: {
    backgroundColor: COLORS.restrictedLight,
  },

  membershipBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },

  joinedBadgeText: {
    color: '#27804D',
  },

  joinBadgeText: {
    color: COLORS.primary,
  },

  restrictedBadgeText: {
    color: COLORS.restricted,
  },
});
