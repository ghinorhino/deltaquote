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

function sanitizeText(text) {
    var prohibitedChars = ['#', '*', '_', '~', '`', '|', '\n', '\r', '"'];
    var sanitized = text;
    prohibitedChars.forEach(char => {
        var regex = new RegExp(`\\${char}`, 'g');
        sanitized = sanitized.replace(regex, '');
    });
    return sanitized;
}

async function makeCircularImage(imageBuffer, size) {
  // Load image from buffer
  const image = await loadImage(imageBuffer);

  // Create square canvas
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Create circular clipping path
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();

  // Draw image centered & scaled to cover
  const scale = Math.max(size / image.width, size / image.height);
  const x = (size - image.width * scale) / 2;
  const y = (size - image.height * scale) / 2;

  ctx.drawImage(
    image,
    x,
    y,
    image.width * scale,
    image.height * scale
  );

  // Add 2px solid white circle border
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, (size / 2) - 1, 0, Math.PI * 2);
    ctx.closePath();
    ctx.stroke();

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

    var module = fs.readFileSync(path.join(__dirname, 'modules', `${interactionId == 'dr_quote_light' ? 'dr_quote' : interactionId}.js`), 'utf-8');
    (async () => { eval(module); })(); // yes i know eval is bad i promise i will require the module properly in the future
});

client.login(Secrets.token);
