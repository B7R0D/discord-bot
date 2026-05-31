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
  const template = await Jimp.read(templatePath);
  const templateW = template.bitmap.width;
  const templateH = template.bitmap.height;

  const userImage = await Jimp.read(userImageBuffer);
  userImage.resize(templateW, templateH, Jimp.RESIZE_BICUBIC);

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

  const templateFile = command === 'shirt' ? 'shirt_template.png' : 'pants_template.png';
  const templatePath = path.join(__dirname, 'templates', templateFile);

  if (!fs.existsSync(templatePath)) {
    return message.reply(`❌ Missing template file \`templates/${templateFile}\`.`);
  }

  // Filter only image attachments
  const imageAttachments = message.attachments.filter(
    (att) => att.contentType && att.contentType.startsWith('image/')
  );

  if (imageAttachments.size === 0) {
    const warn = await message.reply(`❌ Please attach at least one image with \`!${command}\`!`);
    // Delete warning after 5 seconds
    setTimeout(() => warn.delete().catch(() => {}), 5000);
    return;
  }

  // Delete the user's command message
  message.delete().catch(() => {});

  const processing = await message.channel.send(
    `⏳ Processing ${imageAttachments.size} image${imageAttachments.size > 1 ? 's' : ''}...`
  );

  try {
    // Process all images in parallel
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
    await processing.edit('❌ Something went wrong processing your images. Make sure they are valid PNG or JPG files.');
  }
});

const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error('❌ Missing DISCORD_TOKEN environment variable!');
  process.exit(1);
}

client.login(token);
