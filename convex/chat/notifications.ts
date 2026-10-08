import { v } from 'convex/values';

import { internalAction, internalMutation } from '../_generated/server';

// Retained signatures let jobs queued before the client-only cutover drain safely.
// Chat pushes are not part of the approved client notification list.
export const queueChatMessagePush = internalMutation({
  args: { groupId: v.id('chatGroups'), messageId: v.id('chatMessages'), senderId: v.id('users') },
  handler: async () => ({ queued: 0 }),
});
export const queueChatReactionPush = internalMutation({
  args: {
    groupId: v.id('chatGroups'),
    messageId: v.id('chatMessages'),
    reactorId: v.id('users'),
    emoji: v.string(),
  },
  handler: async () => ({ queued: 0 }),
});
export const sendChatMessagePush = internalAction({
  args: {
    recipientIds: v.array(v.id('users')),
    groupId: v.id('chatGroups'),
    messageId: v.id('chatMessages'),
    senderId: v.id('users'),
    title: v.string(),
    body: v.string(),
    eventType: v.optional(
      v.union(
        v.literal('newMessage'),
        v.literal('mention'),
        v.literal('reply'),
        v.literal('allMention'),
        v.literal('reaction')
      )
    ),
  },
  handler: async () => ({ sent: 0 }),
});
