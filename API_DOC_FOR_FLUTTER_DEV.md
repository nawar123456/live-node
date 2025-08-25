# noejs-api Backend — API Documentation for Flutter Developer

## Base URLs
- REST: `http://localhost:3000`
- Socket.IO: `ws://localhost:3000`

---

## Authentication
- Register/Login returns a JWT token.
- Pass JWT as `Authorization: Bearer <token>` in REST requests.
- For Socket.IO, send userId in event payloads.

---

## REST API Endpoints

### Auth
| Endpoint         | Method | Body / Params                        | Description                |
|-----------------|--------|--------------------------------------|----------------------------|
| /auth/register   | POST   | email, password, username            | Register new user          |
| /auth/login      | POST   | email, password                      | Login                      |
| /auth/social     | POST   | provider, providerId, email, ...     | Social login (Google/Apple)|
| /auth/me         | GET    | (JWT in header)                      | Get current user           |

### User
| Endpoint                | Method | Body / Params         | Description                |
|-------------------------|--------|-----------------------|----------------------------|
| /user/:id               | GET    |                       | Get user profile           |
| /user/:id               | PUT    | username, avatar, bio | Update profile (auth)      |
| /user/:id/follow        | POST   |                       | Follow user (auth)         |
| /user/:id/unfollow      | POST   |                       | Unfollow user (auth)       |
| /user/search?q=term     | GET    |                       | Search users               |

### Stream
| Endpoint                | Method | Body / Params         | Description                |
|-------------------------|--------|-----------------------|----------------------------|
| /stream/create          | POST   | title, category, ...  | Start a stream (auth)      |
| /stream/end             | POST   | streamId              | End a stream (auth)        |
| /stream/list            | GET    |                       | List live streams          |
| /stream/:id             | GET    |                       | View stream details        |
| /stream/trending        | GET    |                       | Trending streams           |
| /stream/search?q=term   | GET    |                       | Search streams             |

### Message
| Endpoint                | Method | Body / Params         | Description                |
|-------------------------|--------|-----------------------|----------------------------|
| /message/send           | POST   | streamId, content     | Send message (auth)        |
| /message/:streamId      | GET    |                       | List messages for stream   |

### Category
| Endpoint                | Method | Body / Params         | Description                |
|-------------------------|--------|-----------------------|----------------------------|
| /category/list          | GET    |                       | List categories            |
| /category/create        | POST   | name, icon, order     | Create category (auth)     |

### Follow
| Endpoint                        | Method | Body / Params         | Description                |
|----------------------------------|--------|-----------------------|----------------------------|
| /follow/:id/followers            | GET    |                       | Get followers for user     |
| /follow/:id/following            | GET    |                       | Get following for user     |

---

## Socket.IO Events

### Chat & Viewer Events
| Event Name      | Payload Example                                      | Listen For         | Description                  |
|-----------------|-----------------------------------------------------|--------------------|------------------------------|
| join_stream     | {"streamId": "...", "userId": "..."}             | viewer_count       | Join stream room, get count  |
| leave_stream    | {"streamId": "...", "userId": "..."}             | viewer_count       | Leave stream room, get count |
| send_message    | {"streamId": "...", "userId": "...", "content": "Hi"} | new_message        | Send chat message            |
| stream_status   | {"streamId": "...", "status": "start"}           | stream_status      | Start/stop stream status     |

### WebRTC Signaling Events
| Event Name      | Payload Example                                      | Listen For         | Description                  |
|-----------------|-----------------------------------------------------|--------------------|------------------------------|
| stream_offer    | {"streamId": "...", "sdp": "...", "type": "offer"} | offer-stored       | Broadcaster sends SDP offer  |
| join_stream     | {"streamId": "...", "userId": "..."}             | stream_offer       | Viewer joins, gets offer     |
| stream_answer   | {"streamId": "...", "userId": "...", "sdp": "..."} | stream_answer      | Viewer sends SDP answer      |
| ice_candidate   | {"streamId": "...", "userId": "...", "candidate": "..."} | ice_candidate      | Exchange ICE candidates      |

---

## WebRTC Integration Flow

### For Broadcaster (Flutter):
1. **Create Stream:** Call `/stream/create` (REST) → get streamId
2. **Start Camera:** Initialize WebRTC with camera
3. **Create Offer:** Generate WebRTC offer from camera stream
4. **Send Offer:** Emit `stream_offer` with SDP
5. **Listen for Answers:** Listen for `stream_answer` events
6. **Exchange ICE:** Listen for and emit `ice_candidate` events
7. **Join Chat:** Emit `join_stream` for chat/viewers

### For Viewer (Flutter):
1. **Get Stream Info:** Call `/stream/:id` (REST) → get stream details
2. **Join Stream:** Emit `join_stream` → receive `stream_offer`
3. **Create Answer:** Generate WebRTC answer from received offer
4. **Send Answer:** Emit `stream_answer` with SDP
5. **Exchange ICE:** Listen for and emit `ice_candidate` events
6. **Join Chat:** Emit `join_stream` for chat/viewers

---

## Example: Complete WebRTC Integration

### 1. **Register & Login:**
```json
POST /auth/register
{
  "email": "user@example.com",
  "password": "password123",
  "username": "user1"
}

POST /auth/login
{
  "email": "user@example.com",
  "password": "password123"
}
// Response: { token: "..." }
```

### 2. **Start Streaming (Broadcaster):**
```json
POST /stream/create
(Header: Authorization: Bearer <token>)
{
  "title": "My Live Stream",
  "category": "<categoryId>",
  "tags": ["game"],
  "type": "Game"
}
// Response: { stream: { _id: "streamId", ... } }
```

### 3. **WebRTC Signaling (Broadcaster):**
```javascript
// Socket.IO events for broadcaster
socket.emit('stream_offer', {
  streamId: 'streamId',
  sdp: 'webRTCSdpOffer',
  type: 'offer'
});

socket.on('stream_answer', (data) => {
  // Handle viewer's answer
  console.log('Viewer answer:', data);
});

socket.on('ice_candidate', (data) => {
  // Handle viewer's ICE candidate
  console.log('Viewer ICE:', data);
});

// Join chat room
socket.emit('join_stream', {
  streamId: 'streamId',
  userId: 'userId'
});
```

### 4. **Join Stream (Viewer):**
```javascript
// Socket.IO events for viewer
socket.emit('join_stream', {
  streamId: 'streamId',
  userId: 'userId'
});

socket.on('stream_offer', (data) => {
  // Handle broadcaster's offer
  console.log('Broadcaster offer:', data);
  // Create answer and send back
  socket.emit('stream_answer', {
    streamId: 'streamId',
    userId: 'userId',
    sdp: 'webRTCSdpAnswer',
    type: 'answer'
  });
});

socket.on('ice_candidate', (data) => {
  // Handle broadcaster's ICE candidate
  console.log('Broadcaster ICE:', data);
});

// Join chat room
socket.emit('join_stream', {
  streamId: 'streamId',
  userId: 'userId'
});
```

---

## Notes for Flutter Dev
- Use REST for user, stream, and message CRUD.
- Use Socket.IO for real-time chat, viewers, and WebRTC signaling.
- For camera streaming, use `flutter_webrtc` package with the signaling events above.
- The backend handles WebRTC signaling (SDP offer/answer, ICE candidates).
- See provided Postman collections for ready-to-test examples.

---

**Contact backend dev for any questions or to request new endpoints/events.** 