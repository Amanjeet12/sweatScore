import { useMutation, usePaginatedQuery } from 'convex/react';
import { Alert } from 'react-native';
import { useCallback, useMemo, useRef, useState } from 'react';
import { api } from '~/convex/_generated/api';
import type { Id } from '~/convex/_generated/dataModel';
import type {
  ChatMessage,
  ChatTypingUser,
  SendAttachmentInput,
  SendTextMessageInput,
  SendVoiceMessageInput,
} from '~/types/chat';
import { formatMessageTime } from '~/utils/chat';

function createClientMessageId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

function showChatError(error: unknown) {
  const message =
    error instanceof Error ? error.message : 'Something went wrong while sending the message.';

  Alert.alert('Chat error', message);
}

const MAX_IMAGE_SIZE_BYTES = 20 * 1024 * 1024;
const MAX_VIDEO_SIZE_BYTES = 100 * 1024 * 1024;

function getAttachmentMimeType(type: 'image' | 'video', mimeType?: string, fileName?: string) {
  if (mimeType?.trim()) {
    return mimeType.trim().toLowerCase();
  }

  const extension = fileName?.split('.').pop()?.toLowerCase();

  if (type === 'image') {
    switch (extension) {
      case 'png':
        return 'image/png';

      case 'heic':
        return 'image/heic';

      case 'webp':
        return 'image/webp';

      default:
        return 'image/jpeg';
    }
  }

  if (extension === 'mov') {
    return 'video/quicktime';
  }

  return 'video/mp4';
}

function getAttachmentName(type: 'image' | 'video', name?: string) {
  if (name?.trim()) {
    return name.trim();
  }

  return type === 'image' ? `chat-photo-${Date.now()}.jpg` : `chat-video-${Date.now()}.mp4`;
}

