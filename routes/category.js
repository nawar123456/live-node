const express = require('express');
const Category = require('../models/Category');
const auth = require('../middleware/auth');
const router = express.Router();

// GET /category/list - List all categories
router.get('/list', async (req, res, next) => {
  try {
    const categories = await Category.find().sort({ order: 1, name: 1 });
    res.json({ categories });
  } catch (err) { next(err); }
});

// POST /category/create - Create category (auth required, assume admin)
router.post('/create', auth, async (req, res, next) => {
  try {
    const { name, icon, order } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    const exists = await Category.findOne({ name });
    if (exists) return res.status(409).json({ error: 'Category already exists' });
    const category = await Category.create({ name, icon, order });
    res.json({ category });
  } catch (err) { next(err); }
});

module.exports = router; 