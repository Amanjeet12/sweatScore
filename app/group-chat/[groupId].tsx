import { useQuery } from 'convex/react';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import SafeAreaView from '~/components/core/SafeAreaView';
import ChatComposer from '~/components/group-chat/ChatComposer';
import ChatHeader from '~/components/group-chat/ChatHeader';
import MessageList from '~/components/group-chat/MessageList';
import { api } from '~/convex/_generated/api';
import type { Id } from '~/convex/_generated/dataModel';
import { useChatKeyboard } from '~/hooks/chat/useChatKeyboard';
import { useChatMessages } from '~/hooks/chat/useChatMessages';
import { useChatPresence } from '~/hooks/chat/useChatPresence';
import { useAuthStore } from '~/store/useAuthStore';
import type {
  ChatAttachment,
  ChatMessage,
  PendingVoiceNote,
  ChatMention,
  ChatMentionMember,
} from '~/types/chat';

export default function GroupChatScreen() {
  const params = useLocalSearchParams<{
    groupId?: string | string[];
  }>();

  const groupId = Array.isArray(params.groupId) ? params.groupId[0] : params.groupId;

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
  const initialScrollDoneRef = useRef(false);

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
  } = useChatMessages(groupId);
  const currentUser = useAuthStore((state) => state.currentUser);
  /*
   * useChatPresence adds:
   *
   * - active typing users
   * - sent/delivered/read states
   * - seen-by members
   * - message read updates
   */
  const { messages, typingUsers, setTyping, markMessageRead } = useChatPresence(
    groupId,
    originalMessages
  );

  const typedGroupId = groupId ? (groupId as Id<'chatGroups'>) : undefined;

  const group = useQuery(
    api.chat.groups.getGroup,

    typedGroupId
      ? {
          groupId: typedGroupId,
        }
      : 'skip'
  );

  const mentionMembersResult = useQuery(
    api.chat.groupInfo.listMentionableMembers,

    typedGroupId
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

  const shouldScrollForKeyboard = useCallback(() => {
    return isNearBottomRef.current;
  }, []);

  const { androidKeyboardInset, scrollToLatest } = useChatKeyboard(listRef, {
    shouldScrollOnKeyboardOpen: shouldScrollForKeyboard,
  });

  useEffect(() => {
    if (initialScrollDoneRef.current || isLoading || isLoadingMore || messages.length === 0) {
      return;
    }

    initialScrollDoneRef.current = true;

    const timer = setTimeout(() => {
      scrollToLatest(false);
    }, 120);

    return () => {
      clearTimeout(timer);
    };
  }, [isLoading, isLoadingMore, messages.length, scrollToLatest]);

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

    router.push({
      pathname: '/group-chat/[groupId]/info',

      params: {
        groupId,
      },
    });
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
          keyboardVerticalOffset={0}
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
            onBack={() => router.back()}
            onOpenSearch={() => setSearchOpen(true)}
            onOpenInfo={openGroupInfo}
            onCloseSearch={closeSearch}
            onChangeSearch={setSearchText}
          />

          <View className="flex-1">
            <MessageList
              ref={listRef}
              messages={visibleMessages}
              isLoading={isLoading}
              isLoadingMore={isLoadingMore}
              canLoadEarlier={canLoadEarlier}
              isSearching={Boolean(searchText.trim())}
              onLoadEarlier={loadEarlier}
              onReply={setReplyingTo}
              onReact={reactToMessage}
              onMessageVisible={markMessageRead}
              onNearBottomChange={(nearBottom) => {
                isNearBottomRef.current = nearBottom;
              }}
            />
          </View>

          <ChatComposer
            groupName={group?.name ?? 'Group Chat'}
            replyingTo={replyingTo}
            mentionMembers={mentionMembers}
            currentUserId={currentUser?._id ? String(currentUser._id) : undefined}
            isMentionMembersLoading={mentionMembersResult === undefined}
            isUploadingAttachment={isUploadingAttachment}
            isUploadingVoice={isUploadingVoice}
            onCancelReply={() => setReplyingTo(null)}
            onFocus={handleComposerFocus}
            onTypingChange={setTyping}
            onSendText={handleSendText}
            onSendVoice={handleSendVoice}
            onSendAttachment={handleSendAttachment}
          />
        </KeyboardAvoidingView>
      </View>
    </SafeAreaView>
  );
}
