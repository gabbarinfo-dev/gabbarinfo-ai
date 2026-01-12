// lib/instagram/creative-constants.js

export const CREATIVE_STAGES = {
    BUSINESS_RESOLUTION: "BUSINESS_RESOLUTION",
    BUSINESS_RESOLUTION_WAITING: "BUSINESS_RESOLUTION_WAITING", // Added
    SERVICE_CONTEXT: "SERVICE_CONTEXT",
    SERVICE_CONTEXT_WAITING: "SERVICE_CONTEXT_WAITING", // Added
    OFFER_CONTEXT: "OFFER_CONTEXT",
    OFFER_CONTEXT_WAITING: "OFFER_CONTEXT_WAITING", // Added
    CONTACT_PREFERENCE: "CONTACT_PREFERENCE",
    CONTACT_PREFERENCE_WAITING: "CONTACT_PREFERENCE_WAITING", // Added
    ASSET_CONFIRMATION: "ASSET_CONFIRMATION",
    ASSET_CONFIRMATION_WAITING: "ASSET_CONFIRMATION_WAITING", // Added
    LOGO_DECISION: "LOGO_DECISION",
    LOGO_DECISION_PROCESS: "LOGO_DECISION_PROCESS",
    LOGO_DECISION_WAITING: "LOGO_DECISION_WAITING",
    CONTENT_GENERATION: "CONTENT_GENERATION",
    PREVIEW: "PREVIEW",
    COMPLETED: "COMPLETED"
};

export const CREATIVE_INTENT = {
    CREATE_POST: "CREATE_POST"
};

export const DEFAULT_CREATIVE_STATE = {
    creativeSessionId: null, // New: Stable session ID
    stage: CREATIVE_STAGES.BUSINESS_RESOLUTION,
    businessId: null,
    businessName: null,
    businessCategory: null,
    confirmed: false,
    ready_to_publish: false, // Critical Gate

    // ... rest of the file
    context: {
        rawIntent: "",
        service: null,
        serviceLocked: false,
        offer: null,
        offerLocked: false,
        questions: {
            service: { asked: false, answered: false },
            offer: { asked: false, answered: false }
        }
    },

    assets: {
        contactMethod: null, // website | phone | whatsapp | none
        contactLocked: false,

        websiteUrl: null,
        phone: null,
        assetsConfirmed: false,

        logoDecision: null, // use_logo | use_text
        logoUrl: null,
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
        imagePrompt: null
    }
};

