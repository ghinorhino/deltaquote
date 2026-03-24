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
const fs = require('fs');
const path = require('path');

const Secrets = JSON.parse(fs.readFileSync(path.join(__dirname, 'secrets.json'), 'utf-8'));

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
            .setName('DELTARUNE Quote')
            .setType(ApplicationCommandType.Message)
            .setIntegrationTypes([0, 1])
            .setContexts([0, 1, 2])
            .toJSON(),
        new ContextMenuCommandBuilder()
            .setName('Message in Heart Locket')
            .setType(ApplicationCommandType.Message)
            .setIntegrationTypes([0, 1])
            .setContexts([0, 1, 2])
            .toJSON(),
        new ContextMenuCommandBuilder()
            .setName('User as a Flag')
            .setType(ApplicationCommandType.User)
            .setIntegrationTypes([0, 1])
            .setContexts([0, 1, 2])
            .toJSON(),
        new ContextMenuCommandBuilder()
            .setName('Message on Billboard')
            .setType(ApplicationCommandType.Message)
            .setIntegrationTypes([0, 1])
            .setContexts([0, 1, 2])
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
        case 'DELTARUNE Quote':
            const repliedTo = interaction.targetMessage;
            var userPFP = repliedTo.author.displayAvatarURL({ format: 'png', size: 512 });
            var imageBuffer = await dlImage(userPFP.replace('.webp', '.png'));
            var circularImageBuffer = await makeCircularImage(imageBuffer, 256);

            var box;

            box = await require('./modules/deltarune_generator')(circularImageBuffer, repliedTo.content, false).catch(e => e);

            if (box instanceof Error) {
                await interaction.reply({
                    content: 'An error occurred while generating the DELTARUNE textbox. Please try again later.\n-#' + box.message,
                    flags: MessageFlags.Ephemeral
                });
            }

            await interaction.reply({
                files: [{
                    attachment: await padImage(box, 15),
                    name: 'quote.png'
                }],
                content: '',
            });

            break;
        case 'Message in Heart Locket':
            const msg = interaction.targetMessage;
            var userPFP = msg.author.displayAvatarURL({ format: 'png', size: 512 });
            var imageBuffer = await dlImage(userPFP.replace('.webp', '.png'));

            await interaction.deferReply();

            var gifBuffer = await require('./modules/heart_locket')(imageBuffer, msg.content);
                
            await interaction.editReply({
                files: [{
                    attachment: gifBuffer,
                    name: 'heart-locket.gif'
                }],
                content: '',
            });

            break;
        case 'User as a Flag':
            const user = interaction.targetUser;
            var userPFP = user.displayAvatarURL({ format: 'png', size: 512 });
            var imageBuffer = await dlImage(userPFP.replace('.webp', '.png'));

            await interaction.deferReply();

            var gifBuffer = await require('./modules/user_flag')(imageBuffer);

            await interaction.editReply({
                files: [{
                    attachment: gifBuffer,
                    name: 'flag.gif'
                }],
                content: '',
            });

            break;
        case 'Message on Billboard':
            const billboardMsg = interaction.targetMessage;
            var userPFP = billboardMsg.author.displayAvatarURL({ format: 'png', size: 512 });
            var imageBuffer = await dlImage(userPFP.replace('.webp', '.png'));

            await interaction.deferReply();

            var gifBuffer = await require('./modules/billboard')(imageBuffer, billboardMsg.content);

            await interaction.editReply({
                files: [{
                    attachment: gifBuffer,
                    name: 'billboard.gif'
                }],
                content: '',
            });
    }

    partialLog(greenText(' | Done\n'));
});

client.login(Secrets.token);
