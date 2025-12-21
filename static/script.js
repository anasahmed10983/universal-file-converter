const dropZone = document.getElementById('drop-zone');
const processingArea = document.getElementById('processing-area');
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

let translations = {};
let currentLang = localStorage.getItem('lang') || 'en';
const uploadedFileNames = new Set();
const fileRegistry = new Map();
const fileDataStore = new Map();
// customSelectRegistry removed - using native selects now

// --- Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
    await initLanguages();
    await setLanguage(currentLang);
    const savedTheme = localStorage.getItem('theme') || 'dark';
    applyTheme(savedTheme);
    checkFFmpeg();
    initBatchDropdown();
});

async function initLanguages() {
    const selector = document.getElementById('language-selector');
    if (!selector) return;

    try {
        const res = await fetch('/api/languages');
        const data = await res.json();

        selector.innerHTML = '';
        data.languages.forEach(lang => {
            const btn = document.createElement('button');
            btn.onclick = () => setLanguage(lang);
            btn.dataset.lang = lang;
            btn.className = "lang-btn px-2 py-0.5 rounded text-[10px] font-medium text-gray-400 transition-all uppercase hover:text-white";
            btn.textContent = lang;
            selector.appendChild(btn);
        });
    } catch {
        // Fallback for offline or error
        selector.innerHTML = `
            <button onclick="setLanguage('tr')" data-lang="tr" class="lang-btn px-2 py-0.5 rounded text-[10px] text-gray-400">TR</button>
            <button onclick="setLanguage('en')" data-lang="en" class="lang-btn px-2 py-0.5 rounded text-[10px] text-gray-400">EN</button>
        `;
    }
}

async function checkFFmpeg() {
    try {
        const res = await fetch('/api/check-ffmpeg');
        const data = await res.json();
        if (!data.installed) {
            showToast(t('toasts.ffmpegMissing') || '⚠️ FFmpeg not found!');
        }
    } catch {
        // Silent fail
    }
}

// --- Language System ---
async function loadTranslations(lang) {
    try {
        const res = await fetch(`/static/locales/${lang}.json`);
        if (!res.ok) throw new Error('Language not found');
        translations[lang] = await res.json();
    } catch (e) {
        if (lang !== 'en') await loadTranslations('en');
    }
}

async function setLanguage(lang) {
    currentLang = lang;
    localStorage.setItem('lang', lang);
    document.documentElement.lang = lang;

    if (!translations[lang]) await loadTranslations(lang);
    updateUI();

    // Update active language button
    document.querySelectorAll('.lang-btn').forEach(btn => {
        const isActive = btn.getAttribute('data-lang') === lang;
        btn.className = isActive
            ? 'lang-btn px-2 py-0.5 rounded text-[10px] font-bold transition-all bg-white text-black shadow-sm'
            : 'lang-btn px-2 py-0.5 rounded text-[10px] font-medium text-gray-400 transition-all hover:text-white';
    });
}

function t(keyPath) {
    const keys = keyPath.split('.');
    let val = translations[currentLang];
    for (const k of keys) {
        val = val ? val[k] : null;
    }
    return val || keyPath;
}

function updateUI() {
    const tr = translations[currentLang];
    if (!tr) return;

    // Smart data-i18n bindings (handles nested objects)
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        const val = t(key);
        if (val && val !== key) {
            // Handle nested objects (e.g., features.formats.title)
            if (typeof val === 'object' && val.title) {
                el.textContent = val.title;
            } else {
                el.textContent = val;
            }
        }
    });

    // Special bindings
    document.title = tr.title;

    // Update Batch Dropdown
    updateBatchDropdownUI();

    // Update Buttons in cards
    document.querySelectorAll('[id^="card-"]').forEach(card => {
        const btnConvert = card.querySelector('button[onclick^="startConversion"]');
        if (btnConvert) btnConvert.textContent = t('buttons.convert');

        const btnRemove = card.querySelector('button[onclick^="removeFile"]');
        if (btnRemove) btnRemove.title = t('buttons.remove');
    });
}

