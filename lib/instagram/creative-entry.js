
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

    // 2. Resolve Session ID
    let creativeSessionId = state.creativeSessionId;
    if (!creativeSessionId) {
        creativeSessionId = `ig_creative_${Date.now()}`;
        state = { ...DEFAULT_CREATIVE_STATE, creativeSessionId };
        await saveCreativeState(supabase, email, creativeSessionId, state);
    }

    // 🔗 INTENT-BASED RESET: If user says "publish an instagram post" or similar while in a deep state, RESET.
    const isNewIntent = lowerInstruction.includes("publish an instagram post") || lowerInstruction.includes("publish a post") || lowerInstruction.includes("post to instagram");
    const isReset = instruction.match(/\b(cancel|stop|start over|reset|new post)\b/i);

    if (isReset || (isNewIntent && state.stage !== CREATIVE_STAGES.BUSINESS_RESOLUTION)) {
        await clearCreativeState(supabase, email, creativeSessionId);
        // Regenerate unique session
        const newSessionId = `ig_creative_${Date.now()}`;
        const newState = { ...DEFAULT_CREATIVE_STATE, creativeSessionId: newSessionId };
        await saveCreativeState(supabase, email, newSessionId, newState);
        state = newState;
        creativeSessionId = newSessionId;

        if (isReset) {
            return { response: { ok: true, text: "Creative mode reset. How can I help with your new post?" } };
        }
    }

    let updates = {};

    // 3. State Machine (Strict Turn Boundaries)
    try {
        // --- STAGE 1: BUSINESS RESOLUTION ---
        if (state.stage === CREATIVE_STAGES.BUSINESS_RESOLUTION) {
            const bizResult = await resolveBusiness(session, metaRow, state);
            if (bizResult.complete) {
                const nextState = {
                    ...state,
                    businessId: bizResult.businessId || "default",
                    stage: CREATIVE_STAGES.SERVICE_CONTEXT
                };
                await saveCreativeState(supabase, email, creativeSessionId, nextState);
                state = nextState;
                // Intentional flow-through to start the questionnaire immediately
            } else {
                return { response: { ok: true, text: bizResult.question } };
            }
        }

        // --- STAGE 2: SERVICE_CONTEXT ---
        if (state.stage === CREATIVE_STAGES.SERVICE_CONTEXT) {
            const ctxResult = resolveContext(state);

            if (ctxResult.complete) {
                const nextState = { ...state, stage: CREATIVE_STAGES.OFFER_CONTEXT };
                await saveCreativeState(supabase, email, creativeSessionId, nextState);
                state = nextState;
                // Intentional flow-through
            } else {
                const nextState = {
                    ...state,
                    stage: CREATIVE_STAGES.SERVICE_CONTEXT_WAITING
                };
                await saveCreativeState(supabase, email, creativeSessionId, nextState);
                return { response: { ok: true, text: ctxResult.question } };
            }
        }

        // --- STAGE 2B: SERVICE_CONTEXT_WAITING ---
        if (state.stage === CREATIVE_STAGES.SERVICE_CONTEXT_WAITING) {
            const serviceInput = instruction.trim();
            if (!serviceInput || serviceInput.length < 3 || isNewIntent) {
                return { response: { ok: true, text: "What service or product do you want this Instagram post to focus on? (e.g., 'Laundry Service', 'Fitness Centre')" } };
            }

            const nextState = {
                ...state,
                context: {
                    ...state.context,
                    service: serviceInput,
                    serviceLocked: true
                },
                stage: CREATIVE_STAGES.OFFER_CONTEXT
            };
            await saveCreativeState(supabase, email, creativeSessionId, nextState);
            state = nextState;
            // Flow to next question
        }

        // --- STAGE 3: OFFER_CONTEXT ---
        if (state.stage === CREATIVE_STAGES.OFFER_CONTEXT) {
            const ctxResult = resolveContext(state);

            if (ctxResult.complete) {
                const nextState = { ...state, stage: CREATIVE_STAGES.CONTACT_PREFERENCE };
                await saveCreativeState(supabase, email, creativeSessionId, nextState);
                state = nextState;
            } else {
                const nextState = {
                    ...state,
                    stage: CREATIVE_STAGES.OFFER_CONTEXT_WAITING
                };
                await saveCreativeState(supabase, email, creativeSessionId, nextState);
                return { response: { ok: true, text: ctxResult.question } };
            }
        }

        // --- STAGE 3B: OFFER_CONTEXT_WAITING ---
        if (state.stage === CREATIVE_STAGES.OFFER_CONTEXT_WAITING) {
            const offerInput = instruction.trim();
            const hasOffer = !offerInput.match(/\b(none|no|skip|nothing|na)\b/i);

            const nextState = {
                ...state,
                context: {
                    ...state.context,
                    offer: (hasOffer && offerInput.length > 2) ? offerInput : null,
                    offerLocked: true
                },
                stage: CREATIVE_STAGES.CONTACT_PREFERENCE
            };
            await saveCreativeState(supabase, email, creativeSessionId, nextState);
            state = nextState;
            // Flow to next section
        }

        // --- STAGE 4: CONTACT_PREFERENCE ---
        if (state.stage === CREATIVE_STAGES.CONTACT_PREFERENCE) {
            const assetResult = await resolveAssets(supabase, state, metaRow);

            if (assetResult.complete) {
                const nextState = { ...state, stage: CREATIVE_STAGES.ASSET_CONFIRMATION };
                await saveCreativeState(supabase, email, creativeSessionId, nextState);
                state = nextState;
            } else {
                const nextState = {
                    ...state,
                    stage: CREATIVE_STAGES.CONTACT_PREFERENCE_WAITING
                };
                await saveCreativeState(supabase, email, creativeSessionId, nextState);
                return { response: { ok: true, text: assetResult.question } };
            }
        }

        // --- STAGE 4B: CONTACT_PREFERENCE_WAITING ---
        if (state.stage === CREATIVE_STAGES.CONTACT_PREFERENCE_WAITING) {
            const lower = instruction.toLowerCase();
            let method = null;
            if (lower.includes("website")) method = "website";
            else if (lower.includes("call") || lower.includes("phone")) method = "phone";
            else if (lower.includes("whatsapp")) method = "whatsapp";
            else if (lower.includes("none")) method = "none";

            if (method) {
                const nextState = {
                    ...state,
                    assets: {
                        ...state.assets,
                        contactMethod: method,
                        contactLocked: true
                    },
                    stage: CREATIVE_STAGES.ASSET_CONFIRMATION
                };
                await saveCreativeState(supabase, email, creativeSessionId, nextState);
                state = nextState;
            } else {
                return { response: { ok: true, text: "How should customers contact you? (Reply: 'Website', 'Call', 'WhatsApp', or 'None')" } };
            }
        }

        // --- STAGE 5: ASSET_CONFIRMATION ---
        if (state.stage === CREATIVE_STAGES.ASSET_CONFIRMATION) {
            const assetResult = await resolveAssets(supabase, state, metaRow);

            if (assetResult.complete) {
                const nextState = { ...state, stage: CREATIVE_STAGES.LOGO_DECISION };
                await saveCreativeState(supabase, email, creativeSessionId, nextState);
                state = nextState;
            } else {
                const nextState = {
                    ...state,
                    stage: CREATIVE_STAGES.ASSET_CONFIRMATION_WAITING
                };
                await saveCreativeState(supabase, email, creativeSessionId, nextState);
                return { response: { ok: true, text: assetResult.question } };
            }
        }

        // --- STAGE 5B: ASSET_CONFIRMATION_WAITING ---
        if (state.stage === CREATIVE_STAGES.ASSET_CONFIRMATION_WAITING) {
            const method = state.assets.contactMethod;
            const needsWebsite = method === "website";
            const needsPhone = method === "phone" || method === "whatsapp";

            let website = state.assets.websiteUrl || null;
            let phone = state.assets.phone || null;

            const urlMatch = instruction.match(/(https?:\/\/[^\s]+|www\.[^\s]+|[a-zA-Z0-9-]+\.[a-z]{2,})/i);
            if (urlMatch) website = urlMatch[0];

            const phoneMatch = instruction.match(/(\+?\d[\d\s-]{8,})/);
            if (phoneMatch) phone = phoneMatch[0];

            if ((needsWebsite && !website) || (needsPhone && !phone)) {
                let q = "I still need your details.";
                if (needsWebsite && !website) q = "Please provide your Website URL.";
                else if (needsPhone && !phone) q = "Please provide your Phone Number.";
                return { response: { ok: true, text: q } };
            }

            const nextState = {
                ...state,
                assets: {
                    ...state.assets,
                    assetsConfirmed: true,
                    websiteUrl: website || state.assets.websiteUrl,
                    phone: phone || state.assets.phone
                },
                stage: CREATIVE_STAGES.LOGO_DECISION
            };
            await saveCreativeState(supabase, email, creativeSessionId, nextState);
            state = nextState;
        }

        // --- STAGE 6: LOGO_DECISION ---
        if (state.stage === CREATIVE_STAGES.LOGO_DECISION) {
            // For now, auto-complete logo decision to speed up flow
            const nextState = {
                ...state,
                assets: { ...state.assets, logoLocked: true },
                stage: CREATIVE_STAGES.CONTENT_GENERATION
            };
            await saveCreativeState(supabase, email, creativeSessionId, nextState);
            state = nextState;
        }

        // --- STAGE 7: CONTENT GENERATION ---
        if (state.stage === CREATIVE_STAGES.CONTENT_GENERATION) {
            const [captionData, imageData] = await Promise.all([
                generateCaption(state),
                generateImage(state)
            ]);

            const nextState = {
                ...state,
                content: {
                    ...state.content,
                    caption: captionData.caption,
                    hashtags: captionData.hashtags,
                    imageUrl: imageData.imageUrl,
                    imagePrompt: imageData.imagePrompt
                },
                stage: CREATIVE_STAGES.PREVIEW
            };
            await saveCreativeState(supabase, email, creativeSessionId, nextState);
            state = nextState;
        }

        // --- STAGE 8: PREVIEW & PUBLISH ---
        if (state.stage === CREATIVE_STAGES.PREVIEW) {
            const isConfirmation = instruction.match(/\b(yes|publish|go ahead|confirm|ok)\b/i);
            const isCorrection = !isConfirmation && instruction.length > 3;

            if (isConfirmation) {
                if (!state.content.imageUrl) {
                    const nextState = { ...state, stage: CREATIVE_STAGES.CONTENT_GENERATION };
                    await saveCreativeState(supabase, email, creativeSessionId, nextState);
                    return { response: { ok: true, text: "I seem to have lost the image. Regenerating it for you..." } };
                }

                const nextState = { ...state, ready_to_publish: true, stage: CREATIVE_STAGES.COMPLETED };
                await saveCreativeState(supabase, email, creativeSessionId, nextState);

                return {
                    assets: {
                        imageUrl: state.content.imageUrl,
                        caption: `${state.content.caption || ""}\n\n${(state.content.hashtags || []).join(" ")}`
                    }
                };
            } else if (isCorrection) {
                // If user provides feedback, move back to generation
                const nextState = { ...state, stage: CREATIVE_STAGES.CONTENT_GENERATION };
                await saveCreativeState(supabase, email, creativeSessionId, nextState);
                return { response: { ok: true, text: "Updating content based on your feedback..." } };
            }

            const previewText = composePreview(state);
            return { response: { ok: true, text: previewText } };
        }

        // --- STAGE: COMPLETED ---
        if (state.stage === CREATIVE_STAGES.COMPLETED) {
            await clearCreativeState(supabase, email, creativeSessionId);
            return { response: { ok: true, text: "Previous post completed. Starting new..." } };
        }

        return { response: { ok: false, text: "Thinking..." } };

    } catch (e) {
        console.error("Creative Entry Error:", e);
        return { response: { ok: false, text: `Creative Mode Error: ${e.message}` } };
    }
}
