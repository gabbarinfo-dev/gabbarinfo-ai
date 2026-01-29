
import { CREATIVE_STAGES, CREATIVE_INTENT, DEFAULT_CREATIVE_STATE } from "./creative-constants";
import { loadCreativeState, saveCreativeState, clearCreativeState } from "./creative-memory";
import { resolveBusiness } from "./resolve-business";
import { resolveContext } from "./resolve-context";
import { resolveAssets } from "./resolve-assets";
import { generateCaption } from "./generate-caption";
import { generateImage } from "./generate-image";
import { composePreview } from "./compose-preview";

export async function creativeEntry({ supabase, session, instruction, metaRow, effectiveBusinessId }) {
    const email = session.user.email.toLowerCase();
    const lowerInstruction = (instruction || "").toLowerCase();

    // 1. Load State
    let state = await loadCreativeState(supabase, email);

    // 2. Detect New Intent or Reset
    const isNewIntent = lowerInstruction.includes("publish an instagram") ||
        lowerInstruction.includes("publish a post") ||
        lowerInstruction.includes("create an instagram") ||
        lowerInstruction.includes("post to instagram");
    const isReset = instruction.match(/\b(cancel|stop|start over|reset|new post)\b/i);

    // 🔄 FORCE RESET if new intent detected or state is trapped in COMPLETED
    if (isReset || isNewIntent || state.stage === CREATIVE_STAGES.COMPLETED) {
        await clearCreativeState(supabase, email, state.creativeSessionId);

        const nextSessionId = `ig_creative_${Date.now()}`;
        state = {
            ...DEFAULT_CREATIVE_STATE,
            creativeSessionId: nextSessionId,
            businessName: metaRow?.business_name || "Gabbarinfo",
            businessCategory: metaRow?.business_category || "Business",
            assets: {
                ...DEFAULT_CREATIVE_STATE.assets,
                websiteUrl: metaRow?.business_website || null,
                phone: metaRow?.business_phone || null
            }
        };
        await saveCreativeState(supabase, email, nextSessionId, state);

        if (isReset) {
            return { response: { ok: true, text: "Creative mode reset. What service would you like to focus on today?" } };
        }
        // If it was just a New Intent or coming from COMPLETED, continue to Stage 1 logic
    }

    // 3. Resolve Session ID (Fallback)
    let currentSessionId = state.creativeSessionId;
    if (!currentSessionId) {
        currentSessionId = `ig_creative_${Date.now()}`;
        state.creativeSessionId = currentSessionId;
        await saveCreativeState(supabase, email, currentSessionId, state);
    }

    // 4. State Machine (Strict Sequential Processing)
    try {
        // --- STAGE 1: BUSINESS RESOLUTION ---
        if (state.stage === CREATIVE_STAGES.BUSINESS_RESOLUTION) {
            const bizResult = await resolveBusiness(session, metaRow, state);
            if (bizResult.complete) {
                state.stage = CREATIVE_STAGES.SERVICE_CONTEXT;
                // Continue in same turn
            } else {
                const nextState = { ...state, stage: CREATIVE_STAGES.BUSINESS_RESOLUTION_WAITING };
                await saveCreativeState(supabase, email, currentSessionId, nextState);
                return { response: { ok: true, text: bizResult.question } };
            }
        }

        // --- STAGE 1B: BUSINESS_RESOLUTION_WAITING ---
        if (state.stage === CREATIVE_STAGES.BUSINESS_RESOLUTION_WAITING) {
            const isConfirm = lowerInstruction.includes("yes") || lowerInstruction.includes("sure") || lowerInstruction.includes("ok") || lowerInstruction.includes("use it");
            if (isConfirm) {
                state.businessId = "confirmed";
                state.stage = CREATIVE_STAGES.SERVICE_CONTEXT;
            } else {
                return { response: { ok: true, text: "I need a connected Instagram account to proceed. Should I use the one I found?" } };
            }
        }

        // --- STAGE 2: SERVICE_CONTEXT ---
        if (state.stage === CREATIVE_STAGES.SERVICE_CONTEXT) {
            const ctxResult = resolveContext(state);
            if (ctxResult.complete) {
                state.stage = CREATIVE_STAGES.OFFER_CONTEXT;
            } else {
                const nextState = { ...state, stage: CREATIVE_STAGES.SERVICE_CONTEXT_WAITING };
                await saveCreativeState(supabase, email, currentSessionId, nextState);
                return { response: { ok: true, text: ctxResult.question } };
            }
        }

        // --- STAGE 2B: SERVICE_CONTEXT_WAITING ---
        if (state.stage === CREATIVE_STAGES.SERVICE_CONTEXT_WAITING) {
            const serviceInput = instruction.trim();
            if (!serviceInput || serviceInput.length < 3) {
                return { response: { ok: true, text: "What service or product do you want this Instagram post to focus on?" } };
            }

            state.context.service = serviceInput;
            state.context.serviceLocked = true;
            state.stage = CREATIVE_STAGES.OFFER_CONTEXT;
        }

        // --- STAGE 3: OFFER_CONTEXT ---
        if (state.stage === CREATIVE_STAGES.OFFER_CONTEXT) {
            const ctxResult = resolveContext(state);
            if (ctxResult.complete) {
                state.stage = CREATIVE_STAGES.CONTACT_PREFERENCE;
            } else {
                const nextState = { ...state, stage: CREATIVE_STAGES.OFFER_CONTEXT_WAITING };
                await saveCreativeState(supabase, email, currentSessionId, nextState);
                return { response: { ok: true, text: ctxResult.question } };
            }
        }

        // --- STAGE 3B: OFFER_CONTEXT_WAITING ---
        if (state.stage === CREATIVE_STAGES.OFFER_CONTEXT_WAITING) {
            const offerInput = instruction.trim();
            const noOffer = offerInput.match(/\b(none|no|skip|nothing|na)\b/i);

            state.context.offer = noOffer ? null : offerInput;
            state.context.offerLocked = true;
            state.stage = CREATIVE_STAGES.CONTACT_PREFERENCE;
        }

        // --- STAGE 4: CONTACT_PREFERENCE ---
        if (state.stage === CREATIVE_STAGES.CONTACT_PREFERENCE) {
            const assetResult = await resolveAssets(supabase, state, metaRow);
            if (assetResult.complete) {
                state.stage = CREATIVE_STAGES.ASSET_CONFIRMATION;
            } else {
                const nextState = { ...state, stage: CREATIVE_STAGES.CONTACT_PREFERENCE_WAITING };
                await saveCreativeState(supabase, email, currentSessionId, nextState);
                return { response: { ok: true, text: assetResult.question } };
            }
        }

        // --- STAGE 4B: CONTACT_PREFERENCE_WAITING ---
        if (state.stage === CREATIVE_STAGES.CONTACT_PREFERENCE_WAITING) {
            let method = null;
            if (lowerInstruction.includes("website")) method = "website";
            else if (lowerInstruction.includes("call") || lowerInstruction.includes("phone")) method = "phone";
            else if (lowerInstruction.includes("whatsapp")) method = "whatsapp";
            else if (lowerInstruction.includes("none")) method = "none";

            if (method) {
                state.assets.contactMethod = method;
                state.assets.contactLocked = true;
                state.stage = CREATIVE_STAGES.ASSET_CONFIRMATION;
            } else {
                return { response: { ok: true, text: "How should customers contact you? (Reply: 'Website', 'Call', 'WhatsApp', or 'None')" } };
            }
        }

        // --- STAGE 5: ASSET_CONFIRMATION ---
        if (state.stage === CREATIVE_STAGES.ASSET_CONFIRMATION) {
            const assetResult = await resolveAssets(supabase, state, metaRow);
            if (assetResult.complete) {
                if (state.assets.contactMethod === "phone" || state.assets.contactMethod === "whatsapp") {
                    state.assets.phone = state.assets.phone || metaRow?.business_phone;
                }
                if (state.assets.contactMethod === "website") {
                    state.assets.websiteUrl = state.assets.websiteUrl || metaRow?.business_website;
                }
                state.assets.assetsConfirmed = true;
                state.stage = CREATIVE_STAGES.LOGO_DECISION;
            } else {
                const nextState = { ...state, stage: CREATIVE_STAGES.ASSET_CONFIRMATION_WAITING };
                await saveCreativeState(supabase, email, currentSessionId, nextState);
                return { response: { ok: true, text: assetResult.question } };
            }
        }

        // --- STAGE 5B: ASSET_CONFIRMATION_WAITING ---
        if (state.stage === CREATIVE_STAGES.ASSET_CONFIRMATION_WAITING) {
            const method = state.assets.contactMethod;
            const urlMatch = instruction.match(/(https?:\/\/[^\s]+|www\.[^\s]+|[a-zA-Z0-9-]+\.[a-z]{2,})/i);
            const phoneMatch = instruction.match(/(\+?\d[\d\s-]{8,})/);

            if (method === "website" && urlMatch) state.assets.websiteUrl = urlMatch[0];
            if ((method === "phone" || method === "whatsapp") && phoneMatch) state.assets.phone = phoneMatch[0];

            if ((method === "website" && !state.assets.websiteUrl) || ((method === "phone" || method === "whatsapp") && !state.assets.phone)) {
                return { response: { ok: true, text: `Please provide your ${method === "website" ? "Website URL" : "Phone Number"}.` } };
            }

            state.assets.assetsConfirmed = true;
            state.stage = CREATIVE_STAGES.LOGO_DECISION;
        }

        // --- STAGE 6: LOGO_DECISION ---
        if (state.stage === CREATIVE_STAGES.LOGO_DECISION) {
            state.assets.logoDecision = metaRow?.fb_page_id ? "use_logo" : "use_text";
            state.assets.logoLocked = true;
            state.stage = CREATIVE_STAGES.CONTENT_GENERATION;
        }

        // --- STAGE 7: CONTENT GENERATION ---
        if (state.stage === CREATIVE_STAGES.CONTENT_GENERATION) {
            const [captionData, imageData] = await Promise.all([
                generateCaption(state),
                generateImage(state)
            ]);

            state.content = {
                ...state.content,
                caption: captionData.caption,
                hashtags: captionData.hashtags,
                imageUrl: imageData.imageUrl,
                imagePrompt: imageData.imagePrompt
            };
            state.stage = CREATIVE_STAGES.PREVIEW;

            await saveCreativeState(supabase, email, currentSessionId, state);
            const previewText = composePreview(state);
            return { response: { ok: true, text: previewText } };
        }

        // --- STAGE 8: PREVIEW & PUBLISH ---
        if (state.stage === CREATIVE_STAGES.PREVIEW) {
            const isConfirmation = lowerInstruction.match(/\b(yes|publish|go ahead|confirm|ok|proceed)\b/i);
            const isCorrection = !isConfirmation && instruction.length > 5;

            if (isConfirmation) {
                if (!state.content.imageUrl) {
                    state.stage = CREATIVE_STAGES.CONTENT_GENERATION;
                    await saveCreativeState(supabase, email, currentSessionId, state);
                    return { response: { ok: true, text: "I lost the image. Regenerating..." } };
                }

                state.ready_to_publish = true;
                state.stage = CREATIVE_STAGES.COMPLETED;
                await saveCreativeState(supabase, email, currentSessionId, state);

                return {
                    assets: {
                        imageUrl: state.content.imageUrl,
                        caption: `${state.content.caption || ""}\n\n${(state.content.hashtags || []).join(" ")}`
                    }
                };
            } else if (isCorrection) {
                state.stage = CREATIVE_STAGES.CONTENT_GENERATION;
                state.context.rawIntent += " " + instruction;
                await saveCreativeState(supabase, email, currentSessionId, state);
                return { response: { ok: true, text: "Got your feedback. Updating content now..." } };
            }

            const previewText = composePreview(state);
            return { response: { ok: true, text: previewText } };
        }

        // --- STAGE: COMPLETED (Safety Reset) ---
        if (state.stage === CREATIVE_STAGES.COMPLETED) {
            await clearCreativeState(supabase, email, currentSessionId);
            // Return thinking or recursive call would be better but for now start over logic handles it next turn
            return { response: { ok: true, text: "Post completed! Moving back to the start. What's next?" } };
        }

        await saveCreativeState(supabase, email, currentSessionId, state);
        return { response: { ok: false, text: "Thinking..." } };

    } catch (e) {
        console.error("Creative Entry Error:", e);
        return { response: { ok: false, text: `Instagram flow error: ${e.message}` } };
    }
}
