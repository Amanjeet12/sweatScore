import { useQuery } from 'convex/react';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { ArrowRight } from 'phosphor-react-native';
import { TouchableOpacity, View } from 'react-native';

import { Text } from '~/components/ui/text';
import { api } from '~/convex/_generated/api';

const PRIMARY = '#FF4B1F';

type AvatarProps = {
  imageUrl: string | null;
  initial: string;
  color: string;
  size: number;
};

function PreviewAvatar({ imageUrl, initial, color, size }: AvatarProps) {
  return (
    <View
      className="items-center justify-center overflow-hidden border-2 border-white"
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }}>
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          contentFit="cover"
          style={{ width: size, height: size }}
        />
      ) : (
        <Text className="font-heading font-bold text-white" style={{ fontSize: size * 0.34 }}>
          {initial}
        </Text>
      )}
    </View>
  );
}

function isSameDate(first: Date, second: Date) {
  return (
    first.getDate() === second.getDate() &&
    first.getMonth() === second.getMonth() &&
    first.getFullYear() === second.getFullYear()
  );
}

function formatRelativeTime(timestamp: number) {
  const now = Date.now();
  const elapsed = Math.max(0, now - timestamp);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (elapsed < minute) return 'just now';
  if (elapsed < hour) return `${Math.floor(elapsed / minute)}m`;
  if (elapsed < day) return `${Math.floor(elapsed / hour)}h`;

  const date = new Date(timestamp);
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  if (isSameDate(date, yesterday)) return 'Yesterday';
  if (elapsed < 7 * day) return `${Math.floor(elapsed / day)}d`;

  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export default function CommunityGroupPreviewCard() {
  const group = useQuery(api.chat.groups.getHomeGroupPreview);

  if (!group) {
    return null;
  }

  const openGroup = () => {
    router.push({
      pathname: '/group-chat/[groupId]',
      params: { groupId: String(group.groupId) },
    });
  };

  return (
    <View className="mx-5 rounded-[26px] bg-white px-6 py-6">
      <View className="flex-row items-start justify-between">
        <View className="min-w-0 flex-1 pr-3">
          <Text
            className="font-heading text-[10px] font-extrabold uppercase tracking-wide"
            style={{ color: PRIMARY }}>
            Your community
          </Text>
          <Text numberOfLines={1} className="mt-1 font-heading text-xl font-bold text-[#1A1A1A]">
            {group.name}
          </Text>
        </View>

        {group.hasUnread ? (
          <View className="relative flex-row items-center rounded-full bg-[#EAF8EF] px-3 py-2">
            <View className="mr-1.5 h-2 w-2 rounded-full bg-[#2F9D70]" />
            <Text className="font-heading text-xs font-bold text-[#27855E]">New Message</Text>
            <View className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border border-white bg-[#E8525B]" />
          </View>
        ) : null}
      </View>

      <View className="mt-4 flex-row items-center">
        <View className="flex-row">
          {group.previewMembers.map((member, index) => (
            <View key={String(member.userId)} style={{ marginLeft: index === 0 ? 0 : -10 }}>
              <PreviewAvatar
                imageUrl={member.imageUrl}
                initial={member.initial}
                color={member.avatarColor}
                size={40}
              />
            </View>
          ))}
        </View>
        <Text className="ml-3 font-body text-[13px] text-[#77716D]">
          {group.memberCount} {group.memberCount === 1 ? 'member' : 'members'}
        </Text>
      </View>

      <TouchableOpacity
        activeOpacity={0.78}
        accessibilityRole="button"
        accessibilityLabel={`Open latest message in ${group.name}`}
        onPress={openGroup}
        className="mt-4 flex-row items-center rounded-[22px] bg-[#F8F8F8] p-4">
        {group.lastMessage ? (
          <>
            <PreviewAvatar
              imageUrl={group.lastMessage.senderImageUrl}
              initial={group.lastMessage.senderInitial}
              color={group.lastMessage.senderAvatarColor}
              size={46}
            />
            <View className="ml-3 min-w-0 flex-1">
              <View className="flex-row items-center">
                <Text
                  numberOfLines={1}
                  className="min-w-0 flex-shrink font-heading text-sm font-bold text-[#1A1A1A]">
                  {group.lastMessage.senderName}
                </Text>
                <Text className="ml-2 font-body text-xs text-[#AAA39E]">
                  {formatRelativeTime(group.lastMessage.createdAt)}
                </Text>
              </View>
              <Text numberOfLines={1} className="mt-1 font-body text-[13px] text-[#77716D]">
                {group.lastMessage.text}
              </Text>
            </View>
          </>
        ) : (
          <View className="py-1">
            <Text className="font-heading text-sm font-bold text-[#1A1A1A]">No messages yet</Text>
            <Text className="mt-1 font-body text-xs text-[#8C8580]">Start the conversation</Text>
          </View>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={`Reply to ${group.name}`}
        onPress={openGroup}
        className="mt-4 h-12 flex-row items-center rounded-[20px] bg-[#E8E8E9] px-4">
        <Text numberOfLines={1} className="min-w-0 flex-1 font-body text-[13px] text-[#77716D]">
          Reply to {group.name}...
        </Text>
        <ArrowRight size={19} color="#716A65" weight="bold" />
      </TouchableOpacity>
    </View>
  );
}
