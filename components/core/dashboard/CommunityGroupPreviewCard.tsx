import { useQuery } from 'convex/react';
import { router } from 'expo-router';
import { ArrowRight, ChatCircleDots } from 'phosphor-react-native';
import type { RefObject } from 'react';
import { TouchableOpacity, View } from 'react-native';

import { Text } from '~/components/ui/text';
import { api } from '~/convex/_generated/api';
import { useSubscriptionGuard } from '~/hooks/useSubscriptionGuard';

const PRIMARY = '#FF4B1F';

export default function CommunityGroupPreviewCard({
  tourTargetRef,
}: {
  tourTargetRef?: RefObject<View>;
}) {
  const { requireSubscription } = useSubscriptionGuard();
  const groupPreview = useQuery(api.chat.groups.getHomeGroupPreview);
  const availableGroups = useQuery(api.chat.groups.listAvailableGroups);
  const fallbackGroup = availableGroups?.[0];

  if (!groupPreview && !fallbackGroup) return null;

  const groupId = groupPreview?.groupId ?? fallbackGroup!._id;
  const groupName = groupPreview?.name ?? fallbackGroup!.name;
  const memberCount = groupPreview?.memberCount ?? fallbackGroup!.memberCount;
  const hasUnread = groupPreview?.hasUnread ?? fallbackGroup!.hasUnread;
  const lastMessage = groupPreview?.lastMessage ?? null;

  const openGroup = () => {
    const redirectTo = `/group-chat/${String(groupId)}`;
    if (!requireSubscription({ redirectTo, source: 'today_community_chat' })) return;
    router.push({ pathname: '/group-chat/[groupId]', params: { groupId: String(groupId) } });
  };

  return (
    <View ref={tourTargetRef} collapsable={false} className="mx-5">
      <TouchableOpacity
        activeOpacity={0.78}
        accessibilityRole="button"
        accessibilityLabel={`Open ${groupName}`}
        onPress={openGroup}
        className="min-h-[88px] flex-row items-center rounded-lg bg-white px-4 py-3">
        <View className="relative h-11 w-11 items-center justify-center">
          <ChatCircleDots size={31} color={PRIMARY} weight="regular" />
          {hasUnread ? (
            <View className="absolute right-0 top-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-[#EF4444]" />
          ) : null}
        </View>
        <View className="ml-4 min-w-0 flex-1 pr-3">
          <View className="flex-row items-center">
            <Text
              numberOfLines={1}
              className="min-w-0 flex-shrink font-heading text-base font-semibold text-[#1D1B1A]">
              {groupName}
            </Text>
            <Text className="ml-1 font-body text-[12px] text-[#817A76]">
              · {memberCount} members
            </Text>
          </View>
          <Text numberOfLines={1} className="mt-1 font-body text-[13px] text-[#817A76]">
            {lastMessage?.text ?? 'Open your community group'}
          </Text>
        </View>
        <ArrowRight size={19} color={PRIMARY} weight="bold" />
      </TouchableOpacity>
    </View>
  );
}
