const fs = require('fs');
const path = require('path');

const UPLOADS_DIR = path.join(__dirname, 'uploads');
const DATA_DIR = path.join(__dirname, 'data');
const METADATA_FILE = path.join(DATA_DIR, 'folders.json');

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// Create a sample demo folder
const sampleFolderId = 'sample_demo_nature';
const sampleFolderPath = path.join(UPLOADS_DIR, sampleFolderId);
if (!fs.existsSync(sampleFolderPath)) fs.mkdirSync(sampleFolderPath, { recursive: true });

// Create 3 beautiful SVGs as sample images
const sampleImages = [
  {
    name: 'mountain_sunset.svg',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="400" height="300">
      <defs>
        <linearGradient id="sky" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#fd746c"/>
          <stop offset="100%" stop-color="#ff9068"/>
        </linearGradient>
      </defs>
      <rect width="400" height="300" fill="url(#sky)"/>
      <circle cx="200" cy="180" r="70" fill="#fffc00" opacity="0.8"/>
      <polygon points="50,300 200,120 350,300" fill="#355c7d"/>
      <polygon points="180,300 280,160 380,300" fill="#2a363b"/>
      <polygon points="0,300 120,180 240,300" fill="#6c5b7b" opacity="0.9"/>
    </svg>`
  },
  {
    name: 'ocean_waves.svg',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="400" height="300">
      <defs>
        <linearGradient id="ocean" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#2193b0"/>
          <stop offset="100%" stop-color="#6dd5ed"/>
        </linearGradient>
      </defs>
      <rect width="400" height="300" fill="url(#ocean)"/>
      <path d="M0,200 C150,150 250,250 400,200 L400,300 L0,300 Z" fill="#005c97" opacity="0.7"/>
      <path d="M0,230 C120,180 280,260 400,220 L400,300 L0,300 Z" fill="#003566"/>
    </svg>`
  },
  {
    name: 'forest_mist.svg',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="400" height="300">
      <defs>
        <linearGradient id="forest" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#134e5e"/>
          <stop offset="100%" stop-color="#71b280"/>
        </linearGradient>
      </defs>
      <rect width="400" height="300" fill="url(#forest)"/>
      <polygon points="100,300 100,200 70,200 100,120 130,200 100,200" fill="#0b2b1a"/>
      <polygon points="200,300 200,170 160,170 200,70 240,170 200,170" fill="#061c10"/>
      <polygon points="300,300 300,210 270,210 300,140 330,210 300,210" fill="#0d3b24"/>
    </svg>`
  }
];

const filesList = [];
let totalSize = 0;

sampleImages.forEach(img => {
  const filePath = path.join(sampleFolderPath, img.name);
  fs.writeFileSync(filePath, img.svg, 'utf8');
  const size = Buffer.byteLength(img.svg);
  totalSize += size;
  filesList.push({
    name: img.name,
    size: size,
    url: `/uploads/${sampleFolderId}/${img.name}`
  });
});

const sampleFolder = {
  id: sampleFolderId,
  name: 'Sample Nature Wallpapers',
  createdAt: new Date().toISOString(),
  imageCount: filesList.length,
  totalSizeBytes: totalSize,
  totalSizeFormatted: (totalSize / 1024).toFixed(1) + ' KB',
  files: filesList,
  previews: filesList.map(f => f.url)
};

fs.writeFileSync(METADATA_FILE, JSON.stringify([sampleFolder], null, 2));
console.log('Sample demo folder created successfully!');
