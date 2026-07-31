import { forwardRef, useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  View,
  type ViewToken,
} from "react-native";

import MessageBubble from "~/components/group-chat/MessageBubble";
import { Text } from "~/components/ui/text";
import type { ChatMessage } from "~/types/chat";

type MessageListProps = {
  messages: ChatMessage[];
  isLoading: boolean;
  isSearching: boolean;
  onReply: (message: ChatMessage) => void;
  onReact: (messageId: string, emoji: string) => void;
  onMessageVisible?: (messageId: string) => void;
  onContentSizeChange?: () => void;
};

const MessageList = forwardRef<FlatList<ChatMessage>, MessageListProps>(
  (
    {
      messages,
      isLoading,
      isSearching,
      onReply,
      onReact,
      onMessageVisible,
      onContentSizeChange,
    },
    ref,
  ) => {
    const [actionMessageId, setActionMessageId] = useState<string | null>(null);
    const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
    const onMessageVisibleRef = useRef(onMessageVisible);

    useEffect(() => {
      onMessageVisibleRef.current = onMessageVisible;
    }, [onMessageVisible]);

    const handleViewableItemsChanged = useRef(
      ({ viewableItems }: { viewableItems: ViewToken<ChatMessage>[] }) => {
        viewableItems.forEach((token) => {
          if (token.isViewable && token.item?.id) {
            onMessageVisibleRef.current?.(token.item.id);
          }
        });
      },
    ).current;

    const renderMessage = useCallback(
      ({ item }: { item: ChatMessage }) => (
        <MessageBubble
          message={item}
          actionOpen={actionMessageId === item.id}
          isVoicePlaying={playingVoiceId === item.id}
          onToggleActions={() =>
            setActionMessageId((current) =>
              current === item.id ? null : item.id,
            )
          }
          onToggleVoice={() =>
            setPlayingVoiceId((current) =>
              current === item.id ? null : item.id,
            )
          }
          onReply={() => {
            onReply(item);
            setActionMessageId(null);
          }}
          onReact={(emoji) => {
            onReact(item.id, emoji);
            setActionMessageId(null);
          }}
        />
      ),
      [actionMessageId, onReact, onReply, playingVoiceId],
    );

    return (
      <FlatList
        ref={ref}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
        contentContainerStyle={{
          paddingTop: 16,
          paddingBottom: 8,
          flexGrow: messages.length ? undefined : 1,
        }}
        ListHeaderComponent={
          messages.length ? (
            <View className="mb-5 items-center">
              <View className="rounded-full border border-[#ECE7E3] bg-[#F8F7F6] px-4 py-1.5">
                <Text className="font-body text-xs font-semibold text-[#5D5D5D]">
                  Today
                </Text>
              </View>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center px-8 py-16">
            {isLoading ? (
              <ActivityIndicator size="small" color="#F76B1C" />
            ) : (
              <>
                <Text className="font-heading text-lg font-bold text-[#2B2B2B]">
                  {isSearching ? "No messages found" : "No messages yet"}
                </Text>
                <Text className="mt-1 text-center font-body text-sm text-[#777777]">
                  {isSearching
                    ? "Try another search."
                    : "Start the conversation below."}
                </Text>
              </>
            )}
          </View>
        }
        onContentSizeChange={onContentSizeChange}
        onViewableItemsChanged={handleViewableItemsChanged}
        viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
        onScrollBeginDrag={() => setActionMessageId(null)}
      />
    );
  },
);

MessageList.displayName = "MessageList";

export default MessageList;
