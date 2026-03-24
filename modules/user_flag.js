const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { textRender } = require('./image_utils');

async function flag(image) {
    const makesweet = path.join(__dirname, '../', 'exepacks', 'makesweet');
    let randomId = Math.random().toString(36).substring(2, 15);

    fs.writeFileSync(path.join(makesweet, 'images', `${randomId}.png`), image);

    const command = `docker run -v ${makesweet}:/share paulfitz/makesweet --zip templates/flag.zip --in images/${randomId}.png  --gif animation-${randomId}.gif`;

    let gifBuffer;
    
    try {
        execSync(command, { cwd: makesweet });
        gifBuffer = fs.readFileSync(path.join(makesweet, 'animation-' + randomId + '.gif'));
    }
    catch (error) {
        return new Error('Failed to create user flag GIF');
    }

    // cleanup

    fs.unlinkSync(path.join(makesweet, 'images', `${randomId}.png`));
    fs.unlinkSync(path.join(makesweet, 'animation-' + randomId + '.gif'));

    return gifBuffer;
}

module.exports = flag;