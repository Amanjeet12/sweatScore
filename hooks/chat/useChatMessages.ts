import { useMutation, usePaginatedQuery } from 'convex/react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';

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

const MAX_IMAGE_SIZE_BYTES = 20 * 1024 * 1024;

const MAX_VIDEO_SIZE_BYTES = 100 * 1024 * 1024;

const MAX_AUDIO_SIZE_BYTES = 20 * 1024 * 1024;

const MAX_VOICE_DURATION_SECONDS = 300;

function createClientMessageId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

function showChatError(error: unknown) {
  const message =
    error instanceof Error ? error.message : 'Something went wrong while sending the message.';

  Alert.alert('Chat error', message);
}

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

function getVoiceMimeType(mimeType?: string, fileName?: string) {
  const normalizedMimeType = mimeType?.trim().toLowerCase();

  if (normalizedMimeType?.startsWith('audio/')) {
    return normalizedMimeType;
  }

  const extension = fileName?.split('.').pop()?.toLowerCase();

  switch (extension) {
    case 'aac':
      return 'audio/aac';

    case 'wav':
      return 'audio/wav';

    case 'mp3':
      return 'audio/mpeg';

    case 'webm':
      return 'audio/webm';

    case 'caf':
      return 'audio/x-caf';

    case 'm4a':
    default:
      return 'audio/mp4';
  }
}

function getVoiceFileName(fileName?: string) {
  if (fileName?.trim()) {
    return fileName.trim();
  }

  return `voice-message-${Date.now()}.m4a`;
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
      initialNumItems: 20,
    }
  );

  const generateUploadUrlMutation = useMutation(api.chat.messages.generateUploadUrl);

  const sendAttachmentMutation = useMutation(api.chat.messages.sendAttachment);

  const sendVoiceMessageMutation = useMutation(api.chat.messages.sendVoiceMessage);

  const sendMessageMutation = useMutation(api.chat.messages.sendMessage);

  const toggleReactionMutation = useMutation(api.chat.messages.toggleReaction);

  const markGroupReadMutation = useMutation(api.chat.messages.markGroupRead);

  const attachmentUploadRef = useRef(false);

  const voiceUploadRef = useRef(false);

  const lastReadUpdateRef = useRef(0);

  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);

  const [isUploadingVoice, setIsUploadingVoice] = useState(false);

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

      if (now - lastReadUpdateRef.current < 3000) {
        return;
      }

      lastReadUpdateRef.current = now;

      void markGroupReadMutation({
        groupId: convexGroupId,
      }).catch(() => {
        // Read failures should not interrupt chat.
      });
    },
    [convexGroupId, markGroupReadMutation]
  );

  const loadEarlier = useCallback(() => {
    if (status === 'CanLoadMore') {
      loadMore(30);
    }
  }, [loadMore, status]);

  const sendVoiceMessage = useCallback(
    async ({
      uri,
      durationSeconds,
      fileName,
      mimeType,
      sizeBytes: providedSizeBytes,
      replyToMessageId,
    }: SendVoiceMessageInput) => {
      if (!convexGroupId) {
        return false;
      }

      if (voiceUploadRef.current) {
        return false;
      }

      if (!uri?.trim()) {
        Alert.alert('Voice message unavailable', 'The recorded audio file could not be read.');

        return false;
      }

      const cleanDuration = Math.round(durationSeconds);

      if (cleanDuration < 1) {
        Alert.alert('Voice message too short', 'Record for at least one second before sending.');

        return false;
      }

      if (cleanDuration > MAX_VOICE_DURATION_SECONDS) {
        Alert.alert('Voice message too long', 'Voice messages cannot be longer than 5 minutes.');

        return false;
      }

      voiceUploadRef.current = true;
      setIsUploadingVoice(true);

      try {
        let fileResponse: Response;

        try {
          fileResponse = await fetch(uri);
        } catch {
          throw new Error('The recorded audio file could not be read.');
        }

        if (!fileResponse.ok) {
          throw new Error('The recorded audio file could not be read.');
        }

        const fileBlob = await fileResponse.blob();

        const sizeBytes = fileBlob.size || providedSizeBytes || 0;

        if (sizeBytes <= 0) {
          throw new Error('The recorded audio file is empty.');
        }

        if (sizeBytes > MAX_AUDIO_SIZE_BYTES) {
          throw new Error('Voice messages cannot be larger than 20 MB.');
        }

        const resolvedFileName = getVoiceFileName(fileName);

        const resolvedMimeType = getVoiceMimeType(mimeType || fileBlob.type, resolvedFileName);

        let uploadUrl: string;

        try {
          uploadUrl = await generateUploadUrlMutation({
            groupId: convexGroupId,
          });
        } catch {
          throw new Error(
            'The voice upload could not be started. Check your connection and try again.'
          );
        }

        let uploadResponse: Response;

        try {
          uploadResponse = await fetch(uploadUrl, {
            method: 'POST',

            headers: {
              'Content-Type': resolvedMimeType,
            },

            body: fileBlob,
          });
        } catch {
          throw new Error('Network error while uploading the voice message.');
        }

        if (!uploadResponse.ok) {
          throw new Error('The voice message could not be uploaded.');
        }

        const uploadResult = (await uploadResponse.json()) as {
          storageId?: string;
        };

        if (!uploadResult.storageId) {
          throw new Error('The voice upload did not return a storage ID.');
        }

        try {
          await sendVoiceMessageMutation({
            groupId: convexGroupId,

            storageId: uploadResult.storageId as Id<'_storage'>,

            mimeType: resolvedMimeType,

            sizeBytes,
            durationSeconds: cleanDuration,

            fileName: resolvedFileName,

            clientMessageId: createClientMessageId(),

            ...(replyToMessageId
              ? {
                  replyToMessageId: replyToMessageId as Id<'chatMessages'>,
                }
              : {}),
          });
        } catch (error) {
          throw error instanceof Error
            ? error
            : new Error('The uploaded voice message could not be saved.');
        }

        return true;
      } catch (error) {
        showChatError(error);
        return false;
      } finally {
        voiceUploadRef.current = false;

        setIsUploadingVoice(false);
      }
    },
    [convexGroupId, generateUploadUrlMutation, sendVoiceMessageMutation]
  );

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

        const resolvedMimeType = getAttachmentMimeType(
          type,
          attachment.mimeType || fileBlob.type,
          fileName
        );

        const uploadUrl = await generateUploadUrlMutation({
          groupId: convexGroupId,
        });

        const uploadResponse = await fetch(uploadUrl, {
          method: 'POST',

          headers: {
            'Content-Type': resolvedMimeType,
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

        await sendAttachmentMutation({
          groupId: convexGroupId,

          storageId: uploadResult.storageId as Id<'_storage'>,

          type,
          mimeType: resolvedMimeType,
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
    isUploadingVoice,

    loadEarlier,

    typingUsers: [] as ChatTypingUser[],

    sendTextMessage,
    sendVoiceMessage,
    sendAttachment,
    reactToMessage,
    markMessageRead,
  };
};
