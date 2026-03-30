import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const messageValidator = v.object({
  id: v.string(),
  model: v.string(),
  personaTag: v.string(),
  content: v.string(),
  round: v.number(),
  timestamp: v.string(),
  isModerator: v.boolean(),
});

const settingsValidator = v.object({
  claudeModel: v.string(),
  gptModel: v.string(),
  geminiModel: v.string(),
  moderator: v.string(),
  summarizer: v.string(),
  temperature: v.number(),
  debateStyle: v.string(),
  personas: v.object({
    claude: v.string(),
    gpt: v.string(),
    gemini: v.string(),
  }),
  blackHatMode: v.optional(v.boolean()),
});

export const getDebates = query({
  args: { deviceId: v.string() },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("debates")
      .withIndex("by_device", (q) => q.eq("deviceId", args.deviceId))
      .collect();
    return rows.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
  },
});

export const saveDebate = mutation({
  args: {
    deviceId: v.string(),
    topic: v.string(),
    messages: v.array(messageValidator),
    settings: settingsValidator,
    rounds: v.number(),
    summary: v.optional(v.string()),
    createdAt: v.string(),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("debates", {
      deviceId: args.deviceId,
      topic: args.topic,
      messages: args.messages,
      settings: args.settings,
      rounds: args.rounds,
      summary: args.summary,
      createdAt: args.createdAt,
      ...(args.status !== undefined ? { status: args.status } : {}),
    });
  },
});

export const updateDebate = mutation({
  args: {
    id: v.id("debates"),
    messages: v.optional(v.array(messageValidator)),
    summary: v.optional(v.string()),
    rounds: v.optional(v.number()),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const filtered = Object.fromEntries(
      Object.entries(updates).filter(([, val]) => val !== undefined)
    ) as Record<string, unknown>;
    if (Object.keys(filtered).length > 0) {
      await ctx.db.patch(id, filtered);
    }
  },
});

export const deleteDebate = mutation({
  args: { id: v.id("debates") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});