// --- Theme System ---
function toggleTheme() {
    const isDark = document.documentElement.classList.contains('dark');
    const newTheme = isDark ? 'light' : 'dark';
    applyTheme(newTheme);
    localStorage.setItem('theme', newTheme);
}

function applyTheme(theme) {
    const html = document.documentElement;
    const isLight = theme === 'light';

    html.classList.toggle('dark', !isLight);
    html.classList.toggle('light', isLight);

    // Header styles
    const header = document.querySelector('header');
    if (header) {
        header.classList.toggle('bg-white/90', isLight);
        header.classList.toggle('bg-black/80', !isLight);
    }

    // Toggle Button
    const toggle = document.getElementById('theme-toggle');
    const knob = document.getElementById('toggle-knob');
    if (toggle) toggle.classList.toggle('bg-blue-500', isLight);
    if (toggle) toggle.classList.toggle('bg-gray-600', !isLight);
    if (knob) knob.style.transform = isLight ? 'translateX(24px)' : 'translateX(0)';

    // Body styles - Use classList instead of className override
    const body = document.body;
    if (isLight) {
        body.classList.remove('bg-black', 'text-gray-200');
        body.classList.add('bg-gradient-to-br', 'from-gray-50', 'via-white', 'to-gray-100', 'text-gray-900');
    } else {
        body.classList.remove('bg-gradient-to-br', 'from-gray-50', 'via-white', 'to-gray-100', 'text-gray-900');
        body.classList.add('bg-black', 'text-gray-200');
    }

    // Glass elements
    document.querySelectorAll('.glass').forEach(el => {
        el.classList.toggle('bg-white/80', isLight);
        el.classList.toggle('bg-white/5', !isLight);
        el.classList.toggle('shadow-md', isLight);
        el.classList.toggle('border-gray-200', isLight);
        el.classList.toggle('border-white/10', !isLight);
    });
}

// --- Drag & Drop ---
let dragCounter = 0;
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(evt => {
    document.addEventListener(evt, e => e.preventDefault());
    dropZone.addEventListener(evt, e => e.preventDefault());
});

document.addEventListener('dragenter', () => {
    dragCounter++;
    document.body.classList.add('ring-4', 'ring-blue-500/50');
});
document.addEventListener('dragleave', () => {
    dragCounter--;
    if (dragCounter === 0) document.body.classList.remove('ring-4', 'ring-blue-500/50');
});
document.addEventListener('drop', (e) => {
    dragCounter = 0;
    document.body.classList.remove('ring-4', 'ring-blue-500/50');
    if (e.dataTransfer?.files.length) handleFiles(e.dataTransfer.files);
});
dropZone.addEventListener('drop', (e) => handleFiles(e.dataTransfer.files));
document.addEventListener('paste', e => {
    if (e.clipboardData?.files.length) {
        showToast(t('toasts.pasting').replace('files', e.clipboardData.files.length));
        handleFiles(e.clipboardData.files);
    }
});

// --- File Handling ---
function goBack() {
    // Clear all file cards
    processingArea.querySelectorAll('[id^="card-"]').forEach(card => card.remove());

    // Clear all data stores
    uploadedFileNames.clear();
    fileRegistry.clear();
    fileDataStore.clear();

    // Hide progress bar if visible
    document.getElementById('batch-progress')?.classList.add('hidden');
    document.getElementById('btn-download-all')?.classList.add('hidden');

    // Show main screens
    processingArea.classList.add('hidden');
    dropZone.classList.remove('hidden');
    document.getElementById('hero-section').classList.remove('hidden');

    // Reset file input
    document.getElementById('file-input').value = '';
}

