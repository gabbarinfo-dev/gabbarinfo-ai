// lib/instagram/creative-constants.js

export const CREATIVE_STAGES = {
    BUSINESS_RESOLUTION: "BUSINESS_RESOLUTION",
    CONTEXT_RESOLUTION: "CONTEXT_RESOLUTION",
    ASSET_RESOLUTION: "ASSET_RESOLUTION",
    CONTENT_GENERATION: "CONTENT_GENERATION",
    PREVIEW: "PREVIEW",
    COMPLETED: "COMPLETED"
};

export const CREATIVE_INTENT = "instagram_creative";

export const DEFAULT_CREATIVE_STATE = {
    stage: CREATIVE_STAGES.BUSINESS_RESOLUTION,
    businessId: null,
    businessName: null,
    context: {
        rawIntent: null,
        website: null,
        service: null,
        product: null,
        topic: null,
        tone: null
    },
    assets: {
        logoUrl: null,
        websiteUrl: null,
        phone: null,
        city: null,
        source: null // "explicit", "extracted", "generated"
    },
    content: {
        caption: null,
        hashtags: [],
        imageUrl: null,
        imagePrompt: null,
        previewText: null
    },
    history: [] // Simple conversation history for this flow
};
