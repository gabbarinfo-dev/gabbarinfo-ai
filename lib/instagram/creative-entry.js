// lib/instagram/creative-entry.js
import { CREATIVE_STAGES, DEFAULT_CREATIVE_STATE } from "./creative-constants";
import { loadCreativeState, saveCreativeState, clearCreativeState } from "./creative-memory";
import { resolveBusiness } from "./resolve-business";
import { resolveContext } from "./resolve-context";
import { resolveAssets } from "./resolve-assets";
import { generateCaption } from "./generate-caption";
import { generateImage } from "./generate-image";
import { composePreview } from "./compose-preview";

export async function creativeEntry({ supabase, session, instruction, metaRow }) {
    const email = session.user.email.toLowerCase();

    // 1. Load State
    let state = await loadCreativeState(supabase, email);

    // 2. Resolve Session ID
    let creativeSessionId = state.creativeSessionId;
    if (!creativeSessionId) {
        creativeSessionId = `ig_creative_${Date.now()}`;
        state = { ...DEFAULT_CREATIVE_STATE, creativeSessionId };
        await saveCreativeState(supabase, email, creativeSessionId, state);
        state = await loadCreativeState(supabase, email);
    }

    // 0. Global Resets
    if (instruction.match(/\b(cancel|stop|start over|reset)\b/i)) {
        await clearCreativeState(supabase, email, creativeSessionId);
        return { response: { ok: true, text: "Creative mode canceled. How can I help?", mode: "instagram_post" } };
    }

    try {
        // --- STAGE 1: BUSINESS RESOLUTION (Decision) ---
        if (state.stage === CREATIVE_STAGES.BUSINESS_RESOLUTION) {
            const bizResult = await resolveBusiness(session, metaRow, state);
            if (bizResult.complete) {
                state.stage = CREATIVE_STAGES.SERVICE_CONTEXT;
                await saveCreativeState(supabase, email, creativeSessionId, state);
                return { response: { ok: true, text: "Business already selected. Proceeding to service details.", mode: "instagram_post" } };
            } else {
                state.stage = CREATIVE_STAGES.BUSINESS_RESOLUTION_WAITING;
                await saveCreativeState(supabase, email, creativeSessionId, state);
                return { response: { ok: true, text: bizResult.question, mode: "instagram_post" } };
            }
        }

        // --- STAGE 1B: BUSINESS_RESOLUTION_WAITING (Consumption) ---
        if (state.stage === CREATIVE_STAGES.BUSINESS_RESOLUTION_WAITING) {
            // Fetch accounts and match instruction
            const accessToken = metaRow.fb_user_access_token;
            const url = `https://graph.facebook.com/v21.0/me/accounts?fields=name,category,id,instagram_business_account{id,username,profile_picture_url}&access_token=${accessToken}`;
            const res = await fetch(url);
            const data = await res.json();
            const validAccounts = (data.data || []).filter(p => p.instagram_business_account);

            const lowerInst = instruction.toLowerCase();
            const matched = validAccounts.find(acc =>
                lowerInst.includes(acc.name.toLowerCase()) ||
                lowerInst.includes(acc.instagram_business_account.username.toLowerCase()) ||
                (validAccounts.length === 1 && (lowerInst.includes("yes") || lowerInst.includes("sure") || lowerInst.includes("ok")))
            );

            if (matched) {
                // SINGLE AUTHORITY assignment
                state.businessId = matched.instagram_business_account.id;
                state.businessName = matched.instagram_business_account.username;
                state.businessCategory = matched.category || metaRow?.category || null;

                state.stage = CREATIVE_STAGES.SERVICE_CONTEXT;
                await saveCreativeState(supabase, email, creativeSessionId, state);
                return { response: { ok: true, text: `Account @${state.businessName} selected. Next: Service details.`, mode: "instagram_post" } };
            } else {
                return { response: { ok: true, text: "I couldn't match that account. Please provide the username or name mentioned above.", mode: "instagram_post" } };
            }
        }

        // --- STAGE 2: SERVICE_CONTEXT (Decision) ---
        if (state.stage === CREATIVE_STAGES.SERVICE_CONTEXT) {
            const ctxResult = resolveContext(state);
            if (ctxResult.complete) {
                state.stage = CREATIVE_STAGES.OFFER_CONTEXT;
                await saveCreativeState(supabase, email, creativeSessionId, state);
                return { response: { ok: true, text: "Service finalized. Next: Offer details.", mode: "instagram_post" } };
            } else {
                state.stage = CREATIVE_STAGES.SERVICE_CONTEXT_WAITING;
                state.context.questions.service.asked = true;
                await saveCreativeState(supabase, email, creativeSessionId, state);
                return { response: { ok: true, text: ctxResult.question, mode: "instagram_post" } };
            }
        }

        // --- STAGE 2B: SERVICE_CONTEXT_WAITING (Consumption) ---
        if (state.stage === CREATIVE_STAGES.SERVICE_CONTEXT_WAITING) {
            // SINGLE AUTHORITY assignment
            state.context.service = instruction.trim();
            state.context.serviceLocked = true;
            state.context.questions.service.answered = true;
            state.stage = CREATIVE_STAGES.OFFER_CONTEXT;

            await saveCreativeState(supabase, email, creativeSessionId, state);
            return { response: { ok: true, text: "Service noted. Let's discuss the offer.", mode: "instagram_post" } };
        }

        // --- STAGE 3: OFFER_CONTEXT (Decision) ---
        if (state.stage === CREATIVE_STAGES.OFFER_CONTEXT) {
            const ctxResult = resolveContext(state);
            if (ctxResult.complete) {
                state.stage = CREATIVE_STAGES.CONTACT_PREFERENCE;
                await saveCreativeState(supabase, email, creativeSessionId, state);
                return { response: { ok: true, text: "Offer finalized. Next: Contact preferences.", mode: "instagram_post" } };
            } else {
                state.stage = CREATIVE_STAGES.OFFER_CONTEXT_WAITING;
                state.context.questions.offer.asked = true;
                await saveCreativeState(supabase, email, creativeSessionId, state);
                return { response: { ok: true, text: ctxResult.question, mode: "instagram_post" } };
            }
        }

        // --- STAGE 3B: OFFER_CONTEXT_WAITING (Consumption) ---
        if (state.stage === CREATIVE_STAGES.OFFER_CONTEXT_WAITING) {
            // SINGLE AUTHORITY assignment
            const offerText = instruction.trim();
            const hasOffer = !offerText.match(/\b(none|no|skip|nothing|na)\b/i);
            state.context.offer = hasOffer ? offerText : null;
            state.context.offerLocked = true;
            state.context.questions.offer.answered = true;
            state.stage = CREATIVE_STAGES.CONTACT_PREFERENCE;

            await saveCreativeState(supabase, email, creativeSessionId, state);
            return { response: { ok: true, text: "Offer captures. Proceeding to contact methods.", mode: "instagram_post" } };
        }

        // --- STAGE 4: CONTACT_PREFERENCE (Decision) ---
        if (state.stage === CREATIVE_STAGES.CONTACT_PREFERENCE) {
            const assetResult = await resolveAssets(supabase, state, metaRow);
            if (assetResult.complete) {
                state.stage = CREATIVE_STAGES.ASSET_CONFIRMATION;
                await saveCreativeState(supabase, email, creativeSessionId, state);
                return { response: { ok: true, text: "Checking stored assets.", mode: "instagram_post" } };
            } else {
                state.stage = CREATIVE_STAGES.CONTACT_PREFERENCE_WAITING;
                state.assets.questions.contact.asked = true;
                await saveCreativeState(supabase, email, creativeSessionId, state);
                return { response: { ok: true, text: assetResult.question, mode: "instagram_post" } };
            }
        }

        // --- STAGE 4B: CONTACT_PREFERENCE_WAITING (Consumption) ---
        if (state.stage === CREATIVE_STAGES.CONTACT_PREFERENCE_WAITING) {
            // SINGLE AUTHORITY assignment
            const lower = instruction.toLowerCase();
            let method = "none";
            if (lower.includes("website")) method = "website";
            else if (lower.includes("call") || lower.includes("phone")) method = "phone";
            else if (lower.includes("whatsapp")) method = "whatsapp";

            state.assets.contactMethod = method;
            state.assets.contactLocked = true;
            state.assets.questions.contact.answered = true;
            state.stage = CREATIVE_STAGES.ASSET_CONFIRMATION;

            await saveCreativeState(supabase, email, creativeSessionId, state);
            return { response: { ok: true, text: `Contact method set to ${method}. Moving to verification.`, mode: "instagram_post" } };
        }

        // --- STAGE 5: ASSET_CONFIRMATION (Decision) ---
        if (state.stage === CREATIVE_STAGES.ASSET_CONFIRMATION) {
            const assetResult = await resolveAssets(supabase, state, metaRow);
            if (assetResult.complete) {
                state.stage = CREATIVE_STAGES.LOGO_DECISION;
                await saveCreativeState(supabase, email, creativeSessionId, state);
                return { response: { ok: true, text: "Assets confirmed. Finalizing design.", mode: "instagram_post" } };
            } else {
                state.stage = CREATIVE_STAGES.ASSET_CONFIRMATION_WAITING;
                state.assets.questions.assets.asked = true;
                await saveCreativeState(supabase, email, creativeSessionId, state);
                return { response: { ok: true, text: assetResult.question, mode: "instagram_post" } };
            }
        }

        // --- STAGE 5B: ASSET_CONFIRMATION_WAITING (Consumption) ---
        if (state.stage === CREATIVE_STAGES.ASSET_CONFIRMATION_WAITING) {
            // SINGLE AUTHORITY assignment
            const method = state.assets.contactMethod;
            let website = state.assets.websiteUrl || (method === "website" ? instruction.match(/(https?:\/\/[^\s]+|www\.[^\s]+|[a-zA-Z0-9-]+\.[a-z]{2,})/i)?.[0] : null);
            let phone = state.assets.phone || ((method === "phone" || method === "whatsapp") ? instruction.match(/(\+?\d[\d\s-]{8,})/)?.[0] : null);

            state.assets.websiteUrl = website || state.assets.websiteUrl;
            state.assets.phone = phone || state.assets.phone;
            state.assets.assetsConfirmed = (method === "website" ? !!website : (method === "phone" || method === "whatsapp" ? !!phone : true));
            state.assets.questions.assets.answered = true;
            state.stage = CREATIVE_STAGES.LOGO_DECISION;

            await saveCreativeState(supabase, email, creativeSessionId, state);
            return { response: { ok: true, text: "Asset data updated.", mode: "instagram_post" } };
        }

        // --- STAGE 6: LOGO_DECISION (Decision/Automatic) ---
        if (state.stage === CREATIVE_STAGES.LOGO_DECISION) {
            // SINGLE AUTHORITY for logoUrl
            let finalLogo = state.assets.logoUrl || metaRow?.logo || metaRow?.logo_url;
            state.assets.logoUrl = finalLogo || null;
            state.assets.logoDecision = finalLogo ? "use_logo" : "use_text";
            state.assets.logoLocked = true;
            state.stage = CREATIVE_STAGES.CONTENT_GENERATION;

            await saveCreativeState(supabase, email, creativeSessionId, state);
            return { response: { ok: true, text: "Generating creative content...", mode: "instagram_post" } };
        }

        // --- STAGE 7: CONTENT GENERATION (Process) ---
        if (state.stage === CREATIVE_STAGES.CONTENT_GENERATION) {
            const [captionData, imageData] = await Promise.all([
                generateCaption(state),
                generateImage(state)
            ]);
            // SINGLE AUTHORITY for content
            state.content = {
                ...state.content,
                caption: captionData.caption,
                hashtags: captionData.hashtags,
                imageUrl: imageData.imageUrl,
                imagePrompt: imageData.imagePrompt
            };
            state.stage = CREATIVE_STAGES.PREVIEW;
            await saveCreativeState(supabase, email, creativeSessionId, state);

            // HARD RETURN: No fallthrough, return preview text directly
            const previewText = composePreview(state);
            return { response: { ok: true, text: previewText, mode: "instagram_post" } };
        }

        // --- STAGE 8: PREVIEW & PUBLISH (Wait for confirmation) ---
        if (state.stage === CREATIVE_STAGES.PREVIEW) {
            const isConfirmation = instruction.match(/\b(yes|publish|go ahead|confirm)\b/i);
            if (isConfirmation) {
                // 🔥 FIX 2: SIGNAL "READY TO PUBLISH"
                // Do NOT clear state or say "Post flow completed". 
                // execute.js will handle the hand-off to Path A.
                return {
                    intent: "PUBLISH_INSTAGRAM_POST",
                    payload: {
                        imageUrl: state.content.imageUrl,
                        caption: `${state.content.caption}\n\n${state.content.hashtags.join(" ")}`
                    }
                };
            }
            const previewText = composePreview(state);
            return { response: { ok: true, text: previewText, mode: "instagram_post" } };
        }

        if (state.stage === CREATIVE_STAGES.COMPLETED) {
            await clearCreativeState(supabase, email, creativeSessionId);
            return { response: { ok: true, text: "Post flow completed.", mode: "instagram_post" } };
        }

        return { response: { ok: false, text: "FSM internal limit reached.", mode: "instagram_post" } };

    } catch (e) {
        console.error("Creative Entry Error:", e);
        return { response: { ok: false, text: `FSM Error: ${e.message}`, mode: "instagram_post" } };
    }
}
