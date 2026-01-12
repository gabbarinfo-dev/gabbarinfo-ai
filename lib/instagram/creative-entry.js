// lib/instagram/creative-entry.js
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

    // 1. Load State
    let state = await loadCreativeState(supabase, email);

    // 2. Resolve Session ID
    let creativeSessionId = state.creativeSessionId;
    if (!creativeSessionId) {
        creativeSessionId = `ig_creative_${Date.now()}`;
        state = { ...DEFAULT_CREATIVE_STATE, creativeSessionId };
        // Immediately persist new session ID to lock it
        await saveCreativeState(supabase, email, creativeSessionId, state);

        // Fix: Reload state after session creation to ensure in-memory state === persisted state
        state = await loadCreativeState(supabase, email);
    }

    let updates = {};

    // 0. Handle Global Resets (Moved after loading to know Session ID)
    if (instruction.match(/\b(cancel|stop|start over|reset)\b/i)) {
        await clearCreativeState(supabase, email, creativeSessionId);
        return { response: { ok: true, text: "Creative mode canceled. How can I help?", mode: "instagram_post" } };
    }

    // 3. State Machine (Strict Sequence & Single Authority)
    try {
        // --- STAGE 1: BUSINESS RESOLUTION ---
        if (state.stage === CREATIVE_STAGES.BUSINESS_RESOLUTION) {
            const bizResult = await resolveBusiness(session, metaRow, instruction, state);
            if (bizResult.complete) {
                updates = {
                    ...updates,
                    businessId: bizResult.businessId,
                    businessName: bizResult.businessName,
                    businessCategory: bizResult.businessCategory,
                    stage: CREATIVE_STAGES.SERVICE_CONTEXT
                };
                if (bizResult.logoUrl) {
                    updates.assets = { ...state.assets, logoUrl: bizResult.logoUrl };
                }
                await saveCreativeState(supabase, email, creativeSessionId, { ...state, ...updates });

                // HARD RETURN: Provide a transition response to break the turn
                return { response: { ok: true, text: "Business identified. Let's move to service details.", mode: "instagram_post" } };
            } else {
                return { response: { ok: true, text: bizResult.question, mode: "instagram_post" } };
            }
        }

        // --- STAGE 2: SERVICE_CONTEXT (Unified Authority) ---
        if (state.stage === CREATIVE_STAGES.SERVICE_CONTEXT || state.stage === CREATIVE_STAGES.SERVICE_CONTEXT_WAITING) {
            const ctxResult = resolveContext(instruction, state);

            if (ctxResult.complete) {
                // SUCCESS: Service extracted (sole authority: resolveContext)
                updates = {
                    ...updates,
                    ...ctxResult.updates,
                    stage: CREATIVE_STAGES.OFFER_CONTEXT
                };
                await saveCreativeState(supabase, email, creativeSessionId, { ...state, ...updates });

                // HARD RETURN: No fall-through
                return { response: { ok: true, text: "Service noted. Let's talk about the offer.", mode: "instagram_post" } };
            } else {
                // WAITING: Resolver produced a question or needs more info
                updates = {
                    ...updates,
                    ...ctxResult.updates,
                    stage: CREATIVE_STAGES.SERVICE_CONTEXT_WAITING
                };
                await saveCreativeState(supabase, email, creativeSessionId, { ...state, ...updates });
                return { response: { ok: true, text: ctxResult.question, mode: "instagram_post" } };
            }
        }

        // --- STAGE 3: OFFER_CONTEXT (Unified Authority) ---
        if (state.stage === CREATIVE_STAGES.OFFER_CONTEXT || state.stage === CREATIVE_STAGES.OFFER_CONTEXT_WAITING) {
            const ctxResult = resolveContext(instruction, state);

            if (ctxResult.complete) {
                // SUCCESS: Offer extracted (sole authority: resolveContext)
                updates = {
                    ...updates,
                    ...ctxResult.updates,
                    stage: CREATIVE_STAGES.CONTACT_PREFERENCE
                };
                await saveCreativeState(supabase, email, creativeSessionId, { ...state, ...updates });

                // HARD RETURN: No fall-through
                return { response: { ok: true, text: "Offer details captured. Almost there!", mode: "instagram_post" } };
            } else {
                // WAITING: Resolver produced a question
                updates = {
                    ...updates,
                    ...ctxResult.updates,
                    stage: CREATIVE_STAGES.OFFER_CONTEXT_WAITING
                };
                await saveCreativeState(supabase, email, creativeSessionId, { ...state, ...updates });
                return { response: { ok: true, text: ctxResult.question, mode: "instagram_post" } };
            }
        }

        // --- STAGE 4: CONTACT_PREFERENCE (Unified Authority) ---
        if (state.stage === CREATIVE_STAGES.CONTACT_PREFERENCE || state.stage === CREATIVE_STAGES.CONTACT_PREFERENCE_WAITING) {
            const assetResult = await resolveAssets(supabase, state, instruction, metaRow);

            if (assetResult.complete || assetResult.updates?.assets?.contactLocked) {
                // SUCCESS: Preference noted
                updates = {
                    ...updates,
                    ...assetResult.updates,
                    stage: CREATIVE_STAGES.ASSET_CONFIRMATION
                };
                await saveCreativeState(supabase, email, creativeSessionId, { ...state, ...updates });

                // HARD RETURN: No fall-through
                return { response: { ok: true, text: "Preferences noted. Reviewing assets...", mode: "instagram_post" } };
            } else {
                // WAITING: Resolver produced a question
                updates = {
                    ...updates,
                    ...assetResult.updates,
                    stage: CREATIVE_STAGES.CONTACT_PREFERENCE_WAITING
                };
                await saveCreativeState(supabase, email, creativeSessionId, { ...state, ...updates });
                return { response: { ok: true, text: assetResult.question, mode: "instagram_post" } };
            }
        }

        // --- STAGE 5: ASSET_CONFIRMATION (Unified Authority) ---
        if (state.stage === CREATIVE_STAGES.ASSET_CONFIRMATION || state.stage === CREATIVE_STAGES.ASSET_CONFIRMATION_WAITING) {
            const assetResult = await resolveAssets(supabase, state, instruction, metaRow);

            if (assetResult.complete || assetResult.updates?.assets?.assetsConfirmed) {
                // SUCCESS: Data verified
                updates = {
                    ...updates,
                    ...assetResult.updates,
                    stage: CREATIVE_STAGES.LOGO_DECISION
                };
                await saveCreativeState(supabase, email, creativeSessionId, { ...state, ...updates });

                // HARD RETURN: No fall-through
                return { response: { ok: true, text: "Assets confirmed. Finalizing design...", mode: "instagram_post" } };
            } else {
                // WAITING: Resolver produced a question
                updates = {
                    ...updates,
                    ...assetResult.updates,
                    stage: CREATIVE_STAGES.ASSET_CONFIRMATION_WAITING
                };
                await saveCreativeState(supabase, email, creativeSessionId, { ...state, ...updates });
                return { response: { ok: true, text: assetResult.question, mode: "instagram_post" } };
            }
        }

        // --- STAGE 6: LOGO_DECISION ---
        if (state.stage === CREATIVE_STAGES.LOGO_DECISION) {
            const assetResult = await resolveAssets(supabase, state, instruction, metaRow);

            if (assetResult.complete) {
                // SUCCESS: Automatic or manual decision made
                updates = {
                    ...updates,
                    ...assetResult.updates,
                    stage: CREATIVE_STAGES.CONTENT_GENERATION
                };
                await saveCreativeState(supabase, email, creativeSessionId, { ...state, ...updates });

                // HARD RETURN: Signal that we are starting generation
                return { response: { ok: true, text: "Design preferences noted. Creating your post...", mode: "instagram_post" } };
            } else {
                return { response: { ok: true, text: assetResult.question, mode: "instagram_post" } };
            }
        }

        // --- STAGE 7: CONTENT GENERATION ---
        if (state.stage === CREATIVE_STAGES.CONTENT_GENERATION) {
            // This stage is internal and does not consume input.
            // It will fall through to PREVIEW to show results without an extra user turn.
            const [captionData, imageData] = await Promise.all([
                generateCaption(state),
                generateImage(state)
            ]);

            updates = {
                ...updates,
                content: {
                    ...state.content,
                    caption: captionData.caption,
                    hashtags: captionData.hashtags,
                    imageUrl: imageData.imageUrl,
                    imagePrompt: imageData.imagePrompt
                },
                stage: CREATIVE_STAGES.PREVIEW
            };
            await saveCreativeState(supabase, email, creativeSessionId, { ...state, ...updates });
            state = { ...state, ...updates }; // Update in-memory for preview call
        }

        // --- STAGE 8: PREVIEW & PUBLISH ---
        if (state.stage === CREATIVE_STAGES.PREVIEW) {
            const isConfirmation = instruction.match(/\b(yes|publish|go ahead|confirm)\b/i);
            const isCorrection = !isConfirmation && instruction.length > 3 && !updates.content; // only if we didn't just arrive

            if (isConfirmation) {
                const finalState = {
                    ...state,
                    ...updates,
                    ready_to_publish: true,
                    stage: CREATIVE_STAGES.COMPLETED
                };
                await saveCreativeState(supabase, email, creativeSessionId, finalState);

                return {
                    assets: {
                        imageUrl: state.content.imageUrl,
                        caption: `${state.content.caption}\n\n${state.content.hashtags.join(" ")}`
                    }
                };
            } else if (isCorrection) {
                const lower = instruction.toLowerCase();
                let feedbackText = "Updating content based on your feedback...";

                if (lower.includes("image") || lower.includes("photo") || lower.includes("picture")) {
                    updates = { ...updates, stage: CREATIVE_STAGES.CONTENT_GENERATION };
                } else {
                    updates = {
                        ...updates,
                        context: { ...state.context, rawIntent: state.context.rawIntent + " " + instruction },
                        stage: CREATIVE_STAGES.CONTENT_GENERATION
                    };
                }
                await saveCreativeState(supabase, email, creativeSessionId, { ...state, ...updates });
                return { response: { ok: true, text: feedbackText, mode: "instagram_post" } };
            }

            const previewText = composePreview(state);
            return { response: { ok: true, text: previewText, mode: "instagram_post" } };
        }

        // --- STAGE: COMPLETED ---
        if (state.stage === CREATIVE_STAGES.COMPLETED) {
            await clearCreativeState(supabase, email, creativeSessionId);
            return { response: { ok: true, text: "Previous post completed. How can I help next?", mode: "instagram_post" } };
        }

        return { response: { ok: false, text: "Processing completed.", mode: "instagram_post" } };

    } catch (e) {
        console.error("Creative Entry Error:", e);
        return { response: { ok: false, text: `Creative Mode Error: ${e.message}`, mode: "instagram_post" } };
    }
}
