
import sharp from "sharp";
import fetch from "node-fetch";
import path from "path";
import fs from "fs";
import TextToSVG from "text-to-svg";
import { supabaseServer } from "../supabaseServer";
import arialFontData from "../fonts/arial-font.json";
const { arialFontBase64 } = arialFontData;

/**
 * processImage - Overlays perfect text on DALL-E background using path-based rendering.
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
    console.log("[ProcessImage] Starting Path-based overlay for:", service);

    try {
        // 1. Fetch DALL-E Image
        const response = await fetch(imageUrl);
        if (!response.ok) throw new Error(`Failed to fetch DALL-E image: ${response.statusText}`);
        const imageBuffer = Buffer.from(await response.arrayBuffer());

        // 2. Analyze Brightness for Adaptive Contrast
        const { dominant } = await sharp(imageBuffer).stats();
        const brightness = (dominant.r + dominant.g + dominant.b) / 3;
        const textColor = brightness > 150 ? "#111111" : "#FFFFFF"; // Dark text for light bg
        const accentColor = brightness > 150 ? "#e63946" : "#FFD700"; // Red accent or Gold

        // 3. Initialize TextToSVG with bundled font (Vercel-safe /tmp approach)
        const fontPath = path.join("/tmp", "Arial.ttf");
        if (!fs.existsSync(fontPath)) {
            console.log("[ProcessImage] Extracting bundled font to /tmp...");
            fs.writeFileSync(fontPath, Buffer.from(arialFontBase64, "base64"));
        }

        const textToSVG = TextToSVG.loadSync(fontPath);

        // 4. Generate SVG Paths for Each Element
        const getPath = (text, x, y, size, anchor = "center", color = textColor) => {
            if (!text) return "";
            return textToSVG.getPath(text, {
                x, y, fontSize: size, anchor,
                attributes: { fill: color }
            });
        };

        // Brand (Top Left - subtle)
        const brandSVG = getPath(businessName.toUpperCase(), 40, 60, 24, "left", textColor);

        // Service (Large Center)
        const serviceSVG = getPath(service.toUpperCase(), 512, 480, 72, "center", textColor);

        // Tagline (Below Service)
        const taglineSVG = getPath(tagline, 512, 545, 30, "center", textColor);

        // Offer (Highlighted)
        const offerSVG = (offer && offer !== "None")
            ? getPath(offer.toUpperCase(), 512, 610, 48, "center", accentColor)
            : "";

        // Contact (Bottom Right)
        const contactSVG = getPath(contact, 984, 984, 26, "right", textColor);

        // 5. Build Final SVG
        const overlaySVG = `
            <svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">
                ${brandSVG}
                ${serviceSVG}
                ${taglineSVG}
                ${offerSVG}
                ${contactSVG}
            </svg>
        `;

        // 6. Composite with Sharp
        const processedImageBuffer = await sharp(imageBuffer)
            .composite([{
                input: Buffer.from(overlaySVG),
                top: 0,
                left: 0
            }])
            .png()
            .toBuffer();

        // 7. Upload to Supabase Storage
        const fileName = `ig_${sessionId || Date.now()}.png`;
        const { data, error } = await supabaseServer
            .storage
            .from("instagram-creatives")
            .upload(fileName, processedImageBuffer, {
                contentType: "image/png",
                upsert: true
            });

        if (error) throw error;

        // 8. Get Public URL
        const { data: { publicUrl } } = supabaseServer
            .storage
            .from("instagram-creatives")
            .getPublicUrl(fileName);

        console.log("[ProcessImage] Path-based upload complete:", publicUrl);

        return {
            finalImageUrl: publicUrl,
            fileName
        };

    } catch (e) {
        console.error("[ProcessImage] Error:", e);
        throw e;
    }
}
