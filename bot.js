const { 
    Client, 
    GatewayIntentBits, 
    Events,
    REST,
    Routes,
    ContextMenuCommandBuilder,
    MessageFlags,
    SlashCommandBuilder,
    ApplicationCommandType
} = require('discord.js');
const https = require('https');
const express = require('express');
const fs = require('fs');
const { execFileSync, exec } = require('child_process');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');
const Secrets = JSON.parse(fs.readFileSync(path.join(__dirname, 'secrets.json'), 'utf-8'));
let MAINTENANCE = false;

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
            .setName('DELTARUNE Quote')
            .setType(ApplicationCommandType.Message)
            .setIntegrationTypes([0, 1])
            .setContexts([0, 1, 2])
            .toJSON(),
        new ContextMenuCommandBuilder()
            .setName('DELTARUNE Quote (Light World)')
            .setType(ApplicationCommandType.Message)
            .setIntegrationTypes([0, 1])
            .setContexts([0, 1, 2])
            .toJSON(),
        new SlashCommandBuilder()
            .setName('dialoguebox')
            .setDescription('Generate a dialogue box from provided arguments')
            .setContexts([0, 1, 2])
            .addStringOption(option =>
                option.setName('text')
                    .setDescription('The dialogue\'s text')
                    .setRequired(true))
            .addStringOption(option =>
                option.setName('character')
                    .setDescription('The character speaking (if left blank will be user PFP)')
                    .setRequired(false))
            .addBooleanOption(option =>
                option.setName('lightbox')
                    .setDescription('Whether to use the light box style (default: false)')
                    .setRequired(false))
            .toJSON(),
        new SlashCommandBuilder()
            .setName('serverinfo')
            .setDescription('Get information about the newly launched Deltaquote server!')
            .setContexts([0, 1, 2])
            .toJSON()
    ];

    const rest = new REST({ version: '10' }).setToken(Secrets.token);
    await rest.put(
        Routes.applicationCommands(Secrets.clientId),
        { body: commands }
    );

    // change bot status to streaming "Deltaquote"
    await client.user.setActivity('Deltaquote', { type: 'STREAMING', url: 'https://www.twitch.tv/ghinorhino' });

    partialLog(greenText(' Ready!\n'));

    if (require('./package.json').maintenance.is) {
        MAINTENANCE = true;
        partialLog(redText('The bot is currently set in maintenance mode! Only the owner will be able to use it.\n'));
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
    if (MAINTENANCE && interaction.user.id !== Secrets.ownerId) {
        await interaction.reply({
            content: 'The bot is currently in maintenance mode: ' + require('./package.json').maintenance.reason,
            flags: MessageFlags.Ephemeral
        });
        return;
    }
    var maps = {
        'DELTARUNE Quote': 'dr_quote',
        'DELTARUNE Quote (Light World)': 'dr_quote_light',
        'dialoguebox': 'dr_quote_slash'
    };
    if (!Object.keys(maps).includes(interaction.commandName)) return;

    partialLog(yellowText('Interaction received'));

    if (interaction.commandName === 'serverinfo') {
        partialLog(greenText(' | Sending server info\n'));
        await interaction.reply({
            content: fs.readFileSync(path.join(__dirname, 'serverinfo.txt'), 'utf-8'),
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    var interactionId = maps[interaction.commandName];

    const repliedTo = interaction.targetMessage;

    var userPFP = repliedTo.author.displayAvatarURL({ format: 'png', size: 512 });
    var imageBuffer = await dlImage(userPFP.replace('.webp', '.png'));
    var circularImageBuffer = await makeCircularImage(imageBuffer, 256);

    var startJob = Date.now();

    var box = await require('./box')(circularImageBuffer, repliedTo.content, interactionId == 'dr_quote_light').catch(e => e);

    var endJob = Date.now();

    partialLog(greenText(` | Job done in ${((endJob - startJob) / 1000).toFixed(3)}s`));

    if (box instanceof Error) {
        partialLog(redText(' | Error creating box: ' + box.message + '\n'));
        await interaction.reply({
            content: `**Ooops!** An error occurred and your interaction couldn't be processed.\n-# ${box.message}`,
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    await interaction.reply({
        files: [{
            attachment: box.path,
            name: 'quote.png'
        }],
        content: '',
    });

    partialLog(greenText(' | Done\n'));

    fs.rmSync(box.path);
});

client.login(Secrets.token);
