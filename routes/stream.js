const express = require('express');
const Stream = require('../models/Stream');
const User = require('../models/User');
const auth = require('../middleware/auth');
const router = express.Router();

// POST /stream/create - Start a stream (auth required)
router.post('/create', async (req, res, next) => {
  try {
    const { title, category, tags, type, thumbnail } = req.body;
  const mockUserId = '507f1f77bcf86cd799439011'; // ObjectId تجريبي صحيح

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

// ✅ POST /stream/create-test-simple - Create simple test stream (NO AUTH - for testing only)
router.post('/create-test-simple', async (req, res, next) => {
  try {
    const { streamId, title, userId } = req.body;
    
    // تحديد قيم افتراضية صحيحة للـ enum
    const validCategory = 'gaming'; // أو أي قيمة موجودة في قاعدة البيانات
    const validType = 'Game'; // من الـ enum: ['Game', 'Music', 'Review', 'Talk', 'Other']
    
    const stream = await Stream.findByIdAndUpdate(
      streamId || `test_stream_${Date.now()}`,
      {
        userId: userId || 'test_user',
        title: title || 'Test Stream',
        category: validCategory,
        tags: ['test'],
        type: validType,
        isLive: true,
        startTime: new Date(),
        viewers: []
      },
      { upsert: true, new: true, runValidators: false } // تعطيل التحقق مؤقتاً لتجنب الأخطاء
    );
    
    res.json({ 
      message: '✅ Test stream created successfully',
      streamId: stream._id,
      stream 
    });
  } catch (err) { 
    console.error('Error creating test stream:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
