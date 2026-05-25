require('dotenv').config();
const { Client, GatewayIntentBits, AttachmentBuilder } = require('discord.js');
const Jimp = require('jimp');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const PREFIX = '!';

// Download image from URL to buffer
function downloadImage(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    protocol.get(url, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

// Overlay user image onto template
async function applyTemplate(userImageBuffer, templatePath) {
  // Load template (must be PNG with transparency)
  const template = await Jimp.read(templatePath);
  const templateW = template.bitmap.width;
  const templateH = template.bitmap.height;

  // Load user image and resize to match template
  const userImage = await Jimp.read(userImageBuffer);
  userImage.resize(templateW, templateH);

  // Composite: user image goes UNDER the template
  // So template's opaque parts show on top, transparent parts reveal user image
  userImage.composite(template, 0, 0, {
    mode: Jimp.BLEND_SOURCE_OVER,
    opacitySource: 1,
    opacityDest: 1,
  });

  return await userImage.getBufferAsync(Jimp.MIME_PNG);
}

client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const command = args[0].toLowerCase();

  if (command !== 'shirt' && command !== 'pants') return;

  // Determine which template to use
  const templateFile = command === 'shirt' ? 'shirt_template.png' : 'pants_template.png';
  const templatePath = path.join(__dirname, 'templates', templateFile);

  // Check template exists
  if (!fs.existsSync(templatePath)) {
    return message.reply(
      `❌ Missing template file \`templates/${templateFile}\`. Please add it to the \`templates/\` folder.`
    );
  }

  // Check for attachment
  const attachment = message.attachments.first();
  if (!attachment) {
    return message.reply(
      `❌ Please attach an image! Example: \`!${command}\` with an image uploaded.`
    );
  }

  // Make sure it's an image
  if (!attachment.contentType || !attachment.contentType.startsWith('image/')) {
    return message.reply('❌ That file doesn\'t look like an image. Please upload a PNG or JPG.');
  }

  const processing = await message.reply('⏳ Processing your image...');

  try {
    const imageBuffer = await downloadImage(attachment.url);
    const resultBuffer = await applyTemplate(imageBuffer, templatePath);

    const file = new AttachmentBuilder(resultBuffer, { name: `${command}_result.png` });

    await processing.edit({
      content: `✅ Here's your Roblox ${command} template!`,
      files: [file],
    });
  } catch (err) {
    console.error(err);
    await processing.edit('❌ Something went wrong processing your image. Make sure it\'s a valid PNG or JPG.');
  }
});

const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error('❌ Missing DISCORD_TOKEN environment variable!');
  process.exit(1);
}

client.login(token);
