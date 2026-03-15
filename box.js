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

async function makeBox(pfpBuffer, messageText) {
    try {
        let filtcont = sanitizeText(messageText);

        if (filtcont.trim() === '') {
            throw new Error('Message content is empty or unsupported.');
        }

        const randomFilename = crypto.randomBytes(16).toString('hex');

        const tempFacePath = path.join(__dirname, 'boxgenerator', `temp-${randomFilename}.png`);

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

                if (tagMatch[1] === 'sans') {
                    characterOverride +=
                        ` -font fnt_comicsans -writerdat "{'_spacingwidth': 8, '_spacingheight': 18}"`;
                }
            }
        }
        catch (e) {
            console.log('Error processing tag:', e);
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
            `"${path.join(__dirname, 'boxgenerator', 'box.exe')}" ` +
            `-generate ${randomFilename} ` +
            `-boxheight "a" ` +
            `-text "* ${filtcont}" ` +
            `${characterOverride} ` +
            `-darkbox -quit`;

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

        const outputBuffer = fs.readFileSync(outputPath);

        // cleanup
        fs.unlinkSync(tempFacePath);

        return {
            buffer: outputBuffer,
            path: outputPath,
            characterOverrided
        };

    } catch (err) {
        console.error(err);
        throw err;
    }
}

module.exports = makeBox;