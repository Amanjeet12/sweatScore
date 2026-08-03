import { ArrowDown } from 'phosphor-react-native';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  FlatList,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
  type ViewToken,
} from 'react-native';

import MessageBubble from '~/components/group-chat/MessageBubble';
import { Text } from '~/components/ui/text';
import type { ChatMessage } from '~/types/chat';

type MessageListProps = {
  messages: ChatMessage[];
  isLoading: boolean;
  isLoadingMore: boolean;
  canLoadEarlier: boolean;
  isSearching: boolean;
  canPinMessages: boolean;
  pinnedScrollRequest: { messageId: string; requestId: number } | null;
  readOnly?: boolean;

  onLoadEarlier: () => void;
  onReply: (message: ChatMessage) => void;
  onReact: (messageId: string, emoji: string) => void;
  onTogglePin: (message: ChatMessage) => void;
  onMessageVisible?: (messageId: string) => void;
  onNearBottomChange?: (isNearBottom: boolean) => void;
};

type MessageListRow =
  | {
      type: 'date';
      id: string;
      label: string;
    }
  | {
      type: 'message';
      id: string;
      message: ChatMessage;
    };

const LOAD_EARLIER_THRESHOLD = 100;
const NEAR_BOTTOM_THRESHOLD = 140;

const getStartOfDay = (date: Date) => {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

const isSameCalendarDay = (firstTimestamp: number, secondTimestamp: number) => {
  const first = new Date(firstTimestamp);
  const second = new Date(secondTimestamp);

  return (
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate()
  );
};

const getDateKey = (timestamp: number) => {
  const date = new Date(timestamp);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

const formatMessageDate = (timestamp: number) => {
  const messageDate = getStartOfDay(new Date(timestamp));
  const today = getStartOfDay(new Date());

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (messageDate.getTime() === today.getTime()) {
    return 'Today';
  }

  if (messageDate.getTime() === yesterday.getTime()) {
    return 'Yesterday';
  }

  if (messageDate.getFullYear() === today.getFullYear()) {
    return messageDate.toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'long',
    });
  }

  return messageDate.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
};

const buildRows = (messages: ChatMessage[]): MessageListRow[] => {
  const rows: MessageListRow[] = [];

  messages.forEach((message, index) => {
    const previousMessage = index > 0 ? messages[index - 1] : null;

    const shouldShowDate =
      !previousMessage || !isSameCalendarDay(previousMessage.createdAt, message.createdAt);

    if (shouldShowDate) {
      rows.push({
        type: 'date',
        id: `date-${getDateKey(message.createdAt)}`,
        label: formatMessageDate(message.createdAt),
      });
    }

    rows.push({
      type: 'message',
      id: `message-${message.id}`,
      message,
    });
  });

  return rows;
};

