const dotenv = require('dotenv');

const express = require('express');
const cors = require('cors');

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const streamRoutes = require('./routes/stream');
const messageRoutes = require('./routes/message');
const categoryRoutes = require('./routes/category');
const followRoutes = require('./routes/follow');

app.use('/auth', authRoutes);
app.use('/user', userRoutes);
app.use('/stream', streamRoutes);
app.use('/message', messageRoutes);
app.use('/category', categoryRoutes);
app.use('/follow', followRoutes);

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
});

module.exports = app; 