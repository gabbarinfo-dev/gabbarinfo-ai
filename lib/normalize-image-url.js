import fetch from 'node-fetch';

/**
 * Normalizes Google Drive links to direct public image links and validates them.
 * @param {string} url - The URL to normalize.
 * @returns {Promise<string>} - The normalized URL.
 * @throws {Error} - InvalidInstagramImageURL if validation fails.
 */
export async function normalizeImageUrl(url) {
    if (!url) return url;

    let directUrl = url;

    // 1. Detect and convert Google Drive URLs
    // Matches: 
    // - https://drive.google.com/file/d/{ID}/view...
    // - https://drive.google.com/open?id={ID}
    const driveViewRegex = /drive\.google\.com\/file\/d\/([^\/\?]+)/;
    const driveOpenRegex = /drive\.google\.com\/open\?id=([^\&]+)/;

    const viewMatch = url.match(driveViewRegex);
    const openMatch = url.match(driveOpenRegex);
    const fileId = (viewMatch && viewMatch[1]) || (openMatch && openMatch[1]);

    if (fileId) {
        directUrl = `https://drive.googleusercontent.com/uc?id=${fileId}`;
        console.log(`[Normalization] Converted Google Drive URL to: ${directUrl}`);
    }

    // 2. Perform HEAD request validation
    try {
        const response = await fetch(directUrl, { method: 'HEAD', timeout: 5000 });

        if (!response.ok) {
            console.error(`[Normalization] URL validation failed: HTTP ${response.status}`);
            throw new Error(`InvalidInstagramImageURL: HTTP ${response.status}`);
        }

        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.startsWith('image/')) {
            console.error(`[Normalization] URL validation failed: Invalid Content-Type ${contentType}`);
            throw new Error(`InvalidInstagramImageURL: Content-Type is ${contentType}`);
        }

        return directUrl;
    } catch (error) {
        console.error(`[Normalization] Error validating URL: ${error.message}`);
        if (error.message.includes('InvalidInstagramImageURL')) throw error;
        throw new Error(`InvalidInstagramImageURL: ${error.message}`);
    }
}
