# FolderShare 📁

A simple, 100% free web application where anyone can upload image folders, and visitors can browse and download any folder in a single click from their browser.

---

## 🚀 How to Run Locally

1. Open your terminal in this directory:
   ```bash
   cd image-folder-share
   npm start
   ```
2. Open your browser and go to:
   ```
   http://localhost:3000
   ```

---

## 🌐 How to Share it Publicly on the Internet for $0

If you want anyone in the world to access your website:
Run this single command in a terminal:
```bash
npx localtunnel --port 3000
```
It gives you a free public web link (like `https://bright-panda-12.loca.lt`) that anyone can open in their browser to upload and download!

---

## ✨ Features

- **Folder Upload**: Drag and drop any folder containing images or click "Select Entire Folder" (`webkitdirectory`).
- **Global Public Feed**: Shows all uploaded folders with thumbnail grids, file sizes, and image counts.
- **1-Click Web Download**: Click the green **"Download Folder (1-Click)"** button on any folder card to immediately download all images bundled in a `.zip`.
- **Image Inspector**: Click **"View All Images"** to preview all pictures in full resolution inside a modal before downloading.
- **Delete Option**: Clean up or delete folders whenever you want.
