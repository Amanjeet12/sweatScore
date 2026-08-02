import { PushPin, X } from 'phosphor-react-native';
import { Pressable, TouchableOpacity, View } from 'react-native';

import { Text } from '~/components/ui/text';
import type { ChatPinnedMessage } from '~/types/chat';

type PinnedMessageBannerProps = {
  message: ChatPinnedMessage | null;

  canUnpin: boolean;

  isUnpinning?: boolean;

  onUnpin: () => void;

  onPress: () => void;
};

const PinnedMessageBanner = ({
  message,
  canUnpin,
  isUnpinning = false,
  onUnpin,
  onPress,
}: PinnedMessageBannerProps) => {
  if (!message) {
    return null;
  }

  return (
    <View className="flex-row items-center border-b border-[#F2D7C7] bg-[#FFF8F3] px-4 py-2.5">
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="Go to pinned message"
        className="flex-1 flex-row items-center">
        <View className="h-9 w-9 items-center justify-center rounded-full bg-[#FFE8D9]">
          <PushPin size={18} color="#F35E16" weight="fill" />
        </View>

        <View className="ml-3 flex-1">
          <Text className="font-body text-xs font-bold text-[#F35E16]" numberOfLines={1}>
            Pinned by {message.pinnedByName}
          </Text>

          <Text className="mt-0.5 font-body text-sm font-semibold text-[#292624]" numberOfLines={1}>
            {message.senderName}: {message.preview}
          </Text>
        </View>
      </Pressable>

      {canUnpin ? (
        <TouchableOpacity
          activeOpacity={0.7}
          disabled={isUnpinning}
          onPress={onUnpin}
          accessibilityRole="button"
          accessibilityLabel="Unpin message"
          className="ml-2 h-9 w-9 items-center justify-center rounded-full bg-white"
          style={{
            opacity: isUnpinning ? 0.5 : 1,
          }}>
          <X size={17} color="#6A625D" weight="bold" />
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

export default PinnedMessageBanner;
