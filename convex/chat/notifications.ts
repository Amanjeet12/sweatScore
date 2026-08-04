import { PushNotifications } from '@convex-dev/expo-push-notifications';
import { anyApi } from 'convex/server';
import { v } from 'convex/values';

import { components } from '../_generated/api';
import type { Doc, Id } from '../_generated/dataModel';
import { internalAction, internalMutation } from '../_generated/server';

const MAX_NOTIFICATION_PREVIEW_LENGTH = 120;

const MAX_NOTIFICATION_BODY_LENGTH = 180;

const MAX_NOTIFICATION_TITLE_LENGTH = 60;

const PUSH_RECIPIENT_BATCH_SIZE = 50;

const PUSH_SEND_CONCURRENCY = 20;

const chatNotificationsApi = anyApi['chat/notifications'];

const chatEventValidator = v.union(
  v.literal('newMessage'),
  v.literal('mention'),
  v.literal('reply'),
  v.literal('allMention'),
  v.literal('reaction')
);

type ChatNotificationEvent = 'newMessage' | 'mention' | 'reply' | 'allMention' | 'reaction';

function sanitizeNotificationText(value: unknown, fallback: string, maximumLength: number) {
  if (typeof value !== 'string') {
    return fallback;
  }

  let sanitized = '';

  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);

    /*
     * Preserve valid UTF-16 surrogate pairs.
     */
    if (code >= 0xd800 && code <= 0xdbff) {
      const nextCode = value.charCodeAt(index + 1);

      if (nextCode >= 0xdc00 && nextCode <= 0xdfff) {
        sanitized += value[index] + value[index + 1];

        index += 1;
      } else {
        sanitized += '\uFFFD';
      }

      continue;
    }

    /*
     * Replace an unpaired low surrogate.
     */
    if (code >= 0xdc00 && code <= 0xdfff) {
      sanitized += '\uFFFD';
      continue;
    }

    /*
     * Remove unsupported control characters.
     */
    if (
      (code >= 0x00 && code <= 0x08) ||
      code === 0x0b ||
      code === 0x0c ||
      (code >= 0x0e && code <= 0x1f) ||
      code === 0x7f
    ) {
      sanitized += ' ';
      continue;
    }

    sanitized += value[index];
  }

  const normalized = sanitized.normalize('NFC').replace(/\s+/g, ' ').trim().slice(0, maximumLength);

  return normalized || fallback;
}

function getSenderName(user: Doc<'users'> | null) {
  const name = sanitizeNotificationText(user?.name, '', 60);

  if (name) {
    return name;
  }

  const email = sanitizeNotificationText(user?.email, '', 320);

  if (email) {
    return email.split('@')[0] || 'Someone';
  }

  return 'Someone';
}

function getMessagePreview(message: Doc<'chatMessages'>) {
  const text = sanitizeNotificationText(message.text, '', MAX_NOTIFICATION_PREVIEW_LENGTH);

  switch (message.type) {
    case 'image':
      return text ? `📷 ${text}` : '📷 Photo';

    case 'video':
      return text ? `🎥 ${text}` : '🎥 Video';

    case 'voice':
      return '🎤 Voice message';

    case 'file':
      return text ? `📎 ${text}` : '📎 File';

    case 'link':
      return text ? `🔗 ${text}` : '🔗 Link';

    case 'text':
    default:
      return text || 'New message';
  }
}

/**
 * Runs shortly after a message is created.
 *
 * It checks membership, mute state, global notification
 * settings, and whether the recipient has already received
 * the message inside the active chat screen.
 */
