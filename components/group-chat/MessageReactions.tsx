import { ArrowBendUpLeft, Eye, PushPin } from 'phosphor-react-native';
import { Modal, Pressable, StyleSheet, TouchableOpacity, View } from 'react-native';

import { Text } from '~/components/ui/text';
import type { ChatReaction } from '~/types/chat';
import { REACTION_OPTIONS } from '~/utils/chat';

type MessageReactionsProps = {
  reactions?: ChatReaction[];
  actionOpen: boolean;
  canShowSeen?: boolean;
  canPin?: boolean;
  isPinned?: boolean;
  seenCount?: number;
  readOnly?: boolean;

  onReact: (emoji: string) => void;
  onReply: () => void;
  onShowSeen?: () => void;
  onTogglePin?: () => void;
  onCloseActions: () => void;
};

const MessageReactions = ({
  reactions,
  actionOpen,
  canShowSeen = false,
  canPin = false,
  isPinned = false,
  seenCount = 0,
  readOnly = false,

  onReact,
  onReply,
  onShowSeen,
  onTogglePin,
  onCloseActions,
}: MessageReactionsProps) => {
  const handleReaction = (emoji: string) => {
    onCloseActions();
    onReact(emoji);
  };

  const handleReply = () => {
    onCloseActions();
    onReply();
  };

  const handleShowSeen = () => {
    onCloseActions();
    onShowSeen?.();
  };

  const handleTogglePin = () => {
    onCloseActions();
    onTogglePin?.();
  };

  return (
    <>
      {reactions?.length ? (
        <View
          className="-mt-2 flex-row items-center rounded-full border border-[#EEE3DC] bg-white px-2 py-1"
          style={styles.reactionPill}>
          {reactions.map((reaction) => (
            <TouchableOpacity
              key={reaction.emoji}
              activeOpacity={0.75}
              disabled={readOnly}
              onPress={() => onReact(reaction.emoji)}
              className="mr-1 flex-row items-center">
              <Text className="text-sm">{reaction.emoji}</Text>

              <Text
                className="ml-0.5 font-body text-xs font-semibold"
                style={{
                  color: reaction.reactedByMe ? '#F35E16' : '#484848',
                }}>
                {reaction.count}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      <Modal
        visible={!readOnly && actionOpen}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={onCloseActions}>
        <Pressable style={styles.backdrop} onPress={onCloseActions}>
          <Pressable
            style={styles.actionContainer}
            onPress={(event) => {
              /*
               * Do not close when the user
               * taps inside the action menu.
               */
              event.stopPropagation();
            }}>
            <View className="flex-row items-center">
              {REACTION_OPTIONS.map((emoji) => (
                <TouchableOpacity
                  key={emoji}
                  activeOpacity={0.7}
                  onPress={() => handleReaction(emoji)}
                  accessibilityRole="button"
                  accessibilityLabel={`React with ${emoji}`}
                  className="h-10 w-10 items-center justify-center rounded-full">
                  <Text className="text-xl">{emoji}</Text>
                </TouchableOpacity>
              ))}

              <View className="mx-1 h-7 w-px bg-[#E8E2DE]" />

              {canShowSeen ? (
                <>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={handleShowSeen}
                    accessibilityRole="button"
                    accessibilityLabel={`View ${seenCount} people who saw this message`}
                    className="h-10 flex-row items-center justify-center rounded-full bg-[#F1ECFF] px-3">
                    <Eye size={17} color="#7441D8" weight="bold" />

                    {seenCount > 0 ? (
                      <Text className="ml-1 font-body text-[11px] font-bold text-[#7441D8]">
                        {seenCount}
                      </Text>
                    ) : null}
                  </TouchableOpacity>

                  <View className="mx-1 h-7 w-px bg-[#E8E2DE]" />
                </>
              ) : null}

              {canPin ? (
                <>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={handleTogglePin}
                    accessibilityRole="button"
                    accessibilityLabel={isPinned ? 'Unpin message' : 'Pin message'}
                    className="h-10 w-10 items-center justify-center rounded-full bg-[#FFF1E8]">
                    <PushPin size={18} color="#F35E16" weight={isPinned ? 'fill' : 'bold'} />
                  </TouchableOpacity>

                  <View className="mx-1 h-7 w-px bg-[#E8E2DE]" />
                </>
              ) : null}

              <TouchableOpacity
                activeOpacity={0.7}
                onPress={handleReply}
                accessibilityRole="button"
                accessibilityLabel="Reply to message"
                className="h-10 w-10 items-center justify-center rounded-full bg-[#FFF1E8]">
                <ArrowBendUpLeft size={18} color="#F35E16" weight="bold" />
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  reactionPill: {
    shadowColor: '#352219',

    shadowOffset: {
      width: 0,
      height: 2,
    },

    shadowOpacity: 0.08,
    shadowRadius: 5,
    elevation: 2,
  },

  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',

    backgroundColor: 'rgba(25, 18, 14, 0.18)',

    paddingHorizontal: 14,
    paddingBottom: 90,
  },

  actionContainer: {
    maxWidth: '100%',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#EDE5DF',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 7,

    shadowColor: '#352219',

    shadowOffset: {
      width: 0,
      height: 5,
    },

    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 9,
  },
});

export default MessageReactions;
