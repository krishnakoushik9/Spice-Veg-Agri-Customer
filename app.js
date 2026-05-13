// --- CONFIG & CONSTANTS ---
const VERSION = '1.2.0';
const LAST_UPDATED = 'May 13, 2026 09:20 AM';
const FB = {
    apiKey: "AIzaSyCXh_4FVtBnM83-QRP4MhwPB3juiDSr4",
    projectId: "spice-veg-agri"
};
const FS_BASE = `https://firestore.googleapis.com/v1/projects/${FB.projectId}/databases/(default)/documents`;
const COLLECTION = 'seed_labels';
let CURRENT_LABELS = [];
let EDIT_MODE = false;
let IS_LOW_SPEED = false;

// Hardcoded company details
const COMPANY = {
    producedBy: 'Spice Veg Agri, Hyderabad',
    packedBy:   'Spice Veg Agri, Hyderabad',
    marketedBy: 'Spice Veg Agri Pvt. Ltd., Hyderabad'
};

// --- IMAGE VIEWER STATE ---
let ivScale = 1;
let ivTranslateX = 0;
let ivTranslateY = 0;
let ivDragging = false;
let ivLastX = 0;
let ivLastY = 0;
let ivLastDist = 0; // for pinch

// --- SPEED TEST ---
async function runSpeedTest() {
    const t = performance.now();
    try {
        await fetch('https://www.google.com/favicon.ico', { mode: 'no-cors', cache: 'no-store' });
        if (performance.now() - t > 1500) IS_LOW_SPEED = true;
    } catch (e) { IS_LOW_SPEED = true; }
}

// --- UPDATE AGENT ---
async function checkUpdates() {
    try {
        const res = await fetch(`https://raw.githubusercontent.com/krishnakoushik9/Spice-Veg-Agri-Customer/main/app.js?t=${Date.now()}`, { cache: 'no-store' });
        const text = await res.text();
        const match = text.match(/const VERSION = '([\d.]+)'/);
        if (match && match[1] !== VERSION) console.log(`Update: ${match[1]} (current: ${VERSION})`);
    } catch (e) {}
}

