import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import SafeAreaView from '~/components/core/SafeAreaView';
import ChatComposer from '~/components/group-chat/ChatComposer';
import ChatHeader from '~/components/group-chat/ChatHeader';
import MessageList from '~/components/group-chat/MessageList';
import { useChatKeyboard } from '~/hooks/chat/useChatKeyboard';
import { useChatMessages } from '~/hooks/chat/useChatMessages';
import type { ChatAttachment, ChatMessage, PendingVoiceNote } from '~/types/chat';
import { useQuery } from 'convex/react';
import type { Id } from '~/convex/_generated/dataModel';
import { api } from '~/convex/_generated/api';

export default function GroupChatScreen() {
  const params = useLocalSearchParams<{ groupId?: string | string[] }>();
  const groupId = Array.isArray(params.groupId) ? params.groupId[0] : params.groupId;

  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [searchText, setSearchText] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);

  const {
    messages,
    isLoading,
    typingUsers,
    sendTextMessage,
    sendVoiceMessage,
    sendAttachment,
    reactToMessage,
    markMessageRead,
  } = useChatMessages(groupId);

  const typedGroupId = groupId ? (groupId as Id<'chatGroups'>) : undefined;

  const group = useQuery(
    api.chat.groups.getGroup,
    typedGroupId
      ? {
          groupId: typedGroupId,
        }
      : 'skip'
  );

  const { androidKeyboardInset, scrollToLatest } = useChatKeyboard(listRef);

  const visibleMessages = useMemo(() => {
    const query = searchText.trim().toLowerCase();

    if (!query) return messages;

    return messages.filter((message) => {
      const searchableText = [
        message.text,
        message.senderName,
        message.linkTitle,
        message.linkUrl,
        message.attachment?.name,
        message.replyTo?.text,
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

  const handleSendText = useCallback(
    async (text: string) => {
      if (!groupId) return false;

      const sent = await sendTextMessage({
        text,
        replyToMessageId: replyingTo?.id,
      });

      if (sent) {
        setReplyingTo(null);
        scrollToLatest(true);
      }

      return sent;
    },
    [groupId, replyingTo?.id, scrollToLatest, sendTextMessage]
  );

  const handleSendVoice = useCallback(
    async (voiceNote: PendingVoiceNote) => {
      if (!groupId) return false;

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
    [groupId, replyingTo?.id, scrollToLatest, sendVoiceMessage]
  );

  const handleSendAttachment = useCallback(
    async (attachment: ChatAttachment, text?: string) => {
      if (!groupId) {
        return false;
      }

      const sent = await sendAttachment({
        attachment,
        text,
        replyToMessageId: replyingTo?.id,
      });

      if (sent) {
        setReplyingTo(null);
        scrollToLatest(true);
      }

      return sent;
    },
    [groupId, replyingTo?.id, scrollToLatest, sendAttachment]
  );

  const typingLabel = useMemo(() => {
    if (!typingUsers.length) return undefined;
    if (typingUsers.length === 1) {
      return `${typingUsers[0].name} is typing...`;
    }

    return `${typingUsers.length} people are typing...`;
  }, [typingUsers]);

  return (
    <SafeAreaView className="flex-1 bg-white">
      <Stack.Screen options={{ headerShown: false }} />

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
            groupId={groupId}
            groupName={group?.name ?? 'Group Chat'}
            imageUrl={group?.imageUrl ?? null}
            memberCount={group?.memberCount ?? 0}
            typingLabel={typingLabel}
            searchOpen={searchOpen}
            searchText={searchText}
            onBack={() => router.back()}
            onOpenSearch={() => setSearchOpen(true)}
            onCloseSearch={closeSearch}
            onChangeSearch={setSearchText}
          />
          <View className="flex-1">
            <MessageList
              ref={listRef}
              messages={visibleMessages}
              isLoading={isLoading}
              isSearching={Boolean(searchText.trim())}
              onReply={setReplyingTo}
              onReact={reactToMessage}
              onMessageVisible={markMessageRead}
              onContentSizeChange={() => {
                if (!searchText) scrollToLatest(false);
              }}
            />
          </View>

          <ChatComposer
            groupName={group?.name ?? 'Group Chat'}
            replyingTo={replyingTo}
            onCancelReply={() => setReplyingTo(null)}
            onFocus={() => scrollToLatest(true)}
            onSendText={handleSendText}
            onSendVoice={handleSendVoice}
            onSendAttachment={handleSendAttachment}
          />
        </KeyboardAvoidingView>
      </View>
    </SafeAreaView>
  );
}