export const queueChatMessagePush = internalMutation({
  args: {
    groupId: v.id('chatGroups'),

    messageId: v.id('chatMessages'),

    senderId: v.id('users'),
  },

  handler: async (ctx, args) => {
    const [group, message, sender] = await Promise.all([
      ctx.db.get(args.groupId),
      ctx.db.get(args.messageId),
      ctx.db.get(args.senderId),
    ]);

    if (!group || !group.isActive || !message || message.deletedAt) {
      return {
        queued: 0,
      };
    }

    /*
     * Prevent invalid or mismatched scheduling.
     */
    if (
      String(message.groupId) !== String(args.groupId) ||
      String(message.senderId) !== String(args.senderId)
    ) {
      return {
        queued: 0,
      };
    }

    const memberships = await ctx.db
      .query('chatMembers')
      .withIndex('by_group_status', (queryBuilder) =>
        queryBuilder.eq('groupId', args.groupId).eq('status', 'active')
      )
      .collect();

    const mentionedUserIds = new Set(message.mentionedUserIds.map(String));

    const hasAllMention = /(^|\s)@all\b/i.test(message.text ?? '');

    const repliedMessage = message.replyToMessageId
      ? await ctx.db.get(message.replyToMessageId)
      : null;

    const replyRecipientId =
      repliedMessage && String(repliedMessage.groupId) === String(args.groupId)
        ? String(repliedMessage.senderId)
        : null;

    const recipients: { userId: Id<'users'>; eventType: ChatNotificationEvent }[] = [];

    for (const membership of memberships) {
      /*
       * Never notify the sender.
       */
      if (String(membership.userId) === String(args.senderId)) {
        continue;
      }

      /*
       * Respect per-group mute state.
       */
      if (membership.notificationsMuted) {
        continue;
      }

      /*
       * If the chat screen already marked this
       * message delivered/read, the recipient is
       * likely viewing the group. Do not show a
       * redundant push notification.
       */
      const hasAlreadyReceivedMessage =
        Math.max(
          membership.lastDeliveredAt ?? 0,

          membership.lastReadAt ?? 0
        ) >= message._creationTime;

      if (hasAlreadyReceivedMessage) {
        continue;
      }

      const user = await ctx.db.get(membership.userId);

      if (!user) {
        continue;
      }

      /*
       * Respect the app-wide notification switch.
       */
      if (user.notificationEnabled === false) {
        continue;
      }

      /*
       * The existing app records this token in both
       * the users table and the Convex push component.
       */
      if (!user.expoPushToken) {
        continue;
      }

      const userId = String(user._id);

      const eventType: ChatNotificationEvent = hasAllMention
        ? 'allMention'
        : mentionedUserIds.has(userId)
          ? 'mention'
          : replyRecipientId === userId
            ? 'reply'
            : 'newMessage';

      recipients.push({ userId: user._id, eventType });
    }

    if (recipients.length === 0) {
      return {
        queued: 0,
      };
    }

    const groupName = sanitizeNotificationText(
      group.name,
      'Group Chat',
      MAX_NOTIFICATION_TITLE_LENGTH
    );

    const senderName = getSenderName(sender);

    const preview = getMessagePreview(message);

    const bodies: Record<Exclude<ChatNotificationEvent, 'reaction'>, string> = {
      newMessage: `${senderName}: ${preview}`,
      mention: `${senderName} mentioned you: ${preview}`,
      reply: `${senderName} replied to your message: ${preview}`,
      allMention: `${senderName} mentioned everyone: ${preview}`,
    };

    /*
     * Split large groups into separate scheduled
     * jobs so one action does not receive a very
     * large argument payload.
     */
    for (const eventType of ['newMessage', 'mention', 'reply', 'allMention'] as const) {
      const recipientIds = recipients
        .filter((recipient) => recipient.eventType === eventType)
        .map((recipient) => recipient.userId);

      for (let index = 0; index < recipientIds.length; index += PUSH_RECIPIENT_BATCH_SIZE) {
        const batch = recipientIds.slice(index, index + PUSH_RECIPIENT_BATCH_SIZE);

        await ctx.scheduler.runAfter(0, chatNotificationsApi.sendChatMessagePush, {
          recipientIds: batch,
          groupId: args.groupId,
          messageId: args.messageId,
          senderId: args.senderId,
          title: groupName,
          body: sanitizeNotificationText(
            bodies[eventType],
            'You have a new group notification',
            MAX_NOTIFICATION_BODY_LENGTH
          ),
          eventType,
        });
      }
    }

    return {
      queued: recipients.length,
    };
  },
});

