// socket.js - إدارة اتصالات الوقت الفعلي (WebSocket) للتطبيق

// استيراد النماذج (Models) من قاعدة البيانات
const Message = require('../models/Message'); // نموذج الرسائل
const Stream = require('../models/Stream');   // نموذج البث
const User = require('../models/User');       // نموذج المستخدم
const mongoose = require('mongoose');         // مكتبة للتعامل مع MongoDB

// تخزين العروض (Offers) والمشاهدين في الذاكرة (للاستخدام التجريبي، استخدم Redis/DB للإنتاج)
// هذا الكائن يخزن معلومات الاتصال المؤقتة ل WebRTC
// الصيغة: { streamId: { offer, broadcasterSocketId, viewers: [], waitingViewers: [] } }
const offers = {};

// تصدير الدالة التي تأخذ io (Socket.IO) كمدخل
module.exports = (io) => {
  // الاستماع لحدث الاتصال الجديد
  io.on('connection', (socket) => {
    console.log('🔌 اتصال جديد:', socket.id); // تسجيل معرف الاتصال الجديد

    // انضمام مستخدم لغرفة بث
    socket.on('join_stream', async ({ streamId, userId }) => {
      try {
        console.log('[DEBUG] انضمام لغرفة البث:', { streamId, userId });

        // التحقق من صحة المدخلات
        if (!streamId || !userId) {
          const errorMsg = 'معرف البث ومعرف المستخدم مطلوبان';
          console.log('[ERROR]', errorMsg);
          return socket.emit('error', { message: errorMsg });
        }

        // التحقق من صحة معرف البث (ObjectId)
        if (!mongoose.Types.ObjectId.isValid(streamId)) {
          const errorMsg = `صيغة معرف البث غير صحيحة: ${streamId}`;
          console.log('[ERROR]', errorMsg);
          return socket.emit('error', { message: errorMsg });
        }

        // البحث عن البث في قاعدة البيانات
        let stream;
        try {
          stream = await Stream.findById(streamId);
          console.log('[DEBUG] نتيجة البحث عن البث:', stream ? 'موجود' : 'غير موجود');
        } catch (lookupErr) {
          console.log('[ERROR] فشل البحث عن البث:', lookupErr.message);
          return socket.emit('error', { message: 'فشل البحث في قاعدة البيانات: ' + lookupErr.message });
        }

        // التحقق من وجود البث
        if (!stream) {
          const errorMsg = `البث غير موجود: ${streamId}`;
          console.log('[ERROR]', errorMsg);
          return socket.emit('error', { message: errorMsg });
        }

        console.log('[DEBUG] تم العثور على البث:', stream._id);

        // انضمام المستخدم لغرفة البث (Socket.IO Room)
        socket.join(streamId);
        console.log('[DEBUG] انضم المستخدم للغرفة:', streamId);

        // تحديث عدد المشاهدين في قاعدة البيانات
        try {
          // استخدام $addToSet لتجنب التكرار
          await Stream.findByIdAndUpdate(streamId, { $addToSet: { viewers: userId } });
          const updatedStream = await Stream.findById(streamId);
          // إرسال تحديث عدد المشاهدين لجميع المستخدمين في الغرفة
          io.to(streamId).emit('viewer_count', { count: updatedStream.viewers.length });
          console.log('[DEBUG] تم تحديث عدد المشاهدين');
        } catch (dbErr) {
          console.log('[WARN] فشل تحديث قاعدة البيانات (الاستمرار):', dbErr.message);
        }

        // تهيئة الكائن في الذاكرة إذا لم يكن موجوداً
        if (!offers[streamId]) {
          offers[streamId] = {
            offer: null,
            broadcasterSocketId: null,
            viewers: [],
            waitingViewers: [] // قائمة المشاهدين في وضع الانتظار
          };
        }

        // إرسال العرض (Offer) للمشاهد إذا كان متوفر
        if (offers[streamId].offer) {
          console.log('[DEBUG] إرسال العرض للمشاهد:', socket.id);
          // إرسال العرض للمشاهد الجديد فقط
          io.to(socket.id).emit('stream_offer', offers[streamId].offer);
          // إضافة معرف المشاهد لقائمة المشاهدين النشطين
          offers[streamId].viewers.push(socket.id);
          console.log(`[join_stream] تم إرسال العرض للمشاهد: ${userId}, معرف البث: ${streamId}`);
        } else {
          // إذا ما فيش عرض، نضيف المشاهد لقائمة الانتظار
          console.log(`[join_stream] لا يوجد عرض متوفر لمعرف البث: ${streamId}, إضافة المشاهد لقائمة الانتظار`);
          offers[streamId].waitingViewers.push(socket.id);
          
          // إرسال رسالة انتظار للمشاهد
          socket.emit('waiting_for_broadcaster', {
            message: '⏳ جاري الانتظار حتى يبدأ البث...',
            streamId: streamId
          });
        }

        console.log(`[join_stream] المستخدم ${userId} انضم للبث ${streamId}`);

      } catch (err) {
        console.error('[ERROR] في انضمام المستخدم للبث:', err);
        socket.emit('error', { message: 'فشل الانضمام للبث: ' + err.message });
      }
    });

    // مغادرة مستخدم لغرفة بث
    socket.on('leave_stream', async ({ streamId, userId }) => {
      try {
        // التحقق من صحة المدخلات
        if (!streamId || !userId) {
          return socket.emit('error', { message: 'معرف البث ومعرف المستخدم مطلوبان' });
        }

        // مغادرة الغرفة
        socket.leave(streamId);

        // إزالة المستخدم من قائمة المشاهدين في قاعدة البيانات
        await Stream.findByIdAndUpdate(streamId, { $pull: { viewers: userId } });

        // إرسال تحديث عدد المشاهدين
        const stream = await Stream.findById(streamId);
        io.to(streamId).emit('viewer_count', { count: stream.viewers.length });

        // إزالة المستخدم من قوائم المشاهدين في الذاكرة
        if (offers[streamId]) {
          // إزالة من المشاهدين النشطين
          offers[streamId].viewers = offers[streamId].viewers.filter(id => id !== socket.id);
          // إزالة من قائمة الانتظار
          offers[streamId].waitingViewers = offers[streamId].waitingViewers.filter(id => id !== socket.id);
        }

        console.log(`[leave_stream] المستخدم ${userId} غادر البث ${streamId}`);
      } catch (err) {
        console.error('خطأ في مغادرة البث:', err);
        socket.emit('error', { message: 'فشل مغادرة البث' });
      }
    });

    // إرسال رسالة دردشة مباشرة
    socket.on('send_message', async ({ streamId, userId, content, type }) => {
      try {
        // التحقق من صحة المدخلات
        if (!streamId || !userId || !content) {
          return socket.emit('error', { message: 'معرف البث ومعرف المستخدم والمحتوى مطلوبة' });
        }

        // حفظ الرسالة في قاعدة البيانات
        const message = await Message.create({
          streamId,
          userId,
          content,
          type: type || 'text', // نوع الرسالة (نص، صورة، إلخ)
          filtered: false       // هل تم تصفية الرسالة من الكلمات السيئة؟
        });

        // إرسال الرسالة لجميع المستخدمين في الغرفة
        io.to(streamId).emit('new_message', {
          _id: message._id,
          streamId,
          userId,
          content,
          type: message.type,
          timestamp: message.timestamp
        });

        console.log(`[send_message] تم إرسال رسالة في البث ${streamId} من المستخدم ${userId}`);
      } catch (err) {
        console.error('خطأ في إرسال الرسالة:', err);
        socket.emit('error', { message: 'فشل إرسال الرسالة' });
      }
    });

    // تحديث حالة البث (بدء/إيقاف)
    socket.on('stream_status', ({ streamId, status }) => {
      // التحقق من صحة المدخلات
      if (!streamId || !status) {
        return socket.emit('error', { message: 'معرف البث والحالة مطلوبة' });
      }

      // إرسال تحديث الحالة لجميع المستخدمين في الغرفة
      // status: 'start' | 'stop'
      io.to(streamId).emit('stream_status', { streamId, status });
      console.log(`[stream_status] حالة البث ${streamId}: ${status}`);
    });

    // ----- أحداث إشارات WebRTC -----

    // البثّاث يرسل عرض (Offer)
    socket.on('stream_offer', ({ streamId, sdp, type }) => {
      try {
        // التحقق من صحة المدخلات
        if (!streamId || !sdp || !type) {
          return socket.emit('error', { message: 'معرف البث و sdp و type مطلوبة' });
        }

        // تهيئة الكائن في الذاكرة إذا لم يكن موجوداً
        if (!offers[streamId]) {
          offers[streamId] = {
            offer: null,
            broadcasterSocketId: null,
            viewers: [],
            waitingViewers: []
          };
        }

        // تخزين العرض في الذاكرة
        offers[streamId].offer = { streamId, sdp, type }; // معلومات العرض
        offers[streamId].broadcasterSocketId = socket.id; // معرف اتصال البثّاث

        console.log(`[stream_offer] تم تخزين عرض البثّاث لمعرف البث: ${streamId}`);
        
        // إعلام البثّاث أن العرض تم تخزينه
        socket.emit('offer-stored', { streamId });
        
        // إرسال العرض لجميع المشاهدين في وضع الانتظار
        offers[streamId].waitingViewers.forEach(viewerSocketId => {
          // التأكد أن الاتصال لا يزال موجوداً
          const viewerSocket = io.sockets.sockets.get(viewerSocketId);
          if (viewerSocket) {
            io.to(viewerSocketId).emit('stream_offer', offers[streamId].offer);
            // نقل المشاهد من قائمة الانتظار لقائمة المشاهدين النشطين
            offers[streamId].viewers.push(viewerSocketId);
            console.log(`[stream_offer] تم إرسال العرض للمشاهد في وضع الانتظار: ${viewerSocketId}`);
          }
        });
        
        // تنظيف قائمة الانتظار بعد الإرسال
        offers[streamId].waitingViewers = [];
        
        // إرسال العرض أيضاً لجميع المشاهدين الحاليين
        // (في حالة كان هناك مشاهدون انضموا بعد بدء البث)
        offers[streamId].viewers.forEach(viewerSocketId => {
          // تجنب إرسال العرض للمشاهد نفسه إذا كان موجوداً بالفعل
          if (viewerSocketId !== socket.id) {
            const viewerSocket = io.sockets.sockets.get(viewerSocketId);
            if (viewerSocket) {
              io.to(viewerSocketId).emit('stream_offer', offers[streamId].offer);
              console.log(`[stream_offer] تم إرسال العرض للمشاهد الحالي: ${viewerSocketId}`);
            }
          }
        });

      } catch (err) {
        console.error('خطأ في تخزين العرض:', err);
        socket.emit('error', { message: 'فشل تخزين العرض' });
      }
    });

    // المشاهد يرسل رد (Answer)، إعادة توجيهه للبثّاث
    socket.on('stream_answer', ({ streamId, userId, sdp, type }) => {
      try {
        // التحقق من صحة المدخلات
        if (!streamId || !userId || !sdp || !type) {
          return socket.emit('error', { message: 'معرف البث ومعرف المستخدم و sdp و type مطلوبة' });
        }

        // التحقق من وجود البثّاث
        if (offers[streamId] && offers[streamId].broadcasterSocketId) {
          // إعادة توجيه الرد للبثّاث
          io.to(offers[streamId].broadcasterSocketId).emit('stream_answer', {
            streamId,
            userId,
            sdp,
            type
          });
          console.log(`[stream_answer] تم إعادة توجيه الرد من المشاهد ${userId} للبثّاث لمعرف البث ${streamId}`);
        } else {
          socket.emit('error', { message: 'لا يوجد بثّاث لهذا البث' });
        }
      } catch (err) {
        console.error('خطأ في إعادة توجيه الرد:', err);
        socket.emit('error', { message: 'فشل إعادة توجيه الرد' });
      }
    });

    // تبادل بيانات الاتصال (ICE candidates)
    socket.on('ice_candidate', ({ streamId, userId, candidate }) => {
      try {
        // التحقق من صحة المدخلات
        if (!streamId || !userId || !candidate) {
          return socket.emit('error', { message: 'معرف البث ومعرف المستخدم و candidate مطلوبة' });
        }

        // التحقق من وجود العرض
        if (!offers[streamId]) {
          return socket.emit('error', { message: 'لا يوجد عرض للبث' });
        }

        // تحديد مصدر بيانات الاتصال
        if (socket.id === offers[streamId].broadcasterSocketId) {
          // بيانات الاتصال من البثّاث → جميع المشاهدين
          offers[streamId].viewers.forEach(viewerSocketId => {
            // التأكد أن الاتصال لا يزال موجوداً
            const viewerSocket = io.sockets.sockets.get(viewerSocketId);
            if (viewerSocket) {
              io.to(viewerSocketId).emit('ice_candidate', { streamId, userId, candidate });
            }
          });
          console.log(`[ice_candidate] بيانات الاتصال من البثّاث أُرسلت لـ ${offers[streamId].viewers.length} مشاهدين`);
        } else {
          // بيانات الاتصال من المشاهد → البثّاث
          // التأكد أن اتصال البثّاث لا يزال موجوداً
          const broadcasterSocket = io.sockets.sockets.get(offers[streamId].broadcasterSocketId);
          if (broadcasterSocket) {
            io.to(offers[streamId].broadcasterSocketId).emit('ice_candidate', { streamId, userId, candidate });
            console.log(`[ice_candidate] بيانات الاتصال من المشاهد ${userId} أُرسلت للبثّاث`);
          }
        }
      } catch (err) {
        console.error('خطأ في تبادل بيانات الاتصال:', err);
        socket.emit('error', { message: 'فشل تبادل بيانات الاتصال' });
      }
    });

    // تنظيف عند قطع الاتصال
    socket.on('disconnect', (reason) => {
      console.log(`🔌 Socket disconnected: ${socket.id}, reason: ${reason}`);

      // إزالة معرف الاتصال من جميع القوائم
      Object.keys(offers).forEach(streamId => {
        const streamOffer = offers[streamId];

        // إزالة من قائمة المشاهدين النشطين
        streamOffer.viewers = streamOffer.viewers.filter(id => id !== socket.id);
        
        // إزالة من قائمة المشاهدين في وضع الانتظار
        streamOffer.waitingViewers = streamOffer.waitingViewers.filter(id => id !== socket.id);

        // إذا كان البثّاث منقطع الاتصال، إزالة العرض بالكامل
        if (streamOffer.broadcasterSocketId === socket.id) {
          delete offers[streamId];
          // إعلام جميع المستخدمين في الغرفة أن البثّاث انقطع
          io.to(streamId).emit('broadcaster_disconnected', { streamId });
          console.log(`[disconnect] البثّاث انقطع الاتصال، تم إزالة العرض للبث ${streamId}`);
        }
      });
    });
  });
};
