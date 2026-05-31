require('dotenv').config();
const { Client, GatewayIntentBits, AttachmentBuilder } = require('discord.js');
const sharp = require('sharp');
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

async function applyTemplate(userImageBuffer, templatePath) {
  // Get template dimensions
  const templateMeta = await sharp(templatePath).metadata();
  const { width, height } = templateMeta;

  // Resize user image to match template size
  const resizedUser = await sharp(userImageBuffer)
    .resize(width, height, { fit: 'fill' })
    .png()
    .toBuffer();

  // Composite: template on top of user image
  const result = await sharp(resizedUser)
    .composite([{ input: templatePath, blend: 'over' }])
    .png({ compressionLevel: 0 }) // max quality
    .toBuffer();

  return result;
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

  const templateFile = command === 'shirt' ? 'shirt_template.png' : 'pants_template.png';
  const templatePath = path.join(__dirname, 'templates', templateFile);

  if (!fs.existsSync(templatePath)) {
    return message.reply(`❌ Missing template file \`templates/${templateFile}\`.`);
  }

  const imageAttachments = message.attachments.filter(
    (att) => att.contentType && att.contentType.startsWith('image/')
  );

  if (imageAttachments.size === 0) {
    const warn = await message.reply(`❌ Please attach at least one image with \`!${command}\`!`);
    setTimeout(() => warn.delete().catch(() => {}), 5000);
    return;
  }

  message.delete().catch(() => {});

  const processing = await message.channel.send(
    `⏳ Processing ${imageAttachments.size} image${imageAttachments.size > 1 ? 's' : ''}...`
  );

  try {
    const results = await Promise.all(
      imageAttachments.map(async (att, index) => {
        const imageBuffer = await downloadImage(att.url);
        const resultBuffer = await applyTemplate(imageBuffer, templatePath);
        return new AttachmentBuilder(resultBuffer, {
          name: `${command}_result_${index + 1}.png`,
        });
      })
    );

    await processing.edit({
      content: `✅ Here ${results.length > 1 ? 'are' : 'is'} your ${results.length} Roblox ${command}${results.length > 1 ? 's' : ''}!`,
      files: results,
    });
  } catch (err) {
    console.error(err);
    await processing.edit('❌ Something went wrong. Make sure your images are valid PNG or JPG files.');
  }
});

const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error('❌ Missing DISCORD_TOKEN environment variable!');
  process.exit(1);
}

client.login(token);
