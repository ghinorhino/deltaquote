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
        new ContextMenuCommandBuilder()
            .setName('Add To Multiple Quote Queue')
            .setType(ApplicationCommandType.Message)
            .setIntegrationTypes([0, 1])
            .setContexts([0, 1, 2])
            .toJSON(),
        new SlashCommandBuilder()
            .setName('renderqueue')
            .setDescription('Render all quotes in the queue into a single image (if any)')
            .setContexts([0, 1, 2])
            .toJSON(),
        new SlashCommandBuilder()
            .setName('removequeue')
            .setDescription('Remove all quotes in the queue without rendering (if any)')
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
    partialLog(yellowText('Interaction received'));

    // first handle special commands that aren't quote generation

    if (interaction.commandName === 'renderqueue') {
        partialLog(greenText(' | Rendering quote queue\n'));
        var pathname = path.join(__dirname, 'temp', interaction.user.id);
        if (!fs.existsSync(pathname)) {
            partialLog(redText(' | No quotes to render\n'));
            await interaction.reply({
                content: `**Oh!** Looks like you don't have any quotes in the queue to render!`,
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        var files = fs.readdirSync(pathname).filter(f => f.endsWith('.png'));

        var images = [];
        for (var file of files) {
            var img = await loadImage(path.join(pathname, file));
            images.push(img);
        }
        var finalbuf = await joinImages(images, 15);
        await interaction.reply({
            files: [{
                attachment: finalbuf,
                name: 'quotes.png'
            }],
            content: '',
        });

        fs.rmSync(pathname, { recursive: true, force: true });
    }

    if (interaction.commandName === 'removequeue') {
        partialLog(greenText(' | Removing quote queue\n'));
        var pathname = path.join(__dirname, 'temp', interaction.user.id);

        if (!fs.existsSync(pathname)) {
            partialLog(redText(' | No quotes to remove\n'));
            await interaction.reply({
                content: `**Oh!** Looks like you don't have any quotes in the queue to remove!`,
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        fs.rmSync(pathname, { recursive: true, force: true });
        await interaction.reply({
            content: `Your quote queue has been removed!`,
            flags: MessageFlags.Ephemeral
        });
    }
    
    if (MAINTENANCE) {
        await interaction.reply({
            content: '**Oh!** Looks like the bot is currently in maintenance mode: ' + require('./package.json').maintenance.reason,
            flags: MessageFlags.Ephemeral
        });
        return;
    }


    var maps = {
        'DELTARUNE Quote': 'dr_quote',
        'DELTARUNE Quote (Light World)': 'dr_quote_light',
        'Add To Multiple Quote Queue': 'dr_quote_multi_add'
    };
    if (!Object.keys(maps).includes(interaction.commandName)) return;

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
            content: `**Oh!** Looks like an error occurred... your interaction couldn't be processed.\n-# ${box.message}`,
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    if (!(box instanceof Buffer)) {
        partialLog(redText(' | Unknown error creating box\n'));
        await interaction.reply({
            content: `**Oh!** Looks like an unknown error occurred... your interaction couldn't be processed.`,
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    if (interactionId != 'dr_quote_multi_add') {
        await interaction.reply({
            files: [{
                attachment: await padImage(box, 10),
                name: 'quote.png'
            }],
            content: '',
        });
    }
    else {
        var pathname = path.join(__dirname, 'temp', interaction.user.id);
        if (!fs.existsSync(pathname)) fs.mkdirSync(pathname, { recursive: true });

        if (fs.readdirSync(pathname).length >= 10) {
            partialLog(redText(' | Quote queue limit reached\n'));
            await interaction.reply({
                content: `**Oh!** Looks like your queue has reached a maximum limit, ${interaction.user.username}! Please render or remove your current queue before adding more quotes!`,
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        var filePath = path.join(pathname, Date.now() + '.png');
        fs.writeFileSync(filePath, box);

        await interaction.reply({
            content: `Quote added to the queue!\n\nYou currently have **${fs.readdirSync(pathname).length}** quote(s) in the queue.\n\nOnce you are done, please run "/renderqueue" to make a final combined image and empty the cache.`,
            flags: MessageFlags.Ephemeral
        });
    }

    partialLog(greenText(' | Done\n'));
});

client.login(Secrets.token);
