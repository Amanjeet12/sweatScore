import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';

import { Avatar } from '~/components/group-chat/Avatar';
import MessageContent from '~/components/group-chat/MessageContent';
import MessageReactions from '~/components/group-chat/MessageReactions';
import SeenByModal from '~/components/group-chat/SeenByModal';
import { Text } from '~/components/ui/text';
import type { ChatMessage } from '~/types/chat';

type MessageBubbleProps = {
  message: ChatMessage;
  actionOpen: boolean;
  isVoicePlaying: boolean;
  showSeenReceipt?: boolean;
  canPin?: boolean;
  isHighlighted?: boolean;

  onToggleActions: () => void;
  onCloseActions: () => void;
  onToggleVoice: () => void;
  onReply: () => void;
  onReact: (emoji: string) => void;
  onTogglePin: () => void;
  onPressReplyPreview: () => void;
};
const MAX_VISIBLE_SEEN_AVATARS = 3;

const MessageBubble = ({
  message,
  actionOpen,
  isVoicePlaying,
  showSeenReceipt = false,
  canPin = false,
  isHighlighted = false,
  onToggleActions,
  onCloseActions,
  onToggleVoice,
  onReply,
  onReact,
  onTogglePin,
  onPressReplyPreview,
}: MessageBubbleProps) => {
  const isMine = Boolean(message.isMine);

  const highlightScale = useRef(new Animated.Value(1)).current;

  const [seenModalOpen, setSeenModalOpen] = useState(false);
  const seenMembers = message.seenBy ?? [];

  const visibleSeenMembers = seenMembers.slice(0, MAX_VISIBLE_SEEN_AVATARS);

  const remainingSeenCount = Math.max(0, seenMembers.length - MAX_VISIBLE_SEEN_AVATARS);

  const shouldShowSeenReceipt = isMine && showSeenReceipt && seenMembers.length > 0;

  useEffect(() => {
    if (!isHighlighted) {
      return;
    }

    highlightScale.setValue(1);

    Animated.sequence([
      Animated.timing(highlightScale, {
        toValue: 1.035,
        duration: 220,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(highlightScale, {
        toValue: 1,
        duration: 220,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();
  }, [highlightScale, isHighlighted]);

  return (
    <Animated.View
      className="mb-3 px-4"
      style={{
        transform: [{ scale: highlightScale }],
      }}>
      <View
        className="flex-row items-end"
        style={{
          justifyContent: isMine ? 'flex-end' : 'flex-start',
        }}>
        {!isMine ? (
          <View className="mr-2 self-start pt-5">
            <Avatar initial={message.senderInitial} color={message.senderColor} size={35} />
          </View>
        ) : null}

        <View
          style={{
            maxWidth: '82%',

            alignItems: isMine ? 'flex-end' : 'flex-start',
          }}>
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
            ]}>
            <MessageContent
              message={message}
              isPlaying={isVoicePlaying}
              onToggleVoice={onToggleVoice}
              onPressReplyPreview={onPressReplyPreview}
            />
          </Pressable>

          <MessageReactions
            reactions={message.reactions}
            actionOpen={actionOpen}
            canShowSeen={isMine && seenMembers.length > 0}
            canPin={canPin}
            isPinned={Boolean(message.isPinned)}
            seenCount={seenMembers.length}
            onCloseActions={onCloseActions}
            onShowSeen={() => {
              onCloseActions();
              setSeenModalOpen(true);
            }}
            onReact={onReact}
            onReply={onReply}
            onTogglePin={onTogglePin}
          />

          {shouldShowSeenReceipt ? (
            <View
              className="mt-1 flex-row items-center"
              style={{
                paddingRight: 2,
              }}>
              {seenMembers.length === 1 ? (
                <Text className="font-body text-[10px] font-medium text-[#99918C]">Seen</Text>
              ) : (
                <>
                  <View className="flex-row items-center">
                    {visibleSeenMembers.map((member, index) => (
                      <View
                        key={member.id}
                        style={{
                          marginLeft: index === 0 ? 0 : -5,

                          zIndex: visibleSeenMembers.length - index,
                        }}>
                        <View style={styles.seenAvatarBorder}>
                          <Avatar initial={member.initial} color={member.color} size={17} />
                        </View>
                      </View>
                    ))}

                    {remainingSeenCount > 0 ? (
                      <View
                        style={[
                          styles.remainingCount,

                          {
                            marginLeft: -5,
                          },
                        ]}>
                        <Text className="font-body text-[8px] font-bold text-[#736B66]">
                          +{remainingSeenCount}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  <Text className="ml-1.5 font-body text-[10px] font-medium text-[#99918C]">
                    Seen by {seenMembers.length}
                  </Text>
                </>
              )}
            </View>
          ) : null}
        </View>
      </View>
      <SeenByModal
        visible={seenModalOpen}
        members={seenMembers}
        onClose={() => {
          setSeenModalOpen(false);
        }}
      />
    </Animated.View>
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
    backgroundColor: '#F76B1C',
    borderBottomRightRadius: 5,
  },

  otherMessageBubble: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E7E2DE',
    borderBottomLeftRadius: 5,
  },

  seenAvatarBorder: {
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    overflow: 'hidden',
  },

  remainingCount: {
    width: 19,
    height: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    backgroundColor: '#EFEAE7',
  },
});

export default MessageBubble;
