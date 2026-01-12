
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
        
        // FIX: Do NOT reload state here. Trust the initialized state.
        // Reloading introduces a race condition if Supabase hasn't indexed the write yet.
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
                
                // STRICT: Immediate Save & Return to prevent loop/fall-through
                const nextState = { ...state, ...updates };
                await saveCreativeState(supabase, email, creativeSessionId, nextState);
                return { response: { ok: true, text: "Service confirmed." } };
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
             const service = instruction.trim();

             if (!service || service.length < 3) {
                 return { response: { ok: true, text: "Please tell me the service." } };
             }

             const nextState = {
                 ...state,
                 context: {
                     ...state.context,
                     service,
                     serviceLocked: true,
                     questions: {
                         ...state.context.questions,
                         service: { asked: true, answered: true }
                     }
                 },
                 stage: CREATIVE_STAGES.OFFER_CONTEXT
             };

             await saveCreativeState(supabase, email, creativeSessionId, nextState);
             return { response: { ok: true, text: "Service confirmed." } };
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
             const method = state.assets.contactMethod;
             const needsWebsite = method === "website";
             const needsPhone = method === "phone" || method === "whatsapp";

             let website = state.assets.websiteUrl || null;
             let phone = state.assets.phone || null;

             const missingWebsite = needsWebsite && !website;
             const missingPhone = needsPhone && !phone;

             if (missingWebsite) {
                 const urlMatch = instruction.match(/(https?:\/\/[^\s]+|www\.[^\s]+|[a-zA-Z0-9-]+\.[a-z]{2,})/i);
                 if (urlMatch) {
                     website = urlMatch[0];
                 }
             }

             if (missingPhone) {
                 const phoneMatch = instruction.match(/(\+?\d[\d\s-]{8,})/);
                 if (phoneMatch) {
                     phone = phoneMatch[0];
                 }
             }

             const stillMissingWebsite = needsWebsite && !website;
             const stillMissingPhone = needsPhone && !phone;

             if (!stillMissingWebsite && !stillMissingPhone) {
                 const nextState = {
                     ...state,
                     assets: {
                         ...state.assets,
                         assetsConfirmed: true,
                         websiteUrl: website,
                         phone: phone,
                         questions: { ...state.assets.questions, assets: { asked: true, answered: true } }
                     },
                     stage: CREATIVE_STAGES.LOGO_DECISION
                 };
                 await saveCreativeState(supabase, email, creativeSessionId, nextState);
                 return { response: { ok: true, text: "Assets confirmed." } };
             }

             let question = "I need a bit more info.";
             if (stillMissingWebsite && stillMissingPhone) question = "Please provide your Website URL and Phone Number.";
             else if (stillMissingWebsite) question = "Please provide your Website URL.";
             else if (stillMissingPhone) question = "Please provide your Phone Number.";

             const nextState = {
                 ...state,
                 assets: {
                     ...state.assets,
                     websiteUrl: website,
                     phone: phone,
                     questions: { ...state.assets.questions, assets: { asked: true, answered: false } }
                 },
                 stage: CREATIVE_STAGES.ASSET_CONFIRMATION_WAITING
             };
             await saveCreativeState(supabase, email, creativeSessionId, nextState);
             return { response: { ok: true, text: question } };
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
