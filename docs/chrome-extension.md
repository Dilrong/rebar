# REBAR Chrome Extension (MVP)

This extension supports:

- Save selected highlight text from any page
- Scrape article-like page text and save
- Open REBAR `/share` with prefilled payload (`auto=1`) for login-based save flow

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
   - API Base URL (example: `https://<your-domain>`)
   - Default tags

## Usage

### Save Highlight

1. Select text in a web page
2. Click extension popup
3. Click **Clip Highlight**
4. REBAR Share page opens with prefilled content and auto-save mode
5. If not logged in, sign in and save resumes on return to `/share`

### Save Article

1. Open article page
2. Click extension popup
3. Click **Clip Article**
4. REBAR Share page opens with prefilled content and auto-save mode

## Notes

- Current implementation uses simple DOM extraction (article/main/content-like blocks)
- Captures are forwarded to `/share` query parameters (`content/title/url/tags/auto=1`)
- Actual persistence still uses `/api/capture/share` from the authenticated web app session
