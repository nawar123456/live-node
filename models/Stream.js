const mongoose = require('mongoose');
const { Schema } = mongoose;

const streamSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  isLive: { type: Boolean, default: false },
  viewers: [String], 
  category: { type: Schema.Types.ObjectId, ref: 'Category' },
  tags: [String],
  type: { type: String, enum: ['Game', 'Music', 'Review', 'Talk', 'Other'], default: 'Other' },
  viewCount: { type: Number, default: 0 },
  startTime: Date,
  endTime: Date,
  thumbnail: String
}, { timestamps: true });

module.exports = mongoose.model('Stream', streamSchema); 