// State
let selectedFiles = [];
let allFolders = [];

// DOM Elements
const dropzone = document.getElementById('dropzone');
const folderInput = document.getElementById('folderInput');
const filesInput = document.getElementById('filesInput');
const selectedInfo = document.getElementById('selectedInfo');
const fileCountBadge = document.getElementById('fileCountBadge');
const fileSizeBadge = document.getElementById('fileSizeBadge');
const customFolderName = document.getElementById('customFolderName');
const cancelSelectBtn = document.getElementById('cancelSelectBtn');
const startUploadBtn = document.getElementById('startUploadBtn');
const progressWrapper = document.getElementById('progressWrapper');
const progressBar = document.getElementById('progressBar');
const progressPercent = document.getElementById('progressPercent');
const foldersGrid = document.getElementById('foldersGrid');
const emptyFeed = document.getElementById('emptyFeed');
const searchInput = document.getElementById('searchInput');

// Modal Elements
const galleryModal = document.getElementById('galleryModal');
const modalFolderName = document.getElementById('modalFolderName');
const modalImageCount = document.getElementById('modalImageCount');
const modalImagesContainer = document.getElementById('modalImagesContainer');
const modalDownloadBtn = document.getElementById('modalDownloadBtn');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  loadFolders();
  setupEventListeners();
});

function setupEventListeners() {
  // Folder Input
  folderInput.addEventListener('change', (e) => handleFiles(e.target.files));
  filesInput.addEventListener('change', (e) => handleFiles(e.target.files));

  // Drag & Drop
  ['dragenter', 'dragover'].forEach(name => {
    dropzone.addEventListener(name, (e) => {
      e.preventDefault();
      dropzone.classList.add('border-indigo-500', 'bg-indigo-950/30');
    });
  });

  ['dragleave', 'drop'].forEach(name => {
    dropzone.addEventListener(name, (e) => {
      e.preventDefault();
      dropzone.classList.remove('border-indigo-500', 'bg-indigo-950/30');
    });
  });

  dropzone.addEventListener('drop', (e) => {
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFiles(files);
    }
  });

  // Actions
  cancelSelectBtn.addEventListener('click', clearSelection);
  startUploadBtn.addEventListener('click', uploadFiles);
  searchInput.addEventListener('input', (e) => filterFolders(e.target.value));
}

// Handle File Selection
function handleFiles(files) {
  const fileArray = Array.from(files);
  const imageFiles = fileArray.filter(f => f.type.startsWith('image/') || /\.(jpe?g|png|webp|gif|svg)$/i.test(f.name));

  if (imageFiles.length === 0) {
    showToast('No image files found in the selection!', 'error');
    return;
  }

  selectedFiles = imageFiles;

  let detectedName = '';
  if (selectedFiles[0].webkitRelativePath) {
    const parts = selectedFiles[0].webkitRelativePath.split('/');
    if (parts.length > 1) {
      detectedName = parts[0];
    }
  }

  if (detectedName) {
    customFolderName.value = detectedName;
  } else if (!customFolderName.value) {
    customFolderName.value = `Folder ${new Date().toLocaleDateString()}`;
  }

  const totalBytes = selectedFiles.reduce((acc, f) => acc + f.size, 0);
  fileCountBadge.textContent = `${selectedFiles.length} image${selectedFiles.length === 1 ? '' : 's'} selected`;
  fileSizeBadge.textContent = `Total size: ${(totalBytes / (1024 * 1024)).toFixed(2)} MB`;

  selectedInfo.classList.remove('hidden');
}

function clearSelection() {
  selectedFiles = [];
  folderInput.value = '';
  filesInput.value = '';
  customFolderName.value = '';
  selectedInfo.classList.add('hidden');
  progressWrapper.classList.add('hidden');
  progressBar.style.width = '0%';
  startUploadBtn.disabled = false;
}

