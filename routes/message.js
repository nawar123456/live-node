const express = require('express');
const Message = require('../models/Message');
const Stream = require('../models/Stream');
const User = require('../models/User');
const auth = require('../middleware/auth');
const router = express.Router();

router.use(express.json());

// POST /message/send - Send message to a stream (auth required)
router.post('/send', auth, async (req, res, next) => {
  try {
    const { streamId, content, type } = req.body;
    if (!streamId || !content) return res.status(400).json({ error: 'streamId and content are required' });
    const stream = await Stream.findById(streamId);
    if (!stream || !stream.isLive) return res.status(404).json({ error: 'Stream not found or not live' });
    const message = await Message.create({
      streamId,
      userId: req.user.id,
      content,
      type: type || 'text',
      filtered: false
    });
    res.json({ message });
  } catch (err) { next(err); }
});

// GET /message/:streamId - List messages for a stream
router.get('/:streamId', async (req, res, next) => {
  try {
    const messages = await Message.find({ streamId: req.params.streamId })
      .sort({ timestamp: 1 })
      .populate('userId', 'username avatar');
    res.json({ messages });
  } catch (err) { next(err); }
});

module.exports = router; 