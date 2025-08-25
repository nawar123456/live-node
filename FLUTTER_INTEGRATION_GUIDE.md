# Flutter Live Streaming App - Integration Guide

## 🎯 **What You Need to Implement**

This guide will help you integrate the backend API with your Flutter app to create a complete live streaming application with WebRTC camera streaming, real-time chat, and viewer management.

---

## 📋 **Prerequisites**

### Required Flutter Packages
Add these to your `pubspec.yaml`:

```yaml
dependencies:
  flutter:
    sdk: flutter
  
  # HTTP requests for REST API
  http: ^1.1.0
  # or
  dio: ^5.3.2
  
  # Socket.IO for real-time communication
  socket_io_client: ^2.0.3+1
  
  # WebRTC for camera streaming
  flutter_webrtc: ^0.9.47
  
  # State management (choose one)
  provider: ^6.1.1
  # or
  riverpod: ^2.4.9
  
  # Local storage for tokens
  shared_preferences: ^2.2.2
  
  # Image handling
  cached_network_image: ^3.3.0
  
  # UI components
  flutter_svg: ^2.0.9
```

---

## 🏗️ **Project Structure**

```
lib/
├── models/
│   ├── user.dart
│   ├── stream.dart
│   ├── message.dart
│   └── category.dart
├── services/
│   ├── api_service.dart
│   ├── socket_service.dart
│   ├── auth_service.dart
│   └── webrtc_service.dart
├── providers/
│   ├── auth_provider.dart
│   ├── stream_provider.dart
│   └── chat_provider.dart
├── screens/
│   ├── auth/
│   │   ├── login_screen.dart
│   │   └── register_screen.dart
│   ├── home/
│   │   ├── home_screen.dart
│   │   └── stream_list_screen.dart
│   ├── stream/
│   │   ├── create_stream_screen.dart
│   │   ├── view_stream_screen.dart
│   │   └── chat_screen.dart
│   └── profile/
│       └── profile_screen.dart
└── utils/
    ├── constants.dart
    └── helpers.dart
```

---

## 🔧 **Step-by-Step Implementation**

### Step 1: API Service Setup

Create `lib/services/api_service.dart`:

```dart
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

class ApiService {
  static const String baseUrl = 'http://localhost:3000';
  
  // Get stored JWT token
  static Future<String?> getToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString('jwt_token');
  }
  
  // Store JWT token
  static Future<void> setToken(String token) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('jwt_token', token);
  }
  
  // Register user
  static Future<Map<String, dynamic>> register({
    required String email,
    required String password,
    required String username,
  }) async {
    final response = await http.post(
      Uri.parse('$baseUrl/auth/register'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'email': email,
        'password': password,
        'username': username,
      }),
    );
    
    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      await setToken(data['token']);
      return data;
    } else {
      throw Exception('Registration failed: ${response.body}');
    }
  }
  
  // Login user
  static Future<Map<String, dynamic>> login({
    required String email,
    required String password,
  }) async {
    final response = await http.post(
      Uri.parse('$baseUrl/auth/login'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'email': email,
        'password': password,
      }),
    );
    
    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      await setToken(data['token']);
      return data;
    } else {
      throw Exception('Login failed: ${response.body}');
    }
  }
  
  // Create stream
  static Future<Map<String, dynamic>> createStream({
    required String title,
    String? category,
    List<String>? tags,
    String? type,
    String? thumbnail,
  }) async {
    final token = await getToken();
    final response = await http.post(
      Uri.parse('$baseUrl/stream/create'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
      },
      body: jsonEncode({
        'title': title,
        'category': category,
        'tags': tags,
        'type': type,
        'thumbnail': thumbnail,
      }),
    );
    
    if (response.statusCode == 200) {
      return jsonDecode(response.body);
    } else {
      throw Exception('Failed to create stream: ${response.body}');
    }
  }
  
  // Get live streams
  static Future<List<dynamic>> getLiveStreams() async {
    final response = await http.get(Uri.parse('$baseUrl/stream/list'));
    
    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      return data['streams'];
    } else {
      throw Exception('Failed to get streams: ${response.body}');
    }
  }
  
  // Get stream details
  static Future<Map<String, dynamic>> getStreamDetails(String streamId) async {
    final response = await http.get(Uri.parse('$baseUrl/stream/$streamId'));
    
    if (response.statusCode == 200) {
      return jsonDecode(response.body);
    } else {
      throw Exception('Failed to get stream details: ${response.body}');
    }
  }
}
```

