const { 
    Client, 
    GatewayIntentBits, 
    Events,
    REST,
    Routes,
    ContextMenuCommandBuilder,
    MessageFlags,
    SlashCommandBuilder,
    ApplicationCommandType,
    EmbedBuilder
} = require('discord.js');
const https = require('https');
const fs = require('fs');
const path = require('path');

const Secrets = require('./secrets.json');

const { joinImages, padImage, makeCircularImage, textRender } = require('./modules/image_utils');
const { execSync } = require('child_process');

function dlImage(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            const data = [];
            res.on('data', chunk => data.push(chunk));
            res.on('end', () => resolve(Buffer.concat(data)));
        }).on('error', reject);
    });
}

const client = new Client({ 
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

client.once(Events.ClientReady, async () => {
    console.clear();
    process.stdout.write('Deltaquote ' + require('./package.json').version + '\nProgrammed by GhinoRhino\n\n' + '-'.repeat(process.stdout.columns) + '\n\n');
    partialLog(yellowText('Starting Deltaquote...'));

    const commands = [
        new ContextMenuCommandBuilder()
            .setName('Message as a DELTARUNE dialogue')
            .setType(ApplicationCommandType.Message)
            .setIntegrationTypes([0, 1])
            .setContexts([0, 1, 2])
            .toJSON(),
        new ContextMenuCommandBuilder()
            .setName('Message as a UNDERTALE dialogue')
            .setType(ApplicationCommandType.Message)
            .setIntegrationTypes([0, 1])
            .setContexts([0, 1, 2])
            .toJSON(),
        new SlashCommandBuilder()
            .setName('quote')
            .setDescription('Generate a DELTARUNE dialogue box from a message.')
            .addStringOption(option =>
                option.setName('text')
                    .setDescription('The text to display in the dialogue box.')
                    .setRequired(true))
            .addStringOption(option =>
                option.setName('character')
                    .setDescription('The character name to display in the dialogue box.')
                    .setRequired(false))
            .toJSON()
    ];

    const rest = new REST({ version: '10' }).setToken(Secrets.token);
    await rest.put(
        Routes.applicationCommands(Secrets.clientId),
        { body: commands }
    );

    partialLog(greenText(' Ready!\n'));

    if (!fs.existsSync(path.join(__dirname, 'temp'))) {
        fs.mkdirSync(path.join(__dirname, 'temp'));
    }

    
});

function greenText(str) {
    return '\x1b[32m' + str + '\x1b[0m';
}

function redText(str) {
    return '\x1b[31m' + str + '\x1b[0m';
}

function yellowText(str) {
    return '\x1b[33m' + str + '\x1b[0m';
}

function partialLog(str) {
    process.stdout.write(str);
}

client.on(Events.InteractionCreate, async (interaction) => {
    partialLog(yellowText('Interaction received') + " | Command: " + interaction.commandName);

    switch (interaction.commandName) {
        case 'Message as a DELTARUNE dialogue':
        case 'Message as a UNDERTALE dialogue':
            const repliedTo = interaction.targetMessage;
            var userPFP = repliedTo.author.displayAvatarURL({ format: 'png', size: 512 });
            var imageBuffer = await dlImage(userPFP.replace('.webp', '.png'));
            var circularImageBuffer = await makeCircularImage(imageBuffer, 256);

            var box;

            var character = '';
            var messageText = repliedTo.content;
            var characterMatch = messageText.match(/^<([^>]+)>\s*(.*)$/);
            if (characterMatch) {
                character = characterMatch[1];
                messageText = characterMatch[2];
            }
            
            interaction.deferReply({ ephemeral: true });

            box = await require('./modules/deltarune_generator')(circularImageBuffer, messageText, character || "", interaction.commandName == "Message as a UNDERTALE dialogue").catch(e => e);

            if (box instanceof Error) {
                await interaction.reply({
                    content: 'An error occurred while generating the DELTARUNE textbox. Please try again later.\n-#' + box.message,
                    flags: MessageFlags.Ephemeral
                });
            }

            await interaction.reply({
                files: [{
                    attachment: box,
                    name: 'quote.png'
                }],
                embeds: [],
                content: ''
            });
            break;
        case 'quote':
            var text = interaction.options.getString('text');
            var character = interaction.options.getString('character') || '';
            var userPFP = interaction.user.displayAvatarURL({ format: 'png', size: 512 });
            var imageBuffer = await dlImage(userPFP.replace('.webp', '.png'));
            var circularImageBuffer = await makeCircularImage(imageBuffer, 256);

            var box;

            interaction.deferReply({ ephemeral: true });

            box = await require('./modules/deltarune_generator')(circularImageBuffer, text, character || "", false).catch(e => e);

            if (box instanceof Error) {
                await interaction.reply({
                    content: 'An error occurred while generating the DELTARUNE textbox. Please try again later.\n-#' + box.message,
                    flags: MessageFlags.Ephemeral
                });
            }

            await interaction.reply({
                files: [{
                    attachment: box,
                    name: 'quote.png'
                }],
                embeds: [],
                content: ''
            });
            break;
    }

    partialLog(greenText(' | Done\n'));
});

client.login(Secrets.token);
