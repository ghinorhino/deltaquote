const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { textRender } = require('./image_utils');

async function createHeartLocket(image, text) {
    const makesweet = path.join(__dirname, '../', 'exepacks', 'makesweet');
    let randomId = Math.random().toString(36).substring(2, 15);

    fs.writeFileSync(path.join(makesweet, 'images', `${randomId}.png`), image);
    fs.writeFileSync(path.join(makesweet, 'images', `${randomId}-txt.png`), await textRender(text, 300));

    const command = `docker run -v ${makesweet}:/share paulfitz/makesweet --zip templates/heart-locket.zip --start 15 --in images/${randomId}.png images/${randomId}-txt.png --gif animation-${randomId}.gif`;

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
    fs.unlinkSync(path.join(makesweet, 'images', `${randomId}-txt.png`));
    fs.unlinkSync(path.join(makesweet, 'animation-' + randomId + '.gif'));

    return gifBuffer;
}

module.exports = createHeartLocket;