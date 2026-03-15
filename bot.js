const { 
    Client, 
    GatewayIntentBits, 
    Events,
    REST,
    Routes,
    ContextMenuCommandBuilder,
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

async function makeCircularImage(imageBuffer, size) {
    // Load image from buffer
    const image = await loadImage(imageBuffer);

    // Add 10px padding
    const padding = 10;
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
    console.log(`Logged in as ${client.user.tag}! Deploying commands...`);

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
            .toJSON()
    ];

    const rest = new REST({ version: '10' }).setToken(Secrets.token);
    await rest.put(
        Routes.applicationCommands(Secrets.clientId),
        { body: commands }
    );

    console.log('Successfully registered globally.');
});

client.on(Events.InteractionCreate, async (interaction) => {
    var maps = {
        'DELTARUNE Quote': 'dr_quote',
        'DELTARUNE Quote (Light World)': 'dr_quote_light',
        'dialoguebox': 'dr_quote_slash'
    };
    if (!Object.keys(maps).includes(interaction.commandName)) return;

    var interactionId = maps[interaction.commandName];

    const repliedTo = interaction.targetMessage;

    var userPFP = repliedTo.author.displayAvatarURL({ format: 'png', size: 512 });
    var imageBuffer = await dlImage(userPFP.replace('.webp', '.png'));
    var circularImageBuffer = await makeCircularImage(imageBuffer, 256);

    var box = await require('./box')(circularImageBuffer, repliedTo.content).catch(e => e);

    if (box instanceof Error) {
        await interaction.reply({
            content: `Error: ${box.message}`,
            ephemeral: true
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

    fs.rmSync(box.path);
});

client.login(Secrets.token);
