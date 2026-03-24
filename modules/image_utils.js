const { createCanvas, loadImage } = require('canvas');

async function textRender(text, maxWidth) {
    const canvas = createCanvas(maxWidth, 100);
    const ctx = canvas.getContext('2d');

    ctx.font = '20px Arial';
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'center';

    const lineHeight = 25;
    const words = text.split(' ');
    let line = '';
    let y = 20;

    for (const word of words) {
        const testLine = line + (line ? ' ' : '') + word;
        const metrics = ctx.measureText(testLine);

        if (metrics.width > maxWidth && line) {
            ctx.fillText(line, maxWidth / 2, y);
            line = word;
            y += lineHeight;
        } else {
            line = testLine;
        }
    }

    if (line) ctx.fillText(line, maxWidth / 2, y);

    return await padImage(canvas.toBuffer('image/png'), 20); // for heart locket
}

async function joinImages(images, paddingBetween = 0) {
    const canvases = [];
    let totalHeight = 0;
    let maxWidth = 0;

    for (const image of images) {
        canvases.push(image);
        totalHeight += image.height + paddingBetween;
        maxWidth = Math.max(maxWidth, image.width);
    }

    const canvas = createCanvas(maxWidth, totalHeight - paddingBetween);
    const ctx = canvas.getContext('2d');

    let currentY = 0;
    for (const image of canvases) {
        ctx.drawImage(image, 0, currentY);
        currentY += image.height + paddingBetween;
    }

    return canvas.toBuffer('image/png');
}

async function padImage(buffer, padSize) {
    const image = await loadImage(buffer);
    const paddedWidth = image.width + padSize * 2;
    const paddedHeight = image.height + padSize * 2;
    const canvas = createCanvas(paddedWidth, paddedHeight);
    const ctx = canvas.getContext('2d');

    ctx.drawImage(image, padSize, padSize);

    return canvas.toBuffer('image/png');
}

async function makeCircularImage(imageBuffer, size) {
    // Load image from buffer
    const image = await loadImage(imageBuffer);

    // Add 15px padding
    const padding = 15;
    const canvas = createCanvas(size + padding * 2, size + padding * 2);
    const ctx = canvas.getContext('2d');

    // Create circular clipping path with padding
    ctx.beginPath();
    ctx.arc(
        (size + padding * 2) / 2,
        (size + padding * 2) / 2,
        size / 2,
        0,
        Math.PI * 2
    );
    ctx.closePath();
    ctx.clip();

    // Draw image centered & scaled to cover inside padded area
    const scale = Math.max(size / image.width, size / image.height);
    const x = padding + (size - image.width * scale) / 2;
    const y = padding + (size - image.height * scale) / 2;

    ctx.drawImage(
        image,
        x,
        y,
        image.width * scale,
        image.height * scale
    );

    // Return PNG buffer
    return canvas.toBuffer('image/png');
}

module.exports = {
    joinImages,
    padImage,
    makeCircularImage,
    textRender
};