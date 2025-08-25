const mongoose = require('mongoose');
const { Schema } = mongoose;

const userSchema = new Schema({
  email: { type: String, unique: true, required: true },
  password: { type: String }, // hashed
  authProviders: {
    googleId: String,
    appleId: String
  },
  username: { type: String, unique: true },
  avatar: String,
  fcmToken: String,
  bio: String,
  followers: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  following: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  verified: { type: Boolean, default: false },
  historySearch: [String],
  topSearches: [String]
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema); 