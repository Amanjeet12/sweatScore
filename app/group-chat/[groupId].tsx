import { useQuery, useMutation } from 'convex/react';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SafeAreaView from '~/components/core/SafeAreaView';
import ChatComposer from '~/components/group-chat/ChatComposer';
import ChatHeader from '~/components/group-chat/ChatHeader';
import MessageList from '~/components/group-chat/MessageList';
import PinnedMessageBanner from '~/components/group-chat/PinnedMessageBanner';
import { api } from '~/convex/_generated/api';
import type { Id } from '~/convex/_generated/dataModel';
import { useChatKeyboard } from '~/hooks/chat/useChatKeyboard';
import { useChatMessages } from '~/hooks/chat/useChatMessages';
import { useChatPresence } from '~/hooks/chat/useChatPresence';
import { useSubscriptionGuard } from '~/hooks/useSubscriptionGuard';
import { useAuthStore } from '~/store/useAuthStore';
import type {
  ChatAttachment,
  ChatMessage,
  PendingVoiceNote,
  ChatMention,
  ChatMentionMember,
} from '~/types/chat';
import { Text } from '~/components/ui/text';

export default function GroupChatScreen() {
  const params = useLocalSearchParams<{
    groupId?: string | string[];
  }>();

  const groupId = Array.isArray(params.groupId) ? params.groupId[0] : params.groupId;
  const { requireSubscription } = useSubscriptionGuard();
  const redirectTo = groupId ? `/group-chat/${groupId}` : '/group-chat';
  const requireChatAction = useCallback(
    (source: string) => requireSubscription({ redirectTo, source }),
    [redirectTo, requireSubscription]
  );

  const insets = useSafeAreaInsets();

  /*
   * MessageList now contains both messages
   * and date-separator rows internally.
   */
  const listRef = useRef<FlatList<any>>(null);

  /*
   * This prevents the keyboard and incoming
   * messages from forcing the user to the
   * bottom while reading older messages.
   */
  const isNearBottomRef = useRef(true);

  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);

  const [searchText, setSearchText] = useState('');

  const [searchOpen, setSearchOpen] = useState(false);

  /*
   * useChatMessages handles:
   *
   * - Convex pagination
   * - text sending
   * - attachment sending
   * - voice sending
   * - reactions
   * - upload state
   *
   * These are the raw messages before
   * delivery/read status is added.
   */
  const {
    messages: originalMessages,
    isLoading,
    isLoadingMore,
    canLoadEarlier,
    isUploadingAttachment,
    isUploadingVoice,
    loadEarlier,
    sendTextMessage,
    sendVoiceMessage,
    sendAttachment,
    reactToMessage,
    pinnedMessage,
    canPinMessages,
    pinMessage,
    unpinMessage,
    deleteMessage,
  } = useChatMessages(groupId);

  const [isUpdatingPin, setIsUpdatingPin] = useState(false);

  const [pinnedScrollRequest, setPinnedScrollRequest] = useState<{
    messageId: string;
    requestId: number;
  } | null>(null);
  const currentUser = useAuthStore((state) => state.currentUser);
  /*
   * useChatPresence adds:
   *
   * - active typing users
   * - sent/delivered/read states
   * - seen-by members
   * - message read updates
   */

  const typedGroupId = groupId ? (groupId as Id<'chatGroups'>) : undefined;

  const group = useQuery(
    api.chat.groups.getGroup,

    typedGroupId
      ? {
          groupId: typedGroupId,
        }
      : 'skip'
  );

  const isMember = group?.isMember === true;

  const { messages, typingUsers, setTyping, markMessageRead } = useChatPresence(
    groupId,
    originalMessages,
    isMember
  );

  const mentionMembersResult = useQuery(
    api.chat.groupInfo.listMentionableMembers,

    typedGroupId && isMember
      ? {
          groupId: typedGroupId,
        }
      : 'skip'
  );

  const mentionMembers = useMemo<ChatMentionMember[]>(
    () =>
      (mentionMembersResult ?? []).map((member) => ({
        userId: String(member.userId),

        name: member.name,
        initial: member.initial,

        avatarColor: member.avatarColor,
      })),

    [mentionMembersResult]
  );

  const joinGroupMutation = useMutation(api.chat.groups.joinGroup);

  const [isJoiningGroup, setIsJoiningGroup] = useState(false);

  const handleDeleteMessage = useCallback(
    (message: ChatMessage) => {
      if (!message.isMine || message.isDeleted) {
        return;
      }

      Alert.alert('Delete message?', 'This message will be deleted for everyone in the group.', [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',

          onPress: () => {
            if (replyingTo?.id === message.id) {
              setReplyingTo(null);
            }

            void deleteMessage(message.id);
          },
        },
      ]);
    },
    [deleteMessage, replyingTo?.id]
  );
  const handleJoinGroup = useCallback(async () => {
    if (!typedGroupId || isJoiningGroup) {
      return;
    }
    if (!requireChatAction('chat_join_group')) return;

    setIsJoiningGroup(true);

    try {
      await joinGroupMutation({
        groupId: typedGroupId,
      });
    } catch (error) {
      Alert.alert(
        'Unable to join group',

        error instanceof Error ? error.message : 'Please try again.'
      );
    } finally {
      setIsJoiningGroup(false);
    }
  }, [isJoiningGroup, joinGroupMutation, requireChatAction, typedGroupId]);

  const shouldScrollForKeyboard = useCallback(() => {
    return isNearBottomRef.current;
  }, []);

  const { androidKeyboardInset, scrollToLatest } = useChatKeyboard(listRef, {
    shouldScrollOnKeyboardOpen: shouldScrollForKeyboard,
  });

  const visibleMessages = useMemo(() => {
    const query = searchText.trim().toLowerCase();

    if (!query) {
      return messages;
    }

    return messages.filter((message) => {
      const searchableText = [
        message.text,
        message.senderName,
        message.linkTitle,
        message.linkUrl,
        message.attachment?.name,
        message.replyTo?.text,

        message.type === 'voice' ? 'voice note audio' : undefined,

        message.type === 'image' ? 'photo image' : undefined,

        message.type === 'video' ? 'video' : undefined,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return searchableText.includes(query);
    });
  }, [messages, searchText]);

  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    setSearchText('');
  }, []);

  const openGroupInfo = useCallback(() => {
    if (!groupId) {
      return;
    }

    // router.push({
    //   pathname: '/group-chat/[groupId]/info',

    //   params: {
    //     groupId,
    //   },
    // });
  }, [groupId]);

  const handleComposerFocus = useCallback(() => {
    /*
     * Do not jump to the latest message
     * when the user is currently reading
     * older messages.
     */
    if (isNearBottomRef.current) {
      scrollToLatest(true);
    }
  }, [scrollToLatest]);

  const handleTogglePin = useCallback(
    async (message: ChatMessage) => {
      if (!canPinMessages || isUpdatingPin) {
        return;
      }

      setIsUpdatingPin(true);

      try {
        if (message.isPinned) {
          await unpinMessage(message.id);
        } else {
          await pinMessage(message.id);
        }
      } finally {
        setIsUpdatingPin(false);
      }
    },
    [canPinMessages, isUpdatingPin, pinMessage, unpinMessage]
  );

  const handleUnpinBanner = useCallback(() => {
    if (!pinnedMessage || !canPinMessages || isUpdatingPin) {
      return;
    }

    Alert.alert(
      'Unpin message?',
      'This will remove the pinned message for everyone in the group.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unpin',
          style: 'destructive',
          onPress: () => {
            setIsUpdatingPin(true);
            void unpinMessage(pinnedMessage.messageId).finally(() => setIsUpdatingPin(false));
          },
        },
      ]
    );
  }, [canPinMessages, isUpdatingPin, pinnedMessage, unpinMessage]);

  const handleSendText = useCallback(
    async (text: string, mentions: ChatMention[]) => {
      if (!groupId) {
        return false;
      }

      const sent = await sendTextMessage({
        text,
        mentions,

        replyToMessageId: replyingTo?.id,
      });

      if (sent) {
        setTyping(false);
        setReplyingTo(null);
        scrollToLatest(true);
      }

      return sent;
    },
    [groupId, replyingTo?.id, scrollToLatest, sendTextMessage, setTyping]
  );

  const handleSendVoice = useCallback(
    async (voiceNote: PendingVoiceNote) => {
      if (!groupId) {
        return false;
      }

      setTyping(false);

      const sent = await sendVoiceMessage({
        ...voiceNote,

        replyToMessageId: replyingTo?.id,
      });

      if (sent) {
        setReplyingTo(null);
        scrollToLatest(true);
      }

      return sent;
    },
    [groupId, replyingTo?.id, scrollToLatest, sendVoiceMessage, setTyping]
  );

  const handleSendAttachment = useCallback(
    async (
      attachment: ChatAttachment,

      text?: string,

      mentions: ChatMention[] = []
    ) => {
      if (!groupId) {
        return false;
      }

      const sent = await sendAttachment({
        attachment,
        text,
        mentions,

        replyToMessageId: replyingTo?.id,
      });

      if (sent) {
        setTyping(false);
        setReplyingTo(null);
        scrollToLatest(true);
      }

      return sent;
    },
    [groupId, replyingTo?.id, scrollToLatest, sendAttachment, setTyping]
  );

  const typingLabel = useMemo(() => {
    if (typingUsers.length === 0) {
      return undefined;
    }

    if (typingUsers.length === 1) {
      return `${typingUsers[0].name} is typing...`;
    }

    if (typingUsers.length === 2) {
      return `${typingUsers[0].name} and ${typingUsers[1].name} are typing...`;
    }

    return `${typingUsers.length} people are typing...`;
  }, [typingUsers]);

  return (
    <SafeAreaView className="flex-1 bg-white">
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />

      <View
        className="flex-1"
        style={{
          paddingTop: Platform.OS === 'android' ? insets.top + 8 : 8,
        }}>
          <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
          style={{
            flex: 1,

            paddingBottom: Platform.OS === 'android' ? androidKeyboardInset : 0,
          }}>
          <ChatHeader
            groupName={group?.name ?? 'Group Chat'}
            imageUrl={group?.imageUrl ?? null}
            memberCount={group?.memberCount ?? 0}
            typingLabel={typingLabel}
            searchOpen={searchOpen}
            searchText={searchText}
            showInfoButton={group?.isMember === true}
            onBack={() => router.back()}
            onOpenSearch={() => setSearchOpen(true)}
            onOpenInfo={openGroupInfo}
            onCloseSearch={closeSearch}
            onChangeSearch={setSearchText}
          />

          <PinnedMessageBanner
            message={pinnedMessage}
            canUnpin={canPinMessages}
            isUnpinning={isUpdatingPin}
            onUnpin={handleUnpinBanner}
            onPress={() => {
              if (!pinnedMessage) {
                return;
              }

              closeSearch();
              setPinnedScrollRequest((current) => ({
                messageId: pinnedMessage.messageId,
                requestId: (current?.requestId ?? 0) + 1,
              }));
            }}
          />

          <View className="flex-1">
            <MessageList
              key={groupId}
              ref={listRef}
              messages={visibleMessages}
              readOnly={!isMember}
              isLoading={isLoading}
              isLoadingMore={isLoadingMore}
              canLoadEarlier={canLoadEarlier}
              isSearching={Boolean(searchText.trim())}
              canPinMessages={isMember && canPinMessages && !isUpdatingPin}
              pinnedScrollRequest={pinnedScrollRequest}
              onLoadEarlier={loadEarlier}
              onReply={(message) => {
                if (isMember && requireChatAction('chat_reply_message')) {
                  setReplyingTo(message);
                }
              }}
              onReact={(messageId, emoji) => {
                if (isMember) {
                  reactToMessage(messageId, emoji);
                }
              }}
              onTogglePin={(message) => {
                if (isMember) {
                  void handleTogglePin(message);
                }
              }}
              onMessageVisible={isMember ? markMessageRead : undefined}
              onNearBottomChange={(nearBottom) => {
                isNearBottomRef.current = nearBottom;
              }}
              onDelete={(message) => {
                if (isMember) {
                  handleDeleteMessage(message);
                }
              }}
            />
          </View>

          {group === undefined ? (
            <View className="border-t border-[#EEE7E2] bg-white px-4 py-5">
              <ActivityIndicator size="small" color="#F76B1C" />
            </View>
          ) : group.isMember ? (
            <ChatComposer
              groupName={group.name}
              replyingTo={replyingTo}
              mentionMembers={mentionMembers}
              currentUserId={currentUser?._id ? String(currentUser._id) : undefined}
              canMentionAll={currentUser?.isAdmin === true}
              isMentionMembersLoading={mentionMembersResult === undefined}
              isUploadingAttachment={isUploadingAttachment}
              isUploadingVoice={isUploadingVoice}
              onCancelReply={() => setReplyingTo(null)}
              onFocus={handleComposerFocus}
              onTypingChange={setTyping}
              requirePremiumAction={requireChatAction}
              onSendText={handleSendText}
              onSendVoice={handleSendVoice}
              onSendAttachment={handleSendAttachment}
            />
          ) : (
            <View className="border-t border-[#EEE7E2] bg-white px-4 pb-4 pt-3">
              {group.isRestricted ? (
                <View className="rounded-2xl bg-[#FFF1F1] px-4 py-4">
                  <Text className="text-center font-heading text-base font-bold text-[#B42318]">
                    Group access restricted
                  </Text>

                  <Text className="mt-1 text-center font-body text-sm leading-5 text-[#7A514E]">
                    You were removed from this group and cannot rejoin.
                  </Text>
                </View>
              ) : (
                <View className="rounded-2xl border border-[#F4D7C6] bg-[#FFF7F2] px-4 py-4">
                  <Text className="text-center font-heading text-base font-bold text-[#1A1A1A]">
                    Join this group to participate
                  </Text>

                  <Text className="mt-1 text-center font-body text-sm leading-5 text-[#716A65]">
                    {group.description?.trim() ||
                      'You can read messages, but you must join before sending, replying, reacting or tagging members.'}
                  </Text>

                  <TouchableOpacity
                    activeOpacity={0.8}
                    disabled={isJoiningGroup}
                    onPress={() => {
                      void handleJoinGroup();
                    }}
                    className="mt-4 h-12 items-center justify-center rounded-full bg-[#F76B1C]">
                    {isJoiningGroup ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text className="font-heading text-sm font-bold text-white">Join Group</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        </KeyboardAvoidingView>
      </View>
    </SafeAreaView>
  );
}
