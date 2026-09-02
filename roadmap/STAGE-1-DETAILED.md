# STAGE 1 - Foundation & Auth

> Plan này viết cho một AI coding agent thực thi. Làm đúng thứ tự task.
> Sau mỗi task có mục **Verify** - phải pass mới đi tiếp.
> Gặp mâu thuẫn hoặc thiếu thông tin thì **DỪNG và hỏi người dùng**, không tự đoán.

---

## 0. Bối cảnh

Xây `fina` - app quản lý tài chính cá nhân, một người dùng duy nhất.
iPhone 11 (Safari / PWA) là target chính, Mac là màn hình thứ hai. UI tiếng Anh.

Stage 1 **chỉ** làm hạ tầng: scaffold, Firebase, đăng nhập, app shell rỗng, deploy.
Không có nghiệp vụ nào.

App chị em `logi` nằm ở `/Users/kyphan/ws/app/logi` và **đã giải xong** phần này.
Đọc code ở đó trước khi viết mới - đặc biệt `src/lib/firebase-client.ts`,
`src/lib/firebase-admin.ts`, `src/lib/server-auth.ts`, `src/contexts/AuthContext.tsx`,
`src/app/api/auth/session/route.ts`. Chép sang và đổi tên, đừng viết lại từ đầu.

### KHÔNG làm ở Stage 1
- Bucket, giao dịch, numpad, Summary
- Chart, export, import
- PWA manifest, service worker, push
- Gemini
- Test tự động (trừ khi người dùng yêu cầu)

Scope creep ở stage này làm phần auth khó debug.

---

## Task 1 - Scaffold project

Thư mục `/Users/kyphan/ws/app/fina` đã tồn tại, đã là git repo, đã có `public/`
với `favicon.svg` và `branding/fina-icon.svg`. **Giữ nguyên hai file đó.**

```bash
cd /Users/kyphan/ws/app
npx create-next-app@latest fina-tmp \
  --typescript --tailwind --app --src-dir --eslint \
  --import-alias "@/*" --no-turbopack
```

Rồi chép nội dung `fina-tmp` vào `fina` (đừng đè `public/`, `README.md`, `.git`),
xoá `fina-tmp`.

```bash
cd /Users/kyphan/ws/app/fina
npm i firebase firebase-admin server-only
```

Khớp phiên bản với `logi` (`package.json` ở đó): Next 16.x, React 19.x, node 24.x.

### Cấu trúc cần có sau task này

```
fina/
├── firestore.rules
├── firestore.indexes.json
├── firebase.json
├── .firebaserc
├── vercel.json
├── .env.local          (KHÔNG commit)
├── .env.example
├── .gitignore
├── roadmap/
└── src/
    ├── app/
    │   ├── layout.tsx
    │   ├── page.tsx            → redirect sang /log
    │   ├── globals.css
    │   ├── login/page.tsx
    │   ├── (main)/
    │   │   ├── layout.tsx
    │   │   ├── log/page.tsx
    │   │   ├── summary/page.tsx
    │   │   ├── history/page.tsx
    │   │   ├── insights/page.tsx
    │   │   └── settings/page.tsx
    │   └── api/auth/session/route.ts
    ├── components/
    │   ├── LoginView.tsx
    │   ├── BottomNav.tsx
    │   └── AppShell.tsx
    ├── contexts/AuthContext.tsx
    ├── lib/
    │   ├── firebase-client.ts
    │   ├── firebase-admin.ts
    │   ├── server-auth.ts
    │   └── db-id.ts
    └── types/fina.ts           (rỗng ở stage này, chỉ export {} )
```

### `.gitignore` phải có
```
.env*.local
*firebase-adminsdk*.json
.vercel
.next
node_modules
```

### Verify
`npm run dev` chạy, mở `http://localhost:3000` không lỗi.
`npx tsc --noEmit` sạch.
`git status` **không** thấy file nào chứa secret.

---

## Task 2 - Firebase project riêng

Tạo project **mới**: `kyphan38-fina-app`. Dùng database `(default)`.

Đây là bài học đã trả giá ở `logi` (xem `logi/roadmap/PLAN-project-split-logi.md`):
dùng chung project giữa các app nghĩa là chung Auth user pool, chung tên Cloud
Function, chung quota, và một lần `firebase deploy` nhầm sẽ ghi đè rules của app kia.

`src/lib/db-id.ts`:
```ts
// Mỗi app một Firebase project riêng. fina dùng database mặc định.
// Giữ hằng số này để sau còn một chỗ duy nhất mà đổi.
export const DB_ID = '(default)';
```

### Hai loại file credentials - phân biệt cho đúng

**Loại A - Web app config.** Có `apiKey`, `authDomain`, `projectId`,
`storageBucket`, `messagingSenderId`, `appId`.
→ An toàn ở client. Map vào `NEXT_PUBLIC_*`.

**Loại B - Service account JSON.** Có `"type": "service_account"` và `"private_key"`.
→ Khoá admin, **bỏ qua toàn bộ Security Rules**. Bắt buộc:
- KHÔNG BAO GIỜ đặt vào `NEXT_PUBLIC_*`
- KHÔNG BAO GIỜ commit
- KHÔNG in ra console hay log
- Chỉ trích 3 trường: `project_id`, `client_email`, `private_key`

