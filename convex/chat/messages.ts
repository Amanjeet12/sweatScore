import { ConvexError, v } from 'convex/values';
import type { Doc, Id } from '../_generated/dataModel';
import { mutation, query } from '../_generated/server';
import { requireCurrentUser, requireGroupMember, getGroupMembership } from './helpers';
import { anyApi, paginationOptsValidator } from 'convex/server';
import type { MutationCtx } from '../_generated/server';

const MAX_MESSAGE_LENGTH = 2000;

const MAX_CLIENT_MESSAGE_ID_LENGTH = 100;

const MAX_IMAGE_SIZE_BYTES = 20 * 1024 * 1024;

const MAX_VIDEO_SIZE_BYTES = 100 * 1024 * 1024;

const MAX_AUDIO_SIZE_BYTES = 20 * 1024 * 1024;

const MAX_VOICE_DURATION_SECONDS = 300;

const MAX_ATTACHMENT_NAME_LENGTH = 180;
const CHAT_PUSH_DELAY_MS = 1500;
const chatNotificationsApi = anyApi['chat/notifications'];

const ALLOWED_REACTIONS = ['🔥', '❤️', '💪', '😂', '👏'];

const AVATAR_COLORS = ['#D97706', '#9F1239', '#047857', '#7C3AED', '#2563EB', '#C2410C'];

