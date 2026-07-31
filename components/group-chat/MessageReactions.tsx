import { ArrowBendUpLeft } from "phosphor-react-native";
import { StyleSheet, TouchableOpacity, View } from "react-native";

import { Text } from "~/components/ui/text";
import type { ChatReaction } from "~/types/chat";
import { REACTION_OPTIONS } from "~/utils/chat";

type MessageReactionsProps = {
  reactions?: ChatReaction[];
  actionOpen: boolean;
  onReact: (emoji: string) => void;
  onReply: () => void;
};

const MessageReactions = ({
  reactions,
  actionOpen,
  onReact,
  onReply,
}: MessageReactionsProps) => (
  <>
    {reactions?.length ? (
      <View
        className="-mt-2 flex-row items-center rounded-full border border-[#EEE3DC] bg-white px-2 py-1"
        style={styles.reactionPill}
      >
        {reactions.map((reaction) => (
          <TouchableOpacity
            key={reaction.emoji}
            activeOpacity={0.75}
            onPress={() => onReact(reaction.emoji)}
            className="mr-1 flex-row items-center"
          >
            <Text className="text-sm">{reaction.emoji}</Text>
            <Text
              className="ml-0.5 font-body text-xs font-semibold"
              style={{
                color: reaction.reactedByMe ? "#F35E16" : "#484848",
              }}
            >
              {reaction.count}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    ) : null}

    {actionOpen ? (
      <View
        className="mt-2 flex-row items-center rounded-full border border-[#EDE5DF] bg-white p-1.5"
        style={styles.messageActions}
      >
        {REACTION_OPTIONS.map((emoji) => (
          <TouchableOpacity
            key={emoji}
            activeOpacity={0.7}
            onPress={() => onReact(emoji)}
            accessibilityRole="button"
            accessibilityLabel={`React with ${emoji}`}
            className="h-8 w-8 items-center justify-center rounded-full"
          >
            <Text className="text-lg">{emoji}</Text>
          </TouchableOpacity>
        ))}

        <View className="mx-1 h-6 w-px bg-[#E8E2DE]" />

        <TouchableOpacity
          activeOpacity={0.7}
          onPress={onReply}
          accessibilityRole="button"
          accessibilityLabel="Reply to message"
          className="h-8 w-8 items-center justify-center rounded-full bg-[#FFF1E8]"
        >
          <ArrowBendUpLeft size={17} color="#F35E16" weight="bold" />
        </TouchableOpacity>
      </View>
    ) : null}
  </>
);

const styles = StyleSheet.create({
  reactionPill: {
    shadowColor: "#352219",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 5,
    elevation: 2,
  },
  messageActions: {
    shadowColor: "#352219",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 9,
    elevation: 5,
  },
});

export default MessageReactions;