// Upload Files via XHR for Progress
function uploadFiles() {
  if (selectedFiles.length === 0) return;

  const folderName = customFolderName.value.trim() || 'Images';
  const formData = new FormData();
  formData.append('folderName', folderName);

  selectedFiles.forEach(file => {
    formData.append('images', file, file.name);
  });

  const xhr = new XMLHttpRequest();
  xhr.open('POST', '/api/upload', true);

  progressWrapper.classList.remove('hidden');
  startUploadBtn.disabled = true;
  cancelSelectBtn.classList.add('hidden');

  xhr.upload.onprogress = (e) => {
    if (e.lengthComputable) {
      const percent = Math.round((e.loaded / e.total) * 100);
      progressBar.style.width = percent + '%';
      progressPercent.textContent = percent + '%';
    }
  };

  xhr.onload = () => {
    if (xhr.status === 200) {
      showToast('Folder uploaded successfully!', 'success');
      clearSelection();
      cancelSelectBtn.classList.remove('hidden');
      loadFolders();
    } else {
      showToast('Upload failed. Please try again.', 'error');
      startUploadBtn.disabled = false;
      cancelSelectBtn.classList.remove('hidden');
    }
  };

  xhr.onerror = () => {
    showToast('Network error during upload', 'error');
    startUploadBtn.disabled = false;
    cancelSelectBtn.classList.remove('hidden');
  };

  xhr.send(formData);
}

// Fetch and render folders
async function loadFolders() {
  try {
    const res = await fetch('/api/folders');
    allFolders = await res.json();
    renderFolders(allFolders);
  } catch (err) {
    console.error('Failed to load folders:', err);
  }
}

function renderFolders(folders) {
  foldersGrid.innerHTML = '';

  if (folders.length === 0) {
    emptyFeed.classList.remove('hidden');
    return;
  }
  emptyFeed.classList.add('hidden');

  const origin = window.location.origin;

  folders.forEach(folder => {
    const card = document.createElement('div');
    card.className = 'bg-slate-800/80 border border-slate-700/80 rounded-2xl overflow-hidden hover:border-slate-600 transition-all flex flex-col shadow-lg group';

    // Preview grid (up to 4 images)
    let previewHtml = '';
    if (folder.previews && folder.previews.length > 0) {
      const count = Math.min(folder.previews.length, 4);
      const gridClass = count === 1 ? 'grid-cols-1' : 'grid-cols-2';

      previewHtml = `
        <div class="h-44 bg-slate-900 grid ${gridClass} gap-1 p-1 overflow-hidden relative cursor-pointer" onclick="openModal('${folder.id}')">
          ${folder.previews.slice(0, 4).map(imgUrl => `
            <div class="w-full h-full relative overflow-hidden bg-slate-950">
              <img src="${imgUrl}" alt="Preview" class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" loading="lazy">
            </div>
          `).join('')}
          <div class="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-xs font-semibold gap-1 backdrop-blur-[2px]">
            <i class="fa-solid fa-eye"></i> View All (${folder.imageCount})
          </div>
        </div>
      `;
    } else {
      previewHtml = `
        <div class="h-44 bg-slate-900 flex items-center justify-center text-slate-600">
          <i class="fa-regular fa-image text-4xl"></i>
        </div>
      `;
    }

    const encodedDownloadUrl = `${origin}/${encodeURIComponent(folder.name)}.zip`;
    const simpleCmd = `curl -O "${origin}/${folder.name}.zip"`;

    card.innerHTML = `
      ${previewHtml}
      <div class="p-5 flex-1 flex flex-col justify-between space-y-4">
        <div>
          <div class="flex items-start justify-between gap-2 mb-1">
            <h3 class="font-bold text-white text-base truncate" title="${folder.name}">${folder.name}</h3>
            <button onclick="deleteFolder('${folder.id}')" title="Delete folder" class="text-slate-500 hover:text-red-400 p-1 text-xs transition">
              <i class="fa-regular fa-trash-can"></i>
            </button>
          </div>
          <div class="flex items-center gap-2 text-xs text-slate-400">
            <span class="bg-indigo-500/10 text-indigo-400 font-semibold px-2 py-0.5 rounded-md border border-indigo-500/20">
              ${folder.imageCount} image${folder.imageCount === 1 ? '' : 's'}
            </span>
            <span>&bull;</span>
            <span>${folder.totalSizeFormatted}</span>
          </div>
        </div>

        <div class="space-y-2 pt-2 border-t border-slate-700/60">
          <!-- 1-Click Web Download Button -->
          <a href="${encodedDownloadUrl}" class="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition shadow-sm shadow-emerald-600/30">
            <i class="fa-solid fa-download"></i>
            <span>Download Folder (1-Click)</span>
          </a>

          <!-- Simple CMD Snippet -->
          <div class="bg-slate-900/90 border border-slate-700/60 rounded-xl p-2 flex items-center justify-between text-xs font-mono">
            <span class="text-slate-300 truncate select-all pr-2">${simpleCmd}</span>
            <button onclick="copyCmd('${encodeURIComponent(simpleCmd)}')" title="Copy Command" class="bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white px-2.5 py-1 rounded-lg text-[11px] font-sans font-semibold transition flex items-center gap-1 shrink-0">
              <i class="fa-regular fa-copy"></i> Copy
            </button>
          </div>

          <!-- View Images Button -->
          <button onclick="openModal('${folder.id}')" class="w-full bg-slate-700/60 hover:bg-slate-700 text-slate-300 text-xs py-1.5 px-3 rounded-lg flex items-center justify-center gap-2 transition">
            <i class="fa-solid fa-eye text-slate-400"></i>
            <span>View All Images</span>
          </button>
        </div>
      </div>
    `;

    foldersGrid.appendChild(card);
  });
}

