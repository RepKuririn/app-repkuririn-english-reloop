# Subtitle Loop

A YouTube subtitle learning tool for language learners. Loop specific segments, save favorite phrases, and organize them into groups.

## Quick Start

```bash
# Install dependencies
npm install

# Build for development
npm run build

# Type check
npm run typecheck
```

## Loading the Extension in Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (top right toggle)
3. Click "Load unpacked"
4. Select the `dist` folder from this project

## Development Status

### ✅ Phase 1: Skeleton - COMPLETED
- ✅ Basic project structure
- ✅ Extension loads on YouTube
- ✅ Panel appears in sidebar
- ✅ TypeScript compilation working
- ✅ Vite build system configured

### ✅ Phase 2: Subtitles - COMPLETED
- ✅ Extract subtitles from YouTube transcript panel
- ✅ Display subtitles in scrollable list
- ✅ Click-to-seek functionality
- ✅ Current segment highlighting during playback
- ✅ Automatic sync with video playback

### ✅ Phase 3: Loop - COMPLETED
- ✅ A-B loop button (🔁) on each segment
- ✅ Two-step loop setting (start → end)
- ✅ Automatic loop playback
- ✅ Loop status display
- ✅ Loop clear button

### 🚧 Phase 4: Saving (Next)
- Save phrases to IndexedDB
- Save dialog UI
- Toast notifications

### 📋 Phase 5: Groups (Planned)
- Group management
- Full options page
- Phrase library

## How to Use

1. Open any YouTube video with captions
2. The extension panel will appear on the right side
3. Load subtitles by clicking the load button
4. **Loop Functionality:**
   - Click the **🔁** button on any subtitle to set loop start
   - Click the **🔁** button on another subtitle to set loop end
   - Video will automatically loop between the two points
   - Click **✖ クリア** to stop the loop
5. **Save & Organize:**
   - Click **💾** to save your favorite phrases
   - Organize them into custom groups
   - Access your library from the options page

## Project Structure

```
subtitle-loop/
├── src/
│   ├── types/          # TypeScript type definitions
│   ├── content/        # Content scripts (injected into YouTube)
│   ├── background/     # Service worker
│   ├── popup/          # Extension popup
│   └── options/        # Options/library page
├── public/icons/       # Extension icons
├── dist/               # Build output (load this in Chrome)
└── spec/               # Technical specifications
```

## Technology Stack

- TypeScript 5.4+
- Vite 7.x with @crxjs/vite-plugin
- IndexedDB (Dexie.js)
- Chrome Extension Manifest V3
- Vanilla JavaScript/CSS (no frameworks)

## Design Principles

- **KISS**: Keep It Simple - no complex abstractions
- **YAGNI**: You Aren't Gonna Need It - build only what's needed
- **DOM-First**: Extract data from YouTube's DOM, no external APIs
- **Incremental**: Build and verify one feature at a time

## Port Configuration

- Vite dev server: 5173

## License

ISC