### Step 2: Socket.IO Service Setup

Create `lib/services/socket_service.dart`:

```dart
import 'package:socket_io_client/socket_io_client.dart' as IO;
import 'package:shared_preferences/shared_preferences.dart';

class SocketService {
  static IO.Socket? socket;
  static const String serverUrl = 'ws://localhost:3000';
  
  // Initialize Socket.IO connection
  static void initializeSocket() {
    socket = IO.io(serverUrl, <String, dynamic>{
      'transports': ['websocket'],
      'autoConnect': false,
    });
    
    socket!.connect();
    
    // Connection events
    socket!.onConnect((_) {
      print('Socket connected: ${socket!.id}');
    });
    
    socket!.onDisconnect((_) {
      print('Socket disconnected');
    });
    
    socket!.onError((error) {
      print('Socket error: $error');
    });
  }
  
  // Join stream room (for chat and viewers)
  static void joinStream(String streamId, String userId) {
    socket!.emit('join_stream', {
      'streamId': streamId,
      'userId': userId,
    });
  }
  
  // Leave stream room
  static void leaveStream(String streamId, String userId) {
    socket!.emit('leave_stream', {
      'streamId': streamId,
      'userId': userId,
    });
  }
  
  // Send chat message
  static void sendMessage(String streamId, String userId, String content) {
    socket!.emit('send_message', {
      'streamId': streamId,
      'userId': userId,
      'content': content,
      'type': 'text',
    });
  }
  
  // Listen for new messages
  static void onNewMessage(Function(Map<String, dynamic>) callback) {
    socket!.on('new_message', (data) {
      callback(data);
    });
  }
  
  // Listen for viewer count updates
  static void onViewerCount(Function(Map<String, dynamic>) callback) {
    socket!.on('viewer_count', (data) {
      callback(data);
    });
  }
  
  // WebRTC: Send stream offer (broadcaster)
  static void sendStreamOffer(String streamId, String sdp, String type) {
    socket!.emit('stream-offer', {
      'streamId': streamId,
      'sdp': sdp,
      'type': type,
    });
  }
  
  // WebRTC: Join stream (viewer)
  static void joinStreamForWebRTC(String streamId, String userId) {
    socket!.emit('join-stream', {
      'streamId': streamId,
      'userId': userId,
    });
  }
  
  // WebRTC: Send stream answer (viewer)
  static void sendStreamAnswer(String streamId, String userId, String sdp, String type) {
    socket!.emit('stream-answer', {
      'streamId': streamId,
      'userId': userId,
      'sdp': sdp,
      'type': type,
    });
  }
  
  // WebRTC: Send ICE candidate
  static void sendIceCandidate(String streamId, String userId, String candidate) {
    socket!.emit('ice-candidate', {
      'streamId': streamId,
      'userId': userId,
      'candidate': candidate,
    });
  }
  
  // Listen for WebRTC events
  static void onStreamOffer(Function(Map<String, dynamic>) callback) {
    socket!.on('stream-offer', (data) {
      callback(data);
    });
  }
  
  static void onStreamAnswer(Function(Map<String, dynamic>) callback) {
    socket!.on('stream-answer', (data) {
      callback(data);
    });
  }
  
  static void onIceCandidate(Function(Map<String, dynamic>) callback) {
    socket!.on('ice-candidate', (data) {
      callback(data);
    });
  }
  
  // Disconnect
  static void disconnect() {
    socket?.disconnect();
    socket = null;
  }
}
```

### Step 3: WebRTC Service Setup

Create `lib/services/webrtc_service.dart`:

