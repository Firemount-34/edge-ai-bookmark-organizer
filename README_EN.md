# 🔖 AI Bookmark Organizer (Edge / Chrome Extension)

<p align="center">
  <img src="icons/icon128.png" width="96" height="96" alt="AI Bookmark Organizer Logo">
</p>

<p align="center">
  <strong>An intelligent browser bookmark organizer built on Manifest V3 for Microsoft Edge & Google Chrome</strong><br>
  Powered by mainstream LLM APIs to deduplicate, clean tracking URLs, normalize titles, and reorganize messy bookmarks into a clean two-level hierarchy in one click.
</p>

<p align="center">
  <a href="./README.md">简体中文</a> | <strong>English</strong>
</p>

---

## ✨ Key Features

- 🤖 **Out-of-the-Box Support for Popular LLMs**
  - Built-in presets for **DeepSeek**, **SiliconFlow**, **Alibaba Cloud / Qwen**, **Volcengine (Doubao)**, **OpenAI (ChatGPT)**, and **Google Gemini**.
  - Full compatibility with any **OpenAI-compatible endpoint** and local **Ollama** models.
  - One-click **"⚡ Test Connection"** button. Your API Key is stored strictly locally in `chrome.storage.local` with zero third-party proxy servers.
- 🧹 **Automatic Deduplication & Deep URL Sanitization**
  - Automatically identifies and merges duplicate bookmark URLs.
  - Strips marketing/tracking query parameters (`utm_*`, `msclkid`, `gclid`, `fbclid`, `refpid`, `_gl`, etc.) and expiring session tokens.
- 🏷️ **Smart Title Normalization & Two-Level Hierarchy**
  - Converts cryptic abbreviations (e.g., manuscript submission portals like `twc`, `wcl`, `cl` or router models like `D196G`) and bloated SEO titles into clean, readable titles.
  - Supports custom prompt instructions to organize bookmarks into a structured **"Top-Level Category (with Emoji) + Second-Level Subfolder"** hierarchy.
- 🛡️ **100% Zero-Loss Guarantee & Safe Rollback**
  - **Numeric ID Mapping**: The LLM only returns numeric bookmark IDs and normalized titles while the original URLs are preserved locally—eliminating any risk of hallucinated or corrupted links.
  - **Chunked Requests**: Processes bookmarks in configurable batches (80 / 120 / 200 items) while automatically aligning top-level categories across batches. Any unassigned bookmark is safely caught in a fallback category (`📌 Uncategorized`).
  - **Dual Apply Modes**:
    - **🛡️ Safe Mode (Default)**: Creates a new `✨ AI Organized Bookmarks (Timestamp)` folder inside your Favorites Bar without touching existing bookmarks.
    - **🔄 Replace Mode**: Automatically backs up your current Favorites Bar into `Other Favorites` before replacing it, plus one-click export to standard Netscape `.html` bookmark backup files.
- 🖥️ **Visual Dual-Column Comparison Workspace**
  - Side-by-side equal-height comparison between **"📂 Current Bookmark Structure"** and **"✨ AI Organized Preview"**.
  - Live statistics cards comparing before/after category counts (`X Top Categories / Y Subcategories`) and unified recursive bookmark count badges on every folder.
  - Inline editing (`✏️`) for any category, subfolder, or bookmark title before applying changes to your browser.

---

## 🚀 Installation (Microsoft Edge / Google Chrome)

1. **Clone or Download this Repository**
   ```bash
   git clone https://github.com/Firemount-34/edge-ai-bookmark-organizer.git
   ```
   *(Alternatively, download the pre-packaged `edge-ai-bookmark-organizer-v1.0.0.zip` from [Releases](https://github.com/Firemount-34/edge-ai-bookmark-organizer/releases) and extract it.)*
2. **Enable Developer Mode**
   - **Microsoft Edge**: Navigate to `edge://extensions/` and toggle on **Developer mode** (left sidebar or top-right).
   - **Google Chrome**: Navigate to `chrome://extensions/` and toggle on **Developer mode** (top-right).
3. **Load Unpacked Extension**
   - Click **Load unpacked** and select the `edge-ai-bookmark-organizer` folder.
4. **Open the Workspace**
   - Click the **AI Bookmark Organizer** icon in your browser toolbar to launch the full-screen dashboard.

---

## 📖 Quick Start Guide

1. **Configure LLM API**:
   - Select a provider preset (e.g., `DeepSeek`, `SiliconFlow`, `OpenAI`, or `Gemini`) and enter your `API Key`.
   - Click **"⚡ Test Connection"** to verify connectivity and **"💾 Save Config"** to store your settings locally.
2. **Customize Organization Strategy**:
   - Choose the target bookmark folder (defaults to `Favorites Bar`).
   - Toggle deduplication, URL cleaning, and title normalization, and optionally customize the categorization prompt.
3. **Preview & Fine-Tune**:
   - Click **"✨ Start AI Smart Organization Preview"**.
   - Inspect the generated two-level structure in the right panel. Click `✏️` next to any folder or bookmark to rename it, or use the search bar and **"Expand All / Collapse All"** toggle.
4. **Apply or Export**:
   - Select **Safe Mode** or **Replace Mode**, then click **"🚀 Apply to Edge Favorites"** or **"📥 Export Organized HTML"**.

---

## 📁 Project Structure

```text
edge-ai-bookmark-organizer/
├── manifest.json      # Manifest V3 extension configuration
├── background.js      # Service Worker (opens full-screen dashboard on click)
├── dashboard.html     # Dual-column comparison workspace UI
├── dashboard.css      # Responsive equal-height layout & tree component styles
├── dashboard.js       # Bookmark parsing, URL cleaning, LLM batching & apply logic
├── icons/             # Extension icons (16x16, 48x48, 128x128)
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── README.md          # Chinese documentation (简体中文)
└── README_EN.md       # English documentation
```

---

## 👤 Author

- **Firemount** (<ww157534@gmail.com>)

## 📄 License

MIT License
