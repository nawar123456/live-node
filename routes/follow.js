const express = require('express');
const Follow = require('../models/Follow');
const User = require('../models/User');
const router = express.Router();

// GET /follow/:id/followers - Get followers for a user
router.get('/:id/followers', async (req, res, next) => {
  try {
    const followers = await Follow.find({ following: req.params.id })
      .populate('follower', 'username avatar');
    res.json({ followers: followers.map(f => f.follower) });
  } catch (err) { next(err); }
});

// GET /follow/:id/following - Get users a user is following
router.get('/:id/following', async (req, res, next) => {
  try {
    const following = await Follow.find({ follower: req.params.id })
      .populate('following', 'username avatar');
    res.json({ following: following.map(f => f.following) });
  } catch (err) { next(err); }
});

module.exports = router; 