# STAGE 6 - PWA & Reminder

> Sau mỗi task có **Verify** - phải pass mới đi tiếp.
> Gặp mâu thuẫn thì **DỪNG và hỏi**, không tự đoán.

---

## 0. Mục tiêu

Nhắc khi quên log, và làm app mở nhanh hơn.

Hai việc này đi chung một stage vì cùng một mảnh hạ tầng: service worker.

### Việc người dùng phải tự làm trước
Agent không làm thay được, và không có chúng thì cả stage vô nghĩa:

1. **Nâng Firebase lên Blaze.** Cloud Functions cần. Hai job định kỳ nằm
   trong free tier của Cloud Scheduler (3 job), nên thực tế gần như $0 -
   nhưng phải có thẻ.
2. **Lấy Web Push certificate.** Console → Project settings → Cloud
   Messaging → Web Push certificates → Generate key pair.
   File `web_push_cert.txt` hiện đang **rỗng 0 byte** - copy hụt từ lần trước.
3. **Add to Home Screen từ Safari.** iOS chỉ gửi web push cho PWA đã cài, và
   chỉ cài được từ Safari (không phải Edge/Chrome).

Thiếu bước 3 thì `/settings` sẽ báo "not supported" trong tab trình duyệt
thường - đó là hành vi đúng của iOS, không phải lỗi.

---

## Task 1 - Manifest và icon

`src/app/manifest.ts`: `display: 'standalone'`, `start_url: '/log'`,
`theme_color` khớp token `--bg` của cả hai theme, `background_color` sáng.

`scripts/make-icons.mjs`: sinh PNG 192/512/1024 và maskable từ
`public/branding/fina-icon.svg` (đã có sẵn trong repo). Không thêm thư viện
ảnh - dùng `sharp` nếu đã có, không thì render bằng canvas trong một trang
tạm rồi lưu tay. Icon sinh từ code để đổi màu một chỗ là xong.

### Vì sao standalone quan trọng
Đo ở Stage 2: viewport 812 (standalone) thì màn hình Log **không cuộn gì cả**;
trong Safari còn ~640 nên vùng bucket chỉ còn một hàng. Cài về Home Screen
không phải chuyện thẩm mỹ, nó là chuyện dùng được.

### Verify
Add to Home Screen → mở từ icon → không có thanh địa chỉ, không có thanh tab.

---

## Task 2 - Service worker

`public/sw.js`. **Hai việc, không hơn.**

### a) Nhận push
Gửi **data-only** message, service worker tự vẽ notification. Gửi kèm
`notification` payload nữa thì iOS hiện **hai** thông báo cho cùng một nhắc.

### b) Cache app shell
Đây là khác biệt so với `logi` (SW của logi chỉ push, không cache).
fina cần vì mốc 1,5s / 2,5s.

| Loại | Chiến lược | Vì sao |
|---|---|---|
| `/_next/static/*` | **cache-first, vĩnh viễn** | tên file có hash nội dung, bản mới là tên mới |
| HTML (`/log`, `/summary`, …) | **network-first, fallback cache** | build mới phải tới được ngay |
| `/api/*`, Firestore, Google APIs | **không đụng vào** | dữ liệu không bao giờ được phục vụ từ cache cũ |

Cache-first cho HTML là cách chắc chắn nhất để một hôm nào đó người dùng
nhìn vào bản build của tuần trước mà không hiểu vì sao.

Đặt `CACHE_VERSION` trong `sw.js`, xoá cache cũ ở `activate`.

### Verify
- Bật máy bay → mở app từ Home Screen → app **vẫn mở được**, hiện dữ liệu
  đã cache của Firestore, log được (Firestore xếp hàng ghi).
- Deploy một thay đổi rõ rệt → mở lại → **thấy bản mới**, không phải reload
  hai lần.
- Đo lại Cold start, ghi số vào `README.md`.

---

## Task 3 - FCM token

`src/lib/push.ts`: xin quyền, lấy token, lưu `users/{uid}/meta/fcm`
`{ token, updatedAt, platform }`.

