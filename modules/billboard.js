const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const canvas = require('canvas');

async function imageplustext(imgraw, text) {
    const { createCanvas } = canvas;

    const canv = createCanvas(1000, 900);
    const ctx = canv.getContext('2d');

    // White background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 1000, 900);

    // Load and fit image on left side (500x900)
    const img = await canvas.loadImage(imgraw);
    const imgWidth = 512;
    const imgHeight = 768;
    const scale = Math.min(imgWidth / img.width, imgHeight / img.height);
    const scaledWidth = img.width * scale;
    const scaledHeight = img.height * (scale + 0.05);
    const x = (imgWidth - scaledWidth) / 2;
    const y = (imgHeight - scaledHeight) / 2;
    ctx.drawImage(img, x, y, scaledWidth, scaledHeight);

    // Draw text on right side with padding
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 35px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const maxWidth = 480;
    const textX = 750;
    const textY = 450;

    const words = text.split(' ');
    let lines = [];
    let currentLine = '';

    for (const word of words) {
        const testLine = currentLine + (currentLine ? ' ' : '') + word;
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth) {
            if (currentLine) lines.push(currentLine);
            currentLine = word;
        } else {
            currentLine = testLine;
        }
    }
    if (currentLine) lines.push(currentLine);

    const lineHeight = 45;
    const totalHeight = lines.length * lineHeight;
    let yOffset = textY - (totalHeight / 2);

    for (const line of lines) {
        ctx.fillText(line, textX, yOffset);
        yOffset += lineHeight;
    }

    return canv.toBuffer('image/png');
}
async function billboard(image, text) {
    const makesweet = path.join(__dirname, '../', 'exepacks', 'makesweet');
    let randomId = Math.random().toString(36).substring(2, 15);

    fs.writeFileSync(path.join(makesweet, 'images', `${randomId}.png`), await imageplustext(image, text));

    const command = `docker run -v ${makesweet}:/share paulfitz/makesweet --zip templates/billboard-cityscape.zip --in images/${randomId}.png --gif animation-${randomId}.gif`;

    let gifBuffer;
    
    try {
        execSync(command, { cwd: makesweet });
        gifBuffer = fs.readFileSync(path.join(makesweet, 'animation-' + randomId + '.gif'));
    }
    catch (error) {
        return new Error('Failed to create heart locket GIF');
    }

    // cleanup

    fs.unlinkSync(path.join(makesweet, 'images', `${randomId}.png`));
    fs.unlinkSync(path.join(makesweet, 'animation-' + randomId + '.gif'));

    return gifBuffer;
}

module.exports = billboard;