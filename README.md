# noejs-api

Node.js Express backend for Flutter Live Streaming App

## Tech Stack
- Express.js
- MongoDB (Mongoose)
- Socket.IO (real-time)
- Firebase Admin (notifications)
- JWT authentication

## Setup
1. Clone the repo
2. Run `npm install`
3. Create a `.env` file (see below)
4. Run `npm start`

## .env Example
```
MONGODB_URI=mongodb://localhost:27017/noejs-api
JWT_SECRET=your_jwt_secret
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_CLIENT_EMAIL=your_client_email
FIREBASE_PRIVATE_KEY=your_private_key
```

## Scripts
- `npm start` — Start the server

## Structure
- `/models` — Mongoose models
- `/routes` — Express routes
- `/middleware` — Auth, error handling
- `/socket` — Socket.IO logic
- `/config` — DB, Firebase config
- `/utils` — Helpers 