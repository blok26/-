# ارسمها لو تقدر 🎨🎙️
### لعبة ويب عربية لشخصين عبر هاتفين (رسم مباشر + تخمين + محادثة صوتية WebRTC)

[![CI](https://github.com/USER/REPO/actions/workflows/ci.yml/badge.svg)](https://github.com)
[![Netlify Status](https://api.netlify.com/api/v1/badges/your-site-id/deploy-status)](https://app.netlify.com)

---

## 🌟 نظرة عامة
**«ارسمها لو تقدر»** هي لعبة تعاونية وتنافسية عربية مصممة خصيصًا للهواتف الذكية (Mobile First) لشخصين داخل غرفة خاصة برمز فريد من 6 خانات.
يقوم أحد اللاعبين برسم كلمة سرية من **العامية المصرية**، بينما يشاهد اللاعب الآخر خطوط الرسم لحظة بلحظة ويحاول تخمين الكلمة عبر الشات، مع وجود مكالمة صوتية مباشرة بين الهاتفين عبر تقنية **WebRTC**.

### ✨ الميزات الرئيسية:
- 📱 **Mobile First & PWA:** واجهة سريعة الاستجابة باللغة العربية واتجاه RTL مع خط تجوال (Tajawal).
- ✏️ **رسم لمسي فائق الدقة (60 FPS):** لوحة رسم بدون أي انزياح أو تأخير مع دعم اللمس، الماوس، ممحاة، أحجام فرشاة مختلفة، وتراجع.
- 🇪🇬 **بنك كلمات عامية مصرية أصيلة (+100 كلمة):** تصنيفات متنوعة (أكلات ومشروبات مصرية، أدوات وشوارع، حيوانات وشخصيات، مواقف مضحكة، كرتون وذكريات).
- 💡 **تلميح نصف الوقت:** إظهار عدد الحروف وكشف حرف عشوائي مع رنين صوتي لطيف عند انقضاء نصف مدة الجولة.
- ⚖️ **أزرار تحكيم الرسام:** زران مخصصان للرسام («خمّن صح ✅» لاعتماد التخمين ومنح النقاط فورًا، و«خمّن غلط ❌» لإرسال تنبيه ودود للمخمّن للمحاولة مجددًا).
- 🔄 **استمرار اللعب السلس:** زر «جولة جديدة» وزر «تبديل الرسام» للعب جولات متتالية وتبادل الأدوار دون مغادرة الغرفة.
- 🎙️ **مكالمة صوتية مباشرة:** اتصال صوتي WebRTC بتقنية إلغاء الصدى وتقليل الضوضاء (تطلب الإذن فقط عند الضغط على زر الميكروفون).
- ⚡ **وضع تجربة فوري (Simulation Mode):** إمكانية تجربة اللعبة بالكامل داخل المتصفح مع لاعب تجريبي دون الحاجة لمفاتيح Firebase، بالإضافة لدعم كامل للمزامنة السحابية الحقيقية عبر Firebase Realtime Database.

---

## 🛠️ التقنيات المستخدمة
- **الواجهة الأمامية:** React 19 + TypeScript + Vite + Tailwind CSS v4.
- **إدارة الحالة والمزامنة اللحظية:** Firebase Realtime Database + Anonymous Auth (أو Local BroadcastChannel في وضع المحاكاة).
- **الصوت:** WebRTC Peer-to-Peer (STUN مجاني من Google + دعم خادم TURN اختياري).
- **أيقونات ومؤثرات:** Lucide React + Canvas Confetti + Web Audio API.
- **الاستضافة:** جاهز بالكامل لـ Netlify و GitHub.

---

## 🚀 أولاً: النشر على GitHub خطوة بخطوة

إذا أردت رفع المشروع على حسابك في GitHub، اتبع الخطوات التالية من الطرفية (Terminal):

### 1. إنشاء مستودع جديد على GitHub:
1. اذهب إلى [GitHub](https://github.com/new).
2. اكتب اسم المستودع (مثال: `ersemha-law-teqdar`).
3. اختر المستودع كـ **Public** أو **Private**.
4. **لا** تفعّل خيارات "Add a README" أو ".gitignore" (لأنها موجودة وجاهزة بالفعل في المشروع).
5. اضغط **Create repository**.

### 2. رفع الكود من جهازك إلى GitHub:
افتح الطرفية داخل مجلد المشروع ونفّذ الأوامر التالية بالترتيب:

```bash
# 1. تهيئة مستودع Git محلي
git init -b main

# 2. إضافة جميع الملفات
git add .

# 3. حفظ التغييرات (Commit)
git commit -m "الإصدار الأول: لعبة ارسمها لو تقدر جاهزة للنشر"

# 4. ربط المستودع بحسابك على GitHub (استبدل USERNAME و REPO باسم حسابك ومستودعك)
git remote add origin https://github.com/USERNAME/ersemha-law-teqdar.git

# 5. رفع الكود
git push -u origin main
```

---

## 🌐 ثانياً: النشر على Netlify خطوة بخطوة

المشروع يحتوي مسبقًا على ملف `netlify.toml` وملف `public/_redirects` ودوال `netlify/functions` للـ WebRTC، مما يجعل النشر على Netlify يعمل فورًا بنقرة واحدة!

### الطريقة 1: النشر التلقائي عبر ربط GitHub (موصى بها ⭐)
1. سجّل الدخول إلى [Netlify](https://app.netlify.com).
2. اضغط على **Add new site** ثم اختر **Import an existing project**.
3. اختر **GitHub** وامنح الصلاحية للوصول إلى مستودعك.
4. اختر المستودع `ersemha-law-teqdar`.
5. سيقرأ Netlify تلقائيًا ملف `netlify.toml` المضبوط كالتالي:
   - **Base directory:** *(اتركه فارغًا)*
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
   - **Functions directory:** `netlify/functions`
6. (اختياري) لإضافة إعدادات Firebase الحقيقية، اضغط على **Add environment variables** (راجع قسم المتغيرات أدناه).
7. اضغط **Deploy ersemha-law-teqdar**.
8. سيبدأ البناء وينتهي خلال أقل من دقيقة، وسيعطيك Netlify رابطًا مباشرًا لموقعك (مثال: `https://ersemha-law-teqdar.netlify.app`).

### الطريقة 2: النشر اليدوي المباشر (Drag & Drop)
إذا أردت تجربة النشر دون ربط GitHub:
```bash
# 1. بناء ملفات الإنتاج
npm run build
```
1. اذهب إلى [Netlify Drop](https://app.netlify.com/drop).
2. اسحب مجلد `dist` وأفلته في الصفحة مباشرة، وسيكون موقعك متاحًا فورًا!

### الطريقة 3: النشر عبر Netlify CLI
```bash
npm install -g netlify-cli
ntl login
ntl init
ntl deploy --prod
```

---

## 🔑 ثالثاً: إعدادات Firebase (اختياري للمزامنة عبر الإنترنت)

يعمل التطبيق افتراضيًا في وضع المحاكاة اللحظية الذكية. ولتفعيل اللعب المشترك بين هاتفين على شبكتين مختلفتين عبر الإنترنت، قم بربط Firebase مجانًا:

1. أنشئ مشروعًا جديدًا على [Firebase Console](https://console.firebase.google.com).
2. فعّل **Anonymous Authentication** من: `Build` > `Authentication` > `Sign-in method`.
3. أنشئ **Realtime Database** من: `Build` > `Realtime Database`.
4. انسخ محتوى ملف `database.rules.json` من هذا المشروع والصقه في تبويب **Rules** في Firebase ثم اضغط **Publish**.
5. اذهب إلى **Project Settings** (⚙️) وأضف تطبيق ويب `</>` وانسخ المفاتيح.
6. في Netlify، اذهب إلى:
   `Site configuration` > `Environment variables` > `Add a variable` وأضف المتغيرات التالية:

| اسم المتغير | الوصف | مثال |
| :--- | :--- | :--- |
| `VITE_FIREBASE_API_KEY` | مفتاح API | `AIzaSy...` |
| `VITE_FIREBASE_AUTH_DOMAIN` | نطاق المصادقة | `my-app.firebaseapp.com` |
| `VITE_FIREBASE_DATABASE_URL` | رابط قاعدة البيانات اللحظية | `https://my-app-default-rtdb.firebaseio.com` |
| `VITE_FIREBASE_PROJECT_ID` | معرّف المشروع | `my-app` |
| `VITE_FIREBASE_STORAGE_BUCKET` | نطاق التخزين | `my-app.appspot.com` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | معرّف المرسل | `123456789` |
| `VITE_FIREBASE_APP_ID` | معرّف التطبيق | `1:123...` |

> 💡 **ملاحظة:** يمكنك أيضًا لصق هذه الإعدادات مباشرة من داخل واجهة التطبيق عبر زر **«إعدادات Firebase»** في الزاوية العلوية دون الحاجة لإعادة نشر التطبيق.

---

## 🎙️ رابعاً: المكالمة الصوتية وخوادم TURN (WebRTC)

- يعتمد التطبيق افتراضيًا على خوادم **STUN** المجانية من Google (`stun:stun.l.google.com:19302`) والتي تعمل بكفاءة عالية على شبكات الـ Wi-Fi والاتصالات المباشرة.
- إذا كان اللاعبان على شبكتين خلويتين معقدتين (4G/5G Symmetric NAT)، يمكنك إضافة خادم TURN مجاني أو مدفوع عبر المتغيرات التالية في Netlify:
  - `TURN_URL`: مثال `turn:openrelay.metered.ca:80`
  - `TURN_USERNAME`: اسم المستخدم
  - `TURN_CREDENTIAL`: كلمة المرور
- يوفر المشروع دالة Serverless جاهزة على Netlify في المسار `/api/ice-config` تقوم بتمرير هذه الإعدادات تلقائيًا وبأمان.

---

## 💻 التشغيل والاختبار محليًا (Local Development)

```bash
# تثبيت الحزم
npm install

# تشغيل خادم التطوير المحلي
npm run dev

# تشغيل الفحص والتحقق من الأنواع
npm run lint

# تشغيل اختبارات مطابقة الكلمات العامية والتلميحات
npm test

# تجربة بناء الإنتاج محليًا
npm run build
npm run preview
```

---

## 📁 هيكلية المشروع
```
├── netlify.toml                # إعدادات Netlify للإنتاج والتوجيه والدوال
├── netlify/
│   └── functions/              # دوال Serverless على Netlify (ICE config & Health)
├── public/
│   └── _redirects              # توجيهات SPA لضمان عمل الروابط المباشرة
├── .github/
│   └── workflows/ci.yml        # فحص وبناء الكود آليًا عند كل Commit على GitHub
├── database.rules.json         # قواعد أمان Firebase Realtime Database
├── .env.example                # نموذج لمتغيرات البيئة
├── src/
│   ├── components/             # واجهات اللعبة (اللوحة، المحادثة، النتيجة، الرأس)
│   ├── data/arabicWords.ts     # قاموس الكلمات العامية المصرية وتصنيفاتها
│   ├── hooks/                  # Hooks للغرفة، المؤقت، الرسم، والصوت
│   ├── services/               # خدمات Firebase، WebRTC، والمحاكاة المحلية
│   └── utils/                  # تطبيع النصوص العربية والمؤثرات الصوتية
└── server.ts                   # خادم محلي اختياري لبيئة Node.js / Express
```

---

## 📄 الترخيص
هذا المشروع مفتوح المصدر ومتاح بموجب ترخيص Apache-2.0.
استمتع باللعب مع أصدقائك! 🎨🥳
