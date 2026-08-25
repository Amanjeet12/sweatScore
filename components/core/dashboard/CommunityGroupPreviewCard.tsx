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
  const groupPreview = useQuery(api.chat.groups.getHomeGroupPreview);
  const availableGroups = useQuery(api.chat.groups.listAvailableGroups);
  const fallbackGroup = availableGroups?.[0];

  if (!groupPreview && !fallbackGroup) {
    return null;
  }

  const groupId = groupPreview?.groupId ?? fallbackGroup!._id;
  const groupName = groupPreview?.name ?? fallbackGroup!.name;
  const isMember = groupPreview?.isMember ?? fallbackGroup!.isMember;
  const memberCount = groupPreview?.memberCount ?? fallbackGroup!.memberCount;
  const hasUnread = groupPreview?.hasUnread ?? fallbackGroup!.hasUnread;
  const previewMembers = groupPreview?.previewMembers ?? [];
  const lastMessage = groupPreview?.lastMessage ?? null;

  const openGroup = () => {
    router.push({
      pathname: '/group-chat/[groupId]',
      params: { groupId: String(groupId) },
    });
  };

  return (
    <View
      className="mx-5 rounded-[26px] bg-white px-5 py-5"
      style={{
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.06,
        shadowRadius: 18,
      }}>
      <View className="flex-row items-start justify-between">
        <View className="min-w-0 flex-1 pr-3">
          <Text
            className="font-heading text-[10px] font-extrabold uppercase tracking-wide"
            style={{ color: PRIMARY }}>
            {isMember ? 'Your community' : 'Community group'}
          </Text>
          <Text numberOfLines={1} className="mt-1 font-heading text-xl font-bold text-[#1A1A1A]">
            {groupName}
          </Text>
        </View>

        {hasUnread ? (
          <View className="relative flex-row items-center rounded-full bg-[#EAF8EF] px-3 py-2">
            <View className="mr-1.5 h-2 w-2 rounded-full bg-[#2F9D70]" />
            <Text className="font-heading text-xs font-bold text-[#27855E]">New Message</Text>
            <View className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border border-white bg-[#E8525B]" />
          </View>
        ) : null}
      </View>

      <View className="mt-3 flex-row items-center">
        <View className="flex-row">
          {previewMembers.map((member, index) => (
            <View key={String(member.userId)} style={{ marginLeft: index === 0 ? 0 : -10 }}>
              <PreviewAvatar
                imageUrl={member.imageUrl}
                initial={member.initial}
                color={member.avatarColor}
                size={32}
              />
            </View>
          ))}
        </View>
        <Text className="ml-3 font-body text-[13px] text-[#77716D]">
          {memberCount} {memberCount === 1 ? 'member' : 'members'}
        </Text>
      </View>

      <TouchableOpacity
        activeOpacity={0.78}
        accessibilityRole="button"
        accessibilityLabel={`Open latest message in ${groupName}`}
        onPress={openGroup}
        className="mt-3 min-h-[62px] flex-row items-center rounded-[18px] bg-[#F8F8F8] px-3 py-2.5">
        {lastMessage ? (
          <>
            <PreviewAvatar
              imageUrl={lastMessage.senderImageUrl}
              initial={lastMessage.senderInitial}
              color={lastMessage.senderAvatarColor}
              size={38}
            />
            <View className="ml-3 min-w-0 flex-1">
              <View className="flex-row items-center">
                <Text
                  numberOfLines={1}
                  className="min-w-0 flex-shrink font-heading text-sm font-bold text-[#1A1A1A]">
                  {lastMessage.senderName}
                </Text>
                <Text className="ml-2 font-body text-xs text-[#AAA39E]">
                  {formatRelativeTime(lastMessage.createdAt)}
                </Text>
              </View>
              <Text numberOfLines={1} className="mt-1 font-body text-[13px] text-[#77716D]">
                {lastMessage.text}
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
        accessibilityLabel={isMember ? `Reply to ${groupName}` : `View and join ${groupName}`}
        onPress={openGroup}
        className="mt-2.5 h-10 flex-row items-center rounded-[16px] bg-[#E8E8E9] px-4">
        <Text numberOfLines={1} className="min-w-0 flex-1 font-body text-[13px] text-[#77716D]">
          {isMember ? `Reply to ${groupName}...` : `Join ${groupName}`}
        </Text>
        <ArrowRight size={19} color="#716A65" weight="bold" />
      </TouchableOpacity>
    </View>
  );
}