async function handleFiles(files) {
    if (!files.length) return;

    // Show processing area on first file
    dropZone.classList.add('hidden');
    document.getElementById('hero-section').classList.add('hidden');
    processingArea.classList.remove('hidden');

    for (const file of files) {
        if (file.size > MAX_FILE_SIZE) showToast(`⚠️ ${t('toasts.largeFile')}`);
        if (uploadedFileNames.has(file.name)) {
            showToast(`⚠️ ${t('toasts.duplicate')}`);
            continue;
        }

        uploadedFileNames.add(file.name);
        const fileId = Math.random().toString(36).substring(7);
        createFileCard(file, fileId);

        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await fetch('/api/upload', { method: 'POST', body: formData });
            if (res.ok) {
                const data = await res.json();
                updateCardWithOptions(fileId, data);
            } else {
                updateCardError(fileId, t('toasts.uploadFailed'));
            }
        } catch {
            updateCardError(fileId, t('toasts.serverError'));
        }
    }
}

function createFileCard(file, id) {
    const card = document.createElement('div');
    card.id = `card-${id}`;
    card.className = "glass rounded-2xl p-4 flex items-center justify-between transition-all duration-300 animate-pulse-subtle";
    card.innerHTML = `
        <div class="flex items-center space-x-4">
            <div class="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center text-xl">⏳</div>
            <div>
                <h3 class="text-white font-medium text-sm truncate max-w-xs">${file.name}</h3>
                <p class="text-gray-500 text-xs">${t('status.loading')}</p>
            </div>
        </div>`;
    processingArea.appendChild(card);
}

function updateCardWithOptions(id, data) {
    const card = document.getElementById(`card-${id}`);
    if (!card) return;
    card.classList.remove('animate-pulse-subtle');

    // Store data
    fileRegistry.set(id, data.type);
    fileDataStore.set(id, data);
    updateBatchVisibility();

    // Prepare Data
    const icon = getIconForType(data.type);
    const formatOptions = getFormatOptions(data.type);
    const initialFormat = formatOptions[0]?.value || 'txt';

    card.innerHTML = `
        <div class="flex items-center space-x-4 w-full">
            <div class="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center text-2xl shadow-inner">${icon}</div>
            <div class="flex-1">
                <h3 class="text-white font-medium text-sm truncate max-w-xs">${data.original_name}</h3>
                <div class="flex items-center space-x-2 mt-1">
                    <span class="text-xs text-gray-500 bg-white/5 px-2 py-0.5 rounded text-[10px] uppercase">${data.extension}</span>
                    <span class="text-gray-600 text-[10px]">${(data.size / 1024 / 1024).toFixed(2)} MB</span>
                </div>
            </div>
            <div class="flex items-center space-x-3" id="actions-${id}">
                <div class="w-36" id="select-wrapper-${id}"></div>
                <button onclick="startConversion('${id}', '${data.filename}')" class="px-5 py-2.5 rounded-lg bg-apple-accent hover:bg-blue-600 text-white text-sm font-semibold transition-colors">
                    ${t('buttons.convert')}
                </button>
                <button onclick="removeFile('${id}', '${data.original_name}')" class="p-2.5 rounded-lg hover:bg-red-500/20 text-gray-400 hover:text-red-500 transition-all" title="${t('buttons.remove')}">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                </button>
            </div>
        </div>
        <div id="progress-${id}" class="absolute bottom-0 left-0 h-1 bg-apple-accent transition-all duration-300 w-0 rounded-b-2xl"></div>
    `;

    // Render Custom Select
    const container = document.getElementById(`select-wrapper-${id}`);
    createCustomSelect(container, id, formatOptions, initialFormat);
}

// --- Custom Dropdown Implementation ---

// --- Native Dropdown Implementation (v1.1 Revert) ---

