
import sharp from "sharp";
import fetch from "node-fetch";
import { supabaseServer } from "../supabaseServer";

/**
 * processImage - Overlays perfect text on DALL-E background and uploads to Supabase.
 */
export async function processImage({
    imageUrl,
    businessName,
    service,
    tagline,
    offer,
    contact,
    email,
    sessionId
}) {
    console.log("[ProcessImage] Starting overlay for:", service);

    try {
        // 1. Fetch DALL-E Image
        const response = await fetch(imageUrl);
        const imageBuffer = Buffer.from(await response.arrayBuffer());

        // 2. Analyze Brightness for Adaptive Contrast
        const { dominant } = await sharp(imageBuffer).stats();
        const brightness = (dominant.r + dominant.g + dominant.b) / 3;
        const textColor = brightness > 150 ? "#111111" : "#FFFFFF"; // Dark text for light bg, light text for dark bg
        const accentColor = brightness > 150 ? "#e63946" : "#FFD700"; // Red accent for light bg, Gold for dark bg

        // 3. Construct SVG Overlay (1024x1024 to match DALL-E)
        const svg = `
        <svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">
            <style>
                .brand { fill: ${textColor}; font-size: 24px; font-family: sans-serif; opacity: 0.6; font-weight: 300; }
                .service { fill: ${textColor}; font-size: 72px; font-family: sans-serif; font-weight: 900; text-transform: uppercase; }
                .tagline { fill: ${textColor}; font-size: 32px; font-family: sans-serif; font-weight: 400; font-style: italic; }
                .offer { fill: ${accentColor}; font-size: 48px; font-family: sans-serif; font-weight: 800; }
                .contact { fill: ${textColor}; font-size: 28px; font-family: sans-serif; font-weight: 600; }
            </style>

            <!-- Brand (Top Left) -->
            <text x="40" y="60" class="brand">${businessName.toUpperCase()}</text>

            <!-- Hero Service (Center) -->
            <text x="512" y="480" class="service" text-anchor="middle">${service.toUpperCase()}</text>

            <!-- Tagline (Below Service) -->
            <text x="512" y="540" class="tagline" text-anchor="middle">${tagline}</text>

            <!-- Offer (Below Tagline) -->
            ${offer && offer !== "None" ? `<text x="512" y="620" class="offer" text-anchor="middle">${offer.toUpperCase()}</text>` : ""}

            <!-- Contact (Bottom Right) -->
            <text x="984" y="984" class="contact" text-anchor="end">${contact}</text>
        </svg>
        `;

        // 4. Composite Image
        const processedImageBuffer = await sharp(imageBuffer)
            .composite([{
                input: Buffer.from(svg),
                top: 0,
                left: 0
            }])
            .png()
            .toBuffer();

        // 5. Upload to Supabase Storage
        const fileName = `ig_${sessionId || Date.now()}.png`;
        const { data, error } = await supabaseServer
            .storage
            .from("instagram-creatives")
            .upload(fileName, processedImageBuffer, {
                contentType: "image/png",
                upsert: true
            });

        if (error) throw error;

        // 6. Get Public URL
        const { data: { publicUrl } } = supabaseServer
            .storage
            .from("instagram-creatives")
            .getPublicUrl(fileName);

        console.log("[ProcessImage] Successfully uploaded to:", publicUrl);

        return {
            finalImageUrl: publicUrl,
            fileName // Return the filename so we can delete it later
        };

    } catch (e) {
        console.error("[ProcessImage] Error:", e);
        throw e;
    }
}
