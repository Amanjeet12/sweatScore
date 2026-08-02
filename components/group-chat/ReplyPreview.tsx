import { Pressable, View } from 'react-native';

import { Text } from '~/components/ui/text';
import type { ChatReply } from '~/types/chat';

type ReplyPreviewProps = {
  reply: ChatReply;
  isMine?: boolean;
  onPress?: () => void;
};

const ReplyPreview = ({ reply, isMine = false, onPress }: ReplyPreviewProps) => (
  <Pressable
    onPress={onPress}
    accessibilityRole="button"
    accessibilityLabel={`Go to message from ${reply.senderName}`}
    className="mb-2 overflow-hidden rounded-xl"
    style={{
      backgroundColor: isMine ? 'rgba(255,255,255,0.18)' : '#FFF5EE',
    }}>
    <View className="border-l-[3px] border-[#F76B1C] px-3 py-2">
      <Text
        className="font-body text-xs font-bold"
        style={{ color: isMine ? '#FFFFFF' : '#F35E16' }}>
        {reply.senderName}
      </Text>
      <Text
        className="mt-0.5 font-body text-xs"
        numberOfLines={1}
        style={{ color: isMine ? '#FFF3EC' : '#545454' }}>
        {reply.text}
      </Text>
    </View>
  </Pressable>
);

export default ReplyPreview;
