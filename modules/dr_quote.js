try {
    (async () => {
    try {
        if (repliedTo.author.bot) {
            await interaction.reply({
                content: 'Error: Cannot generate a quote from a bot message.',
                ephemeral: true
            });
            return;
        }
        console.log('Processing interaction...');
        let filtcont = sanitizeText(repliedTo.content);

        if (filtcont.trim() === '') {
            await interaction.reply({
                content: 'Error: Message content is empty or only contains unsupported formatting.',
                ephemeral: true
            });
            return;
        }

        var randomFilename = require('crypto').randomBytes(16).toString('hex');

        var userMsgAuthor = repliedTo.author;
        var userPFP = userMsgAuthor.displayAvatarURL({ format: 'png', size: 512 });
        var imageBuffer = await dlImage(userPFP.replace('.webp', '.png'));

        fs.writeFileSync(path.join(__dirname, 'boxgenerator', `temp-${randomFilename}.png`), await makeCircularImage(imageBuffer, 256));

        var characterOverride = `-face "temp-${randomFilename}.png"`;
        var characterOverrided = false;
        var discordQuote = false;
        var characterTotal = 22;
        const tagMatch = filtcont.match(/^<([^>]+)>/);
        try {
            // check if it isnt a discord mention
            if (tagMatch && !tagMatch[1].startsWith('@')) {
                characterOverride = `-face ${tagMatch[1].split('.')[0].replaceAll('&','')} -emotion ${tagMatch[1].split('.').length > 1 ? tagMatch[1].split('.')[1].replaceAll('&','') : '0'}`;
                characterOverrided = true;
                filtcont = filtcont.slice(tagMatch[0].length).trim();
        		if (tagMatch[1] == 'sans') {
        			console.log('sans time');
        			characterOverride += " -font fnt_comicsans -writerdat \"{'_spacingwidth': 8, '_spacingheight': 18}\"";
        		}
            }
        }
        catch (e) {
            console.log('Error processing tag: ' + e);
        }

        // array-based newline generation
        var array = filtcont
          .split(' ')
          .reduce((acc, word) => {
            const lastLine = acc.split('#').pop();
            if ((lastLine + (lastLine ? ' ' : '') + word).length > characterTotal) {
              return acc + '#' + word;
            } else {
              return acc + (lastLine ? ' ' : '') + word;
            }
          }, '');
        
        filtcont = array;

        const command = `"${path.join(__dirname, 'boxgenerator', 'box.exe')}" -generate ${randomFilename} -boxheight "a" -text "* ${filtcont}" ${characterOverride} ${interactionId == 'dr_quote_light' ? '' : '-darkbox '}-quit`;

        await new Promise((resolve, reject) => {
            exec(command, (error, stdout, stderr) => {
            if (error) reject(error);
            else resolve();
            });
        });

        var appdata = process.env.APPDATA;

        await interaction.reply({
            files: [{
                attachment: (fs.readFileSync(path.join(appdata, '../', 'Local', 'DELTARUNE', 'TEXTBOX_PROGRAM', `${randomFilename}.png`))),
                name: 'quote.png'
            }],
            content: (characterOverrided && !discordQuote ? '_The character of the box has been overriden since a tag was detected._' : '') + (discordQuote ? '**This message was generated using another Discord user\'s profile picture.**' : ''),
        });

        console.log('sent reply, now cleaning up files...');
        fs.unlinkSync(path.join(__dirname, 'boxgenerator', `temp-${randomFilename}.png`));
        fs.unlinkSync(path.join(appdata, '../', 'Local', 'DELTARUNE', 'TEXTBOX_PROGRAM', `${randomFilename}.png`));

    } catch (error) {
        await interaction.reply({
            content: '**An error occurred.** Please try again later.',
            ephemeral: true
        });
        console.error(error);
    }
})();
}
catch(e) {
    interaction.reply({
        content: '**An error occurred.** Please try again later.',
        ephemeral: true
    });
    console.error(e);
}