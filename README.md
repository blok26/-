# ارسمها لو تقدر 🎨🎙️
### لعبة ويب عربية تفاعلية لشخصين عبر هاتفين (رسم مباشر + تخمين + محادثة صوتية WebRTC)

---

## 🌟 نظرة عامة
لعبة تعاونية عربية ممتعة مصممة خصيصًا للهواتف الذكية (Mobile First) لشخصين داخل غرفة خاصة. يقوم أحد اللاعبين برسم كلمة سرية على لوحة رسم لمسية سلسة، ويشاهد اللاعب الآخر الخطوط لحظيًا عبر Firebase Realtime Database، مع إمكانية التحدث المباشر بالصوت عبر WebRTC Peer-to-Peer.

---

## 🛠️ التقنيات المستخدمة
- **الواجهة:** React 19 + TypeScript + Vite + Tailwind CSS.
- **التصميم:** عربي RTL بالكامل مع خط Tajawal ودعم اللمس (Pointer Events & touch-action).
- **قاعدة البيانات والمزامنة:** Firebase Realtime Database + Anonymous Authentication.
- **الصوت المباشر:** WebRTC Audio (STUN افتراضيًا + دعم TURN اختياري عبر خادم Express آمن `/api/ice-config`).
- **المعالجة اللغوية:** دالة تطبيع نصوص عربية متقدمة (إزالة التشكيل، توحيد الهمزات والياء والتاء المربوطة).

---

## 🚀 خطوات إعداد Firebase خطوة بخطوة

1. **إنشاء مشروع Firebase:**
   - اذهب إلى [Firebase Console](https://console.firebase.google.com).
   - اضغط على **Add Project** وسمّه مثلاً: `draw-it-arabic`.

2. **تفعيل تسجيل الدخول المجهول (Anonymous Auth):**
   - من القائمة الجانبية: **Build** > **Authentication**.
   - اضغط **Get Started**.
   - في تبويب **Sign-in method**، اختر **Anonymous** وفعّله (Enable) ثم اضغط **Save**.

3. **إنشاء Firebase Realtime Database:**
   - من القائمة الجانبية: **Build** > **Realtime Database**.
   - اضغط **Create Database**.
   - اختر المنطقة الأقرب لك (مثل `europe-west1` أو `us-central1`).
   - اختر **Start in locked mode**.

4. **نشر قواعد الأمان (database.rules.json):**
   - في صفحة Realtime Database، ادخل تبويب **Rules**.
   - استبدل المحتوى بالكامل بما هو موجود داخل ملف `database.rules.json` في هذا المشروع.
   - اضغط **Publish**.
   - *(أو عبر Firebase CLI: `firebase deploy --only database`)*.

5. **الحصول على مفاتيح التطبيق (Web App Config):**
   - اذهب إلى **Project Settings** (أيقونة الترس ⚙️ بجانب Project Overview).
   - في أسفل الصفحة، اضغط على أيقونة الويب `</>` لإضافة Web App.
   - انسخ قيم `firebaseConfig`.

---

## 🔑 المتغيرات المطلوبة في `.env` أو Secrets

أضف هذه المتغيرات في ملف `.env` محليًا أو في لوحة Secrets داخل AI Studio:

```env
# إعدادات Firebase للواجهة
VITE_FIREBASE_API_KEY="AIzaSy..."
VITE_FIREBASE_AUTH_DOMAIN="your-app.firebaseapp.com"
VITE_FIREBASE_DATABASE_URL="https://your-app-default-rtdb.firebaseio.com"
VITE_FIREBASE_PROJECT_ID="your-app"
VITE_FIREBASE_STORAGE_BUCKET="your-app.appspot.com"
VITE_FIREBASE_MESSAGING_SENDER_ID="1234567890"
VITE_FIREBASE_APP_ID="1:1234567890:web:abcdef"

# خادم TURN الصوتي (اختياري)
TURN_URL="turn:turn.example.com:3478"
TURN_USERNAME="turn_user"
TURN_CREDENTIAL="turn_password"
```

> 💡 **ملاحظة:** يتيح التطبيق أيضًا زر **«إعدادات Firebase»** في الواجهة للصق القيم مباشرة في المتصفح والبدء الفوري دون الحاجة لإعادة تشغيل الخادم.

---

## 🎙️ هل تحتاج إلى خادم TURN لضمان الصوت بين شبكات مختلفة؟

### الإجابة الصريحة والتقنية:
- **نعم، يُوصى بشدة بـ TURN إذا كان اللاعبان على شبكتين خلويتين مختلفتين (4G/5G) أو خلف جدران حماية صارمة (Symmetric NAT).**
- خادم STUN المجاني الافتراضي من Google (`stun:stun.l.google.com:19302`) يعمل بنجاح 100% عندما يكون اللاعبان على شبكة WiFi منزلية، أو شبكات تدعم Full-cone NAT.
- عندما تفشل حزمة STUN في اختراق الـ NAT المزدوج لشبكات المحمول، يتولى TURN نقل الصوت (Relay) بين الطرفين.
- التطبيق مجهز بـ Endpoint آمن على الخادم: `GET /api/ice-config` يجلب إعدادات TURN من متغيرات البيئة دون كشف كلمة المرور للواجهة.
- إذا لم تتوفر إعدادات TURN، يستمر التطبيق بالعمل على STUN ولن يتوقف أبدًا.

---

## 🧪 التحقق والاختبارات
لتشغيل اختبارات فحص تطبيع النصوص العربية:
```bash
npm test # أو npx tsx --test src/utils/normalizeArabic.test.ts
```

لتشغيل السيرفر المحلي:
```bash
npm run dev
```
ثم افتح: `http://localhost:3000`