function filterFolders(keyword) {
  const query = keyword.toLowerCase().trim();
  if (!query) {
    renderFolders(allFolders);
    return;
  }
  const filtered = allFolders.filter(f => f.name.toLowerCase().includes(query));
  renderFolders(filtered);
}

// Copy Simple CMD Command
function copyCmd(encodedCmd) {
  const cmd = decodeURIComponent(encodedCmd);
  navigator.clipboard.writeText(cmd).then(() => {
    showToast('Command copied! Just paste in CMD and press Enter.', 'success');
  }).catch(() => {
    const input = document.createElement('input');
    input.value = cmd;
    document.body.appendChild(input);
    input.select();
    document.execCommand('copy');
    document.body.removeChild(input);
    showToast('Command copied!', 'success');
  });
}

// Modal View
function openModal(folderId) {
  const folder = allFolders.find(f => f.id === folderId);
  if (!folder) return;

  modalFolderName.textContent = folder.name;
  modalImageCount.textContent = `${folder.imageCount} images &bull; ${folder.totalSizeFormatted}`;
  modalImagesContainer.innerHTML = '';

  folder.files.forEach(file => {
    const item = document.createElement('a');
    item.href = file.url;
    item.target = '_blank';
    item.className = 'group block aspect-square rounded-xl overflow-hidden bg-slate-950 border border-slate-800 hover:border-indigo-500 transition relative';
    item.innerHTML = `
      <img src="${file.url}" alt="${file.name}" class="w-full h-full object-cover transition-transform group-hover:scale-105" loading="lazy">
      <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-end p-2 text-[10px] text-white truncate backdrop-blur-[1px]">
        ${file.name}
      </div>
    `;
    modalImagesContainer.appendChild(item);
  });

  modalDownloadBtn.onclick = () => {
    window.location.href = `/${encodeURIComponent(folder.name)}.zip`;
  };

  galleryModal.classList.remove('hidden');
}

function closeModal() {
  galleryModal.classList.add('hidden');
}

// Delete Folder
async function deleteFolder(folderId) {
  if (!confirm('Are you sure you want to delete this folder?')) return;

  try {
    const res = await fetch(`/api/folders/${folderId}`, { method: 'DELETE' });
    if (res.ok) {
      showToast('Folder deleted', 'info');
      loadFolders();
    } else {
      showToast('Failed to delete folder', 'error');
    }
  } catch (err) {
    showToast('Network error while deleting', 'error');
  }
}

// Toast
let toastTimeout;
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  const toastMsg = document.getElementById('toastMsg');
  const toastIcon = document.getElementById('toastIcon');

  toastMsg.textContent = message;

  if (type === 'success') {
    toastIcon.className = 'w-7 h-7 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-sm';
    toastIcon.innerHTML = '<i class="fa-solid fa-check"></i>';
  } else if (type === 'error') {
    toastIcon.className = 'w-7 h-7 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center text-sm';
    toastIcon.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i>';
  } else {
    toastIcon.className = 'w-7 h-7 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-sm';
    toastIcon.innerHTML = '<i class="fa-solid fa-info"></i>';
  }

  toast.classList.remove('translate-y-24', 'opacity-0');
  toast.classList.add('translate-y-0', 'opacity-100');

  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.classList.add('translate-y-24', 'opacity-0');
    toast.classList.remove('translate-y-0', 'opacity-100');
  }, 3500);
}