Cần **cả hai**. Thiếu cái nào thì hỏi xin, đừng đoán.

### `.env.local`
```bash
# ---- Client (an toàn để lộ) ----
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# ---- Server only (BÍ MẬT) ----
FIREBASE_ADMIN_PROJECT_ID=
FIREBASE_ADMIN_CLIENT_EMAIL=
FIREBASE_ADMIN_PRIVATE_KEY=
ALLOWED_USER_EMAIL=ptk.ai.2025@gmail.com
```

`.env.example` là bản copy với mọi giá trị để trống.

### Verify
`node -e "require('dotenv')"` không cần thiết - thay vào đó viết một script tạm
in ra `projectId` từ Admin SDK, chạy được rồi **xoá script**.

---

## Task 3 - Firebase client + admin

Chép từ `logi`, đổi tên biến. Hai điểm bắt buộc giữ nguyên:

1. **Offline persistence bật** ở client (`persistentLocalCache`). Stage 2 phụ thuộc
   vào nó để log khi mất sóng.
2. **Admin SDK khởi tạo một lần**, `private_key` phải `.replace(/\\n/g, '\n')`.

### Verify
Mở app, tab Network không có request nào lỗi 400/403 tới Firestore.

---

## Task 4 - Đăng nhập Google + allowlist

Theo đúng `logi`:
- Login Google bằng popup ở `/login`.
- Sau khi có `idToken` → `POST /api/auth/session` → server verify token →
  **kiểm email có khớp `ALLOWED_USER_EMAIL` không** → set cookie httpOnly,
  `secure` (chỉ ở production, để localhost còn chạy), `sameSite: lax`, 14 ngày.
- `AuthContext` bọc toàn app, expose `{ user, loading, signIn, signOut }`.
- `(main)/layout.tsx` chưa có user → redirect `/login`.
- Mọi API route sau này phải verify cookie **trước khi làm bất cứ việc gì**.

Allowlist kiểm ở **hai chỗ**: lúc login, và trong mỗi request server-side. Chỉ kiểm
ở login là không đủ - cookie có thể bị mang sang chỗ khác.

### Verify
- Login bằng đúng email → vào được `/log`.
- Login bằng email khác → bị từ chối, có thông báo rõ ràng.
- Xoá cookie → tự động về `/login`.
- Gọi `/api/auth/session` bằng `curl` không kèm cookie → 401.

---

## Task 5 - App shell + 5 tab rỗng

`BottomNav`: `Log · Summary · History · Insights · Settings`.
`Log` là tab mặc định, `/` redirect sang `/log`.

Mỗi trang chỉ cần một chữ tên trang. Chưa có nội dung.

Giao diện: **tối giản, font hệ thống, không web font.**
`globals.css` khai báo token màu theo đúng mockup đã duyệt
(`/private/tmp/.../fina-log.html` - hỏi người dùng nếu file đã mất):

```css
:root{
  --bg:#F3F3F2; --surface:#FFFFFF; --surface-2:#FAFAF9; --sunk:#E9E9E7;
  --ink:#1A1A19; --muted:#71716D; --faint:#A3A39E; --line:#E2E2DF;
  --over:#9B2C22;
}
```
Kèm khối dark theo `prefers-color-scheme`. Body luôn set `background` từ token.

### Verify
Mở trên iPhone qua địa chỉ LAN, 5 tab bấm qua lại được, không lỗi console.

---

## Task 6 - Firestore rules

Viết `firestore.rules` theo mẫu `logi`, đổi collection cho hợp mô hình fina.
Ràng buộc bắt buộc kiểm ngay ở tầng DB:

- `isOwner(uid)` cho mọi path.
- `transactions`: `amountVnd is int && amountVnd > 0`, `cycle is string`,
  `bank in ['VCB','BIDV']`, `bucketId is string`.
- `buckets`: `kind in ['budget','fund']`, `bank in ['VCB','BIDV','VPS']`,
  `baselineVnd is int && baselineVnd >= 0`.
- `cycles`: chu kỳ đã `closed` thì **không update được nữa**.
- `covers`: `amountVnd is int && amountVnd > 0`, `status in ['pending','done']`.
- Catch-all `match /{document=**} { allow read, write: if false; }`.

`firestore.indexes.json`: composite index cho `transactions` theo
`(cycle asc, occurredAt desc)` và `(bucketId asc, occurredAt desc)`.

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

### Verify
Từ Rules Playground: đọc `users/<uid_khác>/transactions/x` → **Deny**.
Ghi `transactions` với `amountVnd: 25.5` (số thực) → **Deny**.

---

## Task 7 - Deploy Vercel

- Import repo, đặt biến môi trường (cả 6 `NEXT_PUBLIC_*` và 4 biến server).
- `vercel.json`: chưa cần `maxDuration` ở stage này.
- Firebase Console → Auth → Settings → **Authorized domains**: thêm domain Vercel,
  xoá mọi domain lạ. Đây là việc script không làm được, phải mở console bấm tay.

### Verify
Mở URL production trên iPhone, login được, thấy 5 tab.

---

## Xong Stage 1 khi

Trên iPhone, mở URL production, login Google bằng email của mình, thấy app shell
với 5 tab rỗng, refresh không bị đá ra. Login bằng email khác thì bị chặn.

Ghi lại vào `README.md`: project id Firebase, URL production, và ngày hoàn thành.
