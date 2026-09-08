// lib/ai/ai-config.js
/**
 * Centralized AI Model Configuration for GabbarInfo AI
 * 
 * Standardizes model declarations across all services.
 * To change or upgrade a model in production, update the environment variable
 * or default value here rather than hunting through individual API routes.
 */

export const AI_MODELS = {
  // Primary reasoning and general chat model
  TEXT_PRIMARY: process.env.AI_TEXT_MODEL || process.env.GEMINI_MODEL || "gemini-1.5-flash",

  // High-depth SEO Pillar Blog Writer (1500-2500+ words)
  BLOG_WRITER: process.env.AI_BLOG_MODEL || "gpt-4o",

  // High-speed structured planner & keyword generator
  PLANNER_FAST: process.env.AI_PLANNER_MODEL || "gpt-4o-mini",

  // Primary bespoke visual & creative poster generator
  IMAGE_PRIMARY: process.env.OPENAI_IMAGE_MODEL || "dall-e-3",

  // Graceful fallback image model if primary is temporarily unavailable
  IMAGE_FALLBACK: "dall-e-2",

  // Semantic embeddings for RAG & memory search
  EMBEDDING: "models/text-embedding-004",
};

export const AI_COSTS_ESTIMATE = {
  GEMINI_FLASH_INPUT_PER_M: 0.075,
  GEMINI_FLASH_OUTPUT_PER_M: 0.30,
  GPT_4O_INPUT_PER_M: 2.50,
  GPT_4O_OUTPUT_PER_M: 10.00,
  GPT_4O_MINI_INPUT_PER_M: 0.15,
  GPT_4O_MINI_OUTPUT_PER_M: 0.60,
  IMAGE_SQUARE_STANDARD: 0.040,   // 1024x1024
  IMAGE_WIDESCREEN_HERO: 0.080,   // 1792x1024
};
