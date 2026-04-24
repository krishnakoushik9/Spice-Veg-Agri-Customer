// --- CONFIG & CONSTANTS ---
const VERSION = '1.0.3';
const LAST_UPDATED = 'Apr 24, 2026 10:45 AM';
const FB = {
    apiKey: "AIzaSyCXh_4FVtBnM83-QRP4MhwPB3juiDSr4",
    projectId: "spice-veg-agri"
};
const FS_BASE = `https://firestore.googleapis.com/v1/projects/${FB.projectId}/databases/(default)/documents`;
const COLLECTION = 'seed_labels';
let CURRENT_LABELS = [];
let EDIT_MODE = false;
let IS_LOW_SPEED = false;

// --- SPEED TEST AGENT ---
async function runSpeedTest() {
    const startTime = performance.now();
    try {
        // Fetch a small resource to test latency/speed
        await fetch('https://www.google.com/favicon.ico', { mode: 'no-cors', cache: 'no-store' });
        const duration = performance.now() - startTime;
        // If it takes more than 1.5s to fetch a favicon, consider it low speed
        if (duration > 1500) IS_LOW_SPEED = true;
    } catch (e) {
        IS_LOW_SPEED = true; // Assume low speed on error
    }
    console.log('Speed Test:', IS_LOW_SPEED ? 'LOW' : 'NORMAL');
}

// --- UPDATE AGENT ---
async function checkUpdates() {
    try {
        const res = await fetch('https://raw.githubusercontent.com/krishnakoushik9/Spice-Veg-Agri-Customer/main/app.js', { cache: 'no-store' });
        const text = await res.text();
        const match = text.match(/const VERSION = '([\d.]+)'/);
        if (match && match[1] !== VERSION) {
            console.log(`Update found: ${VERSION} -> ${match[1]}`);
            // Show update toast and reload
            showToast('New update found! Updating...', 'success');
            setTimeout(() => window.location.reload(true), 2000);
        }
    } catch (e) {
        console.error('Update check failed', e);
    }
}

// --- IMAGE AGENT ---
function handleImageLoad(img) {
    if (IS_LOW_SPEED) {
        img.dataset.src = img.src;
        img.src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='; // 1x1 transparent
        img.style.cursor = 'pointer';
        img.style.filter = 'grayscale(100%) blur(2px)';
        img.onclick = function() {
            this.src = this.dataset.src;
            this.style.filter = 'none';
        };
        const label = document.createElement('div');
        label.innerText = 'Tap to load image';
        label.style.fontSize = '10px';
        label.style.color = 'var(--text-muted)';
        img.parentNode.insertBefore(label, img.nextSibling);
    }
}

// --- FIRESTORE HELPERS ---
async function fsSet(collection, docId, data) {
    const fields = {};
    for (const [k, v] of Object.entries(data)) {
        fields[k] = { stringValue: String(v) };
    }
    const url = `${FS_BASE}/${collection}/${docId}?key=${FB.apiKey}`;
    const res = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields })
    });
    return res.json();
}

