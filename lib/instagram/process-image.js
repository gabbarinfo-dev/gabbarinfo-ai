
import sharp from "sharp";
import fetch from "node-fetch";
import path from "path";
import fs from "fs";
import TextToSVG from "text-to-svg";
import { supabaseServer } from "../supabaseServer";
import arialFontData from "../fonts/arial-font.json";
const { arialFontBase64 } = arialFontData;

/**
 * processImage - Overlays perfect text on DALL-E background with wrapping and premium branding.
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
    console.log("[ProcessImage] Starting Premium Ad Branding for:", service);

    try {
        const response = await fetch(imageUrl);
        if (!response.ok) throw new Error(`Failed to fetch DALL-E image: ${response.statusText}`);
        const imageBuffer = Buffer.from(await response.arrayBuffer());

        const fontPath = path.join("/tmp", "Arial.ttf");
        if (!fs.existsSync(fontPath)) {
            fs.writeFileSync(fontPath, Buffer.from(arialFontBase64, "base64"));
        }
        const textToSVG = TextToSVG.loadSync(fontPath);

        // --- UTILITY: Wrap Text ---
        const wrapText = (text, fontSize, maxWidth) => {
            if (!text) return [];
            const words = text.split(/\s+/);
            const lines = [];
            let currentLine = words[0];

            for (let i = 1; i < words.length; i++) {
                const testLine = currentLine + " " + words[i];
                const metrics = textToSVG.getMetrics(testLine, { fontSize });
                if (metrics.width > maxWidth) {
                    lines.push(currentLine);
                    currentLine = words[i];
                } else {
                    currentLine = testLine;
                }
            }
            lines.push(currentLine);
            return lines;
        };

        const getPath = (text, x, y, size, anchor = "center", color = "#FFFFFF", isItalic = false) => {
            if (!text) return "";
            const options = {
                x, y, fontSize: size, anchor,
                attributes: {
                    fill: color,
                    stroke: "black",
                    "stroke-width": 1.5,
                    "paint-order": "stroke fill"
                }
            };
            if (isItalic) {
                options.attributes.transform = `skewX(-15) translate(${-y * Math.tan(-15 * Math.PI / 180)}, 0)`;
            }
            return textToSVG.getPath(text, options);
        };

        // --- 1. Top Branding Bar ---
        const brandStr = businessName.toUpperCase();
        const brandSVG = getPath(brandStr, 40, 60, 22, "left");
        const brandMetrics = textToSVG.getMetrics(brandStr, { fontSize: 22 });
        const brandingOverlay = `
            <rect x="0" y="0" width="1024" height="100" fill="black" fill-opacity="0.2" />
            <rect x="40" y="72" width="${brandMetrics.width}" height="2" fill="#FFFFFF" />
            ${brandSVG}
        `;

        // --- 2. Central Message Cluster (with Wrapping) ---
        const maxTextWidth = 840;
        const serviceLines = wrapText(service.toUpperCase(), 64, maxTextWidth);
        const taglineLines = wrapText(tagline, 28, maxTextWidth);

        let currentY = 460;
        const clusterSVGs = [];

        // Service Lines
        serviceLines.forEach(line => {
            clusterSVGs.push(getPath(line, 512, currentY, 64, "center"));
            currentY += 75;
        });

        // Tagline (Gap then Taglines)
        currentY += 10;
        taglineLines.forEach(line => {
            clusterSVGs.push(getPath(line, 512, currentY, 28, "center", "#FFFFFF", true));
            currentY += 35;
        });

        // Offer
        if (offer && offer !== "None") {
            currentY += 20;
            clusterSVGs.push(getPath(offer.toUpperCase(), 512, currentY, 42, "center", "#FFD700"));
        }

        // Background Box for Cluster (Dynamic Height)
        const clusterHeight = currentY - 400;
        const clusterBoxY = 460 - 70;
        const clusterBackground = `
            <rect x="62" y="${clusterBoxY}" width="900" height="${clusterHeight + 60}" rx="20" fill="black" fill-opacity="0.5" />
        `;

        // --- 3. Bottom Contact Grounding ---
        const contactSVG = getPath(contact, 984, 984, 26, "right");
        const contactMetrics = textToSVG.getMetrics(contact, { fontSize: 26 });
        const iconX = 984 - contactMetrics.width - 40;
        const bottomUI = `
            <linearGradient id="bottomGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="black" stop-opacity="0" />
                <stop offset="100%" stop-color="black" stop-opacity="0.7" />
            </linearGradient>
            <rect x="0" y="800" width="1024" height="224" fill="url(#bottomGrad)" />
            <g transform="translate(${iconX}, 958) scale(0.05)">
                <circle cx="256" cy="256" r="250" fill="white" />
                <path d="M386 322c-15-15-38-15-53 0l-30 30-74-74 30-30c15-15 15-38 0-53l-60-60c-15-15-38-15-53 0l-45 45c-15 15-20 37-14 56 30 100 110 180 210 210 19 6 41 1 56-14l45-45c15-15 15-38 0-53l-60-60z" fill="black"/>
            </g>
            ${contactSVG}
        `;

        // --- BUILD FINAL SVG ---
        const overlaySVG = `
            <svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">
                ${brandingOverlay}
                ${clusterBackground}
                ${clusterSVGs.join("\n")}
                ${bottomUI}
            </svg>
        `;

        const processedImageBuffer = await sharp(imageBuffer)
            .composite([{ input: Buffer.from(overlaySVG), top: 0, left: 0 }])
            .png()
            .toBuffer();

        const fileName = `ig_${sessionId || Date.now()}.png`;
        const { error } = await supabaseServer.storage.from("instagram-creatives").upload(fileName, processedImageBuffer, { contentType: "image/png", upsert: true });
        if (error) throw error;

        const { data: { publicUrl } } = supabaseServer.storage.from("instagram-creatives").getPublicUrl(fileName);
        return { finalImageUrl: publicUrl, fileName };

    } catch (e) {
        console.error("[ProcessImage] Error:", e);
        throw e;
    }
}
