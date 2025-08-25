const mongoose = require('mongoose');
const { Schema } = mongoose;

const categorySchema = new Schema({
  name: { type: String, unique: true, required: true },
  icon: String,
  order: Number
});

module.exports = mongoose.model('Category', categorySchema); 