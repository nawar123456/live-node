const express = require('express');
const Stream = require('../models/Stream');
const User = require('../models/User');
const auth = require('../middleware/auth');
const router = express.Router();

// POST /stream/create - Start a stream (auth required)
router.post('/create', auth, async (req, res, next) => {
  try {
    const { title, category, tags, type, thumbnail } = req.body;
    const stream = await Stream.create({
      userId: req.user.id,
      title,
      category,
      tags,
      type,
      thumbnail,
      isLive: true,
      startTime: new Date()
    });
    res.json({ stream });
  } catch (err) { next(err); }
});

// POST /stream/end - End a stream (auth required, only owner)
router.post('/end', auth, async (req, res, next) => {
  try {
    const { streamId } = req.body;
    const stream = await Stream.findById(streamId);
    if (!stream) return res.status(404).json({ error: 'Stream not found' });
    if (String(stream.userId) !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    stream.isLive = false;
    stream.endTime = new Date();
    await stream.save();
    res.json({ message: 'Stream ended' });
  } catch (err) { next(err); }
});

// GET /stream/list - List all live streams
router.get('/list', async (req, res, next) => {
  try {
    const streams = await Stream.find({ isLive: true })
      .populate('userId', 'username avatar')
      .sort({ startTime: -1 });
    res.json({ streams });
  } catch (err) { next(err); }
});

// GET /stream/:id - View stream details (increment viewCount)
router.get('/:id', async (req, res, next) => {
  try {
    const stream = await Stream.findById(req.params.id).populate('userId', 'username avatar');
    if (!stream) return res.status(404).json({ error: 'Stream not found' });
    stream.viewCount = (stream.viewCount || 0) + 1;
    await stream.save();
    res.json({ stream });
  } catch (err) { next(err); }
});

// GET /stream/trending - List trending streams (most viewers)
router.get('/trending', async (req, res, next) => {
  try {
    const streams = await Stream.find({ isLive: true })
      .sort({ viewers: -1, viewCount: -1 })
      .limit(10)
      .populate('userId', 'username avatar');
    res.json({ streams });
  } catch (err) { next(err); }
});

// GET /stream/search?q=term - Search streams by title, tags, or type
router.get('/search', async (req, res, next) => {
  try {
    const q = req.query.q;
    if (!q) return res.json({ streams: [] });
    const streams = await Stream.find({
      isLive: true,
      $or: [
        { title: { $regex: q, $options: 'i' } },
        { tags: { $regex: q, $options: 'i' } },
        { type: { $regex: q, $options: 'i' } }
      ]
    }).populate('userId', 'username avatar');
    res.json({ streams });
  } catch (err) { next(err); }
});

module.exports = router; 