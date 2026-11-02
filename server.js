const express = require('express');
const cors = require('cors');
const multer = require('multer');
const archiver = require('archiver');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Setup directories
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const DATA_DIR = path.join(__dirname, 'data');
const METADATA_FILE = path.join(DATA_DIR, 'folders.json');

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(METADATA_FILE)) fs.writeFileSync(METADATA_FILE, JSON.stringify([]));

// Helpers for metadata storage
function getFolders() {
  try {
    const raw = fs.readFileSync(METADATA_FILE, 'utf8');
    const folders = JSON.parse(raw);
    // Ensure all folders have code and slug
    let changed = false;
    folders.forEach((f, idx) => {
      if (!f.code) {
        f.code = idx + 1;
        changed = true;
      }
      if (!f.slug) {
        f.slug = (f.name || 'folder').replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
        changed = true;
      }
    });
    if (changed) saveFolders(folders);
    return folders;
  } catch (err) {
    return [];
  }
}

function saveFolders(folders) {
  fs.writeFileSync(METADATA_FILE, JSON.stringify(folders, null, 2));
}

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// Multer storage engine
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!req.folderId) {
      req.folderId = 'fld_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
    }
    const folderPath = path.join(UPLOADS_DIR, req.folderId);
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }
    cb(null, folderPath);
  },
  filename: (req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, safeName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB per file
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(UPLOADS_DIR));

// Helper to stream zip archive
function streamZip(folder, res) {
  const folderPath = path.join(UPLOADS_DIR, folder.id);
  if (!fs.existsSync(folderPath)) {
    return res.status(404).send('Folder files not found on disk');
  }

  const safeFilename = (folder.name || 'folder').replace(/[^a-zA-Z0-9_-]/g, '_');

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}.zip"`);

  const archive = archiver('zip', { zlib: { level: 5 } });
  archive.on('error', (err) => res.status(500).send({ error: err.message }));
  archive.pipe(res);

  archive.directory(folderPath, safeFilename);
  archive.finalize();
}

// 1. Get all folders (Public Feed)
app.get('/api/folders', (req, res) => {
  const folders = getFolders();
  res.json(folders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
});

// 2. Upload folder
app.post('/api/upload', upload.array('images', 200), (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No image files uploaded' });
  }

  const folderName = (req.body.folderName || 'Image Collection').trim();
  const folderId = req.folderId;
  const filesList = req.files.map(f => ({
    name: f.filename,
    size: f.size,
    url: `/uploads/${folderId}/${f.filename}`
  }));

  const totalSize = filesList.reduce((acc, f) => acc + f.size, 0);
  const folders = getFolders();
  
  // Calculate next simple short code number (1, 2, 3...)
  const nextCode = folders.length > 0 ? Math.max(...folders.map(f => f.code || 0)) + 1 : 1;
  const slug = folderName.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();

  const newFolder = {
    id: folderId,
    code: nextCode,
    slug: slug,
    name: folderName,
    createdAt: new Date().toISOString(),
    imageCount: filesList.length,
    totalSizeBytes: totalSize,
    totalSizeFormatted: formatBytes(totalSize),
    files: filesList,
    previews: filesList.slice(0, 4).map(f => f.url)
  };

  folders.push(newFolder);
  saveFolders(folders);

  res.json({ success: true, folder: newFolder });
});

// 3. Ultra-simple download by folder name, slug, or short code: /Experiment_1(a).zip, /1.zip, etc.
app.get('/:identifier.zip', (req, res, next) => {
  let raw = req.params.identifier;
  try { raw = decodeURIComponent(raw); } catch (e) {}
  const target = raw.toLowerCase().trim();
  const folders = getFolders();

  const folder = folders.find(f => 
    (f.name && f.name.toLowerCase().trim() === target) ||
    (f.slug && f.slug.toLowerCase().trim() === target) ||
    (f.code && f.code.toString() === target) ||
    (f.id && f.id.toLowerCase() === target)
  );

  if (folder) {
    return streamZip(folder, res);
  }
  next();
});

// 4. Download by full API endpoint: /api/folders/:id/download
app.get('/api/folders/:id/download', (req, res) => {
  const folders = getFolders();
  const folder = folders.find(f => f.id === req.params.id || (f.code && f.code.toString() === req.params.id));

  if (!folder) {
    return res.status(404).send('Folder not found');
  }

  streamZip(folder, res);
});

// 5. Delete folder
app.delete('/api/folders/:id', (req, res) => {
  const folders = getFolders();
  const idx = folders.findIndex(f => f.id === req.params.id);

  if (idx === -1) {
    return res.status(404).json({ error: 'Folder not found' });
  }

  const folderId = folders[idx].id;
  const folderPath = path.join(UPLOADS_DIR, folderId);

  if (fs.existsSync(folderPath)) {
    fs.rmSync(folderPath, { recursive: true, force: true });
  }

  folders.splice(idx, 1);
  saveFolders(folders);

  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(` FolderShare App running at:`);
  console.log(` 👉 http://localhost:${PORT}`);
  console.log(`======================================================\n`);
});
