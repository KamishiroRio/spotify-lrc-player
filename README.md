# 🎧 Kamishiro Spotify LRC Player

A powerful, highly integrated custom lyrics player for Spotify. It bridges the gap between official limitations and a premium, synchronized-lyrics experience. 

## ✨ Features
* **Seamless UI Integration**: Natively injects a custom `🎵 LRC` toggle button into the Spotify UI.
* **Dynamic Gradient Theme**: Automatically extracts the dominant color from your album art to generate an immersive, self-adapting gradient background.
* **Smart Syncing**: 
  * **Web (Chrome Ext)**: Uses synthetic `PointerEvent` dispatching to bypass React event listeners for precise seeking.
  * **Desktop (Spicetify)**: Deeply integrated with `Spicetify.Player` API for zero-latency seeking and event-driven state management.
* **State Preservation**: Uses a custom radar algorithm to detect and remember your scroll position, ensuring a perfect browsing experience when closing the lyrics panel.

## 🚀 Installation

### For Web (Chrome Extension)
1. Clone this repo: `git clone https://github.com/yourusername/spotify-lrc-player.git`
2. Open Chrome and go to `chrome://extensions/`.
3. Enable "Developer mode" (top right).
4. Click "Load unpacked" and select this project folder.
5. Refresh your Spotify Web Player.

### For Desktop (Spicetify)
1. Ensure [Spicetify](https://spicetify.app/) is installed.
2. Copy `kamishiro-lyrics.js` to your Spicetify `Extensions` folder.
3. Run: `spicetify config extensions kamishiro-lyrics.js`
4. Run: `spicetify apply`

## 🛠️ Tech Stack
* **Frontend**: Vanilla JavaScript (ES6+), DOM Manipulation, Canvas API (for dynamic themes).
* **Environment Interop**: Chrome Extension Manifest V3 / Spicetify CLI (Desktop).
* **Communication**: REST API (via `fetch`) for fetching `.lrc` sync data.

---
*Created by KamishiroRio. Built for Spotify Power-Users.*