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
    let isGoogleDrive = false;

    // 1. Detect and convert Google Drive URLs
    const driveViewRegex = /drive\.google\.com\/file\/d\/([^\/\?]+)/;
    const driveOpenRegex = /drive\.google\.com\/open\?id=([^\&]+)/;

    const viewMatch = url.match(driveViewRegex);
    const openMatch = url.match(driveOpenRegex);
    const fileId = (viewMatch && viewMatch[1]) || (openMatch && openMatch[1]);

    if (fileId) {
        directUrl = `https://drive.googleusercontent.com/uc?id=${fileId}&export=download`;
        isGoogleDrive = true;
    }

    // 2. Validate Google Drive & Other URLs
    // We do NOT blindly trust Drive links anymore. They must be public and valid images.
    let response;
    try {
        response = await fetch(directUrl, { method: 'HEAD', timeout: 5000 });
        if (response.ok) {
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.startsWith('image/')) {
                return directUrl;
            }
        }
    } catch (e) { }

    try {
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
        }
    } catch (e) { }

    throw new Error(`InvalidInstagramImageURL: Unable to validate image at ${directUrl}`);
}