function getAvatarColor(userId: string) {
  let hash = 0;

  for (let index = 0; index < userId.length; index += 1) {
    hash = (hash * 31 + userId.charCodeAt(index)) >>> 0;
  }

  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function getSenderName(user: Doc<'users'> | null) {
  const name = user?.name?.trim();

  if (name) {
    return name;
  }

  if (user?.email) {
    return user.email.split('@')[0];
  }

  return 'Member';
}

function getReplyText(message: Doc<'chatMessages'>) {
  if (message.deletedAt) {
    return 'Message deleted';
  }

  if (message.text?.trim()) {
    return message.text.trim();
  }

  switch (message.type) {
    case 'image':
      return 'Photo';

    case 'video':
      return 'Video';

    case 'voice':
      return 'Voice note';

    case 'file':
      return message.attachment?.fileName || 'File';

    case 'link':
      return message.linkPreview?.title || 'Link';

    default:
      return 'Message';
  }
}

async function requirePinManager(ctx: MutationCtx, groupId: Id<'chatGroups'>) {
  const currentUser = await requireCurrentUser(ctx);

  const membership = await requireGroupMember(ctx, groupId, currentUser._id);

  const group = await ctx.db.get(groupId);

  if (!group || !group.isActive) {
    throw new ConvexError('Group not found');
  }

  const canPinMessages =
    currentUser.isAdmin === true || membership.role === 'owner' || membership.role === 'admin';

  if (!canPinMessages) {
    throw new ConvexError('Only group admins can pin messages');
  }

  return {
    currentUser,
    membership,
    group,
  };
}

export const listMessages = query({
  args: {
    groupId: v.id('chatGroups'),
    paginationOpts: paginationOptsValidator,
  },

  handler: async (ctx, args) => {
    const currentUser = await requireCurrentUser(ctx);

    const group = await ctx.db.get(args.groupId);

    if (!group || !group.isActive) {
      throw new ConvexError('Group not found');
    }

    const result = await ctx.db
      .query('chatMessages')
      .withIndex('by_group', (q) => q.eq('groupId', args.groupId))
      .order('desc')
      .paginate(args.paginationOpts);

    const messages = await Promise.all(
      result.page.map(async (message) => {
        const sender = await ctx.db.get(message.senderId);

        const senderName = getSenderName(sender);

        let replyTo: {
          messageId: typeof message._id;
          senderName: string;
          text: string;
        } | null = null;

        if (message.replyToMessageId) {
          const repliedMessage = await ctx.db.get(message.replyToMessageId);

          if (repliedMessage && repliedMessage.groupId === args.groupId) {
            const repliedSender = await ctx.db.get(repliedMessage.senderId);

            replyTo = {
              messageId: repliedMessage._id,

              senderName: getSenderName(repliedSender),

              text: getReplyText(repliedMessage),
            };
          }
        }

        let attachment: {
          id: string;
          type: 'image' | 'video' | 'file';
          uri: string;
          name: string | null;
          mimeType: string;
          sizeBytes: number;
          thumbnailUri: string | null;
        } | null = null;

        let voiceUri: string | null = null;

        let voiceDuration: number | null = null;

        if (message.attachment && !message.deletedAt) {
          const fileUrl = await ctx.storage.getUrl(message.attachment.storageId);

          const thumbnailUrl = message.attachment.thumbnailStorageId
            ? await ctx.storage.getUrl(message.attachment.thumbnailStorageId)
            : null;

          if (message.type === 'voice') {
            voiceUri = fileUrl;

            voiceDuration = message.attachment.durationSeconds ?? 0;
          } else if (
            fileUrl &&
            (message.type === 'image' || message.type === 'video' || message.type === 'file')
          ) {
            attachment = {
              id: String(message.attachment.storageId),

              type: message.type,

              uri: fileUrl,

              name: message.attachment.fileName ?? null,

              mimeType: message.attachment.mimeType,

              sizeBytes: message.attachment.sizeBytes,

              thumbnailUri: thumbnailUrl,
            };
          }
        }

        const reactionDocuments = message.deletedAt
          ? []
          : await ctx.db
              .query('chatReactions')
              .withIndex('by_message', (q) => q.eq('messageId', message._id))
              .collect();

        const groupedReactions = new Map<
          string,
          {
            emoji: string;
            count: number;
            reactedByMe: boolean;
          }
        >();

        for (const reaction of reactionDocuments) {
          const existing = groupedReactions.get(reaction.emoji);

          if (existing) {
            existing.count += 1;

            if (String(reaction.userId) === String(currentUser._id)) {
              existing.reactedByMe = true;
            }
          } else {
            groupedReactions.set(reaction.emoji, {
              emoji: reaction.emoji,

              count: 1,

              reactedByMe: String(reaction.userId) === String(currentUser._id),
            });
          }
        }

        const isMine = String(message.senderId) === String(currentUser._id);

        return {
          _id: message._id,
          groupId: message.groupId,
          senderId: message.senderId,

          senderName,
          senderInitial: senderName.charAt(0).toUpperCase() || '?',

          senderColor: isMine ? '#F76B1C' : getAvatarColor(String(message.senderId)),

          type: message.deletedAt ? ('text' as const) : message.type,

          text: message.deletedAt ? 'Message deleted' : (message.text ?? null),

          createdAt: message._creationTime,

          isMine,

          isPinned:
            Boolean(group.pinnedMessageId) && String(group.pinnedMessageId) === String(message._id),

          deliveryStatus: isMine ? ('sent' as const) : null,

          isDeleted: Boolean(message.deletedAt),

          attachment,
          voiceUri,
          voiceDuration,
          linkTitle: !message.deletedAt ? (message.linkPreview?.title ?? null) : null,

          linkUrl: !message.deletedAt ? (message.linkPreview?.url ?? null) : null,

          replyTo,
          reactions: Array.from(groupedReactions.values()),
        };
      })
    );

    return {
      ...result,
      page: messages,
    };
  },
});

export const sendMessage = mutation({
  args: {
    groupId: v.id('chatGroups'),
    text: v.string(),
    clientMessageId: v.string(),

    replyToMessageId: v.optional(v.id('chatMessages')),
  },

  handler: async (ctx, args) => {
    const currentUser = await requireCurrentUser(ctx);

    await requireGroupMember(ctx, args.groupId, currentUser._id);

    const group = await ctx.db.get(args.groupId);

    if (!group || !group.isActive) {
      throw new ConvexError('Group not found');
    }

    const text = args.text.trim();

    if (!text) {
      throw new ConvexError('Message cannot be empty');
    }

    if (text.length > MAX_MESSAGE_LENGTH) {
      throw new ConvexError(`Message cannot exceed ${MAX_MESSAGE_LENGTH} characters`);
    }

    const clientMessageId = args.clientMessageId.trim();

    if (!clientMessageId || clientMessageId.length > MAX_CLIENT_MESSAGE_ID_LENGTH) {
      throw new ConvexError('Invalid client message ID');
    }

    const duplicateMessage = await ctx.db
      .query('chatMessages')
      .withIndex('by_sender_client', (q) =>
        q.eq('senderId', currentUser._id).eq('clientMessageId', clientMessageId)
      )
      .first();

    if (duplicateMessage) {
      if (String(duplicateMessage.groupId) !== String(args.groupId)) {
        throw new ConvexError('Client message ID was already used');
      }

      return duplicateMessage._id;
    }

    if (args.replyToMessageId) {
      const repliedMessage = await ctx.db.get(args.replyToMessageId);

      if (!repliedMessage || repliedMessage.groupId !== args.groupId) {
        throw new ConvexError('The replied message does not belong to this group');
      }
    }

    const messageId = await ctx.db.insert('chatMessages', {
      groupId: args.groupId,

      senderId: currentUser._id,

      clientMessageId,
      type: 'text',
      text,

      mentionedUserIds: [],

      ...(args.replyToMessageId
        ? {
            replyToMessageId: args.replyToMessageId,
          }
        : {}),
    });

    await ctx.db.patch(args.groupId, {
      lastMessageId: messageId,
      lastMessageAt: Date.now(),
    });

    await ctx.scheduler.runAfter(CHAT_PUSH_DELAY_MS, chatNotificationsApi.queueChatMessagePush, {
      groupId: args.groupId,
      messageId,
      senderId: currentUser._id,
    });

    return messageId;
  },
});

export const toggleReaction = mutation({
  args: {
    messageId: v.id('chatMessages'),
    emoji: v.string(),
  },

  handler: async (ctx, args) => {
    const currentUser = await requireCurrentUser(ctx);

    if (!ALLOWED_REACTIONS.includes(args.emoji)) {
      throw new ConvexError('Unsupported reaction');
    }

    const message = await ctx.db.get(args.messageId);

    if (!message || message.deletedAt) {
      throw new ConvexError('Message not found');
    }

    await requireGroupMember(ctx, message.groupId, currentUser._id);

    const group = await ctx.db.get(message.groupId);

    if (!group || !group.isActive) {
      throw new ConvexError('Group not found');
    }

    const existingReaction = await ctx.db
      .query('chatReactions')
      .withIndex('by_message_user_emoji', (q) =>
        q.eq('messageId', args.messageId).eq('userId', currentUser._id).eq('emoji', args.emoji)
      )
      .first();

    if (existingReaction) {
      await ctx.db.delete(existingReaction._id);

      return {
        active: false,
      };
    }

    await ctx.db.insert('chatReactions', {
      messageId: args.messageId,

      userId: currentUser._id,

      emoji: args.emoji,
    });

    return {
      active: true,
    };
  },
});

export const markGroupRead = mutation({
  args: {
    groupId: v.id('chatGroups'),
  },

  handler: async (ctx, args) => {
    const currentUser = await requireCurrentUser(ctx);

    await requireGroupMember(ctx, args.groupId, currentUser._id);

    const membership = await ctx.db
      .query('chatMembers')
      .withIndex('by_group_user', (q) =>
        q.eq('groupId', args.groupId).eq('userId', currentUser._id)
      )
      .unique();

    if (!membership || membership.status !== 'active') {
      throw new ConvexError('Active membership required');
    }

    await ctx.db.patch(membership._id, {
      lastReadAt: Date.now(),
    });

    return true;
  },
});

export const generateUploadUrl = mutation({
  args: {
    groupId: v.id('chatGroups'),
  },

  handler: async (ctx, args) => {
    const currentUser = await requireCurrentUser(ctx);

    await requireGroupMember(ctx, args.groupId, currentUser._id);

    const group = await ctx.db.get(args.groupId);

    if (!group || !group.isActive) {
      throw new ConvexError('Group not found');
    }

    return ctx.storage.generateUploadUrl();
  },
});

export const sendAttachment = mutation({
  args: {
    groupId: v.id('chatGroups'),

    storageId: v.id('_storage'),

    type: v.union(v.literal('image'), v.literal('video')),

    text: v.optional(v.string()),

    mimeType: v.string(),
    sizeBytes: v.number(),

    fileName: v.optional(v.string()),

    clientMessageId: v.string(),

    replyToMessageId: v.optional(v.id('chatMessages')),
  },

  handler: async (ctx, args) => {
    const currentUser = await requireCurrentUser(ctx);

    await requireGroupMember(ctx, args.groupId, currentUser._id);

    const group = await ctx.db.get(args.groupId);

    if (!group || !group.isActive) {
      throw new ConvexError('Group not found');
    }

    const clientMessageId = args.clientMessageId.trim();

    if (!clientMessageId || clientMessageId.length > MAX_CLIENT_MESSAGE_ID_LENGTH) {
      throw new ConvexError('Invalid client message ID');
    }

    const duplicateMessage = await ctx.db
      .query('chatMessages')
      .withIndex('by_sender_client', (q) =>
        q.eq('senderId', currentUser._id).eq('clientMessageId', clientMessageId)
      )
      .first();

    if (duplicateMessage) {
      if (String(duplicateMessage.groupId) !== String(args.groupId)) {
        throw new ConvexError('Client message ID was already used');
      }

      return duplicateMessage._id;
    }

    const cleanText = args.text?.trim() ?? '';

    if (cleanText.length > MAX_MESSAGE_LENGTH) {
      throw new ConvexError(`Message cannot exceed ${MAX_MESSAGE_LENGTH} characters`);
    }

    const metadata = await ctx.db.system.get('_storage', args.storageId);

    if (!metadata) {
      throw new ConvexError('Uploaded file not found');
    }

    const mimeType = (metadata.contentType || args.mimeType).trim().toLowerCase();

    if (args.type === 'image' && !mimeType.startsWith('image/')) {
      throw new ConvexError('The uploaded file is not an image');
    }

    if (args.type === 'video' && !mimeType.startsWith('video/')) {
      throw new ConvexError('The uploaded file is not a video');
    }

    const maximumSize = args.type === 'image' ? MAX_IMAGE_SIZE_BYTES : MAX_VIDEO_SIZE_BYTES;

    if (metadata.size > maximumSize) {
      throw new ConvexError(
        args.type === 'image'
          ? 'Image cannot be larger than 20 MB'
          : 'Video cannot be larger than 100 MB'
      );
    }

    const fileName = args.fileName?.trim().slice(0, MAX_ATTACHMENT_NAME_LENGTH);

    if (args.replyToMessageId) {
      const repliedMessage = await ctx.db.get(args.replyToMessageId);

      if (!repliedMessage || String(repliedMessage.groupId) !== String(args.groupId)) {
        throw new ConvexError('The replied message does not belong to this group');
      }
    }

    const messageId = await ctx.db.insert('chatMessages', {
      groupId: args.groupId,

      senderId: currentUser._id,

      clientMessageId,
      type: args.type,

      mentionedUserIds: [],

      ...(cleanText
        ? {
            text: cleanText,
          }
        : {}),

      attachment: {
        storageId: args.storageId,

        mimeType,

        sizeBytes: metadata.size,

        ...(fileName
          ? {
              fileName,
            }
          : {}),
      },

      ...(args.replyToMessageId
        ? {
            replyToMessageId: args.replyToMessageId,
          }
        : {}),
    });

    await ctx.db.patch(args.groupId, {
      lastMessageId: messageId,

      lastMessageAt: Date.now(),
    });

    await ctx.scheduler.runAfter(CHAT_PUSH_DELAY_MS, chatNotificationsApi.queueChatMessagePush, {
      groupId: args.groupId,
      messageId,
      senderId: currentUser._id,
    });

    return messageId;
  },
});

export const sendVoiceMessage = mutation({
  args: {
    groupId: v.id('chatGroups'),

    storageId: v.id('_storage'),

    mimeType: v.string(),
    sizeBytes: v.number(),
    durationSeconds: v.number(),

    fileName: v.optional(v.string()),

    clientMessageId: v.string(),

    replyToMessageId: v.optional(v.id('chatMessages')),
  },

  handler: async (ctx, args) => {
    const currentUser = await requireCurrentUser(ctx);

    await requireGroupMember(ctx, args.groupId, currentUser._id);

    const group = await ctx.db.get(args.groupId);

    if (!group || !group.isActive) {
      throw new ConvexError('Group not found');
    }

    const clientMessageId = args.clientMessageId.trim();

    if (!clientMessageId || clientMessageId.length > MAX_CLIENT_MESSAGE_ID_LENGTH) {
      throw new ConvexError('Invalid client message ID');
    }

    const duplicateMessage = await ctx.db
      .query('chatMessages')
      .withIndex('by_sender_client', (q) =>
        q.eq('senderId', currentUser._id).eq('clientMessageId', clientMessageId)
      )
      .first();

    if (duplicateMessage) {
      if (String(duplicateMessage.groupId) !== String(args.groupId)) {
        throw new ConvexError('Client message ID was already used');
      }

      return duplicateMessage._id;
    }

    const durationSeconds = Math.round(args.durationSeconds);

    if (!Number.isFinite(durationSeconds) || durationSeconds < 1) {
      throw new ConvexError('Voice message duration is invalid');
    }

    if (durationSeconds > MAX_VOICE_DURATION_SECONDS) {
      throw new ConvexError('Voice messages cannot be longer than 5 minutes');
    }

    if (args.sizeBytes <= 0) {
      throw new ConvexError('Voice message file is empty');
    }

    const metadata = await ctx.db.system.get('_storage', args.storageId);

    if (!metadata) {
      throw new ConvexError('Uploaded voice file not found');
    }

    const mimeType = (metadata.contentType || args.mimeType).trim().toLowerCase();

    if (!mimeType.startsWith('audio/')) {
      throw new ConvexError('The uploaded file is not an audio file');
    }

    if (metadata.size <= 0) {
      throw new ConvexError('Voice message file is empty');
    }

    if (metadata.size > MAX_AUDIO_SIZE_BYTES) {
      throw new ConvexError('Voice messages cannot be larger than 20 MB');
    }

    const fileName = args.fileName?.trim().slice(0, MAX_ATTACHMENT_NAME_LENGTH);

    if (args.replyToMessageId) {
      const repliedMessage = await ctx.db.get(args.replyToMessageId);

      if (!repliedMessage || String(repliedMessage.groupId) !== String(args.groupId)) {
        throw new ConvexError('The replied message does not belong to this group');
      }
    }

    const messageId = await ctx.db.insert('chatMessages', {
      groupId: args.groupId,

      senderId: currentUser._id,

      clientMessageId,
      type: 'voice',

      mentionedUserIds: [],

      attachment: {
        storageId: args.storageId,

        mimeType,

        sizeBytes: metadata.size,

        durationSeconds,

        ...(fileName
          ? {
              fileName,
            }
          : {}),
      },

      ...(args.replyToMessageId
        ? {
            replyToMessageId: args.replyToMessageId,
          }
        : {}),
    });

    await ctx.db.patch(args.groupId, {
      lastMessageId: messageId,

      lastMessageAt: Date.now(),
    });

    await ctx.scheduler.runAfter(CHAT_PUSH_DELAY_MS, chatNotificationsApi.queueChatMessagePush, {
      groupId: args.groupId,
      messageId,
      senderId: currentUser._id,
    });

    return messageId;
  },
});

export const pinMessage = mutation({
  args: {
    groupId: v.id('chatGroups'),
    messageId: v.id('chatMessages'),
  },

  handler: async (ctx, args) => {
    const { currentUser } = await requirePinManager(ctx, args.groupId);

    const message = await ctx.db.get(args.messageId);

    if (!message || String(message.groupId) !== String(args.groupId)) {
      throw new ConvexError('Message not found in this group');
    }

    if (message.deletedAt) {
      throw new ConvexError('Deleted messages cannot be pinned');
    }

    await ctx.db.patch(args.groupId, {
      pinnedMessageId: message._id,

      pinnedBy: currentUser._id,

      pinnedAt: Date.now(),
    });

    return {
      pinned: true,
      messageId: message._id,
    };
  },
});

export const unpinMessage = mutation({
  args: {
    groupId: v.id('chatGroups'),

    messageId: v.optional(v.id('chatMessages')),
  },

  handler: async (ctx, args) => {
    const { group } = await requirePinManager(ctx, args.groupId);

    if (!group.pinnedMessageId) {
      return {
        unpinned: false,
      };
    }

    /*
     * Prevent an old message action from
     * unpinning a newly pinned message.
     */
    if (args.messageId && String(args.messageId) !== String(group.pinnedMessageId)) {
      throw new ConvexError('This message is no longer pinned');
    }

    await ctx.db.patch(args.groupId, {
      pinnedMessageId: undefined,
      pinnedBy: undefined,
      pinnedAt: undefined,
    });

    return {
      unpinned: true,
    };
  },
});

export const getPinnedMessage = query({
  args: {
    groupId: v.id('chatGroups'),
  },

  handler: async (ctx, args) => {
    const currentUser = await requireCurrentUser(ctx);

    const group = await ctx.db.get(args.groupId);

    if (!group || !group.isActive) {
      throw new ConvexError('Group not found');
    }

    const membership = await getGroupMembership(ctx, group._id, currentUser._id);

    const canPinMessages =
      currentUser.isAdmin === true ||
      (membership?.status === 'active' &&
        (membership.role === 'owner' || membership.role === 'admin'));

    if (!group.pinnedMessageId) {
      return {
        message: null,
        canPinMessages,
      };
    }

    const message = await ctx.db.get(group.pinnedMessageId);

    if (!message || message.deletedAt || String(message.groupId) !== String(group._id)) {
      return {
        message: null,
        canPinMessages,
      };
    }

    const sender = await ctx.db.get(message.senderId);

    const pinnedByUser = group.pinnedBy ? await ctx.db.get(group.pinnedBy) : null;

    return {
      canPinMessages,

      message: {
        messageId: message._id,

        senderId: message.senderId,

        senderName: getSenderName(sender),

        preview: getReplyText(message),

        type: message.type,

        pinnedAt: group.pinnedAt ?? null,

        pinnedByName: pinnedByUser ? getSenderName(pinnedByUser) : 'Admin',
      },
    };
  },
});

export const deleteOwnMessage = mutation({
  args: {
    messageId: v.id('chatMessages'),
  },

  handler: async (ctx, args) => {
    const currentUser = await requireCurrentUser(ctx);

    const message = await ctx.db.get(args.messageId);

    if (!message) {
      throw new ConvexError('Message not found');
    }

    await requireGroupMember(ctx, message.groupId, currentUser._id);

    if (String(message.senderId) !== String(currentUser._id)) {
      throw new ConvexError('You can only delete your own messages');
    }

    if (message.deletedAt) {
      return {
        deleted: false,
        alreadyDeleted: true,
      };
    }

    const group = await ctx.db.get(message.groupId);

    if (!group || !group.isActive) {
      throw new ConvexError('Group not found');
    }

    /*
     * Soft delete the message.
     * The original database record remains,
     * but its content is hidden from users.
     */
    await ctx.db.patch(message._id, {
      deletedAt: Date.now(),

      /*
       * Remove private content from
       * the message record.
       */
      text: undefined,
      linkPreview: undefined,
      mentions: undefined,
      mentionedUserIds: [],
    });

    /*
     * Remove all reactions from the
     * deleted message.
     */
    const reactions = await ctx.db
      .query('chatReactions')
      .withIndex('by_message', (q) => q.eq('messageId', message._id))
      .collect();

    for (const reaction of reactions) {
      await ctx.db.delete(reaction._id);
    }

    const wasLastMessage = String(group.lastMessageId) === String(message._id);

    const wasPinned = String(group.pinnedMessageId) === String(message._id);

    const groupPatch: {
      lastMessageId?: Id<'chatMessages'>;

      lastMessageAt?: number;

      pinnedMessageId?: Id<'chatMessages'>;

      pinnedBy?: Id<'users'>;

      pinnedAt?: number;
    } = {};

    /*
     * Find the previous visible message
     * when the deleted message was the
     * group's latest message.
     */
    if (wasLastMessage) {
      const latestVisibleMessage = await ctx.db
        .query('chatMessages')
        .withIndex('by_group', (q) => q.eq('groupId', message.groupId))
        .filter((q) => q.eq(q.field('deletedAt'), undefined))
        .order('desc')
        .first();

      groupPatch.lastMessageId = latestVisibleMessage?._id;

      groupPatch.lastMessageAt = latestVisibleMessage?._creationTime;
    }

    /*
     * Automatically unpin the message
     * when the deleted message was pinned.
     */
    if (wasPinned) {
      groupPatch.pinnedMessageId = undefined;

      groupPatch.pinnedBy = undefined;

      groupPatch.pinnedAt = undefined;
    }

    if (wasLastMessage || wasPinned) {
      await ctx.db.patch(group._id, groupPatch);
    }

    return {
      deleted: true,
      alreadyDeleted: false,
    };
  },
});
