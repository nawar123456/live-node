require('dotenv').config(); // ← مهم إذا كنت تستخدم .env محليًا

const http = require('http');
const mongoose = require('mongoose');
const socketio = require('socket.io');
const express = require('express'); // ← إضافة Express
const path = require('path');       // ← إضافة Path

// إنشاء تطبيق Express
const app = require('./app');
app.use(express.json()); // ← هذا هو الحل!

// إضافة خدمة الملفات الثابتة للـ HTML
app.use(express.static(path.join(__dirname, 'public')));

// استخدم المنفذ الديناميكي
const PORT = process.env.PORT || 3000;

// تأكد من أن MONGODB_URI موجود
const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI is not set in environment variables');
  process.exit(1);
}

// الاتصال بـ MongoDB (بدون خيارات قديمة)
mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ MongoDB connected successfully'))
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

const server = http.createServer(app);
const io = socketio(server, { cors: { origin: '*' } });
require('./socket')(io);

io.on('connection', (socket) => {
  console.log('🔌 Socket connected:', socket.id);
  socket.on('disconnect', () => {
    console.log('🔌 Socket disconnected:', socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🧪 Test page available at: http://localhost:${PORT}/test-stream.html`);
});