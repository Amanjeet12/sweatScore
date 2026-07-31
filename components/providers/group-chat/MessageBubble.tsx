import { Pressable, StyleSheet, View } from "react-native";

import { Avatar } from "~/components/group-chat/Avatar";
import MessageContent from "~/components/group-chat/MessageContent";
import MessageReactions from "~/components/group-chat/MessageReactions";
import { Text } from "~/components/ui/text";
import type { ChatMessage } from "~/types/chat";

type MessageBubbleProps = {
  message: ChatMessage;
  actionOpen: boolean;
  isVoicePlaying: boolean;
  onToggleActions: () => void;
  onToggleVoice: () => void;
  onReply: () => void;
  onReact: (emoji: string) => void;
};

const MessageBubble = ({
  message,
  actionOpen,
  isVoicePlaying,
  onToggleActions,
  onToggleVoice,
  onReply,
  onReact,
}: MessageBubbleProps) => {
  const isMine = Boolean(message.isMine);

  return (
    <View className="mb-4 px-4">
      <View
        className="flex-row items-end"
        style={{ justifyContent: isMine ? "flex-end" : "flex-start" }}
      >
        {!isMine ? (
          <View className="mr-2 self-start pt-5">
            <Avatar
              initial={message.senderInitial}
              color={message.senderColor}
              size={35}
            />
          </View>
        ) : null}

        <View
          style={{
            maxWidth: "82%",
            alignItems: isMine ? "flex-end" : "flex-start",
          }}
        >
          {!isMine ? (
            <Text className="mb-1 ml-1 font-body text-xs font-bold text-[#F35E16]">
              {message.senderName}
            </Text>
          ) : null}

          <Pressable
            onLongPress={onToggleActions}
            delayLongPress={250}
            accessibilityRole="button"
            accessibilityHint="Long press for reactions and reply"
            style={[
              styles.messageBubble,
              isMine ? styles.myMessageBubble : styles.otherMessageBubble,
            ]}
          >
            <MessageContent
              message={message}
              isPlaying={isVoicePlaying}
              onToggleVoice={onToggleVoice}
            />
          </Pressable>

          <MessageReactions
            reactions={message.reactions}
            actionOpen={actionOpen}
            onReact={onReact}
            onReply={onReply}
          />

          {message.seenBy?.length ? (
            <View className="mt-2 flex-row items-center">
              <View className="flex-row">
                {message.seenBy.map((member, index) => (
                  <View
                    key={member.id}
                    style={{ marginLeft: index === 0 ? 0 : -6 }}
                  >
                    <Avatar
                      initial={member.initial}
                      color={member.color}
                      size={22}
                    />
                  </View>
                ))}
              </View>
              <Text className="ml-1.5 font-body text-[10px] text-[#828282]">
                Seen by {message.seenBy.length}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  messageBubble: {
    minWidth: 90,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  myMessageBubble: {
    backgroundColor: "#F76B1C",
    borderBottomRightRadius: 5,
  },
  otherMessageBubble: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E7E2DE",
    borderBottomLeftRadius: 5,
  },
});

export default MessageBubble;
