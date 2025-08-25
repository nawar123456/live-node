const mongoose = require('mongoose');
const { Schema } = mongoose;

const followSchema = new Schema({
  follower: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  following: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Follow', followSchema); 