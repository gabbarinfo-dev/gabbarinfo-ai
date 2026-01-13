import OpenAI from "openai";

export async function generateImage(state) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OpenAI API Key missing. Cannot generate image.");
  }

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });

  const businessName = state.businessName || "Your Business";
  const service = state.context.service || "General Services";
  const offer = state.context.offer || "";
  const method = state.assets.contactMethod;

  let website = "";
  if (method === "website" && state.assets.websiteUrl) {
    website = state.assets.websiteUrl;
  } else if ((method === "phone" || method === "whatsapp") && state.assets.phone) {
    website = state.assets.phone;
  }

  let brandingInstruction = "";
  if (state.assets.logoDecision === "use_logo" && state.assets.logoUrl) {
    brandingInstruction = `Incorporate the business logo using this reference URL if possible for style/color, or place a professional logo placeholder in the corner: ${state.assets.logoUrl}`;
  } else {
    brandingInstruction = `Professional typography for the business name: "${businessName}". Place discretely as a logo.`;
  }

  const prompt = `
Create a high-end, professional Instagram post image for a business.

BUSINESS DETAILS:
- Business Name: ${businessName}
- Service Focus: ${service}
- Special Offer: ${offer || "Professional Service Showcase"}
- Branding: ${brandingInstruction}
- Contact Info: ${website ? `Include "${website}" as a clean footer text.` : "No footer text needed."}

VISUAL REQUIREMENTS:
- The image must clearly represent the service.
- Style: Premium, clean, modern, marketing-ready.
- Text Rules: NO generic filler text.
- Tone: Trustworthy and commercial.
`;

  try {
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt,
      n: 1,
      size: "1024x1024"
    });

    return {
      imageUrl: response.data[0].url,
      imagePrompt: prompt
    };
  } catch (e) {
    console.error("Image Generation Error:", e);
    throw new Error("Failed to generate image. Please try again.");
  }
}