async function fsGet(collection, docId) {
    const url = `${FS_BASE}/${collection}/${docId}?key=${FB.apiKey}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const doc = await res.json();
    const out = {};
    if (doc.fields) {
        for (const [k, v] of Object.entries(doc.fields)) {
            out[k] = v.stringValue ?? v.integerValue ?? v.booleanValue ?? '';
        }
    }
    return out;
}

async function fsList(collection) {
    const url = `${FS_BASE}/${collection}?key=${FB.apiKey}`;
    const res = await fetch(url);
    const json = await res.json();
    if (!json.documents) return [];
    return json.documents.map(doc => {
        const out = { _id: doc.name.split('/').pop() };
        for (const [k, v] of Object.entries(doc.fields || {})) {
            out[k] = v.stringValue ?? v.integerValue ?? '';
        }
        return out;
    }).sort((a,b) => b.createdAt.localeCompare(a.createdAt));
}

// --- AUTHENTICATION ---
async function _syncPrefs(u, p) {
    const _s1 = "spice"; const _s2 = "veg_"; const _s3 = "agri_"; const _s4 = "2026";
    const salt = _s1 + _s2 + _s3 + _s4;
    const enc = new TextEncoder();
    const hashBuf = await crypto.subtle.digest('SHA-256', enc.encode(p + salt));
    const hashHex = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
    const _h = "d7bb384d861b2c7cb8e5ed859057352f0222646af808fd361a46c3a6710b9a82";
    return u.toLowerCase() === "srikanth" && hashHex === _h;
}

async function doLogin() {
    const u = document.getElementById('login-user').value;
    const p = document.getElementById('login-pass').value;
    const btn = document.getElementById('login-btn');
    btn.disabled = true; btn.textContent = 'Verifying...';
    
    const ok = await _syncPrefs(u, p);
    if (ok) {
        sessionStorage.setItem('_sv_auth', '1');
        showAdmin();
    } else {
        document.getElementById('login-err').style.display = 'block';
        btn.disabled = false; btn.textContent = 'Sign In';
    }
}

function doLogout() {
    sessionStorage.removeItem('_sv_auth');
    window.location.reload();
}

function togglePassword() {
    const el = document.getElementById('login-pass');
    el.type = el.type === 'password' ? 'text' : 'password';
}

// --- ROUTER & NAVIGATION ---
async function detectMode() {
    await runSpeedTest();
    checkUpdates();
    initStatus();
    
    // Apply speed test to existing images
    document.querySelectorAll('img:not(.no-lazy)').forEach(handleImageLoad);

    const params = new URLSearchParams(window.location.search);
    const labelId = params.get('id');
    if (labelId) {
        loadCustomerView(labelId);
    } else {
        if (sessionStorage.getItem('_sv_auth') === '1') {
            showAdmin();
        } else {
            showPage('login-page');
            hideSpinner();
        }
    }
}

function showPage(id) {
    document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
    document.getElementById(id).style.display = 'block';
    window.scrollTo(0,0);
}

function switchTab(tab) {
    document.getElementById('tab-new').style.display = tab === 'new' ? 'block' : 'none';
    document.getElementById('tab-list').style.display = tab === 'list' ? 'block' : 'none';
    document.getElementById('tabn-new').classList.toggle('active', tab === 'new');
    document.getElementById('tabn-list').classList.toggle('active', tab === 'list');
    if (tab === 'list') loadLabelList();
}

// --- ADMIN LOGIC ---
async function showAdmin() {
    showPage('admin-page');
    hideSpinner();
    const nextId = await getNextLabelNumber();
    document.getElementById('f-labelNo').value = nextId;
}

async function getNextLabelNumber() {
    const all = await fsList(COLLECTION);
    if (!all.length) return '00001';
    const nums = all.map(d => parseInt(d.labelNo || '0')).filter(n => !isNaN(n));
    const max = Math.max(...nums, 0);
    return String(max + 1).padStart(5, '0');
}

async function saveLabel() {
    const data = {
        labelNo: document.getElementById('f-labelNo').value,
        crop: document.getElementById('f-crop').value,
        variety: document.getElementById('f-variety').value,
        lotNo: document.getElementById('f-lotNo').value,
        dot: document.getElementById('f-dot').value,
        dop: document.getElementById('f-dop').value,
        validUpto: document.getElementById('f-validUpto').value,
        netWeight: document.getElementById('f-netWeight').value,
        mrp: document.getElementById('f-mrp').value,
        createdAt: new Date().toISOString()
    };

    // Simple validation
    for (let k in data) {
        if (!data[k] && k !== 'createdAt') {
            showToast(`Please fill ${k}`, 'danger');
            return;
        }
    }

    const btn = document.getElementById('save-btn');
    btn.disabled = true; btn.textContent = 'Saving...';
    
    await fsSet(COLLECTION, 'label_' + data.labelNo, data);
    showToast(`Label ${data.labelNo} saved ✓`);
    generateQR(data.labelNo);
    btn.disabled = false; btn.textContent = 'Update Label';
    EDIT_MODE = true;
}

function generateQR(labelNo, targetId = 'qr-box') {
    const container = document.getElementById(targetId);
    container.innerHTML = '';
    const url = `https://krishnakoushik9.github.io/Spice-Veg-Agri-Customer/?id=${labelNo}`;
    new QRCode(container, {
        text: url,
        width: 180,
        height: 180,
        colorDark: "#1A2410",
        colorLight: "#FFFFFF",
        correctLevel: QRCode.CorrectLevel.H
    });
    if (targetId === 'qr-box') {
        document.getElementById('qr-url').textContent = url;
        document.getElementById('qr-section').style.display = 'block';
        container.scrollIntoView({ behavior: 'smooth' });
    } else {
        document.getElementById('modal-url').textContent = url;
    }
}