// --- FIRESTORE HELPERS ---
async function fsSet(col, docId, data) {
    const fields = {};
    for (const [k, v] of Object.entries(data)) fields[k] = { stringValue: String(v) };
    const res = await fetch(`${FS_BASE}/${col}/${docId}?key=${FB.apiKey}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields })
    });
    return res.json();
}

async function fsGet(col, docId) {
    const res = await fetch(`${FS_BASE}/${col}/${docId}?key=${FB.apiKey}`);
    if (!res.ok) return null;
    const doc = await res.json();
    const out = {};
    if (doc.fields) for (const [k, v] of Object.entries(doc.fields))
        out[k] = v.stringValue ?? v.integerValue ?? v.booleanValue ?? '';
    return out;
}

async function fsList(col) {
    const res = await fetch(`${FS_BASE}/${col}?key=${FB.apiKey}`);
    const json = await res.json();
    if (!json.documents) return [];
    return json.documents.map(doc => {
        const out = { _id: doc.name.split('/').pop() };
        for (const [k, v] of Object.entries(doc.fields || {}))
            out[k] = v.stringValue ?? v.integerValue ?? '';
        return out;
    }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// --- AUTH ---
async function _syncPrefs(u, p) {
    const salt = "spiceveg_agri_2026";
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
    if (ok) { sessionStorage.setItem('_sv_auth', '1'); showAdmin(); }
    else {
        document.getElementById('login-err').style.display = 'block';
        btn.disabled = false; btn.textContent = 'Sign In';
    }
}

function doLogout() { sessionStorage.removeItem('_sv_auth'); window.location.reload(); }
function togglePassword() {
    const el = document.getElementById('login-pass');
    el.type = el.type === 'password' ? 'text' : 'password';
}

// --- ROUTER ---
async function detectMode() {
    await runSpeedTest();
    checkUpdates();
    initStatus();
    const params = new URLSearchParams(window.location.search);
    const labelId = params.get('id');
    if (labelId) { loadCustomerView(labelId); }
    else if (sessionStorage.getItem('_sv_auth') === '1') { showAdmin(); }
    else { showPage('login-page'); hideSpinner(); }
}

function showPage(id) {
    document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
    document.getElementById(id).style.display = 'block';
    window.scrollTo(0, 0);
}

function switchTab(tab) {
    document.getElementById('tab-new').style.display = tab === 'new' ? 'block' : 'none';
    document.getElementById('tab-list').style.display = tab === 'list' ? 'block' : 'none';
    document.getElementById('tabn-new').classList.toggle('active', tab === 'new');
    document.getElementById('tabn-list').classList.toggle('active', tab === 'list');
    if (tab === 'list') loadLabelList();
}

// --- ADMIN ---
async function showAdmin() { showPage('admin-page'); hideSpinner(); }

async function saveLabel() {
    const data = {
        crop: document.getElementById('f-crop').value,
        variety: document.getElementById('f-variety').value,
        lotNo: document.getElementById('f-lotNo').value,
        dot: document.getElementById('f-dot').value,
        dop: document.getElementById('f-dop').value,
        validUpto: document.getElementById('f-validUpto').value,
        netWeight: document.getElementById('f-netWeight').value,
        mrp: document.getElementById('f-mrp').value,
        physicalPurity: document.getElementById('f-physicalPurity').value,
        moisture: document.getElementById('f-moisture').value,
        germination: document.getElementById('f-germination').value,
        geneticPurity: document.getElementById('f-geneticPurity').value,
        producedBy: COMPANY.producedBy,
        packedBy:   COMPANY.packedBy,
        marketedBy: COMPANY.marketedBy,
        createdAt: new Date().toISOString()
    };
    const names = {
        crop:'Commodity (Crop)', variety:'Variety', lotNo:'Lot Number', dot:'Date of Testing',
        dop:'Date of Packaging', validUpto:'Valid Upto', netWeight:'Net Weight', mrp:'MRP',
        physicalPurity:'Physical Purity', moisture:'Moisture',
        germination:'Germination', geneticPurity:'Genetic Purity'
    };
    const hardcoded = ['producedBy', 'packedBy', 'marketedBy', 'createdAt'];
    for (let k in data) {
        if (!data[k] && !hardcoded.includes(k)) { showToast(`Please fill "${names[k]}"`, 'danger'); return; }
    }
    const btn = document.getElementById('save-btn');
    btn.disabled = true; btn.textContent = 'Saving...';
    await fsSet(COLLECTION, 'lot_' + data.lotNo, data);
    showToast(`Lot ${data.lotNo} saved ✓`);
    generateQR(data.lotNo);
    btn.disabled = false; btn.textContent = 'Update Label';
    EDIT_MODE = true;
}

function generateQR(lotNo, targetId = 'qr-box') {
    const container = document.getElementById(targetId);
    container.innerHTML = '';
    const url = `https://krishnakoushik9.github.io/Spice-Veg-Agri-Customer/?id=${lotNo}`;
    new QRCode(container, { text: url, width: 180, height: 180, colorDark: "#1A2410", colorLight: "#FFFFFF", correctLevel: QRCode.CorrectLevel.H });
    if (targetId === 'qr-box') {
        document.getElementById('qr-url').textContent = url;
        document.getElementById('qr-section').style.display = 'block';
        const sb = document.getElementById('btn-shorten');
        if (sb) sb.style.display = 'inline-block';
        container.scrollIntoView({ behavior: 'smooth' });
    } else {
        document.getElementById('modal-url').textContent = url;
    }
}

async function shortenUrl() {
    const urlDisplay = document.getElementById('qr-url');
    const longUrl = urlDisplay.textContent;
    if (!longUrl || longUrl.includes('is.gd')) return;
    const btn = document.getElementById('btn-shorten');
    const orig = btn.textContent;
    btn.disabled = true; btn.textContent = 'Shortening...';
    try {
        const res = await fetch(`https://is.gd/create.php?format=json&url=${encodeURIComponent(longUrl)}`);
        const data = await res.json();
        if (data.shorturl) {
            urlDisplay.innerHTML = `<span style="color:var(--green-primary);font-weight:600;">${data.shorturl}</span><br><small style="opacity:0.5;font-size:9px;">Long: ${longUrl}</small>`;
            showToast('URL Shortened! ✓');
            btn.style.display = 'none';
        }
    } catch (e) { showToast('Shortening failed', 'danger'); }
    finally { btn.disabled = false; btn.textContent = orig; }
}

function downloadQR() {
    const canvas = document.querySelector('#qr-box canvas');
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `SpiceVeg_Lot_${document.getElementById('f-lotNo').value}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
}

async function loadLabelList() {
    const container = document.getElementById('labels-container');
    container.innerHTML = '<p style="text-align:center;color:var(--text-muted);">Loading...</p>';
    const list = await fsList(COLLECTION);
    container.innerHTML = '';
    if (!list.length) { container.innerHTML = '<p style="text-align:center;color:var(--text-muted);margin-top:40px;">No records found.</p>'; return; }
    list.forEach(item => {
        const card = document.createElement('div');
        card.className = 'label-card';
        card.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:flex-start;">
                <div>
                    <b style="color:var(--green-primary);">Lot: ${item.lotNo}</b> — ${item.crop} / ${item.variety}
                    <div style="font-size:12px;color:var(--text-muted);margin-top:4px;">Valid: ${item.validUpto} | Net Wt: ${item.netWeight}${item.physicalPurity ? ' | Purity: '+item.physicalPurity : ''}</div>
                </div>
                <button onclick="openModal('${item.lotNo}')" style="padding:4px 8px;font-size:11px;background:var(--surface2);border:1px solid var(--border);">QR</button>
            </div>
            <div style="margin-top:12px;display:flex;gap:8px;">
                <button onclick="editLabel('${item.lotNo}')" style="flex:1;font-size:12px;padding:6px;background:none;border:1px solid var(--border);">Edit</button>
                <button onclick="window.open('?id=${item.lotNo}','_blank')" style="flex:1;font-size:12px;padding:6px;background:none;border:1px solid var(--border);">Open ↗</button>
            </div>`;
        container.appendChild(card);
    });
    CURRENT_LABELS = list;
}