export const queueChatReactionPush = internalMutation({
  args: {
    groupId: v.id('chatGroups'),
    messageId: v.id('chatMessages'),
    reactorId: v.id('users'),
    emoji: v.string(),
  },

  handler: async (ctx, args) => {
    const [group, message, reactor] = await Promise.all([
      ctx.db.get(args.groupId),
      ctx.db.get(args.messageId),
      ctx.db.get(args.reactorId),
    ]);

    if (
      !group?.isActive ||
      !message ||
      message.deletedAt ||
      !reactor ||
      String(message.groupId) !== String(args.groupId) ||
      String(message.senderId) === String(args.reactorId)
    ) {
      return { queued: 0 };
    }

    const activeReaction = await ctx.db
      .query('chatReactions')
      .withIndex('by_message_user_emoji', (queryBuilder) =>
        queryBuilder
          .eq('messageId', args.messageId)
          .eq('userId', args.reactorId)
          .eq('emoji', args.emoji)
      )
      .first();

    if (!activeReaction) {
      return { queued: 0 };
    }

    const membership = await ctx.db
      .query('chatMembers')
      .withIndex('by_group_user', (queryBuilder) =>
        queryBuilder.eq('groupId', args.groupId).eq('userId', message.senderId)
      )
      .unique();

    const recipient = await ctx.db.get(message.senderId);

    if (
      membership?.status !== 'active' ||
      membership.notificationsMuted ||
      !recipient ||
      recipient.notificationEnabled === false ||
      !recipient.expoPushToken
    ) {
      return { queued: 0 };
    }

    const groupName = sanitizeNotificationText(
      group.name,
      'Group Chat',
      MAX_NOTIFICATION_TITLE_LENGTH
    );
    const reactorName = getSenderName(reactor);
    const emoji = sanitizeNotificationText(args.emoji, '👍', 10);
    const body = sanitizeNotificationText(
      `${reactorName} reacted ${emoji} to your message`,
      'Someone reacted to your message',
      MAX_NOTIFICATION_BODY_LENGTH
    );

    await ctx.scheduler.runAfter(0, chatNotificationsApi.sendChatMessagePush, {
      recipientIds: [recipient._id],
      groupId: args.groupId,
      messageId: args.messageId,
      senderId: args.reactorId,
      title: groupName,
      body,
      eventType: 'reaction',
    });

    return { queued: 1 };
  },
});

/**
 * Sends the actual Expo notifications.
 *
 * This is an action because network operations must not
 * run inside the database mutation.
 */
export const sendChatMessagePush = internalAction({
  args: {
    recipientIds: v.array(v.id('users')),

    groupId: v.id('chatGroups'),

    messageId: v.id('chatMessages'),

    senderId: v.id('users'),

    title: v.string(),
    body: v.string(),
    eventType: v.optional(chatEventValidator),
  },

  handler: async (ctx, args) => {
    const pushNotifications = new PushNotifications(components.pushNotifications);

    let sent = 0;

    for (let index = 0; index < args.recipientIds.length; index += PUSH_SEND_CONCURRENCY) {
      const recipientBatch = args.recipientIds.slice(index, index + PUSH_SEND_CONCURRENCY);

      const results = await Promise.allSettled(
        recipientBatch.map((userId) =>
          pushNotifications.sendPushNotification(ctx as any, {
            userId,

            notification: {
              title: args.title,

              body: args.body,

              sound: 'default',

              data: {
                notificationType: 'newChatMessage',

                chatEventType: args.eventType ?? 'newMessage',

                groupId: String(args.groupId),

                messageId: String(args.messageId),

                senderId: String(args.senderId),
              },
            },
          })
        )
      );

      sent += results.filter((result) => result.status === 'fulfilled').length;

      for (const result of results) {
        if (result.status === 'rejected') {
          console.error('Chat push notification failed:', result.reason);
        }
      }
    }

    return {
      sent,
    };
  },
});
