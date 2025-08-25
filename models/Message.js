const mongoose = require('mongoose');
const { Schema } = mongoose;

const messageSchema = new Schema({
  streamId: { type: Schema.Types.ObjectId, ref: 'Stream', required: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, required: true },
  filtered: { type: Boolean, default: false },
  timestamp: { type: Date, default: Date.now },
  type: { type: String, enum: ['text', 'emoji', 'other'], default: 'text' }
});

module.exports = mongoose.model('Message', messageSchema); 