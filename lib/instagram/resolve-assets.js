// lib/instagram/resolve-assets.js


export async function resolveAssets(supabase, state, instruction, metaRow) {
    // 1. Contact Preference
    if (!state.assets.contactLocked) {
        // Check if question was asked
        if (state.assets.questions.contact.asked && !state.assets.questions.contact.answered) {
            const lower = instruction.toLowerCase();
            let method = null;
            if (lower.includes("website")) method = "website";
            else if (lower.includes("call") || lower.includes("phone")) method = "phone";
            else if (lower.includes("whatsapp")) method = "whatsapp";
            else if (lower.includes("none")) method = "none";

            if (method) {
                return {
                    complete: false,
                    updates: { 
                        assets: { 
                            ...state.assets, 
                            contactMethod: method, 
                            contactLocked: true,
                            questions: { ...state.assets.questions, contact: { asked: true, answered: true } }
                        } 
                    }
                };
            } else {
                 return {
                    complete: false,
                    question: "Please choose one: 'Website', 'Call', 'WhatsApp', or 'None'."
                 };
            }
        }

        // First time asking
        return {
            complete: false,
            updates: { assets: { ...state.assets, questions: { ...state.assets.questions, contact: { asked: true, answered: false } } } },
            question: "How should customers contact you? (Reply: 'Website', 'Call', 'WhatsApp', or 'None')"
        };
    }

    // 2. Asset Confirmation (Supabase First - Priority Logic)
    if (!state.assets.assetsConfirmed) {
        const method = state.assets.contactMethod;
        const needsWebsite = method === "website";
        const needsPhone = method === "phone" || method === "whatsapp";

        // Retrieve known values (State > Supabase)
        let website = state.assets.websiteUrl || metaRow?.website;
        let phone = state.assets.phone || metaRow?.phone;

        // Check if we have required data
        const missingWebsite = needsWebsite && !website;
        const missingPhone = needsPhone && !phone;

        // If we have everything needed for the chosen method, AUTO-CONFIRM
        if (!missingWebsite && !missingPhone) {
             return {
                 complete: false,
                 updates: { 
                     assets: { 
                         ...state.assets, 
                         assetsConfirmed: true,
                         websiteUrl: website || null,
                         phone: phone || null,
                         questions: { ...state.assets.questions, assets: { asked: true, answered: true } }
                     } 
                 }
             };
        }

        // If missing data, ask specifically for it
        if (state.assets.questions.assets.asked && !state.assets.questions.assets.answered) {
            // Extract from user input
            let updated = false;
            
            if (missingWebsite) {
                const urlMatch = instruction.match(/(https?:\/\/[^\s]+|www\.[^\s]+|[a-zA-Z0-9-]+\.[a-z]{2,})/i);
                if (urlMatch) {
                    website = urlMatch[0];
                    updated = true;
                }
            }
            
            if (missingPhone) {
                 const phoneMatch = instruction.match(/(\+?\d[\d\s-]{8,})/);
                 if (phoneMatch) {
                     phone = phoneMatch[0];
                     updated = true;
                 }
            }

            // If we found something, re-check completeness
            const stillMissingWebsite = needsWebsite && !website;
            const stillMissingPhone = needsPhone && !phone;

            if (!stillMissingWebsite && !stillMissingPhone) {
                return {
                    complete: false,
                    updates: { 
                        assets: { 
                            ...state.assets, 
                            assetsConfirmed: true,
                            websiteUrl: website || null,
                            phone: phone || null,
                            questions: { ...state.assets.questions, assets: { asked: true, answered: true } }
                        } 
                    }
                };
            }
            
            // Still missing something
            let q = "I need a bit more info.";
            if (stillMissingWebsite) q = "Please provide your Website URL.";
            else if (stillMissingPhone) q = "Please provide your Phone Number.";
            
            return { complete: false, question: q };
        }

        // First time asking for missing info
        let q = "I need some details.";
        if (missingWebsite && missingPhone) q = "Please provide your Website URL and Phone Number.";
        else if (missingWebsite) q = "Please provide your Website URL.";
        else if (missingPhone) q = "Please provide your Phone Number.";

        return {
            complete: false,
            updates: { assets: { ...state.assets, questions: { ...state.assets.questions, assets: { asked: true, answered: false } } } },
            question: q
        };
    }

    // 3. Logo Decision (Automatic Priority: Website/State -> Supabase -> Text)
    if (!state.assets.logoLocked) {
        // Priority 1: State (from FB scrape)
        // Priority 2: Supabase (metaRow)
        // Priority 3: Text (Fallback)
        
        let finalLogo = state.assets.logoUrl;
        if (!finalLogo && metaRow?.logo) finalLogo = metaRow.logo;
        if (!finalLogo && metaRow?.logo_url) finalLogo = metaRow.logo_url; // try both common names

        const decision = finalLogo ? "use_logo" : "use_text";
        
        return {
             complete: true,
             updates: { 
                 assets: { 
                     ...state.assets, 
                     logoDecision: decision, 
                     logoUrl: finalLogo || null,
                     logoLocked: true,
                     questions: { ...state.assets.questions, logo: { asked: true, answered: true } } // Mark as handled
                 } 
             }
         };
    }

    return { complete: true, updates: {} };
}