```dart
import 'package:flutter_webrtc/flutter_webrtc.dart';

class WebRTCService {
  RTCPeerConnection? peerConnection;
  MediaStream? localStream;
  Function(RTCSessionDescription)? onOffer;
  Function(RTCSessionDescription)? onAnswer;
  Function(RTCIceCandidate)? onIceCandidate;
  
  // Initialize WebRTC
  Future<void> initialize() async {
    final configuration = {
      'iceServers': [
        {'urls': 'stun:stun.l.google.com:19302'},
      ],
    };
    
    peerConnection = await createPeerConnection(configuration);
    
    // Set up event handlers
    peerConnection!.onIceCandidate = (candidate) {
      onIceCandidate?.call(candidate);
    };
    
    peerConnection!.onConnectionState = (state) {
      print('Connection state: $state');
    };
  }
  
  // Start camera stream (for broadcaster)
  Future<MediaStream> startCamera() async {
    final constraints = {
      'audio': true,
      'video': {
        'mandatory': {
          'minWidth': '640',
          'minHeight': '480',
          'minFrameRate': '30',
        },
        'facingMode': 'user',
        'optional': [],
      }
    };
    
    localStream = await navigator.mediaDevices.getUserMedia(constraints);
    
    // Add tracks to peer connection
    localStream!.getTracks().forEach((track) {
      peerConnection!.addTrack(track, localStream!);
    });
    
    return localStream!;
  }
  
  // Create offer (broadcaster)
  Future<RTCSessionDescription> createOffer() async {
    final offer = await peerConnection!.createOffer();
    await peerConnection!.setLocalDescription(offer);
    return offer;
  }
  
  // Set remote description (viewer)
  Future<void> setRemoteDescription(RTCSessionDescription description) async {
    await peerConnection!.setRemoteDescription(description);
  }
  
  // Create answer (viewer)
  Future<RTCSessionDescription> createAnswer() async {
    final answer = await peerConnection!.createAnswer();
    await peerConnection!.setLocalDescription(answer);
    return answer;
  }
  
  // Add ICE candidate
  Future<void> addIceCandidate(RTCIceCandidate candidate) async {
    await peerConnection!.addCandidate(candidate);
  }
  
  // Clean up
  void dispose() {
    localStream?.dispose();
    peerConnection?.dispose();
  }
}
```

### Step 4: Create Stream Screen (Broadcaster)

Create `lib/screens/stream/create_stream_screen.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';
import '../../services/api_service.dart';
import '../../services/socket_service.dart';
import '../../services/webrtc_service.dart';

class CreateStreamScreen extends StatefulWidget {
  @override
  _CreateStreamScreenState createState() => _CreateStreamScreenState();
}

class _CreateStreamScreenState extends State<CreateStreamScreen> {
  final WebRTCService _webrtcService = WebRTCService();
  final TextEditingController _titleController = TextEditingController();
  RTCVideoRenderer _localRenderer = RTCVideoRenderer();
  String? _streamId;
  bool _isStreaming = false;
  
  @override
  void initState() {
    super.initState();
    _localRenderer.initialize();
    _webrtcService.initialize();
    _setupWebRTCEvents();
  }
  
  void _setupWebRTCEvents() {
    _webrtcService.onAnswer = (answer) {
      _webrtcService.setRemoteDescription(answer);
    };
    
    _webrtcService.onIceCandidate = (candidate) {
      // Send ICE candidate to viewers via Socket.IO
      SocketService.sendIceCandidate(_streamId!, 'broadcaster', candidate.candidate);
    };
  }
  
  Future<void> _startStream() async {
    try {
      // 1. Create stream in backend
      final streamData = await ApiService.createStream(
        title: _titleController.text,
        type: 'Game',
      );
      _streamId = streamData['stream']['_id'];
      
      // 2. Start camera
      final localStream = await _webrtcService.startCamera();
      _localRenderer.srcObject = localStream;
      
      // 3. Create WebRTC offer
      final offer = await _webrtcService.createOffer();
      
      // 4. Send offer via Socket.IO
      SocketService.sendStreamOffer(_streamId!, offer.sdp!, offer.type!);
      
      // 5. Join stream room for chat
      SocketService.joinStream(_streamId!, 'broadcaster');
      
      setState(() {
        _isStreaming = true;
      });
      
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to start stream: $e')),
      );
    }
  }
  
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('Create Stream')),
      body: Column(
        children: [
          // Camera preview
          Container(
            height: 300,
            child: RTCVideoView(_localRenderer),
          ),
          
          // Stream title input
          Padding(
            padding: EdgeInsets.all(16),
            child: TextField(
              controller: _titleController,
              decoration: InputDecoration(
                labelText: 'Stream Title',
                border: OutlineInputBorder(),
              ),
            ),
          ),
          
          // Start/Stop button
          ElevatedButton(
            onPressed: _isStreaming ? null : _startStream,
            child: Text(_isStreaming ? 'Streaming...' : 'Start Stream'),
          ),
        ],
      ),
    );
  }
  
  @override
  void dispose() {
    _localRenderer.dispose();
    _webrtcService.dispose();
    super.dispose();
  }
}
```

