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

    // 0. Handle Global Resets
    if (instruction.match(/\b(cancel|stop|start over|reset)\b/i)) {
        await clearCreativeState(supabase, email, effectiveBusinessId);
        return { response: { ok: true, text: "Creative mode canceled. How can I help?" } };
    }

    // 1. Load State
    let state = await loadCreativeState(supabase, email, effectiveBusinessId);
    let updates = {};

    // PERSISTENCE FIX: Ensure we have a valid ID for saving, even if effectiveBusinessId is null
    const saveId = effectiveBusinessId || state.businessId;

    // 2. State Machine (Strict Sequence)
    try {
        // --- STAGE 1: BUSINESS RESOLUTION ---
        if (state.stage === CREATIVE_STAGES.BUSINESS_RESOLUTION) {
            const bizResult = await resolveBusiness(session, metaRow, instruction, state);
            if (bizResult.complete) {
                updates = { 
                    ...updates, 
                    businessId: bizResult.businessId,
                    businessName: bizResult.businessName, 
                    businessCategory: bizResult.businessCategory, // Persist Category
                    stage: CREATIVE_STAGES.SERVICE_CONTEXT 
                };
                if (bizResult.logoUrl) {
                    updates.assets = { ...state.assets, logoUrl: bizResult.logoUrl };
                }
                state = { ...state, ...updates }; // Advance immediately
            } else {
                return { response: { ok: true, text: bizResult.question } };
            }
        }
        
        // Update saveId if we just resolved the business
        const currentSaveId = saveId || state.businessId;

        // --- STAGE 2: SERVICE CONTEXT (MANDATORY LOCK) ---
        if (state.stage === CREATIVE_STAGES.SERVICE_CONTEXT) {
            const ctxResult = resolveContext(instruction, state);
            updates = { ...updates, ...ctxResult.updates };
            state = { ...state, ...updates };

            if (state.context.serviceLocked) {
                updates.stage = CREATIVE_STAGES.OFFER_CONTEXT;
                state.stage = CREATIVE_STAGES.OFFER_CONTEXT;
                
                // CRITICAL FIX: Immediately persist the locked service state.
                // This prevents the "loop" where the state isn't saved before the next turn.
                await saveCreativeState(supabase, email, currentSaveId, updates);
                
            } else {
                await saveCreativeState(supabase, email, currentSaveId, updates);
                return { response: { ok: true, text: ctxResult.question } };
            }
        }

        // --- STAGE 3: OFFER CONTEXT ---
        if (state.stage === CREATIVE_STAGES.OFFER_CONTEXT) {
             const ctxResult = resolveContext(instruction, state);
             updates = { ...updates, ...ctxResult.updates };
             state = { ...state, ...updates };
             
             if (state.context.offerLocked) {
                 updates.stage = CREATIVE_STAGES.CONTACT_PREFERENCE;
                 state.stage = CREATIVE_STAGES.CONTACT_PREFERENCE;
             } else {
                 await saveCreativeState(supabase, email, currentSaveId, updates);
                 return { response: { ok: true, text: ctxResult.question } };
             }
        }

        // --- STAGE 4: CONTACT PREFERENCE ---
        if (state.stage === CREATIVE_STAGES.CONTACT_PREFERENCE) {
             const assetResult = await resolveAssets(supabase, state, instruction, metaRow);
             updates = { ...updates, ...assetResult.updates };
             state = { ...state, ...updates };

             if (state.assets.contactLocked) {
                 updates.stage = CREATIVE_STAGES.ASSET_CONFIRMATION;
                 state.stage = CREATIVE_STAGES.ASSET_CONFIRMATION;
             } else {
                 await saveCreativeState(supabase, email, currentSaveId, updates);
                 return { response: { ok: true, text: assetResult.question } };
             }
        }

        // --- STAGE 5: ASSET CONFIRMATION ---
        if (state.stage === CREATIVE_STAGES.ASSET_CONFIRMATION) {
             const assetResult = await resolveAssets(supabase, state, instruction, metaRow);
             updates = { ...updates, ...assetResult.updates };
             state = { ...state, ...updates };

             if (state.assets.assetsConfirmed) {
                 updates.stage = CREATIVE_STAGES.LOGO_DECISION;
                 state.stage = CREATIVE_STAGES.LOGO_DECISION;
             } else {
                 await saveCreativeState(supabase, email, currentSaveId, updates);
                 return { response: { ok: true, text: assetResult.question } };
             }
        }

        // --- STAGE 6: LOGO DECISION ---
        if (state.stage === CREATIVE_STAGES.LOGO_DECISION) {
             const assetResult = await resolveAssets(supabase, state, instruction, metaRow);
             updates = { ...updates, ...assetResult.updates };
             state = { ...state, ...updates };

             if (state.assets.logoLocked) {
                 updates.stage = CREATIVE_STAGES.CONTENT_GENERATION;
                 state.stage = CREATIVE_STAGES.CONTENT_GENERATION;
             } else {
                 await saveCreativeState(supabase, email, currentSaveId, updates);
                 return { response: { ok: true, text: assetResult.question } };
             }
        }

        // --- STAGE 7: CONTENT GENERATION ---
        if (state.stage === CREATIVE_STAGES.CONTENT_GENERATION) {
            // Parallel Generation
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
            state = { ...state, ...updates };
        }

        // --- STAGE 8: PREVIEW & PUBLISH ---
        if (state.stage === CREATIVE_STAGES.PREVIEW) {
            // Check for User Feedback vs Confirmation
            // We require EXPLICIT confirmation to set ready_to_publish
            const isConfirmation = instruction.match(/\b(yes|publish|go ahead|confirm)\b/i); 
            const isCorrection = !isConfirmation && instruction.length > 3;

            if (isConfirmation) {
                // HARD GATE: Only set ready_to_publish here
                updates = { ...updates, ready_to_publish: true, stage: CREATIVE_STAGES.COMPLETED };
                await saveCreativeState(supabase, email, currentSaveId, updates);
                
                // RETURN ASSETS ONLY HERE
                return { 
                    assets: {
                        imageUrl: state.content.imageUrl,
                        caption: `${state.content.caption}\n\n${state.content.hashtags.join(" ")}`
                    }
                };
            } else if (isCorrection) {
                // Determine what to change
                const lower = instruction.toLowerCase();
                if (lower.includes("image") || lower.includes("photo") || lower.includes("picture")) {
                    updates = { ...updates, stage: CREATIVE_STAGES.CONTENT_GENERATION };
                    await saveCreativeState(supabase, email, currentSaveId, updates);
                    // Recursively call to regenerate immediately
                    return await creativeEntry({ supabase, session, instruction: "retry", metaRow, effectiveBusinessId: currentSaveId });
                } else {
                     // Assume Caption/Context change
                     updates = { 
                         ...updates, 
                         context: { ...state.context, rawIntent: state.context.rawIntent + " " + instruction },
                         stage: CREATIVE_STAGES.CONTENT_GENERATION 
                     };
                     await saveCreativeState(supabase, email, currentSaveId, updates);
                     return await creativeEntry({ supabase, session, instruction: "retry", metaRow, effectiveBusinessId: currentSaveId });
                }
            }

            // Show Preview (Default)
            const previewText = composePreview(state);
            await saveCreativeState(supabase, email, currentSaveId, updates);
            // DO NOT RETURN ASSETS HERE
            return { response: { ok: true, text: previewText } };
        }

        // --- STAGE: COMPLETED ---
        if (state.stage === CREATIVE_STAGES.COMPLETED) {
             await clearCreativeState(supabase, email, currentSaveId);
             return { response: { ok: true, text: "Previous post completed. Starting new..." } };
        }

        // Default Save
        await saveCreativeState(supabase, email, currentSaveId, updates);
        return { response: { ok: false, text: "Processing..." } };

    } catch (e) {
        console.error("Creative Entry Error:", e);
        return { response: { ok: false, text: `Creative Mode Error: ${e.message}` } };
    }
}
