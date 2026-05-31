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
    protocol.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      // Follow redirects
      if (res.statusCode === 301 || res.statusCode === 302) {
        return downloadImage(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`Failed to download image: HTTP ${res.statusCode}`));
      }
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        if (buf.length === 0) return reject(new Error('Downloaded empty buffer'));
        resolve(buf);
      });
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function applyTemplate(userImageBuffer, templatePath) {
  const templateMeta = await sharp(templatePath).metadata();
  const { width, height } = templateMeta;

  const resizedUser = await sharp(userImageBuffer)
    .resize(width, height, { fit: 'fill' })
    .png()
    .toBuffer();

  const result = await sharp(resizedUser)
    .composite([{ input: templatePath, blend: 'over' }])
    .png({ compressionLevel: 0 })
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

  // Snapshot URLs immediately before deleting the message
  const attachmentList = imageAttachments.map((att, i) => ({ url: att.url, index: i }));

  message.delete().catch(() => {});

  const processing = await message.channel.send(
    `⏳ Processing ${attachmentList.length} image${attachmentList.length > 1 ? 's' : ''}...`
  );

  try {
    const results = await Promise.all(
      attachmentList.map(async ({ url, index }) => {
        const imageBuffer = await downloadImage(url);
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
    await processing.edit('❌ Something went wrong: ' + err.message);
  }
});

const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error('❌ Missing DISCORD_TOKEN environment variable!');
  process.exit(1);
}

client.login(token);