### Step 5: View Stream Screen (Viewer)

Create `lib/screens/stream/view_stream_screen.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';
import '../../services/api_service.dart';
import '../../services/socket_service.dart';
import '../../services/webrtc_service.dart';

class ViewStreamScreen extends StatefulWidget {
  final String streamId;
  
  ViewStreamScreen({required this.streamId});
  
  @override
  _ViewStreamScreenState createState() => _ViewStreamScreenState();
}

class _ViewStreamScreenState extends State<ViewStreamScreen> {
  final WebRTCService _webrtcService = WebRTCService();
  RTCVideoRenderer _remoteRenderer = RTCVideoRenderer();
  bool _isConnected = false;
  
  @override
  void initState() {
    super.initState();
    _remoteRenderer.initialize();
    _webrtcService.initialize();
    _setupWebRTCEvents();
    _joinStream();
  }
  
  void _setupWebRTCEvents() {
    _webrtcService.onOffer = (offer) async {
      await _webrtcService.setRemoteDescription(offer);
      final answer = await _webrtcService.createAnswer();
      SocketService.sendStreamAnswer(widget.streamId, 'viewer', answer.sdp!, answer.type!);
    };
    
    _webrtcService.onIceCandidate = (candidate) {
      SocketService.sendIceCandidate(widget.streamId, 'viewer', candidate.candidate);
    };
  }
  
  void _joinStream() {
    // Join stream for WebRTC signaling
    SocketService.joinStreamForWebRTC(widget.streamId, 'viewer');
    
    // Join stream for chat
    SocketService.joinStream(widget.streamId, 'viewer');
    
    // Listen for stream offer
    SocketService.onStreamOffer((data) {
      final offer = RTCSessionDescription(data['sdp'], data['type']);
      _webrtcService.setRemoteDescription(offer);
    });
    
    // Listen for ICE candidates
    SocketService.onIceCandidate((data) {
      final candidate = RTCIceCandidate(data['candidate'], data['sdpMid'], data['sdpMLineIndex']);
      _webrtcService.addIceCandidate(candidate);
    });
  }
  
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('Live Stream')),
      body: Column(
        children: [
          // Remote video
          Container(
            height: 300,
            child: RTCVideoView(_remoteRenderer),
          ),
          
          // Chat area (implement separately)
          Expanded(
            child: Container(
              color: Colors.grey[200],
              child: Center(child: Text('Chat Area')),
            ),
          ),
        ],
      ),
    );
  }
  
  @override
  void dispose() {
    _remoteRenderer.dispose();
    _webrtcService.dispose();
    SocketService.leaveStream(widget.streamId, 'viewer');
    super.dispose();
  }
}
```

---

## 🚀 **Next Steps**

### 1. **Initialize Services in main.dart**
```dart
void main() {
  runApp(MyApp());
}

class MyApp extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    // Initialize Socket.IO
    SocketService.initializeSocket();
    
    return MaterialApp(
      title: 'Live Streaming App',
      home: LoginScreen(),
    );
  }
}
```

### 2. **Test the Integration**
1. Start your backend server
2. Test REST APIs with Postman
3. Test Socket.IO events with Postman
4. Run the Flutter app and test the flow

### 3. **Add More Features**
- User authentication screens
- Stream listing screen
- Chat UI implementation
- Profile management
- Error handling and loading states

---

## 📱 **Testing Checklist**

- [ ] User registration/login works
- [ ] REST API calls are successful
- [ ] Socket.IO connection is established
- [ ] WebRTC camera access works
- [ ] Stream creation and joining works
- [ ] Real-time chat functions
- [ ] Viewer count updates
- [ ] WebRTC video streaming works

---

## 🔧 **Troubleshooting**

### Common Issues:
1. **Socket.IO connection fails**: Check server URL and CORS settings
2. **WebRTC not working**: Ensure camera permissions are granted
3. **Video not displaying**: Check RTCVideoRenderer initialization
4. **Signaling issues**: Verify event names match backend

### Debug Tips:
- Use `print()` statements to debug Socket.IO events
- Check browser console for WebRTC errors
- Verify all required packages are installed
- Test with Postman collections first

---

**Your Flutter app is now ready to integrate with the backend!** 🎉

Let me know if you need help with any specific part of the implementation. 