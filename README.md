# Roblox Template Discord Bot

A Discord bot that overlays your image onto Roblox shirt/pants templates.

## Commands

| Command | Description |
|---------|-------------|
| `!shirt` + image | Applies your image onto the shirt template |
| `!pants` + image | Applies your image onto the pants template |

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Add your templates
Create a `templates/` folder and add your template PNG files:
```
templates/
├── shirt_template.png   ← your shirt template (with transparency)
└── pants_template.png   ← your pants template (with transparency)
```

> ⚠️ Templates MUST be PNG files with transparent areas where the user's image should show through.

### 3. Set your bot token
Create a `.env` file or set it in Railway:
```
DISCORD_TOKEN=your_token_here
```

Or on Railway: go to **Variables** tab and add `DISCORD_TOKEN`.

### 4. Run the bot
```bash
npm start
```

## Deploy to Railway

1. Push this folder to a GitHub repo
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Add `DISCORD_TOKEN` in the Variables tab
4. Railway will auto-start the bot

## How it works

1. User runs `!shirt` or `!pants` and attaches an image
2. Bot downloads the image and resizes it to match the template size
3. Bot composites the template ON TOP of the user's image
4. The template's transparent areas reveal the user's image underneath
5. The template's opaque areas (borders, labels) stay on top
6. Result is sent back to Discord as a PNG
