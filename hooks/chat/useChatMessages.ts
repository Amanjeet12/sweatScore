import { useCallback, useEffect, useState } from "react";

import { createMockMessages, MOCK_TYPING_USERS } from "~/mocks/chatMessages";
import type {
  ChatMessage,
  SendAttachmentInput,
  SendTextMessageInput,
  SendVoiceMessageInput,
} from "~/types/chat";
import {
  createReplyDetails,
  CURRENT_CHAT_USER,
  formatMessageTime,
} from "~/utils/chat";

/**
 * Local UI data adapter.
 *
 * Keep this return shape when Convex is added. The internals can then be
 * replaced with usePaginatedQuery/useMutation without rewriting the screen.
 */
export const useChatMessages = (groupId?: string) => {
  const resolvedGroupId = groupId || "local-preview";
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    createMockMessages(resolvedGroupId),
  );

  useEffect(() => {
    setMessages(createMockMessages(resolvedGroupId));
  }, [resolvedGroupId]);

  const getReply = useCallback(
    (replyToMessageId?: string) =>
      createReplyDetails(
        messages.find((message) => message.id === replyToMessageId),
      ),
    [messages],
  );

  const sendTextMessage = useCallback(
    async ({ text, replyToMessageId }: SendTextMessageInput) => {
      const cleanText = text.trim();
      if (!cleanText) return false;

      const now = new Date();
      const message: ChatMessage = {
        id: `local-text-${Date.now()}`,
        groupId: resolvedGroupId,
        senderId: CURRENT_CHAT_USER.id,
        senderName: CURRENT_CHAT_USER.name,
        senderInitial: CURRENT_CHAT_USER.initial,
        senderColor: CURRENT_CHAT_USER.color,
        type: "text",
        text: cleanText,
        createdAt: now.getTime(),
        time: formatMessageTime(now),
        isMine: true,
        deliveryStatus: "read",
        replyTo: getReply(replyToMessageId),
      };

      setMessages((current) => [...current, message]);
      return true;
    },
    [getReply, resolvedGroupId],
  );

  const sendVoiceMessage = useCallback(
    async ({
      uri,
      durationSeconds,
      replyToMessageId,
    }: SendVoiceMessageInput) => {
      const now = new Date();
      const message: ChatMessage = {
        id: `local-voice-${Date.now()}`,
        groupId: resolvedGroupId,
        senderId: CURRENT_CHAT_USER.id,
        senderName: CURRENT_CHAT_USER.name,
        senderInitial: CURRENT_CHAT_USER.initial,
        senderColor: CURRENT_CHAT_USER.color,
        type: "voice",
        voiceUri: uri,
        voiceDuration: durationSeconds,
        createdAt: now.getTime(),
        time: formatMessageTime(now),
        isMine: true,
        deliveryStatus: "sent",
        replyTo: getReply(replyToMessageId),
      };

      setMessages((current) => [...current, message]);
      return true;
    },
    [getReply, resolvedGroupId],
  );

  const sendAttachment = useCallback(
    async ({ attachment, replyToMessageId }: SendAttachmentInput) => {
      const now = new Date();
      const message: ChatMessage = {
        id: `local-attachment-${Date.now()}`,
        groupId: resolvedGroupId,
        senderId: CURRENT_CHAT_USER.id,
        senderName: CURRENT_CHAT_USER.name,
        senderInitial: CURRENT_CHAT_USER.initial,
        senderColor: CURRENT_CHAT_USER.color,
        type: attachment.type,
        attachment,
        text:
          attachment.type === "image"
            ? "Shared a photo"
            : attachment.type === "video"
              ? "Shared a workout video"
              : undefined,
        createdAt: now.getTime(),
        time: formatMessageTime(now),
        isMine: true,
        deliveryStatus: "sent",
        replyTo: getReply(replyToMessageId),
      };

      setMessages((current) => [...current, message]);
      return true;
    },
    [getReply, resolvedGroupId],
  );

  const reactToMessage = useCallback((messageId: string, emoji: string) => {
    setMessages((current) =>
      current.map((message) => {
        if (message.id !== messageId) return message;

        const reactions = [...(message.reactions || [])];
        const existingIndex = reactions.findIndex(
          (reaction) => reaction.emoji === emoji,
        );

        if (existingIndex >= 0) {
          const existing = reactions[existingIndex];

          reactions[existingIndex] = {
            ...existing,
            count: existing.reactedByMe
              ? Math.max(existing.count - 1, 0)
              : existing.count + 1,
            reactedByMe: !existing.reactedByMe,
          };
        } else {
          reactions.push({
            emoji,
            count: 1,
            reactedByMe: true,
          });
        }

        return {
          ...message,
          reactions: reactions.filter((reaction) => reaction.count > 0),
        };
      }),
    );
  }, []);

  const markMessageRead = useCallback((_messageId: string) => {
    // Convex phase: call a debounced markRead mutation here.
  }, []);

  return {
    messages,
    isLoading: false,
    typingUsers: MOCK_TYPING_USERS,
    sendTextMessage,
    sendVoiceMessage,
    sendAttachment,
    reactToMessage,
    markMessageRead,
  };
};
