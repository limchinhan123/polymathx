import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  debates: defineTable({
    deviceId: v.string(),
    topic: v.string(),
    messages: v.array(
      v.object({
        id: v.string(),
        model: v.string(),
        personaTag: v.string(),
        content: v.string(),
        round: v.number(),
        timestamp: v.string(),
        isModerator: v.boolean(),
      })
    ),
    settings: v.object({
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
    }),
    rounds: v.number(),
    summary: v.optional(v.string()),
    createdAt: v.string(),
  }).index("by_device", ["deviceId"]),
});
