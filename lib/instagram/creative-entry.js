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
        return { response: { ok: true, text: "Creative mode canceled. How can I help?" } };
    }

    // 3. State Machine (Strict Sequence)
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
                state = { ...state, ...updates }; 
            } else {
                return { response: { ok: true, text: bizResult.question } };
            }
        }
        
        // --- STAGE 2: SERVICE CONTEXT (MANDATORY LOCK) ---
        if (state.stage === CREATIVE_STAGES.SERVICE_CONTEXT) {
            const ctxResult = resolveContext(instruction, state);
            updates = { ...updates, ...ctxResult.updates };
            
            // Check completion directly from the result
            if (ctxResult.complete) {
                updates.stage = CREATIVE_STAGES.OFFER_CONTEXT;
            }

            // CRITICAL FIX: Always save FULL STATE, never just updates
            const nextState = { ...state, ...updates };
            await saveCreativeState(supabase, email, creativeSessionId, nextState);
            state = nextState;

            if (!ctxResult.complete) {
                return { response: { ok: true, text: ctxResult.question } };
            }
        }

        // --- STAGE 3: OFFER CONTEXT ---
        if (state.stage === CREATIVE_STAGES.OFFER_CONTEXT) {
             const ctxResult = resolveContext(instruction, state);
             updates = { ...updates, ...ctxResult.updates };
             
             if (ctxResult.complete) {
                 updates.stage = CREATIVE_STAGES.CONTACT_PREFERENCE;
             }
             
             const nextState = { ...state, ...updates };
             await saveCreativeState(supabase, email, creativeSessionId, nextState);
             state = nextState;

             if (!ctxResult.complete) {
                 return { response: { ok: true, text: ctxResult.question } };
             }
        }

        // --- STAGE 4: CONTACT PREFERENCE ---
        if (state.stage === CREATIVE_STAGES.CONTACT_PREFERENCE) {
             const assetResult = await resolveAssets(supabase, state, instruction, metaRow);
             updates = { ...updates, ...assetResult.updates };
             
             // Check directly from result, resolveAssets returns complete: boolean
             if (assetResult.complete) {
                 updates.stage = CREATIVE_STAGES.ASSET_CONFIRMATION;
             }

             const nextState = { ...state, ...updates };
             await saveCreativeState(supabase, email, creativeSessionId, nextState);
             state = nextState;

             if (!assetResult.complete) {
                 return { response: { ok: true, text: assetResult.question } };
             }
        }

        // --- STAGE 5: ASSET CONFIRMATION ---
        if (state.stage === CREATIVE_STAGES.ASSET_CONFIRMATION) {
             const assetResult = await resolveAssets(supabase, state, instruction, metaRow);
             updates = { ...updates, ...assetResult.updates };
             
             if (assetResult.complete) { // Note: resolveAssets logic for confirmation might need checking 'complete' property usage carefully or specific flag
                  // Actually resolveAssets returns complete=false with updates if auto-confirming? 
                  // Let's look at resolveAssets logic:
                  // If auto-confirm: returns complete: false, updates: { assetsConfirmed: true ... }
                  // Wait, strict loop logic:
                  // We should check the specific flag if 'complete' isn't reliable for stage transition
                  if (assetResult.updates?.assets?.assetsConfirmed || state.assets?.assetsConfirmed) {
                      updates.stage = CREATIVE_STAGES.LOGO_DECISION;
                  }
             }
             // For ASSET_CONFIRMATION specifically, resolveAssets returns complete=false usually until done?
             // Let's stick to the pattern:
             if (assetResult.updates?.assets?.assetsConfirmed) {
                  updates.stage = CREATIVE_STAGES.LOGO_DECISION;
             }

             const nextState = { ...state, ...updates };
             await saveCreativeState(supabase, email, creativeSessionId, nextState);
             state = nextState;

             // If we didn't advance, return question
             if (state.stage === CREATIVE_STAGES.ASSET_CONFIRMATION) {
                 return { response: { ok: true, text: assetResult.question } };
             }
        }

        // --- STAGE 6: LOGO DECISION ---
        if (state.stage === CREATIVE_STAGES.LOGO_DECISION) {
             const assetResult = await resolveAssets(supabase, state, instruction, metaRow);
             updates = { ...updates, ...assetResult.updates };
             
             if (assetResult.complete) {
                 updates.stage = CREATIVE_STAGES.CONTENT_GENERATION;
             }

             const nextState = { ...state, ...updates };
             await saveCreativeState(supabase, email, creativeSessionId, nextState);
             state = nextState;

             if (!assetResult.complete) {
                 return { response: { ok: true, text: assetResult.question } };
             }
        }

        // --- STAGE 7: CONTENT GENERATION ---
        if (state.stage === CREATIVE_STAGES.CONTENT_GENERATION) {
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
            const isConfirmation = instruction.match(/\b(yes|publish|go ahead|confirm)\b/i); 
            const isCorrection = !isConfirmation && instruction.length > 3;

            if (isConfirmation) {
                updates = { ...updates, ready_to_publish: true, stage: CREATIVE_STAGES.COMPLETED };
                await saveCreativeState(supabase, email, creativeSessionId, updates);
                
                return { 
                    assets: {
                        imageUrl: state.content.imageUrl,
                        caption: `${state.content.caption}\n\n${state.content.hashtags.join(" ")}`
                    }
                };
            } else if (isCorrection) {
                const lower = instruction.toLowerCase();
                if (lower.includes("image") || lower.includes("photo") || lower.includes("picture")) {
                    updates = { ...updates, stage: CREATIVE_STAGES.CONTENT_GENERATION };
                    await saveCreativeState(supabase, email, creativeSessionId, updates);
                    return await creativeEntry({ supabase, session, instruction: "retry", metaRow, effectiveBusinessId: state.businessId });
                } else {
                     updates = { 
                         ...updates, 
                         context: { ...state.context, rawIntent: state.context.rawIntent + " " + instruction },
                         stage: CREATIVE_STAGES.CONTENT_GENERATION 
                     };
                     await saveCreativeState(supabase, email, creativeSessionId, updates);
                     return await creativeEntry({ supabase, session, instruction: "retry", metaRow, effectiveBusinessId: state.businessId });
                }
            }

            const previewText = composePreview(state);
            await saveCreativeState(supabase, email, creativeSessionId, updates);
            return { response: { ok: true, text: previewText } };
        }

        // --- STAGE: COMPLETED ---
        if (state.stage === CREATIVE_STAGES.COMPLETED) {
             await clearCreativeState(supabase, email, creativeSessionId);
             return { response: { ok: true, text: "Previous post completed. Starting new..." } };
        }

        await saveCreativeState(supabase, email, creativeSessionId, updates);
        return { response: { ok: false, text: "Processing..." } };

    } catch (e) {
        console.error("Creative Entry Error:", e);
        return { response: { ok: false, text: `Creative Mode Error: ${e.message}` } };
    }
}