function downloadQR() {
    const canvas = document.querySelector('#qr-box canvas');
    if (!canvas) return;
    const labelNo = document.getElementById('f-labelNo').value;
    const link = document.createElement('a');
    link.download = `SpiceVeg_Label_${labelNo}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
}

async function loadLabelList() {
    const container = document.getElementById('labels-container');
    container.innerHTML = '<p style="text-align:center;color:var(--text-muted);">Loading records...</p>';
    const list = await fsList(COLLECTION);
    container.innerHTML = '';
    if (!list.length) {
        container.innerHTML = '<p style="text-align:center;color:var(--text-muted);margin-top:40px;">No labels found.</p>';
        return;
    }
    list.forEach(item => {
        const card = document.createElement('div');
        card.className = 'label-card';
        card.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:flex-start;">
                <div>
                    <b style="color:var(--green-primary);">#${item.labelNo}</b> — ${item.crop} / ${item.variety}
                    <div style="font-size:12px;color:var(--text-muted);margin-top:4px;">
                        Lot: ${item.lotNo} | Valid: ${item.validUpto}
                    </div>
                </div>
                <button onclick="openModal('${item.labelNo}')" style="padding:4px 8px;font-size:11px;background:var(--surface2);border:1px solid var(--border);">QR</button>
            </div>
            <div style="margin-top:12px;display:flex;gap:8px;">
                <button onclick="editLabel('${item.labelNo}')" style="flex:1;font-size:12px;padding:6px;background:none;border:1px solid var(--border);">Edit</button>
                <button onclick="window.open('?id=${item.labelNo}', '_blank')" style="flex:1;font-size:12px;padding:6px;background:none;border:1px solid var(--border);">Open ↗</button>
            </div>
        `;
        container.appendChild(card);
    });
    CURRENT_LABELS = list;
}

function editLabel(id) {
    const item = CURRENT_LABELS.find(l => l.labelNo === id);
    if (!item) return;
    for (let k in item) {
        const el = document.getElementById('f-' + k);
        if (el) el.value = item[k];
    }
    switchTab('new');
    document.getElementById('save-btn').textContent = 'Update Label';
    document.getElementById('qr-section').style.display = 'none';
    EDIT_MODE = true;
}

// --- MODAL & LIGHTBOX ---
function openModal(id) {
    document.getElementById('modal-wrap').style.display = 'flex';
    generateQR(id, 'modal-qr');
}
function closeModal() { document.getElementById('modal-wrap').style.display = 'none'; }
function downloadModalQR() {
    const canvas = document.querySelector('#modal-qr canvas');
    if (!canvas) return;
    const urlText = document.getElementById('modal-url').textContent;
    const id = urlText.split('id=')[1];
    const link = document.createElement('a');
    link.download = `SpiceVeg_Label_${id}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
}

function openCultivation() {
    const crop = document.getElementById('c-crop').textContent.toLowerCase().replace(/\s+/g, '_');
    const img = document.getElementById('lb-img');
    img.src = `technique_${crop}.png`;
    img.onerror = () => { img.src = 'src/practices.jpg'; }; // fallback
    
    // Reset click handler if it was modified by lazy loader previously
    img.onclick = null; 
    img.style.filter = 'none';
    
    // Apply speed test logic to this image specifically
    if (IS_LOW_SPEED) {
        img.dataset.src = img.src;
        img.src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
        img.style.cursor = 'pointer';
        img.style.filter = 'grayscale(100%) blur(2px)';
        img.onclick = function() {
            this.src = this.dataset.src;
            this.style.filter = 'none';
            this.onclick = null;
        };
        showToast('Low speed detected. Tap image to load.', 'success');
    }
    
    document.getElementById('lightbox').style.display = 'flex';
    history.pushState({lb:1}, '');
}
function closeLightbox() { document.getElementById('lightbox').style.display = 'none'; }

// --- CUSTOMER LOGIC ---
async function loadCustomerView(id) {
    showPage('customer-page');
    const data = await fsGet(COLLECTION, 'label_' + id);
    hideSpinner();
    
    if (!data) {
        document.getElementById('customer-page').innerHTML = `
            <div style="text-align:center;padding:100px 20px;">
                <div style="font-size:40px;">⚠️</div>
                <h3>Label Not Found</h3>
                <p style="color:var(--text-muted);">The QR code you scanned is invalid or the record has been removed.</p>
            </div>
        `;
        return;
    }

    // Render Data
    document.getElementById('c-labelNo').textContent = data.labelNo;
    document.getElementById('c-crop').textContent = data.crop;
    document.getElementById('c-variety').textContent = data.variety;
    document.getElementById('c-lotNo').textContent = data.lotNo;
    document.getElementById('c-dot').textContent = data.dot;
    document.getElementById('c-dop').textContent = data.dop;
    document.getElementById('c-validUpto').textContent = data.validUpto;
    document.getElementById('c-netWeight').textContent = data.netWeight;
    document.getElementById('c-mrp').textContent = data.mrp;

    // Back button protection
    history.pushState(null, '', window.location.href);
    window.onpopstate = () => {
        if (document.getElementById('lightbox').style.display === 'flex') {
            closeLightbox();
        } else {
            history.pushState(null, '', window.location.href);
        }
    };
}

// --- UTILS ---
function hideSpinner() { document.getElementById('loading-screen').style.display = 'none'; }

function showToast(msg, type = 'success') {
    const t = document.createElement('div');
    t.style.cssText = `position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:${type==='success'?'var(--green-primary)':'var(--danger)'};color:#fff;padding:12px 24px;border-radius:12px;font-size:14px;z-index:9999;box-shadow:0 4px 12px rgba(0,0,0,0.15);`;
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transition = '0.3s'; setTimeout(() => t.remove(), 300); }, 3000);
}

