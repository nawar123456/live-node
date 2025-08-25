const express = require('express');
const User = require('../models/User');
const { hashPassword, comparePassword } = require('../utils/password');
const { signToken } = require('../utils/jwt');
const auth = require('../middleware/auth');
const router = express.Router();

// POST /auth/register
router.post('/register', async (req, res, next) => {
  try {
    const { email, password, username } = req.body;
    if (!email || !password || !username) {
      return res.status(400).json({ error: 'Email, password, and username are required' });
    }
    const exists = await User.findOne({ email });
    if (exists) return res.status(409).json({ error: 'Email already registered' });
    const hashed = await hashPassword(password);
    const user = await User.create({ email, password: hashed, username });
    const token = signToken({ id: user._id });
    res.json({ token, user: { id: user._id, email: user.email, username: user.username } });
  } catch (err) { next(err); }
});

// POST /auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: 'User not found' });
    const valid = await comparePassword(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
    const token = signToken({ id: user._id });
    res.json({ token, user: { id: user._id, email: user.email, username: user.username } });
  } catch (err) { next(err); }
});

// POST /auth/social
router.post('/social', async (req, res, next) => {
  try {
    const { provider, providerId, email, username, avatar } = req.body;
    if (!provider || !providerId || !email) {
      return res.status(400).json({ error: 'Provider, providerId, and email are required' });
    }
    let user = await User.findOne({ email });
    if (!user) {
      user = await User.create({
        email,
        username: username || email.split('@')[0],
        avatar,
        authProviders: {
          ...(provider === 'google' && { googleId: providerId }),
          ...(provider === 'apple' && { appleId: providerId })
        }
      });
    } else {
      if (provider === 'google' && !user.authProviders.googleId) user.authProviders.googleId = providerId;
      if (provider === 'apple' && !user.authProviders.appleId) user.authProviders.appleId = providerId;
      await user.save();
    }
    const token = signToken({ id: user._id });
    res.json({ token, user: { id: user._id, email: user.email, username: user.username, avatar: user.avatar } });
  } catch (err) { next(err); }
});

// GET /auth/me
router.get('/me', auth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
  } catch (err) { next(err); }
});

module.exports = router; 