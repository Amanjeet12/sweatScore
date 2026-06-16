'use node';

import MailerLite from '@mailerlite/mailerlite-nodejs';
import { v } from 'convex/values';

import { internalAction } from './_generated/server';

export enum MailerLiteGroup {
  WELCOME = '158733174495511600',
  REACHED_100_POINTS = '158733204784678641',
  REACHED_250_POINTS = '158733236108788770',
  REACHED_500_POINTS = '158733243276854453',
  NO_ACTIVITY = '172135301915870752',
}

export const getGroups = internalAction({
  args: {},
  handler: async (ctx, args) => {
    const mailerlite = new MailerLite({
      api_key: process.env.MAILERLITE_API_KEY!,
    });

    const params = {
      limit: 25,
      page: 1,
      sort: '-name' as const,
    };

    const groups = await mailerlite.groups.get(params);

    console.log(
      'groups',
      groups.data.data.map((group) => {
        return {
          id: group.id,
          name: group.name,
        };
      })
    );
  },
});

export const addUserToGroup = internalAction({
  args: {
    email: v.string(),
    userId: v.id('users'),
    name: v.string(),
    groupId: v.string(),
  },
  handler: async (ctx, args) => {
    const mailerlite = new MailerLite({
      api_key: process.env.MAILERLITE_API_KEY!,
    });

    const firstName = args.name.split(' ')[0];

    const params = {
      email: args.email,
      fields: {
        name: args.name,
        first_name: firstName,
        user_id: args.userId.toString(),
      },
      groups: [args.groupId],
      status: 'active' as const, // possible statuses: active, unsubscribed, unconfirmed, bounced or junk.
    };

    await mailerlite.subscribers.createOrUpdate(params);
  },
});
