const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { exec } = require('child_process');

function sanitizeText(text) {
    var prohibitedChars = ['#', '*', '_', '~', '`', '|', '\n', '\r', '"'];
    var sanitized = text;
    prohibitedChars.forEach(char => {
        var regex = new RegExp(`\\${char}`, 'g');
        sanitized = sanitized.replace(regex, '');
    });
    return sanitized;
}

async function makeBox(pfpBuffer, messageText, lightBox = false) {
    try {
        let filtcont = sanitizeText(messageText);

        if (filtcont.trim() === '') {
            throw new Error('Message content is empty or unsupported.');
        }

        const randomFilename = crypto.randomBytes(16).toString('hex');

        const tempFacePath = path.join(__dirname, '../', 'exepacks', 'boxgenerator', `temp-${randomFilename}.png`);

        fs.writeFileSync(
            tempFacePath,
            pfpBuffer
        );

        let characterOverride = `-face "temp-${randomFilename}.png"`;
        let characterOverrided = false;
        let characterTotal = 22;

        const tagMatch = filtcont.match(/^<([^>]+)>/);

        try {
            if (tagMatch && !tagMatch[1].startsWith('@')) {

                const parts = tagMatch[1].split('.');

                characterOverride =
                    `-face ${parts[0].replaceAll('&','')} ` +
                    `-emotion ${(parts.length > 1 ? parts[1] : '0').replaceAll('&','')}`;

                characterOverrided = true;

                filtcont = filtcont.slice(tagMatch[0].length).trim();
            }
        }
        catch (e) {
            
        }

        // word wrapping
        filtcont = filtcont
            .split(' ')
            .reduce((acc, word) => {
                const lastLine = acc.split('#').pop();

                if ((lastLine + (lastLine ? ' ' : '') + word).length > characterTotal) {
                    return acc + '#' + word;
                } else {
                    return acc + (lastLine ? ' ' : '') + word;
                }
            }, '');

        const command =
            `"${path.join(__dirname, '../', 'exepacks', 'boxgenerator', 'box.exe')}" ` +
            `-generate ${randomFilename} ` +
            `-boxheight "a" ` +
            `-text "* ${filtcont}" ` +
            `${characterOverride} ` +
            `${!lightBox ? '-darkbox' : ''} -quit`;

        await new Promise((resolve, reject) => {
            exec(command, (error) => {
                if (error) reject(error);
                else resolve();
            });
        });

        const appdata = process.env.APPDATA;

        const outputPath = path.join(
            appdata,
            '../',
            'Local',
            'DELTARUNE',
            'TEXTBOX_PROGRAM',
            `${randomFilename}.png`
        );

        if (!fs.existsSync(outputPath)) {
            throw new Error('The textbox generator failed to produce an output image. This is a common error, so try again.');
        }

        const outputBuffer = fs.readFileSync(outputPath);

        // cleanup
        fs.unlinkSync(tempFacePath);
        fs.unlinkSync(outputPath);

        return outputBuffer;

    } catch (err) {
        return new Error('Failed to create box: ' + err.message);
    }
}

module.exports = makeBox;