function createCustomSelect(container, id, options, initialValue) {
    const select = document.createElement('select');
    select.className = "w-full border rounded-lg px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-apple-accent transition-all appearance-none cursor-pointer";

    // KÖYLÜ AMA KESİN ÇÖZÜM: Inline styles
    select.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
    select.style.color = '#ffffff';
    select.style.border = '1px solid rgba(255, 255, 255, 0.2)';
    select.style.backgroundImage = `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%239ca3af' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`;
    select.style.backgroundPosition = "right 0.5rem center";
    select.style.backgroundRepeat = "no-repeat";
    select.style.backgroundSize = "1.5em 1.5em";
    select.style.paddingRight = "2.5rem";

    let currentGroup = null;
    let groupEl = null;

    options.forEach(opt => {
        if (opt.group && opt.group !== currentGroup) {
            currentGroup = opt.group;
            groupEl = document.createElement('optgroup');
            const label = t(`groups.${currentGroup}`) || currentGroup.toUpperCase();
            groupEl.label = label;
            // Yumuşak başlık arka planı
            groupEl.style.backgroundColor = 'rgba(20, 20, 25, 0.98)';
            groupEl.style.color = '#999999';
            groupEl.style.fontWeight = 'bold';
            select.appendChild(groupEl);
        }

        const option = document.createElement('option');
        option.value = opt.value;
        option.textContent = opt.text;

        // Yumuşak arka plan (select ile uyumlu)
        option.style.backgroundColor = 'rgba(30, 30, 35, 0.95)';
        option.style.color = '#ffffff';
        option.style.padding = '8px';

        if (opt.value === initialValue) option.selected = true;

        if (groupEl) {
            groupEl.appendChild(option);
        } else {
            select.appendChild(option);
        }
    });

    select.addEventListener('change', (e) => {
        // Native select value is automatically updated
    });

    container.innerHTML = '';
    container.appendChild(select);
}


// --- Batch Dropdown ---
function initBatchDropdown() {
    const container = document.getElementById('batch-select-container');
    if (!container) return;

    // Generate all options grouped
    const formats = getAllFormatsGrouped();
    // Add "Apply All"
    const allOptions = [{ value: '', text: t('applyAll') }].concat(formats);

    createCustomSelect(container, 'batch', allOptions, '');

    // Add change listener for batch dropdown
    const batchSelect = container.querySelector('select');
    if (batchSelect) {
        batchSelect.addEventListener('change', (e) => {
            if (e.target.value) {
                applyBatchFormat(e.target.value);
            }
        });
    }
}

function updateBatchDropdownUI() {
    // Re-init to update translations
    const container = document.getElementById('batch-select-container');
    if (container) {
        container.innerHTML = ''; // Clear
        initBatchDropdown();
    }
}


function getFormatOptions(type) {
    // Returns array of {value, text, group}
    const map = {
        image: ['webp', 'png', 'jpg', 'jpeg', 'gif', 'bmp', 'tiff', 'ico', 'avif', 'pdf'],
        video: ['mp4', 'webm', 'avi', 'mkv', 'mov', 'wmv', 'flv', 'm4v', '3gp', 'mpeg', 'mp3', 'wav', 'gif'],
        audio: ['mp3', 'wav', 'aac', 'ogg', 'flac', 'm4a', 'wma', 'aiff', 'opus', 'ac3', 'm4r'],
        data: ['csv', 'xlsx', 'json', 'txt', 'xml', 'html'],
        pdf: ['txt', 'docx', 'doc', 'html', 'md', 'rtf'],
        archive: ['zip', '7z', 'tar']
    };

    const list = map[type.toLowerCase()] || ['txt'];
    return list.map(f => ({
        value: f,
        text: f.toUpperCase(),
        group: type.toLowerCase() // Simple grouping by file type
    }));
}

function getAllFormatsGrouped() {
    const order = ['image', 'video', 'audio', 'document', 'pdf', 'archive', 'data'];
    let all = [];
    order.forEach(type => {
        // Handle 'document' merging if needed or just use type keys
        // Since getFormatOptions uses specific keys, let's just iterate
    });

    // Manual construct for cleaner batch list
    const groups = [
        { type: 'image', list: ['webp', 'png', 'jpg', 'gif', 'pdf'] },
        { type: 'video', list: ['mp4', 'webm', 'avi', 'mkv', 'mp3', 'gif'] },
        { type: 'audio', list: ['mp3', 'wav', 'aac', 'flac'] },
        { type: 'document', list: ['pdf', 'docx', 'txt'] },
        { type: 'archive', list: ['zip', '7z', 'tar'] }
        // reduced list for batch to avoid clutter, or full list?
        // Let's use full list but grouped
    ];

    // Let's use getFormatOptions source
    const map = {
        image: ['webp', 'png', 'jpg', 'jpeg', 'gif'],
        video: ['mp4', 'webm', 'avi', 'mkv'],
        audio: ['mp3', 'wav'],
        document: ['pdf', 'docx', 'txt'],
        archive: ['zip', '7z']
    };
    // Flatten
    let result = [];
    Object.keys(map).forEach(g => {
        map[g].forEach(f => {
            result.push({ value: f, text: f.toUpperCase(), group: g });
        });
    });
    return result;
}

