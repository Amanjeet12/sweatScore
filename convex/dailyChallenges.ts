import { v } from 'convex/values';

import { query } from './_generated/server';

/**
 * Get the daily challenge for a specific date
 * @param date - ISO date string (e.g., "2025-01-15")
 * @returns The challenge for that day of the month, or null if not found
 */
export const getChallengeByDate = query({
  args: {
    date: v.string(),
  },
  handler: async (ctx, { date }) => {
    // Parse the date and extract the day of the month (1-31)
    const parsedDate = new Date(date);
    const dayOfMonth = parsedDate.getDate();

    // Query the dailyChallengesList table for this day
    const challenge = await ctx.db
      .query('dailyChallengesList')
      .filter((q) => q.eq(q.field('day'), dayOfMonth))
      .first();

    return challenge;
  },
});

/**
 * Get today's challenge (convenience query)
 * @returns The challenge for today's day of the month, or null if not found
 */
export const getTodaysChallenge = query({
  args: {},
  handler: async (ctx) => {
    const today = new Date();
    const dayOfMonth = today.getDate();

    const challenge = await ctx.db
      .query('dailyChallengesList')
      .filter((q) => q.eq(q.field('day'), dayOfMonth))
      .first();

    return challenge;
  },
});

/**
 * Get all challenges (for admin/display purposes)
 * @returns All 31 daily challenges
 */
export const getAllChallenges = query({
  args: {},
  handler: async (ctx) => {
    const challenges = await ctx.db.query('dailyChallengesList').collect();

    // Sort by day number
    return challenges.sort((a, b) => a.day - b.day);
  },
});