export const useChatMessages = (groupId?: string) => {
  const convexGroupId = groupId ? (groupId as Id<'chatGroups'>) : undefined;

  const { results, status, loadMore } = usePaginatedQuery(
    api.chat.messages.listMessages,
    convexGroupId
      ? {
          groupId: convexGroupId,
        }
      : 'skip',
    {
      initialNumItems: 50,
    }
  );

  const generateUploadUrlMutation = useMutation(api.chat.messages.generateUploadUrl);
  const sendAttachmentMutation = useMutation(api.chat.messages.sendAttachment);
  const attachmentUploadRef = useRef(false);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);

  const sendMessageMutation = useMutation(api.chat.messages.sendMessage);
  const toggleReactionMutation = useMutation(api.chat.messages.toggleReaction);
  const markGroupReadMutation = useMutation(api.chat.messages.markGroupRead);
  const lastReadUpdateRef = useRef(0);

  const messages = useMemo<ChatMessage[]>(() => {
    return [...results].reverse().map((message) => ({
      id: String(message._id),
      groupId: String(message.groupId),
      senderId: String(message.senderId),
      senderName: message.senderName,
      senderInitial: message.senderInitial,
      senderColor: message.senderColor,
      type: message.type,
      createdAt: message.createdAt,
      time: formatMessageTime(new Date(message.createdAt)),
      isMine: message.isMine,
      ...(message.deliveryStatus
        ? {
            deliveryStatus: message.deliveryStatus,
          }
        : {}),
      ...(message.text
        ? {
            text: message.text,
          }
        : {}),
      ...(message.attachment
        ? {
            attachment: {
              id: message.attachment.id,
              type: message.attachment.type,
              uri: message.attachment.uri,
              ...(message.attachment.name
                ? {
                    name: message.attachment.name,
                  }
                : {}),
              mimeType: message.attachment.mimeType,
              sizeBytes: message.attachment.sizeBytes,
              ...(message.attachment.thumbnailUri
                ? {
                    thumbnailUri: message.attachment.thumbnailUri,
                  }
                : {}),
            },
          }
        : {}),
      ...(message.voiceUri
        ? {
            voiceUri: message.voiceUri,
            voiceDuration: message.voiceDuration ?? 0,
          }
        : {}),
      ...(message.linkTitle
        ? {
            linkTitle: message.linkTitle,
          }
        : {}),
      ...(message.linkUrl
        ? {
            linkUrl: message.linkUrl,
          }
        : {}),
      ...(message.replyTo
        ? {
            replyTo: {
              messageId: String(message.replyTo.messageId),
              senderName: message.replyTo.senderName,
              text: message.replyTo.text,
            },
          }
        : {}),
      reactions: message.reactions,
    }));
  }, [results]);

  const sendTextMessage = useCallback(
    async ({ text, replyToMessageId }: SendTextMessageInput) => {
      if (!convexGroupId) {
        return false;
      }

      const cleanText = text.trim();

      if (!cleanText) {
        return false;
      }

      try {
        await sendMessageMutation({
          groupId: convexGroupId,
          text: cleanText,
          clientMessageId: createClientMessageId(),
          ...(replyToMessageId
            ? {
                replyToMessageId: replyToMessageId as Id<'chatMessages'>,
              }
            : {}),
        });

        return true;
      } catch (error) {
        showChatError(error);
        return false;
      }
    },
    [convexGroupId, sendMessageMutation]
  );

  const reactToMessage = useCallback(
    (messageId: string, emoji: string) => {
      void toggleReactionMutation({
        messageId: messageId as Id<'chatMessages'>,
        emoji,
      }).catch(showChatError);
    },
    [toggleReactionMutation]
  );

  const markMessageRead = useCallback(
    (_messageId: string) => {
      if (!convexGroupId) {
        return;
      }

      const now = Date.now();

      // Prevent a mutation for every visible message.
      if (now - lastReadUpdateRef.current < 3000) {
        return;
      }

      lastReadUpdateRef.current = now;

      void markGroupReadMutation({
        groupId: convexGroupId,
      }).catch(() => {
        // Read-receipt failure should not interrupt chat.
      });
    },
    [convexGroupId, markGroupReadMutation]
  );

  const loadEarlier = useCallback(() => {
    if (status === 'CanLoadMore') {
      loadMore(30);
    }
  }, [loadMore, status]);

  const sendVoiceMessage = useCallback(async (_input: SendVoiceMessageInput) => {
    Alert.alert('Coming next', 'Voice-message uploading is not connected yet.');

    return false;
  }, []);

  const sendAttachment = useCallback(
    async ({ attachment, text, replyToMessageId }: SendAttachmentInput) => {
      if (!convexGroupId) {
        return false;
      }

      if (attachmentUploadRef.current) {
        return false;
      }

      if (attachment.type !== 'image' && attachment.type !== 'video') {
        Alert.alert('Unsupported attachment', 'Only images and videos are currently supported.');

        return false;
      }

      const cleanText = text?.trim() ?? '';

      if (cleanText.length > 2000) {
        Alert.alert('Message too long', 'The message cannot exceed 2000 characters.');

        return false;
      }

      attachmentUploadRef.current = true;
      setIsUploadingAttachment(true);

      try {
        const type = attachment.type;

        const fileResponse = await fetch(attachment.uri);

        if (!fileResponse.ok) {
          throw new Error('The selected file could not be read.');
        }

        const fileBlob = await fileResponse.blob();

        const sizeBytes = fileBlob.size || attachment.sizeBytes || 0;

        const maximumSize = type === 'image' ? MAX_IMAGE_SIZE_BYTES : MAX_VIDEO_SIZE_BYTES;

        if (sizeBytes > maximumSize) {
          throw new Error(
            type === 'image'
              ? 'Image cannot be larger than 20 MB.'
              : 'Video cannot be larger than 100 MB.'
          );
        }

        if (sizeBytes <= 0) {
          throw new Error('The selected file could not be read.');
        }

        const fileName = getAttachmentName(type, attachment.name);

        const mimeType = getAttachmentMimeType(
          type,
          attachment.mimeType || fileBlob.type,
          fileName
        );

        /*
         * Step 1: get the Convex Storage upload URL.
         */
        const uploadUrl = await generateUploadUrlMutation({
          groupId: convexGroupId,
        });

        /*
         * Step 2: upload the image/video to Convex Storage.
         */
        const uploadResponse = await fetch(uploadUrl, {
          method: 'POST',
          headers: {
            'Content-Type': mimeType,
          },
          body: fileBlob,
        });

        if (!uploadResponse.ok) {
          throw new Error('The attachment upload failed.');
        }

        const uploadResult = (await uploadResponse.json()) as {
          storageId?: string;
        };

        if (!uploadResult.storageId) {
          throw new Error('The upload did not return a storage ID.');
        }

        /*
         * Step 3: create one chatMessages document
         * containing both text and attachment.
         */
        await sendAttachmentMutation({
          groupId: convexGroupId,
          storageId: uploadResult.storageId as Id<'_storage'>,
          type,
          mimeType,
          sizeBytes,
          fileName,
          clientMessageId: createClientMessageId(),

          ...(cleanText
            ? {
                text: cleanText,
              }
            : {}),

          ...(replyToMessageId
            ? {
                replyToMessageId: replyToMessageId as Id<'chatMessages'>,
              }
            : {}),
        });

        return true;
      } catch (error) {
        showChatError(error);
        return false;
      } finally {
        attachmentUploadRef.current = false;
        setIsUploadingAttachment(false);
      }
    },
    [convexGroupId, generateUploadUrlMutation, sendAttachmentMutation]
  );

  return {
    messages,
    isLoading: status === 'LoadingFirstPage',
    isLoadingMore: status === 'LoadingMore',
    canLoadEarlier: status === 'CanLoadMore',
    isUploadingAttachment,
    loadEarlier,
    typingUsers: [] as ChatTypingUser[],
    sendTextMessage,
    sendVoiceMessage,
    sendAttachment,
    reactToMessage,
    markMessageRead,
  };
};
