
import { CREATIVE_STAGES, CREATIVE_INTENT, DEFAULT_CREATIVE_STATE } from "./creative-constants";
import { loadCreativeState, saveCreativeState, clearCreativeState } from "./creative-memory";
import { resolveBusiness } from "./resolve-business";
import { resolveContext } from "./resolve-context";
import { resolveAssets } from "./resolve-assets";
import { generateCaption } from "./generate-caption";
import { generateImage } from "./generate-image";
import { composePreview } from "./compose-preview";

export async function creativeEntry({ supabase, session, instruction, metaRow, effectiveBusinessId }) {
    // 🔥 HIGH-PRIORITY ENTRY GUARD: Path A Sovereignty
    // If both assets are present, Creative Mode must NO-OP and return early.
    const hasImage = instruction.includes("Image URL:");
    const hasCaption = instruction.includes("Caption:");
    if (hasImage && hasCaption) {
        console.log("🛡️ [Creative] Path A detected. Sovereignty Guard Triggered. No-op.");
        return {};
    }

    const email = session.user.email.toLowerCase();

    // 1. Load State
    let state = await loadCreativeState(supabase, email);

    // FIX 3 — CREATIVE ENTRY GUARD (SAFETY)
    // If generic trigger and no assets, start FRESH.
    const isGenericTrigger = instruction.toLowerCase().trim() === "publish an instagram post";
    if (isGenericTrigger && !hasImage && !hasCaption) {
        console.log("🔄 [Creative] Generic trigger detected. Resetting to fresh state.");
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

    // 0. Handle Global Resets
    if (instruction.match(/\b(cancel|stop|start over|reset)\b/i)) {
        await clearCreativeState(supabase, email, creativeSessionId);
        return { response: { ok: true, text: "Creative mode canceled. How can I help?" } };
    }

    // 3. State Machine (Strict Sequence, Hard Returns)
    try {
        // --- STAGE 1: BUSINESS RESOLUTION (RESOLVE) ---
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

        // --- STAGE 1B: BUSINESS_RESOLUTION_WAITING (WAITING) ---
        if (state.stage === CREATIVE_STAGES.BUSINESS_RESOLUTION_WAITING) {
            // FIX: Selection from metaRow only (No Meta Graph API network calls)
            if (instruction.match(/\b(yes|ok|sure|this one|confirm)\b/i)) {
                state.businessId = metaRow.instagram_actor_id || metaRow.ig_business_id;
                state.businessName = "your Instagram account"; // Generic since we are avoiding extra network fetches
                state.stage = CREATIVE_STAGES.SERVICE_CONTEXT;
                await saveCreativeState(supabase, email, creativeSessionId, state);
                return { response: { ok: true, text: "Great. Now, what service are we highlighting?" } };
            }
            return { response: { ok: true, text: "I'm sorry, I didn't catch that. Should I use your connected Instagram account?" } };
        }

        // --- STAGE 2: SERVICE_CONTEXT (RESOLVE) ---
        if (state.stage === CREATIVE_STAGES.SERVICE_CONTEXT) {
            const ctxResult = resolveContext(state);
            if (ctxResult.complete) {
                state.stage = CREATIVE_STAGES.OFFER_CONTEXT;
            } else {
                state.stage = CREATIVE_STAGES.SERVICE_CONTEXT_WAITING;
                await saveCreativeState(supabase, email, creativeSessionId, state);
                return { response: { ok: true, text: ctxResult.question } };
            }
        }

        // --- STAGE 2B: SERVICE_CONTEXT_WAITING (WAITING) ---
        if (state.stage === CREATIVE_STAGES.SERVICE_CONTEXT_WAITING) {
            state.context.service = instruction.trim();
            state.context.serviceLocked = true;
            state.stage = CREATIVE_STAGES.OFFER_CONTEXT;
            await saveCreativeState(supabase, email, creativeSessionId, state);
            return { response: { ok: true, text: "Got it. And any specific offer or discount for this post?" } };
        }

        // --- STAGE 3: OFFER_CONTEXT (RESOLVE) ---
        if (state.stage === CREATIVE_STAGES.OFFER_CONTEXT) {
            const ctxResult = resolveContext(state);
            if (ctxResult.complete) {
                state.stage = CREATIVE_STAGES.CONTACT_PREFERENCE;
            } else {
                state.stage = CREATIVE_STAGES.OFFER_CONTEXT_WAITING;
                await saveCreativeState(supabase, email, creativeSessionId, state);
                return { response: { ok: true, text: ctxResult.question } };
            }
        }

        // --- STAGE 3B: OFFER_CONTEXT_WAITING (WAITING) ---
        if (state.stage === CREATIVE_STAGES.OFFER_CONTEXT_WAITING) {
            const text = instruction.toLowerCase();
            const skip = text.match(/\b(none|no|nothing|skip|na)\b/i);
            state.context.offer = skip ? null : instruction.trim();
            state.context.offerLocked = true;
            state.stage = CREATIVE_STAGES.CONTACT_PREFERENCE;
            await saveCreativeState(supabase, email, creativeSessionId, state);
            return { response: { ok: true, text: "Understood. How should people reach out? Website, Call, or WhatsApp?" } };
        }

        // --- STAGE 4: CONTACT_PREFERENCE (RESOLVE) ---
        if (state.stage === CREATIVE_STAGES.CONTACT_PREFERENCE) {
            const assetResult = await resolveAssets(supabase, state, metaRow);
            if (assetResult.complete) {
                state.stage = CREATIVE_STAGES.ASSET_CONFIRMATION;
            } else {
                state.stage = CREATIVE_STAGES.CONTACT_PREFERENCE_WAITING;
                await saveCreativeState(supabase, email, creativeSessionId, state);
                return { response: { ok: true, text: assetResult.question } };
            }
        }

        // --- STAGE 4B: CONTACT_PREFERENCE_WAITING (WAITING) ---
        if (state.stage === CREATIVE_STAGES.CONTACT_PREFERENCE_WAITING) {
            const lower = instruction.toLowerCase();
            let method = null;
            if (lower.includes("website")) method = "website";
            else if (lower.includes("call") || lower.includes("phone")) method = "phone";
            else if (lower.includes("whatsapp")) method = "whatsapp";
            else if (lower.includes("none")) method = "none";

            if (method) {
                state.assets.contactMethod = method;
                state.assets.contactLocked = true;
                state.stage = CREATIVE_STAGES.ASSET_CONFIRMATION;
                await saveCreativeState(supabase, email, creativeSessionId, state);
                return { response: { ok: true, text: "Noted." } };
            }
            return { response: { ok: true, text: "Please choose: Website, Call, WhatsApp, or None." } };
        }

        // --- STAGE 5: ASSET_CONFIRMATION (RESOLVE) ---
        if (state.stage === CREATIVE_STAGES.ASSET_CONFIRMATION) {
            const assetResult = await resolveAssets(supabase, state, metaRow);
            if (assetResult.complete) {
                state.stage = CREATIVE_STAGES.LOGO_DECISION;
            } else {
                state.stage = CREATIVE_STAGES.ASSET_CONFIRMATION_WAITING;
                await saveCreativeState(supabase, email, creativeSessionId, state);
                return { response: { ok: true, text: assetResult.question } };
            }
        }

        // --- STAGE 5B: ASSET_CONFIRMATION_WAITING (WAITING) ---
        if (state.stage === CREATIVE_STAGES.ASSET_CONFIRMATION_WAITING) {
            const method = state.assets.contactMethod;
            if (method === "website") {
                const urlMatch = instruction.match(/(https?:\/\/[^\s]+|www\.[^\s]+|[a-zA-Z0-9-]+\.[a-z]{2,})/i);
                if (urlMatch) {
                    state.assets.websiteUrl = urlMatch[0].startsWith("http") ? urlMatch[0] : "https://" + urlMatch[0];
                    state.assets.assetsConfirmed = true;
                    state.stage = CREATIVE_STAGES.LOGO_DECISION;
                }
            } else if (method === "phone" || method === "whatsapp") {
                const phoneMatch = instruction.match(/(\+?\d[\d\s-]{8,})/);
                if (phoneMatch) {
                    state.assets.phone = phoneMatch[0];
                    state.assets.assetsConfirmed = true;
                    state.stage = CREATIVE_STAGES.LOGO_DECISION;
                }
            }

            if (state.assets.assetsConfirmed) {
                await saveCreativeState(supabase, email, creativeSessionId, state);
                return { response: { ok: true, text: "Got it. Moving on to logo setup." } };
            }
            return { response: { ok: true, text: "I still need that info. Could you provide it again?" } };
        }

        // --- STAGE 6: LOGO_DECISION (RESOLVE) ---
        if (state.stage === CREATIVE_STAGES.LOGO_DECISION) {
            const assetResult = await resolveAssets(supabase, state, metaRow);
            if (assetResult.complete) {
                // Split Authority: Decision only
                state.stage = CREATIVE_STAGES.LOGO_DECISION_PROCESS;
            } else {
                // Fallback (questions if any)
                state.stage = CREATIVE_STAGES.LOGO_DECISION_WAITING;
                await saveCreativeState(supabase, email, creativeSessionId, state);
                return { response: { ok: true, text: assetResult.question } };
            }
        }

        // --- STAGE 6B: LOGO_DECISION_PROCESS (PROCESS) ---
        if (state.stage === CREATIVE_STAGES.LOGO_DECISION_PROCESS) {
            // FIX: Split Authority - Assignments moved to PROCESS stage
            const finalLogo = state.assets.logoUrl || metaRow?.logo || metaRow?.logo_url;
            state.assets.logoUrl = finalLogo || null;
            state.assets.logoDecision = finalLogo ? "use_logo" : "use_text";
            state.assets.logoLocked = true;
            state.stage = CREATIVE_STAGES.CONTENT_GENERATION;
            // No return here, fall through to heavy generation
        }

        // --- STAGE 7: CONTENT_GENERATION (PROCESS) ---
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

            const previewText = composePreview(state);
            return { response: { ok: true, text: previewText } };
        }

        // --- STAGE 8: PREVIEW & PUBLISH (INTENT RETURN) ---
        if (state.stage === CREATIVE_STAGES.PREVIEW) {
            const isConfirmation = instruction.match(/\b(yes|publish|go ahead|confirm|ok|do it)\b/i);

            if (isConfirmation) {
                state.stage = CREATIVE_STAGES.COMPLETED;
                await saveCreativeState(supabase, email, creativeSessionId, state);

                return {
                    intent: "PUBLISH_INSTAGRAM_POST",
                    payload: {
                        imageUrl: state.content.imageUrl,
                        caption: `${state.content.caption}\n\n${state.content.hashtags.join(" ")}`
                    }
                };
            }

            // Correction handling
            state.stage = CREATIVE_STAGES.CONTENT_GENERATION;
            state.context.rawIntent += " " + instruction;
            await saveCreativeState(supabase, email, creativeSessionId, state);
            return { response: { ok: true, text: "Updating based on your feedback..." } };
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
