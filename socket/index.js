const Message = require('../models/Message');
const Stream = require('../models/Stream');
const User = require('../models/User');

// Store offers and viewers in memory (for demo, use Redis/DB for scale)
const offers = {}; // { streamId: { offer, broadcasterSocketId, viewers: [] } }

module.exports = (io) => {
  io.on('connection', (socket) => {
    console.log('Socket connected:', socket.id);

    // Join a stream room
    socket.on('join_stream', async ({ streamId, userId }) => {
      try {
        if (!streamId || !userId) {
          return socket.emit('error', { message: 'streamId and userId are required' });
        }
        
        socket.join(streamId);
        // Increment viewers in DB
        await Stream.findByIdAndUpdate(streamId, { $addToSet: { viewers: userId } });
        // Broadcast new viewer count
        const stream = await Stream.findById(streamId);
        io.to(streamId).emit('viewer_count', { count: stream.viewers.length });
        
        console.log(`[join_stream] User ${userId} joined stream ${streamId}`);
      } catch (err) {
        console.error('Error in join_stream:', err);
        socket.emit('error', { message: 'Failed to join stream' });
      }
    });

    // Leave a stream room
    socket.on('leave_stream', async ({ streamId, userId }) => {
      try {
        if (!streamId || !userId) {
          return socket.emit('error', { message: 'streamId and userId are required' });
        }
        
        socket.leave(streamId);
        // Decrement viewers in DB
        await Stream.findByIdAndUpdate(streamId, { $pull: { viewers: userId } });
        // Broadcast new viewer count
        const stream = await Stream.findById(streamId);
        io.to(streamId).emit('viewer_count', { count: stream.viewers.length });
        
        console.log(`[leave_stream] User ${userId} left stream ${streamId}`);
      } catch (err) {
        console.error('Error in leave_stream:', err);
        socket.emit('error', { message: 'Failed to leave stream' });
      }
    });

    // Live chat: send message
    socket.on('send_message', async ({ streamId, userId, content, type }) => {
      try {
        if (!streamId || !userId || !content) {
          return socket.emit('error', { message: 'streamId, userId, and content are required' });
        }
        
        // Save message to DB
        const message = await Message.create({
          streamId,
          userId,
          content,
          type: type || 'text',
          filtered: false
        });
        // Broadcast to all in room
        io.to(streamId).emit('new_message', {
          _id: message._id,
          streamId,
          userId,
          content,
          type: message.type,
          timestamp: message.timestamp
        });
        
        console.log(`[send_message] Message sent in stream ${streamId} by user ${userId}`);
      } catch (err) {
        console.error('Error in send_message:', err);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // Stream status updates
    socket.on('stream_status', ({ streamId, status }) => {
      if (!streamId || !status) {
        return socket.emit('error', { message: 'streamId and status are required' });
      }
      
      // status: 'start' | 'stop'
      io.to(streamId).emit('stream_status', { streamId, status });
      console.log(`[stream_status] Stream ${streamId} status: ${status}`);
    });

    // ----- WEBRTC SIGNALING EVENTS -----

    // Broadcaster sends offer
    socket.on('stream_offer', ({ streamId, sdp, type }) => {
      try {
        if (!streamId || !sdp || !type) {
          return socket.emit('error', { message: 'streamId, sdp, and type are required' });
        }
        
        offers[streamId] = {
          offer: { streamId, sdp, type },
          broadcasterSocketId: socket.id,
          viewers: []
        };
        
        console.log(`[stream_offer] Broadcaster SDP stored for streamId: ${streamId}`);
        socket.emit('offer-stored', { streamId });
      } catch (err) {
        console.error('Error in stream_offer:', err);
        socket.emit('error', { message: 'Failed to store offer' });
      }
    });

    // Viewer joins and gets offer (enhanced join_stream for WebRTC)
    socket.on('join_stream', async ({ streamId, userId }) => {
      try {
        if (!streamId || !userId) {
          return socket.emit('error', { message: 'streamId and userId are required' });
        }
        
        socket.join(streamId);
        // Increment viewers in DB
        await Stream.findByIdAndUpdate(streamId, { $addToSet: { viewers: userId } });
        // Broadcast new viewer count
        const stream = await Stream.findById(streamId);
        io.to(streamId).emit('viewer_count', { count: stream.viewers.length });

        // Relay offer to this viewer if available
        if (offers[streamId] && offers[streamId].offer) {
          io.to(socket.id).emit('stream_offer', offers[streamId].offer);
          offers[streamId].viewers.push(socket.id);
          console.log(`[join_stream] Sent offer to viewer: ${userId}, streamId: ${streamId}`);
        } else {
          console.log(`[join_stream] No offer available for streamId: ${streamId}`);
        }
      } catch (err) {
        console.error('Error in join_stream:', err);
        socket.emit('error', { message: 'Failed to join stream' });
      }
    });

    // Viewer sends answer, relay to broadcaster
    socket.on('stream_answer', ({ streamId, userId, sdp, type }) => {
      try {
        if (!streamId || !userId || !sdp || !type) {
          return socket.emit('error', { message: 'streamId, userId, sdp, and type are required' });
        }
        
        if (offers[streamId] && offers[streamId].broadcasterSocketId) {
          io.to(offers[streamId].broadcasterSocketId).emit('stream_answer', { 
            streamId, 
            userId, 
            sdp, 
            type 
          });
          console.log(`[stream_answer] Relayed answer from viewer ${userId} to broadcaster for streamId ${streamId}`);
        } else {
          socket.emit('error', { message: 'No broadcaster found for this stream' });
        }
      } catch (err) {
        console.error('Error in stream_answer:', err);
        socket.emit('error', { message: 'Failed to relay answer' });
      }
    });

    // ICE candidates exchange
    socket.on('ice_candidate', ({ streamId, userId, candidate }) => {
      try {
        if (!streamId || !userId || !candidate) {
          return socket.emit('error', { message: 'streamId, userId, and candidate are required' });
        }
        
        if (!offers[streamId]) {
          return socket.emit('error', { message: 'No stream offer found' });
        }
        
        if (socket.id === offers[streamId].broadcasterSocketId) {
          // Broadcaster's ICE → all viewers
          offers[streamId].viewers.forEach(viewerSocketId => {
            io.to(viewerSocketId).emit('ice_candidate', { streamId, userId, candidate });
          });
          console.log(`[ice_candidate] Broadcaster ICE relayed to ${offers[streamId].viewers.length} viewers`);
        } else {
          // Viewer's ICE → broadcaster
          io.to(offers[streamId].broadcasterSocketId).emit('ice_candidate', { streamId, userId, candidate });
          console.log(`[ice_candidate] Viewer ${userId} ICE relayed to broadcaster`);
        }
      } catch (err) {
        console.error('Error in ice_candidate:', err);
        socket.emit('error', { message: 'Failed to relay ICE candidate' });
      }
    });

    // Cleanup on disconnect
    socket.on('disconnect', () => {
      console.log('Socket disconnected:', socket.id);
      
      // Remove socket from offers viewers
      Object.keys(offers).forEach(streamId => {
        if (offers[streamId].viewers.includes(socket.id)) {
          offers[streamId].viewers = offers[streamId].viewers.filter(sid => sid !== socket.id);
          console.log(`[disconnect] Removed viewer from stream ${streamId}`);
        }
        
        // Remove offer if broadcaster disconnects
        if (offers[streamId].broadcasterSocketId === socket.id) {
          delete offers[streamId];
          io.to(streamId).emit('broadcaster_disconnected', { streamId });
          console.log(`[disconnect] Broadcaster disconnected, removed offer for stream ${streamId}`);
        }
      });
    });
  });
}; 