const MessageList = forwardRef<FlatList<any>, MessageListProps>(
  (
    {
      messages,
      isLoading,
      isLoadingMore,
      canLoadEarlier,
      isSearching,
      canPinMessages,
      pinnedScrollRequest,
      readOnly = false,

      onLoadEarlier,
      onReply,
      onReact,
      onTogglePin,
      onMessageVisible,
      onNearBottomChange,
    },
    forwardedRef
  ) => {
    const internalListRef = useRef<FlatList<MessageListRow>>(null);

    const [actionMessageId, setActionMessageId] = useState<string | null>(null);
    const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
    const [isNearBottom, setIsNearBottom] = useState(true);
    const [newMessageCount, setNewMessageCount] = useState(0);
    const [replyScrollRequest, setReplyScrollRequest] = useState<{
      messageId: string;
      requestId: number;
    } | null>(null);
    const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);

    const loadingEarlierRef = useRef(false);
    const isNearBottomRef = useRef(true);
    const previousLatestIdRef = useRef<string | null>(null);
    const initialScrollDoneRef = useRef(false);
    const handledPinnedRequestRef = useRef<number | null>(null);
    const handledReplyRequestRef = useRef<number | null>(null);
    const replyRequestIdRef = useRef(0);
    const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const highlightDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const onMessageVisibleRef = useRef(onMessageVisible);

    /*
     * Older messages should only load after an actual user scroll.
     * This prevents automatic loading when 20 short messages do not
     * fill the complete screen.
     */
    const userHasScrolledRef = useRef(false);

    /*
     * Prevent repeatedly loading multiple pages while one scroll event
     * remains inside the top threshold.
     */
    const wasNearTopRef = useRef(false);

    const rows = useMemo(() => buildRows(messages), [messages]);

    const highlightMessage = useCallback((messageId: string) => {
      setHighlightedMessageId(null);

      requestAnimationFrame(() => {
        setHighlightedMessageId(messageId);
      });

      if (highlightTimerRef.current) {
        clearTimeout(highlightTimerRef.current);
      }

      highlightTimerRef.current = setTimeout(() => {
        setHighlightedMessageId(null);
        highlightTimerRef.current = null;
      }, 1800);
    }, []);

    useEffect(() => {
      if (
        !pinnedScrollRequest ||
        handledPinnedRequestRef.current === pinnedScrollRequest.requestId ||
        isLoading ||
        isLoadingMore
      ) {
        return;
      }

      const rowIndex = rows.findIndex(
        (row) => row.type === 'message' && row.message.id === pinnedScrollRequest.messageId
      );

      if (rowIndex >= 0) {
        handledPinnedRequestRef.current = pinnedScrollRequest.requestId;

        requestAnimationFrame(() => {
          internalListRef.current?.scrollToIndex({
            index: rowIndex,
            animated: true,
            viewPosition: 0.5,
          });

          if (highlightDelayRef.current) {
            clearTimeout(highlightDelayRef.current);
          }

          highlightDelayRef.current = setTimeout(() => {
            highlightMessage(pinnedScrollRequest.messageId);
            highlightDelayRef.current = null;
          }, 400);
        });
        return;
      }

      if (canLoadEarlier && !isSearching) {
        onLoadEarlier();
      }
    }, [
      canLoadEarlier,
      highlightMessage,
      isLoading,
      isLoadingMore,
      isSearching,
      onLoadEarlier,
      pinnedScrollRequest,
      rows,
    ]);

    useEffect(() => {
      if (
        !replyScrollRequest ||
        handledReplyRequestRef.current === replyScrollRequest.requestId ||
        isLoading ||
        isLoadingMore
      ) {
        return;
      }

      const rowIndex = rows.findIndex(
        (row) => row.type === 'message' && row.message.id === replyScrollRequest.messageId
      );

      if (rowIndex >= 0) {
        handledReplyRequestRef.current = replyScrollRequest.requestId;

        requestAnimationFrame(() => {
          internalListRef.current?.scrollToIndex({
            index: rowIndex,
            animated: true,
            viewPosition: 0.5,
          });

          if (highlightDelayRef.current) {
            clearTimeout(highlightDelayRef.current);
          }

          highlightDelayRef.current = setTimeout(() => {
            highlightMessage(replyScrollRequest.messageId);
            highlightDelayRef.current = null;
          }, 400);
        });
        return;
      }

      if (canLoadEarlier && !isSearching) {
        onLoadEarlier();
      }
    }, [
      canLoadEarlier,
      highlightMessage,
      isLoading,
      isLoadingMore,
      isSearching,
      onLoadEarlier,
      replyScrollRequest,
      rows,
    ]);

    useEffect(() => {
      return () => {
        if (highlightTimerRef.current) {
          clearTimeout(highlightTimerRef.current);
        }

        if (highlightDelayRef.current) {
          clearTimeout(highlightDelayRef.current);
        }
      };
    }, []);

    const latestOwnMessageId = useMemo(() => {
      for (let index = messages.length - 1; index >= 0; index -= 1) {
        if (messages[index].isMine) {
          return messages[index].id;
        }
      }

      return null;
    }, [messages]);

    useImperativeHandle(forwardedRef, () => internalListRef.current as FlatList<any>);

    useEffect(() => {
      onMessageVisibleRef.current = onMessageVisible;
    }, [onMessageVisible]);

    const updateNearBottom = useCallback(
      (nextValue: boolean) => {
        if (isNearBottomRef.current === nextValue) {
          return;
        }

        isNearBottomRef.current = nextValue;
        setIsNearBottom(nextValue);
        onNearBottomChange?.(nextValue);

        if (nextValue) {
          setNewMessageCount(0);
        }
      },
      [onNearBottomChange]
    );

    const scrollToLatest = useCallback(
      (animated = true) => {
        requestAnimationFrame(() => {
          internalListRef.current?.scrollToEnd({
            animated,
          });
        });

        updateNearBottom(true);
        setNewMessageCount(0);
      },
      [updateNearBottom]
    );

    const handleLoadEarlier = useCallback(() => {
      if (!canLoadEarlier || isLoadingMore || loadingEarlierRef.current || isSearching) {
        return;
      }

      loadingEarlierRef.current = true;
      onLoadEarlier();
    }, [canLoadEarlier, isLoadingMore, isSearching, onLoadEarlier]);

    /*
     * Release the pagination lock after Convex finishes loading.
     */
    useEffect(() => {
      if (!isLoadingMore) {
        loadingEarlierRef.current = false;
      }
    }, [isLoadingMore]);

    /*
     * Scroll to the newest message only once when the initial
     * 20 messages are first loaded.
     *
     * This does not run when the count changes from 20 to 40.
     */
    useEffect(() => {
      if (initialScrollDoneRef.current || isLoading || messages.length === 0) {
        return;
      }

      initialScrollDoneRef.current = true;

      const timer = setTimeout(() => {
        scrollToLatest(false);
      }, 100);

      return () => {
        clearTimeout(timer);
      };
    }, [isLoading, messages.length, scrollToLatest]);

    /*
     * Detect only messages appended after the current latest message.
     *
     * Loading older messages does not change the latest message ID,
     * so pagination will never trigger scrollToLatest here.
     */
    useEffect(() => {
      if (messages.length === 0) {
        previousLatestIdRef.current = null;
        return;
      }

      if (isSearching) {
        return;
      }

      const latestMessage = messages[messages.length - 1];
      const previousLatestId = previousLatestIdRef.current;

      if (!previousLatestId) {
        previousLatestIdRef.current = latestMessage.id;
        return;
      }

      if (previousLatestId === latestMessage.id) {
        return;
      }

      const previousLatestIndex = messages.findIndex((message) => message.id === previousLatestId);

      if (previousLatestIndex >= 0) {
        const appendedMessages = messages.slice(previousLatestIndex + 1);

        if (appendedMessages.length > 0) {
          const containsMyMessage = appendedMessages.some((message) => message.isMine);

          if (containsMyMessage || isNearBottomRef.current) {
            scrollToLatest(true);
          } else {
            setNewMessageCount((currentCount) => currentCount + appendedMessages.length);
          }
        }
      }

      previousLatestIdRef.current = latestMessage.id;
    }, [isSearching, messages, scrollToLatest]);

    const handleScroll = useCallback(
      (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;

        const distanceFromBottom =
          contentSize.height - (contentOffset.y + layoutMeasurement.height);

        updateNearBottom(distanceFromBottom <= NEAR_BOTTOM_THRESHOLD);

        const isNearTop = contentOffset.y <= LOAD_EARLIER_THRESHOLD;

        /*
         * Load one older page only when the user newly enters
         * the top threshold.
         */
        if (userHasScrolledRef.current && isNearTop && !wasNearTopRef.current) {
          handleLoadEarlier();
        }

        wasNearTopRef.current = isNearTop;
      },
      [handleLoadEarlier, updateNearBottom]
    );

    const handleViewableItemsChanged = useRef(
      ({ viewableItems }: { viewableItems: ViewToken<MessageListRow>[] }) => {
        viewableItems.forEach((token) => {
          if (!token.isViewable || token.item?.type !== 'message') {
            return;
          }

          onMessageVisibleRef.current?.(token.item.message.id);
        });
      }
    ).current;

    const renderRow = useCallback(
      ({ item }: { item: MessageListRow }) => {
        if (item.type === 'date') {
          return (
            <View className="my-3 items-center">
              <View className="rounded-full border border-[#ECE7E3] bg-[#F8F7F6] px-4 py-1.5">
                <Text className="font-body text-[11px] font-semibold text-[#6D6864]">
                  {item.label}
                </Text>
              </View>
            </View>
          );
        }

        const message = item.message;

        return (
          <MessageBubble
            message={message}
            readOnly={readOnly}
            actionOpen={actionMessageId === message.id}
            isVoicePlaying={playingVoiceId === message.id}
            showSeenReceipt={message.id === latestOwnMessageId}
            canPin={canPinMessages}
            isHighlighted={highlightedMessageId === message.id}
            onToggleActions={() => {
              setActionMessageId((current) => (current === message.id ? null : message.id));
            }}
            onCloseActions={() => {
              setActionMessageId(null);
            }}
            onToggleVoice={() => {
              setPlayingVoiceId((current) => (current === message.id ? null : message.id));
            }}
            onReply={() => {
              onReply(message);
              setActionMessageId(null);
            }}
            onReact={(emoji) => {
              onReact(message.id, emoji);

              setActionMessageId(null);
            }}
            onTogglePin={() => {
              onTogglePin(message);
              setActionMessageId(null);
            }}
            onPressReplyPreview={() => {
              if (!message.replyTo) {
                return;
              }

              replyRequestIdRef.current += 1;
              setReplyScrollRequest({
                messageId: message.replyTo.messageId,
                requestId: replyRequestIdRef.current,
              });
              setActionMessageId(null);
            }}
          />
        );
      },
      [
        actionMessageId,
        canPinMessages,
        highlightedMessageId,
        latestOwnMessageId,
        onReact,
        onReply,
        onTogglePin,
        playingVoiceId,
      ]
    );

    /*
     * Fixed-height pagination header.
     *
     * Its height does not change between loading, button and empty
     * states, preventing message-position shifts.
     */
    const paginationHeader = (
      <View style={styles.paginationHeader}>
        {isLoadingMore ? (
          <>
            <ActivityIndicator size="small" color="#F76B1C" />

            <Text className="mt-1 font-body text-[11px] text-[#77716D]">
              Loading earlier messages…
            </Text>
          </>
        ) : canLoadEarlier && !isSearching ? (
          <TouchableOpacity
            activeOpacity={0.75}
            onPress={handleLoadEarlier}
            className="rounded-full bg-[#FFF0E7] px-4 py-2">
            <Text className="font-body text-xs font-bold text-[#F76B1C]">
              Load earlier messages
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );

    return (
      <View className="flex-1">
        <FlatList
          ref={internalListRef}
          data={rows}
          keyExtractor={(item) => item.id}
          renderItem={renderRow}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          contentContainerStyle={{
            paddingTop: 8,
            paddingBottom: 10,
            flexGrow: messages.length ? undefined : 1,
          }}
          ListHeaderComponent={paginationHeader}
          /*
           * React Native keeps the currently visible message fixed
           * when older date/message rows are inserted above it.
           *
           * The ListHeaderComponent is not included in data indexes,
           * so the first data index is 0.
           */
          maintainVisibleContentPosition={{
            minIndexForVisible: 0,
          }}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          onViewableItemsChanged={handleViewableItemsChanged}
          onScrollToIndexFailed={(info) => {
            internalListRef.current?.scrollToOffset({
              offset: info.averageItemLength * info.index,
              animated: true,
            });
          }}
          viewabilityConfig={{
            itemVisiblePercentThreshold: 60,
            minimumViewTime: 250,
          }}
          onScrollBeginDrag={() => {
            userHasScrolledRef.current = true;
            setActionMessageId(null);
          }}
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center px-8 py-16">
              {isLoading ? (
                <ActivityIndicator size="small" color="#F76B1C" />
              ) : (
                <>
                  <Text className="font-heading text-lg font-bold text-[#2B2B2B]">
                    {isSearching ? 'No messages found' : 'No messages yet'}
                  </Text>

                  <Text className="mt-1 text-center font-body text-sm text-[#777777]">
                    {isSearching ? 'Try another search.' : 'Start the conversation below.'}
                  </Text>
                </>
              )}
            </View>
          }
        />

        {!isNearBottom && newMessageCount > 0 ? (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => scrollToLatest(true)}
            accessibilityRole="button"
            accessibilityLabel={`${newMessageCount} new ${
              newMessageCount === 1 ? 'message' : 'messages'
            }`}
            style={styles.newMessageButton}>
            <ArrowDown size={17} color="#FFFFFF" weight="bold" />

            <Text className="ml-1.5 font-body text-xs font-bold text-white">
              {newMessageCount} {newMessageCount === 1 ? 'new message' : 'new messages'}
            </Text>
          </TouchableOpacity>
        ) : !isNearBottom ? (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => scrollToLatest(true)}
            accessibilityRole="button"
            accessibilityLabel="Scroll to latest message"
            style={styles.scrollBottomButton}>
            <ArrowDown size={20} color="#F76B1C" weight="bold" />
          </TouchableOpacity>
        ) : null}
      </View>
    );
  }
);

MessageList.displayName = 'MessageList';

const styles = StyleSheet.create({
  paginationHeader: {
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },

  newMessageButton: {
    position: 'absolute',
    right: 16,
    bottom: 14,
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: '#F76B1C',
    paddingHorizontal: 14,

    shadowColor: '#6B3216',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 6,
  },

  scrollBottomButton: {
    position: 'absolute',
    right: 16,
    bottom: 14,
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 21,
    borderWidth: 1,
    borderColor: '#F3D4C3',
    backgroundColor: '#FFFFFF',

    shadowColor: '#6B3216',
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.15,
    shadowRadius: 7,
    elevation: 5,
  },
});

export default MessageList;
