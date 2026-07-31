import { Check, Checks } from "phosphor-react-native";
import { View } from "react-native";

import { MentionText } from "~/components/group-chat/Avatar";
import LinkPreview from "~/components/group-chat/LinkPreview";
import MediaMessage from "~/components/group-chat/MediaMessage";
import ReplyPreview from "~/components/group-chat/ReplyPreview";
import VoiceMessage from "~/components/group-chat/VoiceMessage";
import { Text } from "~/components/ui/text";
import type { ChatMessage } from "~/types/chat";

type MessageContentProps = {
  message: ChatMessage;
  isPlaying: boolean;
  onToggleVoice: () => void;
};

const DeliveryStatus = ({ message }: { message: ChatMessage }) => {
  if (!message.isMine) return null;

  if (message.deliveryStatus === "read") {
    return <Checks size={15} color="#FFFFFF" weight="bold" />;
  }

  if (message.deliveryStatus === "delivered") {
    return <Checks size={15} color="#FFE5D7" weight="bold" />;
  }

  return <Check size={15} color="#FFE5D7" weight="bold" />;
};

const MessageContent = ({
  message,
  isPlaying,
  onToggleVoice,
}: MessageContentProps) => {
  const isMine = Boolean(message.isMine);
  const hasMediaBeforeText =
    message.type === "image" ||
    message.type === "video" ||
    message.type === "file" ||
    message.type === "link";

  return (
    <>
      {message.replyTo ? (
        <ReplyPreview reply={message.replyTo} isMine={isMine} />
      ) : null}

      {message.attachment ? (
        <MediaMessage attachment={message.attachment} />
      ) : null}

      {message.type === "link" ? (
        <LinkPreview title={message.linkTitle} url={message.linkUrl} />
      ) : null}

      {message.type === "voice" ? (
        <VoiceMessage
          duration={message.voiceDuration}
          isMine={isMine}
          isPlaying={isPlaying}
          onTogglePlayback={onToggleVoice}
        />
      ) : null}

      {message.text ? (
        <View className={hasMediaBeforeText ? "mt-2" : ""}>
          {isMine ? (
            <Text className="font-body text-[15px] leading-[22px] text-white">
              {message.text}
            </Text>
          ) : (
            <MentionText>{message.text}</MentionText>
          )}
        </View>
      ) : null}

      <View className="mt-1 flex-row items-center justify-end gap-x-1">
        <Text
          className="font-body text-[10px]"
          style={{ color: isMine ? "#FFF0E8" : "#7D7D7D" }}
        >
          {message.time}
        </Text>
        <DeliveryStatus message={message} />
      </View>
    </>
  );
};

export default MessageContent;
