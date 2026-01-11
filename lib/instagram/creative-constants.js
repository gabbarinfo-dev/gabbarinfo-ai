// lib/instagram/creative-constants.js


export const CREATIVE_STAGES = {
    BUSINESS_RESOLUTION: "BUSINESS_RESOLUTION",
    SERVICE_CONTEXT: "SERVICE_CONTEXT", // Mandatory First Step
    OFFER_CONTEXT: "OFFER_CONTEXT",
    CONTACT_PREFERENCE: "CONTACT_PREFERENCE",
    ASSET_CONFIRMATION: "ASSET_CONFIRMATION",
    LOGO_DECISION: "LOGO_DECISION",
    CONTENT_GENERATION: "CONTENT_GENERATION",
    PREVIEW: "PREVIEW",
    COMPLETED: "COMPLETED"
};

export const CREATIVE_INTENT = "instagram_creative";

export const DEFAULT_CREATIVE_STATE = {
    stage: CREATIVE_STAGES.BUSINESS_RESOLUTION,
    ready_to_publish: false, // HARD GATE: Must be true to return assets
    businessId: null,
    businessName: null,
    businessCategory: null, // From Supabase or FB
    context: {
        service: null, // MANDATORY
        offer: null,   // Optional
        rawIntent: null,
        serviceLocked: false, // Critical for loop prevention
        offerLocked: false,
        questions: {
            service: { asked: false, answered: false },
            offer: { asked: false, answered: false }
        }
    },
    assets: {
        websiteUrl: null,
        phone: null,
        whatsapp: null,
        city: null,
        logoUrl: null,
        
        contactMethod: null, // "website", "phone", "whatsapp", "none"
        contactLocked: false,
        
        assetsConfirmed: false, // For Supabase data confirmation
        
        logoDecision: null, // "use_logo", "use_text", "none"
        logoLocked: false,
        
        questions: {
            contact: { asked: false, answered: false },
            assets: { asked: false, answered: false },
            logo: { asked: false, answered: false }
        }
    },
    content: {
        caption: null,
        hashtags: [],
        imageUrl: null,
        imagePrompt: null,
        previewText: null
    },
    history: []
};

