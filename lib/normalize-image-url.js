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

    // Dual-mode validation: HEAD then GET (with Range)
    let response;
    try {
        console.log(`[Normalization] Validating URL (HEAD): ${directUrl}`);
        response = await fetch(directUrl, { method: 'HEAD', timeout: 5000 });

        if (response.ok) {
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.startsWith('image/')) {
                return directUrl;
            }
        }
        console.warn(`[Normalization] HEAD validation failed (HTTP ${response.status}), falling back to GET...`);
    } catch (e) {
        console.warn(`[Normalization] HEAD request error: ${e.message}. Falling back to GET...`);
    }

    try {
        console.log(`[Normalization] Validating URL (GET Range): ${directUrl}`);
        response = await fetch(directUrl, {
            method: 'GET',
            headers: { 'Range': 'bytes=0-1024' },
            timeout: 8000
        });

        if (response.ok) {
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.startsWith('image/')) {
                return directUrl;
            }
            console.error(`[Normalization] Invalid Content-Type: ${contentType}`);
        } else {
            console.error(`[Normalization] GET validation failed: HTTP ${response.status}`);
        }
    } catch (e) {
        console.error(`[Normalization] GET request error: ${e.message}`);
    }

    throw new Error(`InvalidInstagramImageURL: Unable to validate image at ${directUrl}`);
}
