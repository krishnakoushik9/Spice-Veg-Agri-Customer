const CONFIG = {
    baseUrl: 'https://krishnakoushik9.github.io/Spice-Veg-Agri-Customer/',
    apiEndpoint: 'https://is.gd/create.php?format=json'
};

const dom = {
    longUrl: document.getElementById('longUrl'),
    shortUrl: document.getElementById('shortUrl'),
    shortenBtn: document.getElementById('shortenBtn'),
    copyBtn: document.getElementById('copyBtn'),
    resultArea: document.getElementById('resultArea'),
    statusMsg: document.getElementById('statusMsg')
};

// --- AUTO-FILL LOGIC ---
function init() {
    const params = new URLSearchParams(window.location.search);
    const lotId = params.get('id');
    
    if (lotId) {
        dom.longUrl.value = `${CONFIG.baseUrl}?id=${lotId}`;
        handleShorten(); // Auto-trigger for convenience
    }
}

// --- API LOGIC ---
async function handleShorten() {
    const url = dom.longUrl.value.trim();
    
    if (!url) {
        showStatus('Please enter a URL first.', 'error');
        return;
    }

    try {
        new URL(url); // Basic validation
    } catch (e) {
        showStatus('Please enter a valid URL.', 'error');
        return;
    }

    setLoading(true);
    dom.resultArea.style.display = 'none';

    try {
        const response = await fetch(`${CONFIG.apiEndpoint}&url=${encodeURIComponent(url)}`);
        const data = await response.json();

        if (data.shorturl) {
            dom.shortUrl.value = data.shorturl;
            dom.resultArea.style.display = 'block';
            showStatus('URL shortened successfully!', 'success');
        } else if (data.errormessage) {
            showStatus(data.errormessage, 'error');
        } else {
            showStatus('An unexpected error occurred.', 'error');
        }
    } catch (error) {
        showStatus('Failed to connect to shortening service.', 'error');
    } finally {
        setLoading(false);
    }
}

// --- UTILS ---
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

// --- EVENT LISTENERS ---
dom.shortenBtn.addEventListener('click', handleShorten);
dom.copyBtn.addEventListener('click', handleCopy);
dom.longUrl.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleShorten();
});

// Run
init();
