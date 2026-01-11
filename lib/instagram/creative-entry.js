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
        
        // --- STAGE 2: SERVICE_CONTEXT ---
        if (state.stage === CREATIVE_STAGES.SERVICE_CONTEXT) {
            const ctxResult = resolveContext(instruction, state);
            updates = { ...updates, ...ctxResult.updates };
            
            if (ctxResult.complete) {
                updates.stage = CREATIVE_STAGES.OFFER_CONTEXT;
            } else {
                // 🔒 Freeze FSM: we are now waiting for service answer
                updates.context = { 
                    ...(state.context || {}), 
                    questions: { 
                        ...(state.context?.questions || {}), 
                        service: { asked: true, answered: false } 
                    } 
                };
                updates.stage = CREATIVE_STAGES.SERVICE_CONTEXT_WAITING;
            }

            const nextState = { ...state, ...updates };
            await saveCreativeState(supabase, email, creativeSessionId, nextState);
            state = nextState;

            if (state.stage === CREATIVE_STAGES.SERVICE_CONTEXT_WAITING) {
                return { response: { ok: true, text: ctxResult.question } };
            }
        }

        // --- STAGE 2B: SERVICE_CONTEXT_WAITING ---
        if (state.stage === CREATIVE_STAGES.SERVICE_CONTEXT_WAITING) {
             // treat ANY user input as the service answer
             const nextState = {
                 ...state,
                 context: { 
                     ...state.context, 
                     service: instruction, 
                     serviceLocked: true, 
                     questions: { 
                         ...state.context.questions, 
                         service: { asked: true, answered: true } 
                     } 
                 },
                 stage: CREATIVE_STAGES.OFFER_CONTEXT
             };
             
             await saveCreativeState(supabase, email, creativeSessionId, nextState);
             
             // STOP EXECUTION: One step per turn
             // Return "Processing..." to allow client to trigger next step naturally if needed, 
             // or just acknowledge. Since we want to move fast, we can return a hidden acknowledgement
             // or a simple text that will be displayed. 
             // Ideally we want to immediately prompt the NEXT question.
             // But the user rule is STRICT: "RETURN immediately".
             // If we return "Got it", the user sees "Got it". Then they have to type something to trigger the next step?
             // Ah, if we return text, the agent outputs text. The user then has to reply.
             // This might slow down the flow (User: Laundry -> Agent: Got it -> User: ???)
             // BUT this guarantees no loop.
             // To make it smooth, we can return the NEXT question immediately here?
             // No, that violates "Asking happens in one request".
             // Wait, if we return "Got it", the user is stuck until they say "Next".
             // UNLESS we recursively call ourselves? No, "FSM != recursive function".
             // So we MUST return text. 
             // Let's return a transition phrase that prompts the next step implicitly?
             // actually, the next step is OFFER. 
             // If we return "Service noted.", the user says "Ok". Then we ask "Any offer?".
             // This is safe.
             
             return { response: { ok: true, text: "Got it. Let's continue." } };
        }

        // --- STAGE 3: OFFER_CONTEXT ---
        if (state.stage === CREATIVE_STAGES.OFFER_CONTEXT) {
             const ctxResult = resolveContext(instruction, state);
             updates = { ...updates, ...ctxResult.updates };
             
             if (ctxResult.complete) {
                 updates.stage = CREATIVE_STAGES.CONTACT_PREFERENCE;
             } else {
                 // 🔒 Freeze FSM: we are now waiting for offer answer
                 updates.context = { 
                     ...(state.context || {}), 
                     questions: { 
                         ...(state.context?.questions || {}), 
                         offer: { asked: true, answered: false } 
                     } 
                 };
                 updates.stage = CREATIVE_STAGES.OFFER_CONTEXT_WAITING;
             }
             
             const nextState = { ...state, ...updates };
             await saveCreativeState(supabase, email, creativeSessionId, nextState);
             state = nextState;

             if (state.stage === CREATIVE_STAGES.OFFER_CONTEXT_WAITING) {
                 return { response: { ok: true, text: ctxResult.question } };
             }
        }

        // --- STAGE 3B: OFFER_CONTEXT_WAITING ---
        if (state.stage === CREATIVE_STAGES.OFFER_CONTEXT_WAITING) {
             const offer = instruction.trim();
             const hasOffer = !offer.match(/\b(none|no|skip|nothing|na)\b/i);

             const nextState = {
                 ...state,
                 context: { 
                     ...state.context, 
                     offer: hasOffer ? offer : null,
                     offerLocked: true, 
                     questions: { 
                         ...state.context.questions, 
                         offer: { asked: true, answered: true } 
                     } 
                 },
                 stage: CREATIVE_STAGES.CONTACT_PREFERENCE
             };
             
             await saveCreativeState(supabase, email, creativeSessionId, nextState);
             
             return { response: { ok: true, text: "Understood." } };
        }

        // --- STAGE 4: CONTACT_PREFERENCE ---
        if (state.stage === CREATIVE_STAGES.CONTACT_PREFERENCE) {
             const assetResult = await resolveAssets(supabase, state, instruction, metaRow);
             updates = { ...updates, ...assetResult.updates };
             
             if (assetResult.complete) {
                 updates.stage = CREATIVE_STAGES.ASSET_CONFIRMATION;
             } else {
                 updates.assets = { 
                     ...(state.assets || {}), 
                     questions: { 
                         ...(state.assets?.questions || {}), 
                         contact: { asked: true, answered: false } 
                     } 
                 };
                 updates.stage = CREATIVE_STAGES.CONTACT_PREFERENCE_WAITING;
             }

             const nextState = { ...state, ...updates };
             await saveCreativeState(supabase, email, creativeSessionId, nextState);
             state = nextState;

             if (state.stage === CREATIVE_STAGES.CONTACT_PREFERENCE_WAITING) {
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
                         contactLocked: true,
                         questions: { ...state.assets.questions, contact: { asked: true, answered: true } }
                     },
                     stage: CREATIVE_STAGES.ASSET_CONFIRMATION
                 };
                 
                 await saveCreativeState(supabase, email, creativeSessionId, nextState);
                 
                 return { response: { ok: true, text: "Noted." } };
             } else {
                 return { response: { ok: true, text: "Please choose one: 'Website', 'Call', 'WhatsApp', or 'None'." } };
             }
        }

        // --- STAGE 5: ASSET_CONFIRMATION ---
        if (state.stage === CREATIVE_STAGES.ASSET_CONFIRMATION) {
             const assetResult = await resolveAssets(supabase, state, instruction, metaRow);
             updates = { ...updates, ...assetResult.updates };
             
             if (assetResult.complete) {
                 updates.stage = CREATIVE_STAGES.LOGO_DECISION;
             } else {
                 updates.assets = {
                      ...(state.assets || {}),
                      ...assetResult.updates?.assets, // preserve any partial updates from resolver
                      questions: {
                          ...(state.assets?.questions || {}),
                          assets: { asked: true, answered: false }
                      }
                 };
                 updates.stage = CREATIVE_STAGES.ASSET_CONFIRMATION_WAITING;
             }

             const nextState = { ...state, ...updates };
             await saveCreativeState(supabase, email, creativeSessionId, nextState);
             state = nextState;

             if (state.stage === CREATIVE_STAGES.ASSET_CONFIRMATION_WAITING) {
                 return { response: { ok: true, text: assetResult.question } };
             }
        }

        // --- STAGE 5B: ASSET_CONFIRMATION_WAITING ---
        if (state.stage === CREATIVE_STAGES.ASSET_CONFIRMATION_WAITING) {
             // Re-run resolver to parse input (phone/website regex)
             // We need to pass the current state which has the 'asked' flag set
             const assetResult = await resolveAssets(supabase, state, instruction, metaRow);
             updates = { ...updates, ...assetResult.updates };

             // If complete now, advance
             if (assetResult.complete || assetResult.updates?.assets?.assetsConfirmed) {
                 const nextState = { 
                     ...state, 
                     ...updates,
                     stage: CREATIVE_STAGES.LOGO_DECISION
                 };
                 await saveCreativeState(supabase, email, creativeSessionId, nextState);
                 
                 return { response: { ok: true, text: "Assets confirmed." } };
             } else {
                 // Still missing something?
                 return { response: { ok: true, text: assetResult.question } };
             }
        }

        // --- STAGE 6: LOGO_DECISION ---
        if (state.stage === CREATIVE_STAGES.LOGO_DECISION) {
             const assetResult = await resolveAssets(supabase, state, instruction, metaRow);
             updates = { ...updates, ...assetResult.updates };
             
             if (assetResult.complete) {
                 updates.stage = CREATIVE_STAGES.CONTENT_GENERATION;
             }
             // Logo decision usually auto-completes. If it needed to ask, we would add WAITING here.
             
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
                const nextState = { 
                    ...state, 
                    ...updates,
                    ready_to_publish: true, 
                    stage: CREATIVE_STAGES.COMPLETED 
                };
                await saveCreativeState(supabase, email, creativeSessionId, nextState);
                
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
                    feedbackText = "Regenerating image...";
                } else {
                     updates = { 
                         ...updates, 
                         context: { ...state.context, rawIntent: state.context.rawIntent + " " + instruction },
                         stage: CREATIVE_STAGES.CONTENT_GENERATION 
                     };
                     feedbackText = "Updating content...";
                }

                const nextState = { ...state, ...updates };
                await saveCreativeState(supabase, email, creativeSessionId, nextState);
                return { response: { ok: true, text: feedbackText } };
            }

            const previewText = composePreview(state);
            await saveCreativeState(supabase, email, creativeSessionId, state);
            return { response: { ok: true, text: previewText } };
        }

        // --- STAGE: COMPLETED ---
        if (state.stage === CREATIVE_STAGES.COMPLETED) {
             await clearCreativeState(supabase, email, creativeSessionId);
             return { response: { ok: true, text: "Previous post completed. Starting new..." } };
        }

        const finalState = { ...state, ...updates };
        await saveCreativeState(supabase, email, creativeSessionId, finalState);
        return { response: { ok: false, text: "Processing..." } };

    } catch (e) {
        console.error("Creative Entry Error:", e);
        return { response: { ok: false, text: `Creative Mode Error: ${e.message}` } };
    }
}