function getIconForType(type) {
    const icons = { image: '🖼️', video: '🎬', audio: '🎵', pdf: '📕', document: '📄', archive: '📦', data: '📊' };
    return icons[type] || '📁';
}

// --- Conversion Logic ---
async function startConversion(id, filename) {
    const actionsDiv = document.getElementById(`actions-${id}`);
    const progressBar = document.getElementById(`progress-${id}`);

    // Get value from select element
    const selectEl = document.querySelector(`#select-wrapper-${id} select`);
    const format = selectEl?.value;
    if (!format) return showToast(t('toasts.error'));

    actionsDiv.innerHTML = `<span class="text-xs text-apple-accent animate-pulse">${t('status.converting')}</span>`;

    try {
        const res = await fetch('/api/convert', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ file_path: filename, target_format: format })
        });
        const result = await res.json();

        if (result.success) {
            progressBar.style.width = "100%";
            progressBar.className = "absolute bottom-0 left-0 h-1 bg-apple-success transition-all duration-300 w-full rounded-b-2xl";

            actionsDiv.innerHTML = `
                <div class="flex items-center space-x-2">
                     <button onclick="resetCard('${id}', '${filename}')" class="p-2.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors" title="${t('buttons.convertAgain')}">
                        <svg class="w-5 h-5 text-gray-400 hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                    </button>
                    <a href="/api/download/${result.filename}" download class="px-4 py-2.5 rounded-lg bg-apple-success hover:bg-green-600 text-white text-sm font-semibold inline-flex items-center space-x-2">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                        <span>${t('buttons.download')}</span>
                    </a>
                </div>`;
            checkDownloadAllButton();
        } else {
            throw new Error(result.error);
        }
    } catch (e) {
        actionsDiv.innerHTML = `
            <div class="flex flex-col items-end gap-2">
                <span class="text-xs text-red-500 font-medium">${e.message || t('toasts.error')}</span>
                <button onclick="resetCard('${id}', '${filename}')" class="px-4 py-2 bg-white/10 text-white text-sm font-medium rounded-lg border border-white/10 hover:bg-white/20 transition-colors">${t('buttons.retry')}</button>
            </div>`;
        progressBar.style.width = "100%";
        progressBar.className = "absolute bottom-0 left-0 h-1 bg-red-500 transition-all duration-300 w-full rounded-b-2xl";
        triggerShake(`card-${id}`);
    }
}

function resetCard(id, filename) {
    const data = fileDataStore.get(id);
    if (data) updateCardWithOptions(id, data);
}

function removeFile(id, originalName) {
    const card = document.getElementById(`card-${id}`);
    if (card) {
        card.style.opacity = '0';
        setTimeout(() => {
            card.remove();
            uploadedFileNames.delete(originalName);
            fileRegistry.delete(id);
            fileDataStore.delete(id);
            updateBatchVisibility();
            const remaining = document.querySelectorAll('[id^="card-"]');
            if (remaining.length === 0) {
                processingArea.classList.add('hidden');
                dropZone.classList.remove('hidden');
                document.getElementById('hero-section')?.classList.remove('hidden');
                document.getElementById('btn-download-all')?.classList.add('hidden');
            }
        }, 300);
    }
}

// --- Utils ---
function showToast(msg) {
    const toast = document.getElementById('toast');
    document.getElementById('toast-message').textContent = msg;
    toast.classList.remove('translate-y-24', 'opacity-0');
    setTimeout(() => toast.classList.add('translate-y-24', 'opacity-0'), 3000);
}

