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

    // 2. State Machine
    try {
        // --- STAGE: BUSINESS RESOLUTION ---
        if (state.stage === CREATIVE_STAGES.BUSINESS_RESOLUTION) {
            const bizResult = await resolveBusiness(session, metaRow, instruction, state);
            if (bizResult.complete) {
                updates = { 
                    ...updates, 
                    businessId: bizResult.businessId,
                    businessName: bizResult.businessName,
                    stage: CREATIVE_STAGES.CONTEXT_RESOLUTION 
                };
                if (bizResult.logoUrl) {
                    updates.assets = { ...state.assets, logoUrl: bizResult.logoUrl };
                }
                // Fall through to next stage immediately
                state = { ...state, ...updates }; 
            } else {
                return { response: { ok: true, text: bizResult.question } };
            }
        }

        // --- STAGE: CONTEXT RESOLUTION ---
        if (state.stage === CREATIVE_STAGES.CONTEXT_RESOLUTION) {
            const ctxResult = resolveContext(instruction, state);
            
            // Update context regardless of completeness
            updates = { ...updates, context: { ...state.context, ...ctxResult.context } };
            state = { ...state, ...updates };

            if (ctxResult.complete) {
                updates.stage = CREATIVE_STAGES.ASSET_RESOLUTION;
                state.stage = CREATIVE_STAGES.ASSET_RESOLUTION;
            } else {
                await saveCreativeState(supabase, email, effectiveBusinessId, updates);
                return { response: { ok: true, text: ctxResult.question } };
            }
        }

        // --- STAGE: ASSET RESOLUTION ---
        if (state.stage === CREATIVE_STAGES.ASSET_RESOLUTION) {
            const assetResult = await resolveAssets(supabase, state, effectiveBusinessId);
            updates = { ...updates, assets: assetResult.assets, stage: CREATIVE_STAGES.CONTENT_GENERATION };
            state = { ...state, ...updates };
        }

        // --- STAGE: CONTENT GENERATION ---
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

        // --- STAGE: PREVIEW ---
        if (state.stage === CREATIVE_STAGES.PREVIEW) {
            // Check for User Feedback vs Confirmation
            const isConfirmation = instruction.match(/\b(yes|ok|publish|confirm|go ahead)\b/i);
            const isCorrection = !isConfirmation && instruction.length > 5; // Simple heuristic

            if (isConfirmation) {
                // HAND OFF TO EXECUTE.JS
                // We save the state as "COMPLETED" locally, but execute.js will handle the actual publish.
                await saveCreativeState(supabase, email, effectiveBusinessId, { ...updates, stage: CREATIVE_STAGES.COMPLETED });
                
                return { 
                    assets: {
                        imageUrl: state.content.imageUrl,
                        caption: `${state.content.caption}\n\n${state.content.hashtags.join(" ")}`
                    }
                };
            } else if (isCorrection) {
                // User wants changes. 
                // Determine what to change (Caption or Image or Context)
                // For MVP, if they say "image", regenerate image. Else caption.
                const lower = instruction.toLowerCase();
                if (lower.includes("image") || lower.includes("photo") || lower.includes("picture")) {
                    // Reset to CONTENT_GENERATION but keep context
                    // Ideally we should update prompt, but for now we just regenerate
                    updates = { ...updates, stage: CREATIVE_STAGES.CONTENT_GENERATION }; // Will loop back next turn? No, we need to re-run generation now?
                    // To keep it simple, we save state and ask "Regenerating...".
                    // But actually, we can just loop back if we change stage variable and use a while loop? 
                    // For safety, let's just save and return "Regenerating".
                    // Better: We are in a function. We can just set stage and fall through if we structured it as a loop.
                    // But here we used `if` blocks.
                    // Let's just handle it by resetting stage and telling user to confirm.
                    
                    await saveCreativeState(supabase, email, effectiveBusinessId, { ...updates, stage: CREATIVE_STAGES.CONTENT_GENERATION });
                    // We need to actually RUN the generation again immediately? 
                    // No, next turn.
                    // But user expects immediate response.
                    // Let's just return a message "Regenerating image..." and set stage. 
                    // The next user message will trigger generation? No, that requires user input.
                    // We need to auto-trigger.
                    // Recursion?
                    return await creativeEntry({ supabase, session, instruction: "retry", metaRow, effectiveBusinessId });
                } else {
                     // Assume Caption/Context change
                     updates = { 
                         ...updates, 
                         context: { ...state.context, rawIntent: state.context.rawIntent + " " + instruction },
                         stage: CREATIVE_STAGES.CONTENT_GENERATION 
                     };
                     await saveCreativeState(supabase, email, effectiveBusinessId, updates);
                     return await creativeEntry({ supabase, session, instruction: "retry", metaRow, effectiveBusinessId });
                }
            }

            // Show Preview
            const previewText = composePreview(state);
            await saveCreativeState(supabase, email, effectiveBusinessId, updates);
            return { response: { ok: true, text: previewText } };
        }

        // --- STAGE: COMPLETED ---
        if (state.stage === CREATIVE_STAGES.COMPLETED) {
             // If we are here, it means we already published?
             // Or user is talking after publish.
             // Reset?
             await clearCreativeState(supabase, email, effectiveBusinessId);
             return { response: { ok: true, text: "Previous post completed. Starting new..." } };
        }

        // Default Save
        await saveCreativeState(supabase, email, effectiveBusinessId, updates);
        return { response: { ok: false, text: "Processing..." } };

    } catch (e) {
        console.error("Creative Entry Error:", e);
        return { response: { ok: false, text: `Creative Mode Error: ${e.message}` } };
    }
}
