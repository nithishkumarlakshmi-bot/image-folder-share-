const express = require('express');
const cors = require('cors');
const multer = require('multer');
const archiver = require('archiver');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

// Supabase credentials
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://phfusgxxorzoupoqknfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBoZnVzZ3h4b3J6b3Vwb3FrbmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MzYyMzAzMCwiZXhwIjoyMTA5MTk5MDMwfQ.ul-HFuHQMubtlhORWZs_fG9cx_g7KaXa2u2Fllm5T6Q';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// Multer memory storage (upload directly to Supabase cloud)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB per file
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Helper to stream zip archive directly from Supabase
async function streamZip(folder, res) {
  const safeFilename = (folder.name || 'folder').replace(/[^a-zA-Z0-9_-]/g, '_');

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}.zip"`);

  const archive = archiver('zip', { zlib: { level: 5 } });
  archive.on('error', (err) => {
    console.error('Archive error:', err);
    if (!res.headersSent) res.status(500).send({ error: err.message });
  });

  archive.pipe(res);

  for (const file of folder.files || []) {
    try {
      if (file.path) {
        const { data: fileBlob } = await supabase.storage.from('folders').download(file.path);
        if (fileBlob) {
          const buf = Buffer.from(await fileBlob.arrayBuffer());
          archive.append(buf, { name: `${safeFilename}/${file.name}` });
          continue;
        }
      }
      if (file.url) {
        const resp = await fetch(file.url);
        if (resp.ok) {
          const buf = Buffer.from(await resp.arrayBuffer());
          archive.append(buf, { name: `${safeFilename}/${file.name}` });
        }
      }
    } catch (err) {
      console.error(`Error streaming file "${file.name}":`, err);
    }
  }

  archive.finalize();
}

// 1. Get all folders (Public Feed from Supabase)
app.get('/api/folders', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('folders')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const mapped = (data || []).map(f => ({
      id: f.id,
      name: f.name,
      code: f.code,
      slug: f.slug,
      createdAt: f.created_at,
      imageCount: f.image_count,
      totalSizeBytes: f.total_size_bytes,
      totalSizeFormatted: f.total_size_formatted,
      files: f.files,
      previews: f.previews
    }));

    res.json(mapped);
  } catch (err) {
    console.error('Failed to get folders:', err);
    res.status(500).json({ error: 'Failed to fetch folders' });
  }
});

// 2. Upload folder directly to Supabase Storage & Database
app.post('/api/upload', upload.array('images', 200), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No image files uploaded' });
    }

    const folderName = (req.body.folderName || 'Image Collection').trim();
    const folderId = 'fld_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);

    const uploadedFiles = [];
    let totalSize = 0;

    for (const file of req.files) {
      const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
      const storagePath = `${folderId}/${safeName}`;

      const { error: uploadErr } = await supabase.storage
        .from('folders')
        .upload(storagePath, file.buffer, {
          contentType: file.mimetype || 'image/jpeg',
          upsert: true
        });

      if (uploadErr) {
        console.error('Error uploading to Supabase:', uploadErr);
        continue;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('folders')
        .getPublicUrl(storagePath);

      uploadedFiles.push({
        name: safeName,
        size: file.size,
        path: storagePath,
        url: publicUrl
      });

      totalSize += file.size;
    }

    if (uploadedFiles.length === 0) {
      return res.status(500).json({ error: 'Failed to upload files to cloud storage' });
    }

    // Assign sequential code
    const { data: existing } = await supabase.from('folders').select('code');
    const maxCode = existing && existing.length > 0 ? Math.max(...existing.map(e => e.code || 0)) : 0;
    const nextCode = maxCode + 1;
    const slug = folderName.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();

    const newFolder = {
      id: folderId,
      name: folderName,
      code: nextCode,
      slug: slug,
      created_at: new Date().toISOString(),
      image_count: uploadedFiles.length,
      total_size_bytes: totalSize,
      total_size_formatted: formatBytes(totalSize),
      files: uploadedFiles,
      previews: uploadedFiles.slice(0, 4).map(f => f.url)
    };

    const { error: dbErr } = await supabase.from('folders').insert(newFolder);
    if (dbErr) throw dbErr;

    res.json({
      success: true,
      folder: {
        ...newFolder,
        createdAt: newFolder.created_at,
        imageCount: newFolder.image_count,
        totalSizeBytes: newFolder.total_size_bytes,
        totalSizeFormatted: newFolder.total_size_formatted
      }
    });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 3. Ultra-simple download by folder name, slug, or code: /Experiment_1(a).zip, /1.zip, etc.
app.get('/:identifier.zip', async (req, res, next) => {
  try {
    let raw = req.params.identifier;
    try { raw = decodeURIComponent(raw); } catch (e) {}
    const target = raw.toLowerCase().trim();

    const { data: folders } = await supabase.from('folders').select('*');
    if (!folders) return next();

    const folder = folders.find(f => 
      (f.name && f.name.toLowerCase().trim() === target) ||
      (f.slug && f.slug.toLowerCase().trim() === target) ||
      (f.code && f.code.toString() === target) ||
      (f.id && f.id.toLowerCase() === target)
    );

    if (folder) {
      return await streamZip(folder, res);
    }
    next();
  } catch (err) {
    console.error('Download error:', err);
    res.status(500).send('Error preparing download');
  }
});

// 4. Download by full API endpoint: /api/folders/:id/download
app.get('/api/folders/:id/download', async (req, res) => {
  try {
    const { data: folders } = await supabase.from('folders').select('*');
    const folder = (folders || []).find(f => f.id === req.params.id || (f.code && f.code.toString() === req.params.id));

    if (!folder) {
      return res.status(404).send('Folder not found');
    }

    await streamZip(folder, res);
  } catch (err) {
    console.error('API download error:', err);
    res.status(500).send('Error preparing download');
  }
});

// 5. Delete folder
app.delete('/api/folders/:id', async (req, res) => {
  try {
    const { data: folder } = await supabase
      .from('folders')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (!folder) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    // Delete files from storage
    if (folder.files && folder.files.length > 0) {
      const paths = folder.files.map(f => f.path).filter(Boolean);
      if (paths.length > 0) {
        await supabase.storage.from('folders').remove(paths);
      }
    }

    // Delete row from database
    await supabase.from('folders').delete().eq('id', req.params.id);

    res.json({ success: true });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(` FolderShare App (Supabase Cloud Storage Active)`);
  console.log(` 👉 http://localhost:${PORT}`);
  console.log(`======================================================\n`);
});
