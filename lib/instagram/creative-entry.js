import { CREATIVE_STAGES, CREATIVE_INTENT, DEFAULT_CREATIVE_STATE } from "./creative-constants";
import { loadCreativeState, saveCreativeState, clearCreativeState } from "./creative-memory";
import { resolveBusiness } from "./resolve-business";
import { resolveContext } from "./resolve-context";
import { resolveAssets } from "./resolve-assets";
import { generateCaption } from "./generate-caption";
import { generateImage } from "./generate-image";
import { composePreview } from "./compose-preview";

export async function creativeEntry({
  supabase,
  session,
  instruction,
  metaRow,
  effectiveBusinessId
}) {
  // 🔥 HIGH-PRIORITY ENTRY GUARD: Path A Sovereignty
  const hasImage = instruction.includes("Image URL:");
  const hasCaption = instruction.includes("Caption:");
  if (hasImage && hasCaption) {
    console.log("🛡️ [Creative] Path A detected. Sovereignty Guard Triggered. No-op.");
    return {};
  }

  const email = session.user.email.toLowerCase();

  // 1. Load State
  let state = await loadCreativeState(supabase, email);

  // 🔄 Reset on generic trigger
  const isGenericTrigger =
    instruction.toLowerCase().trim() === "publish an instagram post";
  if (isGenericTrigger && !hasImage && !hasCaption) {
    state = {
      ...DEFAULT_CREATIVE_STATE,
      creativeSessionId: `ig_creative_${Date.now()}`,
      content: { ...DEFAULT_CREATIVE_STATE.content }
    };
    await saveCreativeState(supabase, email, state.creativeSessionId, state);
  }

  // 2. Resolve Session ID
  let creativeSessionId = state.creativeSessionId;
  if (!creativeSessionId) {
    creativeSessionId = `ig_creative_${Date.now()}`;
    state = { ...DEFAULT_CREATIVE_STATE, creativeSessionId };
    await saveCreativeState(supabase, email, creativeSessionId, state);
  }

  // Global reset
  if (instruction.match(/\b(cancel|stop|start over|reset)\b/i)) {
    await clearCreativeState(supabase, email, creativeSessionId);
    return { response: { ok: true, text: "Creative mode canceled. How can I help?" } };
  }

  try {
    // --- BUSINESS RESOLUTION ---
    if (state.stage === CREATIVE_STAGES.BUSINESS_RESOLUTION) {
      const bizResult = await resolveBusiness(session, metaRow, state);
      if (bizResult.complete) {
        state.stage = CREATIVE_STAGES.SERVICE_CONTEXT;
      } else {
        state.stage = CREATIVE_STAGES.BUSINESS_RESOLUTION_WAITING;
        await saveCreativeState(supabase, email, creativeSessionId, state);
        return { response: { ok: true, text: bizResult.question } };
      }
    }

    if (state.stage === CREATIVE_STAGES.BUSINESS_RESOLUTION_WAITING) {
      if (instruction.match(/\b(yes|ok|sure|this one|confirm)\b/i)) {
        state.businessId =
          metaRow.instagram_actor_id || metaRow.ig_business_id;
        state.businessName = "your Instagram account";
        state.stage = CREATIVE_STAGES.SERVICE_CONTEXT;
      } else {
        return {
          response: { ok: true, text: "Please confirm to continue." }
        };
      }
    }

    // --- CONTEXT ---
    if (state.stage === CREATIVE_STAGES.SERVICE_CONTEXT) {
      const ctx = await resolveContext(state, instruction);
      if (!ctx.complete) {
        await saveCreativeState(supabase, email, creativeSessionId, state);
        return { response: { ok: true, text: ctx.question } };
      }
      state.stage = CREATIVE_STAGES.ASSET_RESOLUTION;
    }

    // --- ASSETS ---
    if (state.stage === CREATIVE_STAGES.ASSET_RESOLUTION) {
      const asset = await resolveAssets(state, instruction);
      if (!asset.complete) {
        await saveCreativeState(supabase, email, creativeSessionId, state);
        return { response: { ok: true, text: asset.question } };
      }
      state.stage = CREATIVE_STAGES.CONTENT_GENERATION;
    }

    // --- GENERATION ---
    if (state.stage === CREATIVE_STAGES.CONTENT_GENERATION) {
      const [captionData, imageData] = await Promise.all([
        generateCaption(state),
        generateImage(state)
      ]);

      state.content = {
        caption: captionData.caption,
        hashtags: captionData.hashtags,
        imageUrl: imageData.imageUrl,
        imagePrompt: imageData.imagePrompt
      };

      state.stage = CREATIVE_STAGES.PREVIEW;
      await saveCreativeState(supabase, email, creativeSessionId, state);

      return {
        response: { ok: true, text: composePreview(state) }
      };
    }

    // --- PREVIEW / INTENT ---
    if (state.stage === CREATIVE_STAGES.PREVIEW) {
      if (instruction.match(/\b(yes|publish|confirm|ok)\b/i)) {
        state.stage = CREATIVE_STAGES.COMPLETED;
        await saveCreativeState(supabase, email, creativeSessionId, state);

        return {
          intent: "PUBLISH_INSTAGRAM_POST",
          payload: {
            imageUrl: state.content.imageUrl,
            caption:
              `${state.content.caption}\n\n${state.content.hashtags.join(" ")}`
          }
        };
      }

      state.stage = CREATIVE_STAGES.CONTENT_GENERATION;
      await saveCreativeState(supabase, email, creativeSessionId, state);
      return { response: { ok: true, text: "Updating based on your feedback." } };
    }

    if (state.stage === CREATIVE_STAGES.COMPLETED) {
      await clearCreativeState(supabase, email, creativeSessionId);
      return { response: { ok: true, text: "Flow completed." } };
    }
  } catch (e) {
    console.error("Creative Entry Error:", e);
    return { response: { ok: false, text: `Creative Mode Error: ${e.message}` } };
  }

  return { response: { ok: false, text: "Internal FSM error." } };
}