function editLabel(id) {
    const item = CURRENT_LABELS.find(l => l.lotNo === id);
    if (!item) return;
    ['crop','variety','lotNo','dot','dop','validUpto','netWeight','mrp','physicalPurity','moisture'].forEach(k => {
        const el = document.getElementById('f-' + k);
        if (el && item[k]) el.value = item[k];
    });
    switchTab('new');
    document.getElementById('save-btn').textContent = 'Update Label';
    document.getElementById('qr-section').style.display = 'none';
    EDIT_MODE = true;
}

// --- MODAL ---
function openModal(id) { document.getElementById('modal-wrap').style.display = 'flex'; generateQR(id, 'modal-qr'); }
function closeModal() { document.getElementById('modal-wrap').style.display = 'none'; }
function downloadModalQR() {
    const canvas = document.querySelector('#modal-qr canvas');
    if (!canvas) return;
    const id = document.getElementById('modal-url').textContent.split('id=')[1];
    const link = document.createElement('a');
    link.download = `SpiceVeg_Label_${id}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
}

// --- STATE POPUP (before image viewer) ---
function openCultivation() {
    document.getElementById('state-popup').classList.add('active');
}

function closeStatePopup() {
    document.getElementById('state-popup').classList.remove('active');
}

function selectState(state) {
    closeStatePopup();
    let src = '';
    let label = '';
    if (state === 'telangana') {
        src = 'src/practices.jpg';
        label = 'Telangana — Cultivation Practices';
    } else if (state === 'karnataka') {
        src = 'src/Karnataka.jpeg';
        label = 'Karnataka — Cultivation Practices';
    }
    openImageViewer(src, label);
}

// --- IMAGE VIEWER ---
function openImageViewer(src, title) {
    const viewer = document.getElementById('image-viewer');
    const img = document.getElementById('iv-img');
    const titleEl = document.getElementById('iv-title');

    // Reset state
    ivScale = 1; ivTranslateX = 0; ivTranslateY = 0;
    ivUpdateTransform();

    img.src = src;
    img.onerror = () => { img.src = 'src/practices.jpg'; };
    titleEl.textContent = title || 'Cultivation Practices';
    viewer.classList.add('active');
    history.pushState({ iv: 1 }, '');

    // Bind drag events
    const wrap = document.getElementById('iv-canvas-wrap');
    wrap.addEventListener('mousedown', ivMouseDown);
    wrap.addEventListener('mousemove', ivMouseMove);
    wrap.addEventListener('mouseup', ivMouseUp);
    wrap.addEventListener('mouseleave', ivMouseUp);
    wrap.addEventListener('wheel', ivWheel, { passive: false });
    // Touch
    wrap.addEventListener('touchstart', ivTouchStart, { passive: false });
    wrap.addEventListener('touchmove', ivTouchMove, { passive: false });
    wrap.addEventListener('touchend', ivTouchEnd);
}

function closeImageViewer() {
    const viewer = document.getElementById('image-viewer');
    viewer.classList.remove('active');
    // Remove listeners
    const wrap = document.getElementById('iv-canvas-wrap');
    wrap.removeEventListener('mousedown', ivMouseDown);
    wrap.removeEventListener('mousemove', ivMouseMove);
    wrap.removeEventListener('mouseup', ivMouseUp);
    wrap.removeEventListener('mouseleave', ivMouseUp);
    wrap.removeEventListener('wheel', ivWheel);
    wrap.removeEventListener('touchstart', ivTouchStart);
    wrap.removeEventListener('touchmove', ivTouchMove);
    wrap.removeEventListener('touchend', ivTouchEnd);
}

function ivUpdateTransform() {
    const img = document.getElementById('iv-img');
    img.style.transform = `translate(${ivTranslateX}px, ${ivTranslateY}px) scale(${ivScale})`;
    document.getElementById('iv-zoom-label').textContent = Math.round(ivScale * 100) + '%';
}

function ivZoomIn() { ivScale = Math.min(ivScale * 1.25, 6); ivUpdateTransform(); }
function ivZoomOut() { ivScale = Math.max(ivScale / 1.25, 0.3); ivUpdateTransform(); }
function ivResetZoom() { ivScale = 1; ivTranslateX = 0; ivTranslateY = 0; ivUpdateTransform(); }
function ivPanLeft()  { ivTranslateX += 60; ivUpdateTransform(); }
function ivPanRight() { ivTranslateX -= 60; ivUpdateTransform(); }
function ivPanUp()    { ivTranslateY += 60; ivUpdateTransform(); }
function ivPanDown()  { ivTranslateY -= 60; ivUpdateTransform(); }

// Mouse drag
function ivMouseDown(e) { ivDragging = true; ivLastX = e.clientX; ivLastY = e.clientY; }
function ivMouseMove(e) {
    if (!ivDragging) return;
    ivTranslateX += e.clientX - ivLastX;
    ivTranslateY += e.clientY - ivLastY;
    ivLastX = e.clientX; ivLastY = e.clientY;
    ivUpdateTransform();
}
function ivMouseUp() { ivDragging = false; }

// Scroll wheel zoom
function ivWheel(e) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.85 : 1.15;
    ivScale = Math.min(Math.max(ivScale * delta, 0.3), 6);
    ivUpdateTransform();
}

// Touch pinch-to-zoom + drag
function ivTouchStart(e) {
    if (e.touches.length === 2) {
        ivLastDist = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
        );
    } else if (e.touches.length === 1) {
        ivDragging = true;
        ivLastX = e.touches[0].clientX;
        ivLastY = e.touches[0].clientY;
    }
}
function ivTouchMove(e) {
    e.preventDefault();
    if (e.touches.length === 2) {
        const dist = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
        );
        if (ivLastDist > 0) {
            ivScale = Math.min(Math.max(ivScale * (dist / ivLastDist), 0.3), 6);
        }
        ivLastDist = dist;
        ivUpdateTransform();
    } else if (e.touches.length === 1 && ivDragging) {
        ivTranslateX += e.touches[0].clientX - ivLastX;
        ivTranslateY += e.touches[0].clientY - ivLastY;
        ivLastX = e.touches[0].clientX;
        ivLastY = e.touches[0].clientY;
        ivUpdateTransform();
    }
}
function ivTouchEnd(e) {
    if (e.touches.length < 2) ivLastDist = 0;
    if (e.touches.length === 0) ivDragging = false;
}

// --- VISIT US POPUP ---
function openVisitPopup() {
    document.getElementById('visit-popup').classList.add('active');
}
function closeVisitPopup() {
    document.getElementById('visit-popup').classList.remove('active');
}

// --- CUSTOMER VIEW ---
async function loadCustomerView(id) {
    showPage('customer-page');
    const data = await fsGet(COLLECTION, 'lot_' + id);
    hideSpinner();
    if (!data) {
        document.getElementById('customer-page').innerHTML = `
            <div style="text-align:center;padding:100px 20px;">
                <div style="font-size:40px;">⚠️</div>
                <h3>Information Not Found</h3>
                <p style="color:var(--text-muted);">The QR code you scanned is invalid or the record has been removed.</p>
            </div>`;
        return;
    }
    document.getElementById('c-crop').textContent       = data.crop            || '—';
    document.getElementById('c-variety').textContent    = data.variety         || '—';
    document.getElementById('c-lotNo').textContent      = data.lotNo           || '—';
    document.getElementById('c-dot').textContent        = data.dot             || '—';
    document.getElementById('c-dop').textContent        = data.dop             || '—';
    document.getElementById('c-validUpto').textContent  = data.validUpto       || '—';
    document.getElementById('c-netWeight').textContent  = data.netWeight       || '—';
    document.getElementById('c-mrp').textContent        = data.mrp ? `₹${data.mrp}/-` : '—';
    document.getElementById('c-physicalPurity').textContent = data.physicalPurity || '—';
    document.getElementById('c-moisture').textContent       = data.moisture        || '—';
    document.getElementById('c-germination').textContent    = data.germination     || '—';
    document.getElementById('c-geneticPurity').textContent  = data.geneticPurity   || '—';
    // Company details are hardcoded — no DOM ids needed

    history.pushState(null, '', window.location.href);
    window.onpopstate = () => {
        if (document.getElementById('image-viewer').classList.contains('active')) closeImageViewer();
        else history.pushState(null, '', window.location.href);
    };
}

// --- PRINT ---
function printLabelUI() {
    const get = id => document.getElementById(id).value;
    const data = {
        crop: get('f-crop'), variety: get('f-variety'), lotNo: get('f-lotNo'),
        dot: get('f-dot'), dop: get('f-dop'), validUpto: get('f-validUpto'),
        netWeight: get('f-netWeight'), mrp: get('f-mrp'),
        physicalPurity: get('f-physicalPurity'), moisture: get('f-moisture'),
        producedBy: COMPANY.producedBy, packedBy: COMPANY.packedBy, marketedBy: COMPANY.marketedBy
    };
    const canvas = document.querySelector('#qr-box canvas');
    const qr = canvas ? canvas.toDataURL() : '';
    const w = window.open('', '_blank');
    w.document.write(`<html><head><style>
        body{font-family:sans-serif;font-size:10px;padding:5mm;width:60mm;border:1px solid #eee;}
        .brand{font-size:14px;font-weight:bold;color:#3B6D11;}
        .hr{height:1px;background:#ddd;margin:2mm 0;}
        .row{display:flex;justify-content:space-between;margin:.5mm 0;}
        .qr{width:30mm;height:30mm;display:block;margin:2mm auto;}
    </style></head><body>
        <div class="brand">SpiceVeg™ <small style="color:#777;font-weight:normal;font-size:8px;">VEGETABLE SEEDS</small></div>
        <div class="hr"></div><center><b>TRUTHFUL LABEL</b></center>
        <div class="row"><span>Crop:</span><b>${data.crop}</b></div>
        <div class="row"><span>Variety:</span><b>${data.variety}</b></div>
        <div class="row"><span>Lot No:</span><b>${data.lotNo}</b></div>
        <div class="row"><span>Tested:</span>${data.dot}</div>
        <div class="row"><span>Packed:</span>${data.dop}</div>
        <div class="row"><span>Valid:</span><b>${data.validUpto}</b></div>
        <div class="row"><span>Net Wt:</span>${data.netWeight}</div>
        <div class="row"><span>MRP:</span><b>₹${data.mrp}/-</b></div>
        <div class="hr"></div>
        <div class="row"><span>Physical Purity:</span>${data.physicalPurity}</div>
        <div class="row"><span>Moisture:</span>${data.moisture}</div>
        <div class="hr"></div>
        <div class="row"><span>Produced by:</span>${data.producedBy}</div>
        <div class="row"><span>Packed by:</span>${data.packedBy}</div>
        <div class="row"><span>Marketed by:</span>${data.marketedBy}</div>
        <img src="${qr}" class="qr">
        <center style="font-size:7px;color:#999;">Scan to verify quality & cultivation techniques</center>
    </body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 500);
}

// --- UTILS ---
function hideSpinner() { document.getElementById('loading-screen').style.display = 'none'; }

function showToast(msg, type = 'success') {
    const t = document.createElement('div');
    t.style.cssText = `position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:${type==='success'?'var(--green-primary)':'var(--danger)'};color:#fff;padding:12px 24px;border-radius:12px;font-size:14px;z-index:9999;box-shadow:0 4px 12px rgba(0,0,0,0.15);white-space:nowrap;`;
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => { t.style.opacity='0'; t.style.transition='0.3s'; setTimeout(()=>t.remove(),300); }, 3000);
}

async function initStatus() {
    const elVer = document.getElementById('status-version');
    const elUpd = document.getElementById('status-updated');
    const elSym = document.getElementById('status-symbol');
    if (elVer) elVer.textContent = VERSION;
    if (elUpd) elUpd.textContent = LAST_UPDATED;
    try {
        const componentsOk = typeof QRCode !== 'undefined';
        const fbRes = await fetch(`${FS_BASE}?key=${FB.apiKey}&pageSize=1`);
        if (componentsOk && fbRes.ok) {
            elSym.classList.add('ok');
            elSym.title = 'Systems Operational';
        } else {
            elSym.title = 'Systems Check Failed';
        }
    } catch (e) { elSym.title = 'Connection Error'; }
}

// --- INIT ---
window.addEventListener('DOMContentLoaded', detectMode);