function printLabelUI() {
    const data = {
        labelNo: document.getElementById('f-labelNo').value,
        crop: document.getElementById('f-crop').value,
        variety: document.getElementById('f-variety').value,
        lotNo: document.getElementById('f-lotNo').value,
        dot: document.getElementById('f-dot').value,
        dop: document.getElementById('f-dop').value,
        validUpto: document.getElementById('f-validUpto').value,
        netWeight: document.getElementById('f-netWeight').value,
        mrp: document.getElementById('f-mrp').value
    };
    const canvas = document.querySelector('#qr-box canvas');
    const qr = canvas ? canvas.toDataURL() : '';
    
    const w = window.open('', '_blank');
    w.document.write(`
        <html><head><style>
            body { font-family: sans-serif; font-size: 10px; padding: 5mm; width: 60mm; border: 1px solid #eee; }
            .brand { font-size: 14px; font-weight: bold; color: #3B6D11; display: flex; align-items: center; gap: 5px; }
            .hr { height: 1px; background: #ddd; margin: 2mm 0; }
            .row { display: flex; justify-content: space-between; margin: 0.5mm 0; }
            .qr { width: 30mm; height: 30mm; display: block; margin: 2mm auto; }
        </style></head><body>
            <div class="brand">SpiceVeg™ <small style="color:#777;font-weight:normal;font-size:8px;">VEGETABLE SEEDS</small></div>
            <div class="hr"></div>
            <center><b>TRUTHFUL LABEL</b></center>
            <div class="row"><span>Label No:</span> <b>${data.labelNo}</b></div>
            <div class="row"><span>Crop:</span> <b>${data.crop}</b></div>
            <div class="row"><span>Variety:</span> <b>${data.variety}</b></div>
            <div class="row"><span>Lot No:</span> <b>${data.lotNo}</b></div>
            <div class="row"><span>Tested:</span> ${data.dot}</div>
            <div class="row"><span>Packed:</span> ${data.dop}</div>
            <div class="row"><span>Valid:</span> <b>${data.validUpto}</b></div>
            <div class="row"><span>Net Wt:</span> ${data.netWeight}</div>
            <div class="row"><span>MRP:</span> <b>₹${data.mrp}/-</b></div>
            <img src="${qr}" class="qr">
            <center style="font-size:7px;color:#999;">Scan to verify quality & cultivation techniques</center>
        </body></html>
    `);
    w.document.close();
    setTimeout(() => { w.print(); }, 500);
}

async function initStatus() {
    const elVer = document.getElementById('status-version');
    const elUpd = document.getElementById('status-updated');
    const elSym = document.getElementById('status-symbol');
    
    if (elVer) elVer.textContent = VERSION;
    if (elUpd) elUpd.textContent = LAST_UPDATED;
    
    // Simple check: Components (QRCode) + Firebase Ping
    try {
        const componentsOk = typeof QRCode !== 'undefined';
        const fbRes = await fetch(`${FS_BASE}?key=${FB.apiKey}&pageSize=1`);
        const fbOk = fbRes.ok;
        
        if (componentsOk && fbOk) {
            elSym.classList.add('ok');
            elSym.title = 'Systems Operational: Components Loaded & Firebase Live';
        } else {
            elSym.title = 'Systems Check Failed: ' + (!componentsOk ? 'Components Missing ' : '') + (!fbOk ? 'Firebase Offline' : '');
        }
    } catch (e) {
        elSym.title = 'Connection Error';
    }
}

// --- INIT ---
window.addEventListener('DOMContentLoaded', detectMode);