Bật/tắt trong `/settings`. Trạng thái phải nói rõ **ba** khả năng, không gộp:
- `Not supported` - đang mở trong tab trình duyệt, chưa Add to Home Screen
- `Blocked` - người dùng đã từ chối quyền, phải sửa trong Cài đặt iOS
- `On` / `Off`

Gộp ba cái thành một dòng "không bật được" là cách chắc chắn để nửa năm sau
không ai biết vì sao.

### Verify
Bật trong PWA đã cài → Firestore có `meta/fcm` với token.
Mở trong tab Safari thường → hiện `Not supported`, không xin quyền.

---

## Task 4 - Điều kiện gửi

Không phải "chưa log hôm nay". Đúng là **N ngày liên tiếp không có giao dịch nào**.

`reminderQuietDays` mặc định **2**, sửa được trong Settings.

### Vì sao 2, không phải mỗi ngày

Đếm trên 138 dòng thật, khoảng 28/3 - 2/9/2026:

| | |
|---|---|
| Số ngày có log | **43** |
| Khoảng thời gian | 159 ngày |
| Tỉ lệ | **27%** |
| Khoảng cách giữa 2 lần log | trung vị **2** ngày, dài nhất 13 |

Nhắc mỗi ngày không log sẽ kêu khoảng **266 lần/năm**, và phần lớn những
ngày đó người dùng **thật sự không tiêu gì** - nhắc là sai. Hai tuần là tắt
noti, rồi tính năng này coi như không tồn tại.

| Ngưỡng | Số lần kêu trong 5 tháng |
|---|---|
| mỗi ngày | ~116 |
| **2 ngày** | **~30** |
| 3 ngày | ~18 |

### Câu chữ
```
fina
2 days since your last entry.
```

Nêu sự thật, không trách móc. Không "Bạn quên rồi!", không dấu chấm than.
Cùng nguyên tắc với `logi`.

---

## Task 5 - Cloud Function

`functions/src/index.ts`, chạy **mỗi 15 phút**.

```
1. Giờ Việt Nam có phải 22:00 không? (khớp trong khung 15 phút)
2. Đọc users/{uid}/meta/fcm  -> có token không?
3. Giao dịch mới nhất theo occurredAt desc limit 1
4. now - occurredAt >= reminderQuietDays ngày?
5. Hôm nay đã gửi chưa? (meta/pushLog)
6. Gửi data-only, ghi pushLog
```

### Hai chiếc đồng hồ phải khớp nhau

`functions/` deploy riêng, **không import được code trong `src/`**. Nên nó
phải có bản sao của luật ngày 25 và luật múi giờ.

Đó là chỗ sẽ trôi. Bắt buộc có `test/functions-time.test.ts` so hai bản
**giờ này qua giờ khác**, gồm cả tuần bắc qua năm mới. Đổi luật một bên mà
quên bên kia thì test đỏ - đúng cách `logi` làm.

### Ràng buộc
- Function chạy theo UTC. Mọi so sánh phải quy về `Asia/Ho_Chi_Minh`, không
  được tin vào giờ máy chủ.
- `meta/pushLog` chặn gửi trùng: một loại nhắc, một lần mỗi ngày logic.
- Log chỉ ghi tên lỗi, **không bao giờ ghi số tiền hay ghi chú** ra log
  production.
- Job thứ hai dọn `pushLog` cũ, giữ khoảng 30 ngày.

### Verify
Đặt tạm `reminderQuietDays: 0` và đổi giờ gửi sang phút kế tiếp → nhận được
thông báo trên **màn khoá** khi app đã đóng hẳn. Trả lại giá trị cũ sau khi thử.

---

## Task 6 - Đường lui

Ghi vào `README.md` cách tắt nếu không muốn trả tiền Blaze nữa:

```bash
firebase functions:delete pushReminders trimPushLog
```
rồi hạ về Spark. App vẫn chạy bình thường, chỉ mất nhắc ở màn khoá.

Viết sẵn để sau này không phải mò lại.

---

## Xong Stage 6 khi

App mở từ icon Home Screen, không có thanh trình duyệt, mở được cả khi mất
mạng. Không log 2 ngày → 22:00 có thông báo trên màn khoá khi app đã đóng.
Số đo Cold start mới đã ghi vào `README.md`.
