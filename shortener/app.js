const CONFIG = {
    baseUrl: 'https://krishnakoushik9.github.io/Spice-Veg-Agri-Customer/'
};

const FB = {
    apiKey: "AIzaSyCXh_4FVtBnM83-QRP4MhwPB3juiDSr4",
    projectId: "spice-veg-agri"
};
const FS_BASE = `https://firestore.googleapis.com/v1/projects/${FB.projectId}/databases/(default)/documents`;
const COLLECTION = 'seed_labels';

const URL_SHORTENERS = [
    {
        name: 'TinyURL',
        shorten: async (url) => {
            const res = await fetch(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(url)}`);
            if (!res.ok) throw new Error('TinyURL failed');
            const short = await res.text();
            if (!short.startsWith('http')) throw new Error('Invalid response');
            return short.trim();
        }
    },
    {
        name: 'URLVanish',
        shorten: async (url) => {
            const res = await fetch('https://urlvanish.com/create_api.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ originalUrl: url })
            });
            const data = await res.json();
            if (data.status !== 'success') throw new Error('URLVanish failed');
            return data.alias;
        }
    },
    {
        name: 'Shrtco.de',
        shorten: async (url) => {
            const res = await fetch(`https://api.shrtco.de/v2/shorten?url=${encodeURIComponent(url)}`);
            const data = await res.json();
            if (!data.ok) throw new Error('Shrtco.de failed');
            return data.result.full_short_link;
        }
    }
];

async function fsPatch(col, docId, fields) {
    const mask = Object.keys(fields).map(k => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join('&');
    const fsFields = {};
    for (const [k, v] of Object.entries(fields)) fsFields[k] = { stringValue: String(v) };
    const url = `${FS_BASE}/${col}/${docId}?${mask}&key=${FB.apiKey}`;
    const res = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: fsFields })
    });
    if (!res.ok) throw new Error(`Firestore patch failed (${res.status})`);
    return res.json();
}

const dom = {
    longUrl: document.getElementById('longUrl'),
    shortUrl: document.getElementById('shortUrl'),
    shortenBtn: document.getElementById('shortenBtn'),
    copyBtn: document.getElementById('copyBtn'),
    resultArea: document.getElementById('resultArea'),
    statusMsg: document.getElementById('statusMsg'),
    serviceSelect: document.getElementById('serviceSelect'),
    serviceUsed: document.getElementById('serviceUsed'),
    fbSaveWrap: document.getElementById('fbSaveWrap'),
    fbSaveBtn: document.getElementById('fbSaveBtn'),
    fbSaveStatus: document.getElementById('fbSaveStatus')
};

let LAST_SHORT = null;
let LAST_LONG = null;
let LAST_LOT = null;

function initSelectFromStorage() {
    if (!dom.serviceSelect) return;
    const saved = localStorage.getItem('preferred_shortener');
    if (saved !== null && URL_SHORTENERS[Number(saved)]) dom.serviceSelect.value = saved;
}

function init() {
    initSelectFromStorage();
    const params = new URLSearchParams(window.location.search);
    const lotId = params.get('id');
    if (lotId) {
        dom.longUrl.value = `${CONFIG.baseUrl}?id=${lotId}`;
        handleShorten();
    }
}

async function handleShorten() {
    const url = dom.longUrl.value.trim();
    if (!url) { showStatus('Please enter a URL first.', 'error'); return; }
    try { new URL(url); } catch (e) { showStatus('Please enter a valid URL.', 'error'); return; }

    setLoading(true);
    dom.resultArea.style.display = 'none';
    if (dom.fbSaveWrap) dom.fbSaveWrap.style.display = 'none';

    const startIdx = dom.serviceSelect ? Math.max(0, Number(dom.serviceSelect.value) || 0) : 0;
    const order = [];
    for (let i = 0; i < URL_SHORTENERS.length; i++) {
        order.push(URL_SHORTENERS[(startIdx + i) % URL_SHORTENERS.length]);
    }

    let shortUrl = null;
    let serviceName = null;
    const errors = [];
    for (const svc of order) {
        try {
            shortUrl = await svc.shorten(url);
            serviceName = svc.name;
            break;
        } catch (e) {
            errors.push(`${svc.name}: ${e.message}`);
        }
    }

    setLoading(false);

    if (!shortUrl) {
        showStatus('All shorteners failed. Try again later.', 'error');
        console.warn('Shortener errors:', errors);
        return;
    }

    LAST_SHORT = shortUrl;
    LAST_LONG = url;
    dom.shortUrl.value = shortUrl;
    dom.resultArea.style.display = 'block';
    showStatus(`Shortened via ${serviceName} ✓`, 'success');
    if (dom.serviceUsed) dom.serviceUsed.textContent = `via ${serviceName}`;

    const idx = URL_SHORTENERS.findIndex(s => s.name === serviceName);
    if (idx >= 0) localStorage.setItem('preferred_shortener', String(idx));

    LAST_LOT = new URLSearchParams(url.split('?')[1] || '').get('id');
    if (LAST_LOT && dom.fbSaveWrap) {
        dom.fbSaveWrap.style.display = 'block';
        if (dom.fbSaveStatus) dom.fbSaveStatus.textContent = '';
        if (dom.fbSaveBtn) {
            dom.fbSaveBtn.disabled = false;
            dom.fbSaveBtn.textContent = `Save to Firebase (lot ${LAST_LOT})`;
        }
    }
}

async function handleFirebaseSave() {
    if (!LAST_SHORT || !LAST_LOT) return;
    dom.fbSaveBtn.disabled = true;
    dom.fbSaveBtn.textContent = 'Saving...';
    try {
        await fsPatch(COLLECTION, 'lot_' + LAST_LOT, { shortUrl: LAST_SHORT });
        if (dom.fbSaveStatus) {
            dom.fbSaveStatus.textContent = `Saved to database ✓`;
            dom.fbSaveStatus.className = 'status-msg success';
        }
        dom.fbSaveBtn.textContent = 'Saved ✓';
    } catch (e) {
        if (dom.fbSaveStatus) {
            dom.fbSaveStatus.textContent = `Save failed: ${e.message}`;
            dom.fbSaveStatus.className = 'status-msg error';
        }
        dom.fbSaveBtn.disabled = false;
        dom.fbSaveBtn.textContent = `Retry save`;
    }
}

function showStatus(msg, type) {
    dom.statusMsg.textContent = msg;
    dom.statusMsg.className = `status-msg ${type}`;
}

function setLoading(isLoading) {
    dom.shortenBtn.disabled = isLoading;
    dom.shortenBtn.textContent = isLoading ? 'Shortening...' : 'Generate Short URL';
}

async function handleCopy() {
    try {
        await navigator.clipboard.writeText(dom.shortUrl.value);
        const originalText = dom.statusMsg.textContent;
        const originalClass = dom.statusMsg.className;
        showStatus('Copied to clipboard!', 'success');
        setTimeout(() => {
            dom.statusMsg.textContent = originalText;
            dom.statusMsg.className = originalClass;
        }, 2000);
    } catch (err) {
        showStatus('Failed to copy.', 'error');
    }
}

dom.shortenBtn.addEventListener('click', handleShorten);
dom.copyBtn.addEventListener('click', handleCopy);
dom.longUrl.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleShorten(); });
if (dom.fbSaveBtn) dom.fbSaveBtn.addEventListener('click', handleFirebaseSave);

init();
