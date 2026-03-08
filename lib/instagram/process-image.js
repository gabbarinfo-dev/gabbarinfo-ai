
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

        // 2. Fixed Contrast Strategy (White text with black outline)
        const textColor = "#FFFFFF";
        const accentColor = "#FFD700"; // Gold

        // 3. Initialize TextToSVG with bundled font (Vercel-safe /tmp approach)
        const fontPath = path.join("/tmp", "Arial.ttf");
        if (!fs.existsSync(fontPath)) {
            console.log("[ProcessImage] Extracting bundled font to /tmp...");
            fs.writeFileSync(fontPath, Buffer.from(arialFontBase64, "base64"));
        }

        const textToSVG = TextToSVG.loadSync(fontPath);

        // 4. Generate SVG Paths for Each Element
        const getPath = (text, x, y, size, anchor = "center", color = textColor, isItalic = false) => {
            if (!text) return "";
            const options = {
                x, y, fontSize: size, anchor,
                attributes: {
                    fill: color,
                    stroke: "black",
                    "stroke-width": 2,
                    "paint-order": "stroke fill"
                }
            };
            if (isItalic) {
                options.attributes.transform = `skewX(-15) translate(${-y * Math.tan(-15 * Math.PI / 180)}, 0)`;
            }
            return textToSVG.getPath(text, options);
        };

        // Brand (Top Left - Underlined)
        const brandStr = businessName.toUpperCase();
        const brandSVG = getPath(brandStr, 40, 60, 24, "left", textColor);
        const brandMetrics = textToSVG.getMetrics(brandStr, { fontSize: 24 });
        const underlineSVG = `<rect x="40" y="70" width="${brandMetrics.width}" height="3" fill="${textColor}" stroke="black" stroke-width="1" />`;

        // Service (Large Center)
        const serviceSVG = getPath(service.toUpperCase(), 512, 480, 72, "center", textColor);

        // Tagline (Below Service - Italics)
        const taglineSVG = getPath(tagline, 512, 545, 30, "center", textColor, true);

        // Offer (Highlighted)
        const offerSVG = (offer && offer !== "None")
            ? getPath(offer.toUpperCase(), 512, 610, 48, "center", accentColor)
            : "";

        // Contact (Bottom Right - with Icon)
        const contactSVG = getPath(contact, 984, 984, 26, "right", textColor);
        const contactMetrics = textToSVG.getMetrics(contact, { fontSize: 26 });
        const iconX = 984 - contactMetrics.width - 40;
        const phoneIconSVG = `
            <g transform="translate(${iconX}, 958) scale(0.05)">
                <circle cx="256" cy="256" r="250" fill="black" />
                <circle cx="256" cy="256" r="230" fill="white" />
                <path d="M386 322c-15-15-38-15-53 0l-30 30-74-74 30-30c15-15 15-38 0-53l-60-60c-15-15-38-15-53 0l-45 45c-15 15-20 37-14 56 30 100 110 180 210 210 19 6 41 1 56-14l45-45c15-15 15-38 0-53l-60-60z" fill="black"/>
            </g>
        `;

        // 5. Build Final SVG
        const overlaySVG = `
            <svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">
                ${brandSVG}
                ${underlineSVG}
                ${serviceSVG}
                ${taglineSVG}
                ${offerSVG}
                ${phoneIconSVG}
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