function updateCardError(id, msg) {
    const card = document.getElementById(`card-${id}`);
    const data = fileDataStore.get(id);
    const originalName = data?.original_name || '';

    card.className = "glass rounded-2xl p-4 flex items-center justify-between border border-red-500 bg-red-500/5";
    card.innerHTML = `<span class="text-red-500 text-sm">⚠️ ${msg}</span> <button onclick="removeFile('${id}', '${originalName}')" class="text-white">✕</button>`;
    triggerShake(`card-${id}`);
}

function triggerShake(elementId) {
    const el = document.getElementById(elementId);
    if (el) {
        el.classList.add('error-shake');
        setTimeout(() => el.classList.remove('error-shake'), 500);
    }
}

function updateBatchVisibility() {
    // Current logic just updates the batch dropdown text/content if needed
    // If we want intelligent hiding/showing of groups in batch dropdown, we'd need to re-render it.
    // For now, let's just re-init text
    updateBatchDropdownUI();
}

function applyBatchFormat(format) {
    if (!format) return;

    let count = 0;

    // Find all file card select dropdowns (native selects)
    document.querySelectorAll('[id^="select-wrapper-"]').forEach(wrapper => {
        const select = wrapper.querySelector('select');
        if (!select) return;

        // Check if this format exists in options
        const option = Array.from(select.options).find(opt => opt.value === format);
        if (option) {
            // Set the value
            select.value = format;

            // Visual feedback - briefly highlight
            select.style.boxShadow = '0 0 0 2px #0071e3';
            setTimeout(() => {
                select.style.boxShadow = '';
            }, 300);

            count++;
        }
    });

    if (count > 0) {
        showToast(t('toasts.batchSuccess').replace('format', format.toUpperCase()));
    } else {
        showToast(t('toasts.batchError'));
    }

    // Reset batch dropdown to "Apply All"
    const batchSelect = document.querySelector('#batch-select-container select');
    if (batchSelect) batchSelect.value = '';
}

async function convertAll() {
    const buttons = document.querySelectorAll('button[onclick^="startConversion"]');
    if (buttons.length === 0) return showToast(t('toasts.noFiles'));

    const total = buttons.length;
    let completed = 0;

    // Show progress bar
    const progressContainer = document.getElementById('batch-progress');
    const progressBar = document.getElementById('batch-progress-bar');
    const progressText = document.getElementById('batch-progress-text');

    progressContainer.classList.remove('hidden');
    progressBar.style.width = '0%';
    progressText.textContent = `0/${total}`;

    showToast(t('toasts.converting'));

    for (const btn of buttons) {
        btn.click();
        await new Promise(r => setTimeout(r, 500));

        completed++;
        const percentage = (completed / total) * 100;
        progressBar.style.width = `${percentage}%`;
        progressText.textContent = `${completed}/${total}`;

        // Change to green when complete
        if (completed === total) {
            progressBar.classList.remove('from-blue-500', 'to-green-500');
            progressBar.classList.add('bg-green-500');
            setTimeout(() => {
                progressContainer.classList.add('hidden');
                progressBar.classList.remove('bg-green-500');
                progressBar.classList.add('from-blue-500', 'to-green-500');
            }, 2000);
        }
    }
}

async function downloadAll() {
    const links = document.querySelectorAll('a[download]');
    const filenames = Array.from(links).map(a => a.href.split('/').pop());
    if (!filenames.length) return showToast(t('toasts.noDownload'));

    showToast(t('toasts.zipping'));
    try {
        const res = await fetch('/api/download-all', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filenames })
        });
        if (res.ok) {
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = "converted_files.zip";
            document.body.appendChild(a);
            a.click();
            URL.revokeObjectURL(url);
        } else {
            showToast(t('toasts.zipError'));
        }
    } catch {
        showToast(t('toasts.connError'));
    }
}

function checkDownloadAllButton() {
    if (document.querySelectorAll('a[download]').length > 0) {
        document.getElementById('btn-download-all')?.classList.remove('hidden');
    }
}
