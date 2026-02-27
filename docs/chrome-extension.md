# REBAR Chrome Extension (MVP)

This extension supports:

- Save selected highlight text from any page
- Scrape article-like page text and save
- Save directly to REBAR via `POST /api/capture/share` from extension background worker
- Right-click instant save via context menu (no popup step)

## Folder

- `extension/manifest.json`
- `extension/background.js`
- `extension/content.js`
- `extension/popup.*`
- `extension/options.*`

## Setup

1. Open Chrome extensions page: `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** and select `extension/`
4. Open extension **Options** and set:
   - Default tags

## Usage

### Save Highlight

1. Select text in a web page
2. Click extension popup
3. Click **Clip Highlight**
4. Preview appears in popup; edit fields if needed
5. Click **Save to REBAR**

### Instant Save Highlight (Right-click)

1. Select text in a web page
2. Right-click the selected text
3. Click **Save Highlight to REBAR**
4. Extension saves immediately

### Save Article

1. Open article page
2. Click extension popup
3. Click **Clip Article**
4. Extension saves immediately

### Instant Clip Article (Right-click)

1. Open article page
2. Right-click the page background
3. Click **Clip Article to REBAR**
4. Extension saves immediately

## Notes

- Current implementation uses simple DOM extraction (article/main/content-like blocks)
- Captures are sent directly from extension background worker to `/api/capture/share`
- Extension is fixed to `https://rebarops.com` and uses login session (`credentials: include`)
