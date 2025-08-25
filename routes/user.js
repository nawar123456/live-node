const express = require('express');
const User = require('../models/User');
const Follow = require('../models/Follow');
const auth = require('../middleware/auth');
const router = express.Router();

// GET /user/:id - Get user profile
router.get('/:id', async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
  } catch (err) { next(err); }
});

// PUT /user/:id - Update user profile (auth required)
router.put('/:id', auth, async (req, res, next) => {
  try {
    if (req.user.id !== req.params.id) return res.status(403).json({ error: 'Forbidden' });
    const { username, avatar, bio, fcmToken } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $set: { username, avatar, bio, fcmToken } },
      { new: true, runValidators: true }
    ).select('-password');
    res.json({ user });
  } catch (err) { next(err); }
});

// POST /user/:id/follow - Follow user (auth required)
router.post('/:id/follow', auth, async (req, res, next) => {
  try {
    if (req.user.id === req.params.id) return res.status(400).json({ error: 'Cannot follow yourself' });
    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ error: 'User not found' });
    // Prevent duplicate follows
    const exists = await Follow.findOne({ follower: req.user.id, following: req.params.id });
    if (exists) return res.status(409).json({ error: 'Already following' });
    await Follow.create({ follower: req.user.id, following: req.params.id });
    res.json({ message: 'Followed' });
  } catch (err) { next(err); }
});

// POST /user/:id/unfollow - Unfollow user (auth required)
router.post('/:id/unfollow', auth, async (req, res, next) => {
  try {
    if (req.user.id === req.params.id) return res.status(400).json({ error: 'Cannot unfollow yourself' });
    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ error: 'User not found' });
    await Follow.deleteOne({ follower: req.user.id, following: req.params.id });
    res.json({ message: 'Unfollowed' });
  } catch (err) { next(err); }
});

// GET /user/search?q=term - Search users by username or email
router.get('/search', async (req, res, next) => {
  try {
    const q = req.query.q;
    if (!q) return res.json({ users: [] });
    const users = await User.find({
      $or: [
        { username: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } }
      ]
    }).select('-password');
    res.json({ users });
  } catch (err) { next(err); }
});

module.exports = router; 