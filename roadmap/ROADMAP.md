# fina - Implementation Roadmap

App quản lý tài chính cá nhân. Next.js (App Router) + Firebase + Vercel + Gemini Flash.
Một người dùng duy nhất, iPhone + Mac, giao diện tiếng Anh.

Thay thế hệ thống `Budget.numbers` + iOS Shortcuts đang dùng. Cùng stack với `logi`,
nên phần auth / PWA / push / AI-insight chép sang được gần như nguyên vẹn.

---

## Nguyên tắc xuyên suốt (áp dụng cho MỌI stage)

Bất biến. Agent thực thi không được đổi mà không hỏi.

1. **Chu kỳ cắt ngày 25**, không phải mùng 1. Mọi truy vấn đi qua `cycleOf()`.
   Không bao giờ dùng tháng lịch thô. Chi ngày 25/08 thuộc chu kỳ `2026-09`.
2. **Tiền lưu số nguyên VND** (`155360`). UI nhập và hiện theo **nghìn** (`155.36`).
   Không bao giờ để số thực trong DB - cộng nhiều dòng float sẽ trôi.
3. **Chỉ có hai loại hũ**: `budget` (reset mỗi chu kỳ) và `fund` (cộng dồn).
   Không phát minh loại thứ ba.
4. **Giao dịch luôn ghi vào bucket đúng việc đã tiêu.** Nguồn tiền bù là chuyện
   khác, ghi riêng ở `covers`. Tiêu lố Food thì Food phải hiện lố - không được
   giấu khoản đó sang Buffer.
5. **App theo dõi hũ tiền, không theo dõi số dư ngân hàng.** Chuyển tiền thật
   giữa VCB/BIDV/VPS là việc ngoài đời, app chỉ nhắc.
6. **Lưu giao dịch TRƯỚC khi hỏi bất cứ điều gì.** Hộp thoại bù tiền, confirm
   chuyển khoản - tất cả đều đến sau khi record đã nằm trong Firestore.
7. **Quỹ chỉ giảm sau khi xác nhận đã chuyển khoản** (luồng BIDV → VCB).
   Bù từ Buffer (cùng VCB) thì trừ ngay.
8. **Không xoá dữ liệu tự động.** Bỏ một bucket = `active: false`, giữ lịch sử.
9. **Gemini API key chỉ tồn tại server-side.** Không bao giờ có tiền tố `NEXT_PUBLIC_`.
10. **Code làm phép tính, model chỉ chọn câu đáng nói.** Model không bao giờ được
    giao việc cộng trừ.
11. **Câu chữ nêu số, không dạy đời.** `"Beauty 2.100 / 1.800 (+17%)"` - không phải
    `"Bạn tiêu cho làm đẹp hơi nhiều"`. Không tư vấn đầu tư, không đánh giá một
    khoản chi là hợp lý hay không.
12. **Tốc độ mở màn hình Log là ràng buộc số 1.** Từ chạm icon tới lúc gõ được số:
    ≤ 1,5s khi app còn trong RAM, ≤ 2,5s khi iOS đã kill. Đo thật ở Stage 2.
13. **Không dùng web font.** Font hệ thống. Mọi thứ phải tải là mọi thứ phải chờ.
14. **Generator độc lập với Limit.** Generator chỉ *điền sẵn* số cho chu kỳ mới,
    không bao giờ tự đồng bộ ngược.
15. **iOS Safari / PWA là target chính** (iPhone 11). Mac là màn hình thứ hai để
    xem và sửa, không phải nơi thiết kế cho.

---

## Mô hình dữ liệu

### `users/{uid}/buckets/{bucketId}`

```ts
{
  id: string;               // 'food', 'beauty', 'healthFund', ...
  name: string;             // 'Food'
  kind: 'budget' | 'fund';
  bank: 'VCB' | 'BIDV' | 'VPS';
  baselineVnd: number;      // số tiền chuẩn mỗi chu kỳ
  balanceVnd: number;       // CHỈ với kind='fund'. Denormalize, xem ghi chú dưới
  order: number;            // thứ tự trên lưới
  active: boolean;
  goal: { targetVnd: number; targetDate: string } | null;
  createdAt: number; updatedAt: number;
}
```

`balanceVnd` được cập nhật **trong cùng một batch** với giao dịch. Có
`scripts/recompute-balances.mjs` để dựng lại từ lịch sử khi nghi ngờ lệch.
Lý do denormalize: cộng lại toàn bộ lịch sử mỗi lần mở app sẽ đốt quota đọc.

### `users/{uid}/transactions/{txId}`

```ts
{
  id: string;
  occurredAt: number;       // epoch ms
  cycle: string;            // '2026-09'  ← field query chính
  bucketId: string;
  bank: 'VCB' | 'BIDV';     // CHÉP từ bucket lúc lưu, không tra ngược
  amountVnd: number;        // số nguyên, luôn dương
  note: string | null;
  source: 'web' | 'import';
  createdAt: number; updatedAt: number;
}
```

`bank` chép cứng vào record: nếu sang năm một bucket đổi ngân hàng, lịch sử năm
nay vẫn đúng.

`Month` và `Year` **không lưu**. Chúng được suy ra từ `cycle` khi hiển thị và khi
export. Lưu ba field rời sẽ có ngày chúng nói khác nhau.

### `users/{uid}/cycles/{cycleId}`   — id là `2026-09`

```ts
{
  id: string;
  startAt: number; endAt: number;
  incomeVnd: number | null;            // lương nhập ở Generator
  limits: Record<string, number>;      // chốt lúc mở chu kỳ, không đổi theo baseline
  status: 'open' | 'closed';
  closedAt: number | null;
  surplusVnd: number | null;           // dư (+) hoặc lố (-) khi đóng sổ
  surplusTo: 'etf' | 'reserve' | 'hold' | null;
}
```

`limits` được **đóng băng** lúc mở chu kỳ. Sửa baseline sau đó không ảnh hưởng
chu kỳ đang chạy - nếu không, biểu đồ quá khứ sẽ đổi số mỗi lần chỉnh Settings.

### `users/{uid}/covers/{coverId}`

Một lần bù tiền cho khoản tiêu lố.

```ts
{
  id: string;
  txId: string;             // giao dịch gây lố
  cycle: string;
  toBucketId: string;       // bucket bị lố
  fromBucketId: string;     // 'buffer' hoặc một quỹ BIDV
  amountVnd: number;        // chỉ phần vượt
  needsTransfer: boolean;   // true khi from là BIDV
  status: 'pending' | 'done';
  createdAt: number; confirmedAt: number | null;
}
```

`needsTransfer=false` → `status='done'` ngay, trừ Buffer luôn.
`needsTransfer=true` → nằm `pending` cho tới khi bấm "Rồi". Quỹ **chưa** giảm khi
còn pending; ô bị lố vẫn hiện số âm đỏ. Đó là trạng thái thật.

### `users/{uid}/meta/settings`

```ts
{
  cycleStartDay: 25;
  reminderHour: 22;
  reminderQuietDays: 2;     // im lặng N ngày thì nhắc
  timezone: 'Asia/Ho_Chi_Minh';
}
```

Còn lại: `meta/fcm` (push token), `insights/{cycleId}` (nhận xét AI đã sinh).

### Quy tắc chu kỳ

```ts
function cycleOf(d: Date, startDay = 25): string {
  const m = d.getDate() >= startDay ? d.getMonth() + 1 : d.getMonth();
  const y = d.getFullYear() + (m > 11 ? 1 : 0);
  return `${y}-${String((m % 12) + 1).padStart(2, '0')}`;
}
```

Kiểm chứng bằng dữ liệu thật: `24 Jul 2026 → 2026-07`, `27 Jul 2026 → 2026-08`,
`25 Apr 2026 → 2026-05`.

---

## Bộ hũ khởi tạo

### VCB - `budget`, reset mỗi chu kỳ

| id | name | baseline | TB thực tế 5 chu kỳ |
|---|---|---:|---:|
| `food` | Food | 3.000.000 | 2.765.000 |
| `beauty` | Beauty | 1.800.000 | 1.683.000 |
| `social` | Social | 700.000 | 620.000 |
| `tech` | Tech | 800.000 | 689.000 |
| `utilities` | Utilities | 200.000 ¹ | ~100.000 |
| `buffer` | Buffer | 1.000.000 | - |
| | | **7.500.000** | |

¹ Wifi 3.000.000/năm đã chuyển sang quỹ `Reserve`, nên Utilities chỉ còn card điện
thoại. Con số này **cần xem lại sau 2 chu kỳ dùng thật**.

### BIDV - `fund`, cộng dồn

| id | name | baseline | ghi chú |
|---|---|---:|---|
| `healthFund` | Health Fund | 3.500.000 | goal ~42.000.000, dự kiến 09/2027 |
| `purchases` | Purchases | 4.100.000 | gia dụng, quần áo, đồ ăn cho chó, giày chạy |
| `travel` | Travel | 1.200.000 | |
| `reserve` | Reserve | chưa chốt ² | wifi (năm), iPhone, xe máy |
| `emergency` | Emergency | 250.000 | không đụng tới |

² Đặt trong Settings ở Stage 2. Riêng wifi đã cần ≥ 250.000/tháng.

### VPS
`etf` - `fund`, nhận phần dư sau khi phân bổ.

---

## Bảng stage

| Stage | Tên | Mục tiêu | Kết quả kiểm chứng được |
|---|---|---|---|
| **1** | Foundation & Auth | Chạy được, đăng nhập được, deploy được | Mở trên iPhone, login Google, thấy 5 tab rỗng đã xác thực |
| **2** | Buckets & Quick Log | Ghi được một khoản chi | Chạm Food → gõ 25 → Save → thấy ô Food giảm |
| **3** | Summary & Cycle | Thấy được tình hình chu kỳ | Bảng VCB/BIDV/VPS khớp tay tính; đóng sổ chạy đúng |
| **4** | History, Edit & Import | Bỏ được Numbers | 138 dòng cũ nằm trong app, sửa/xoá được |
| **5** | Overspend & Cover | Tiêu lố không còn biến mất | Gõ vượt hạn mức → chọn nguồn → luồng chuyển khoản chạy đủ |
| **6** | PWA & Reminder | Nhắc được khi quên log | Im 2 ngày → 22:00 có noti trên màn khoá |
| **7** | Insights | Hiểu được xu hướng | Cuối chu kỳ có báo cáo, số trong câu đều đúng |
| **8** | Mac layout & Polish | Dùng hàng ngày không vướng | Nhập bằng bàn phím trên Mac, chart đọc được |

---

## Stage 1 - Foundation & Auth

→ `STAGE-1-DETAILED.md`

Scaffold Next.js + TypeScript + Tailwind. Firebase project **riêng**
`kyphan38-fina-app`, database `(default)`. Login Google + allowlist một email,
session cookie httpOnly 14 ngày, `AuthContext`, app shell với 5 tab rỗng.
Deploy Vercel, deploy Firestore rules.

**Không làm:** bucket, giao dịch, chart, AI. Chỉ hạ tầng.

## Stage 2 - Buckets & Quick Log

→ `STAGE-2-DETAILED.md`

**Mục tiêu:** ghi được một khoản chi, nhanh.

### Phạm vi
- `src/types/fina.ts` - toàn bộ mô hình dữ liệu ở trên.
- `src/lib/cycle.ts` - `cycleOf()`, `cycleRange()`, `cycleLabel()`. Có test.
- `src/lib/money.ts` - `toVnd('155.36') → 155360`, `fromVnd(155360) → '155.36'`.
  Nhận cả `.` và `,`. Có test.
- Seed bộ hũ khởi tạo ở trên vào Firestore (script hoặc màn hình Settings).
- Màn hình **Log** đúng như mockup:
  - Section `Monthly` (6 ô) luôn mở; section `Funds` (5 ô) gập được,
    **nhớ trạng thái** trong `localStorage`.
  - Mỗi ô: tên, số còn lại (budget) hoặc số dư (fund), vạch tiến độ 2px.
    Vượt hạn mức → số và vạch chuyển đỏ.
  - Vị trí ô **cố định**, không tự sắp theo tần suất.
  - **Numpad tự vẽ**, không dùng bàn phím iOS. Phím `.` và `⌫`.
  - Ô Note tuỳ chọn, không bao giờ chặn Save.
  - Save → ghi optimistic, toast hiện `Food · 25 · còn 2.975 / 3.000`.
- Firestore offline persistence bật (như logi Stage 1).

### Ràng buộc
- Amount = 0 hoặc rỗng → nút Save vô hiệu.
- Ghi giao dịch và cập nhật `balanceVnd` của fund trong **cùng một `writeBatch`**.
- Không có web font. Không có thư viện chart ở stage này.
- Tiêu lố **chưa** hỏi gì cả - chỉ hiện đỏ. Luồng bù để Stage 5.

### Xong khi
Trên iPhone: chạm icon → gõ được số trong **≤ 1,5s** (app còn trong RAM).
Đo bằng `performance.now()` từ `navigationStart` tới lúc numpad nhận chạm đầu tiên,
in ra một dòng trong Settings. Ghi số đo thật vào file này.

## Stage 3 - Summary & Cycle

→ `STAGE-3-DETAILED.md`

**Mục tiêu:** thấy được toàn cảnh chu kỳ và đóng sổ được.

### Phạm vi
- Màn hình **Summary**: ba khối `VCB` / `BIDV` / `VPS`.
  - VCB: từng bucket `spent / limit`, thanh ngang, tổng đã tiêu và còn lại.
  - BIDV: số dư từng quỹ, tổng. `healthFund` có thanh tiến độ tới goal.
  - VPS: tổng đã nạp ETF.
- `src/lib/cycle-close.ts`: tính `surplusVnd` = tổng `limit - spent` của mọi
  bucket `budget`.
- Màn hình **đóng sổ** (mở khi qua ngày 25 mà chu kỳ trước còn `open`):
  liệt kê từng bucket, tổng dư/lố, chọn nơi nhận phần dư (mặc định **ETF**),
  một nút `Đóng sổ`. Chưa đóng sổ thì chu kỳ mới chưa hiện Summary.
- **Generator** (nút trong Summary): nhập lương → các bucket lấy `baseline`,
  ETF = lương − tổng. Hiện % của từng nhóm. Kết quả **chỉ điền sẵn** `limits`
  cho chu kỳ mới, bạn sửa đè được.

### Ràng buộc
- `limits` đóng băng lúc mở chu kỳ. Sửa baseline không đụng chu kỳ đang chạy.
- Đóng sổ là thao tác **một chiều**, nhưng phải ghi đủ dữ liệu để mở lại bằng tay
  nếu sai (không hard-delete gì).
- Không tự chuyển tiền, không tự tạo giao dịch ETF. Chỉ ghi con số.

### Xong khi
Tính tay tổng chi tiêu chu kỳ tháng 9 từ Firestore, khớp với số trên Summary.
Đóng sổ một chu kỳ giả → `surplusVnd` đúng, chu kỳ mới mở với `limits` đúng.

## Stage 4 - History, Edit & Import

→ `STAGE-4-DETAILED.md`

**Mục tiêu:** bỏ được `Budget.numbers`.

### Phạm vi
- Màn hình **History**: danh sách giao dịch theo chu kỳ, mới nhất trên cùng.
  Lọc theo bucket. Tap một dòng → bottom sheet sửa `amount / bucket / note /
  occurredAt`, hoặc xoá.
- Sửa `occurredAt` qua mốc ngày 25 → `cycle` phải tính lại, và số của **cả hai**
  chu kỳ phải cập nhật.
- Sửa `bucketId` giữa hai fund → `balanceVnd` của cả hai phải cập nhật.
- Nút **"Gộp nhiều ngày"**: một dòng cho khoảng thời gian, đánh dấu
  `note` có tiền tố `[gộp]`. Có vì dữ liệu cũ cho thấy bạn hay ghi dồn.
- `scripts/import-numbers.mjs`: đọc CSV export từ Numbers, map sang bucket mới,
  ghi `source: 'import'`. **Mặc định dry-run**, `--commit` mới ghi thật.
- **Export**: JSON toàn bộ + CSV có cột `Cycle | Month | Year | Bucket | Bank |
  Amount | Note | Date`. Nhắc export mỗi tháng một lần (Firestore free tier
  không tự backup - bài học từ `logi`).

### Bảng map khi import

| Category cũ | Ghi chú chứa | → bucket mới |
|---|---|---|
| FDU | `bros`, `anh em`, `friends`, `happy hour`, `DL team`, `W Harry`, `voi ban`, `moi` | `social` |
| FDU | `card`, `4g` | `utilities` |
| FDU | còn lại | `food` |
| Health | `seo`, `laser` | `healthFund` |
| Health | `may hap dien` | `purchases` |
| Health | còn lại | `beauty` |
| Tech | `op lung` | `tech` |
| Others | `tu lanh`, `may say`, `ghe cong`, `tam ga`, `ban lam viec`, `den cho ban`, `dung cu setup`, `boc ghe`, `hop quan ao`, `coolmate`, `do an minu` | `purchases` |
| Others | `wifi`, `card dt` | `reserve` |
| Others | `ca phe` | `food` |
| Others | `sach`, `bang diem`, `film`, `grab`, `cho me` | `buffer` |
| Others | `self fund`, `all for travelling` | **bỏ** - là chuyển quỹ, không phải chi tiêu |
| bất kỳ | `placeholder`, `bi ben`, `stuff for safety` | **bỏ** - không nhớ là gì |

Dòng nào không khớp luật nào → script **dừng và hỏi**, không tự đoán.

### Xong khi
138 dòng cũ nằm trong app, tổng theo chu kỳ khớp với `Budget.numbers`.
Sửa một giao dịch cũ trên iPhone, số ở Summary đổi theo ngay.

## Stage 5 - Overspend & Cover

→ `STAGE-5-DETAILED.md`

**Mục tiêu:** tiêu lố không còn biến mất khỏi sổ.

### Phạm vi
- Sau khi lưu giao dịch, nếu `spent > limit` (budget) hoặc `amount > balance`
  (fund) → hiện sheet **"Bù từ đâu?"**. Sheet **dismiss được**; giao dịch đã lưu rồi.
- Nguồn bù: `Buffer` (nếu còn đủ) hoặc **một** quỹ BIDV. Một nguồn duy nhất -
  không chia 200 chỗ này 590 chỗ kia. Buffer không đủ → làm mờ, bắt chọn quỹ.
- **Luồng VCB→VCB (Buffer):** chọn → màn confirm `"Bù 790 từ Buffer?"` → trừ ngay,
  `cover.status='done'`.
- **Luồng BIDV→VCB:** chọn → hiện số tiền + nút `Copy` → bạn rời app chuyển khoản →
  quay lại, app hỏi `"Đã chuyển 790 từ Reserve chưa?"` → bấm `Rồi` thì quỹ mới giảm.
  - `cover` phải được ghi xuống Firestore **trước khi** bạn rời app. iOS hay kill
    PWA khi chuyển sang app ngân hàng; quay lại dù app đã bị kill vẫn phải hỏi.
  - Bắt lúc quay lại bằng `visibilitychange`, và cả lúc app khởi động lại.
  - Không dùng deep link mở app ngân hàng. Chỉ Copy số tiền.
- Dải nhắc `⚠ Tech vượt 790 · chọn nguồn bù` khi còn cover chưa xử lý.
- Đóng sổ chu kỳ **bắt buộc** giải quyết hết cover pending mới đóng được.

### Ràng buộc
- Giao dịch không bao giờ bị ghi sang bucket khác để "cho vừa hạn mức".
  Food lố thì Food hiện lố.
- `cover` chỉ ghi phần **vượt**, không ghi cả giao dịch.

### Xong khi
Gõ một khoản vượt hạn mức Tech → chọn Reserve → tắt app hoàn toàn → mở lại →
app vẫn hỏi "đã chuyển chưa" → bấm Rồi → Reserve giảm đúng, Tech hết đỏ.

## Stage 6 - PWA & Reminder

→ `STAGE-6-DETAILED.md`

**Mục tiêu:** nhắc khi quên log.

Chép từ `logi`: `manifest.ts`, `scripts/make-icons.mjs`, `public/sw.js`
(push-only, **không cache API**), `src/lib/push.ts`, Cloud Function chạy mỗi 15 phút.

Khác `logi` một chỗ: điều kiện gửi là **không có giao dịch nào trong N ngày**
(mặc định `reminderQuietDays = 2`), kiểm lúc 22:00 giờ Việt Nam.

Câu chữ: `"2 days since your last entry."` - nêu sự thật, không trách móc.

Lý do chọn 2 ngày: dữ liệu 159 ngày cho thấy chỉ **27% số ngày** có log, trung vị
khoảng cách giữa hai lần log là **2 ngày**. Nhắc mỗi ngày sẽ kêu ~266 lần/năm và
bạn sẽ tắt nó trong hai tuần.

Cần Firebase **Blaze**. Cần Add to Home Screen **từ Safari** (iOS chỉ cho web push
với PWA đã cài).

### Xong khi
Không log 2 ngày → 22:00 có noti trên màn khoá khi app đã đóng.

## Stage 7 - Insights

→ `STAGE-7-DETAILED.md`

**Mục tiêu:** hiểu xu hướng, không phải nghe lời khuyên.

Pipeline giống `logi` Stage 7: `signals.ts` (code tính ~15 chỉ số) → `digest.ts`
(JSON nhỏ) → `/api/insight` (Gemini Flash Lite) → `insight-sanitize.ts` (vứt mọi
câu có số không nằm trong digest).

### Phạm vi
- Báo cáo **cuối chu kỳ**, gắn vào màn hình đóng sổ. Có nút chạy lại bằng tay.
- Phát hiện bất thường do **code**, không do model:
  - một giao dịch lớn bất thường so với chính bucket đó
  - một bucket tăng 3 chu kỳ liên tiếp
  - `"Beauty vượt 4/6 chu kỳ gần đây"` → dấu hiệu baseline sai, không phải bạn sai
- Biểu đồ **Buffer 6 chu kỳ** (theo mẫu ở phần thảo luận) - thuần code, không AI.
- Nhắc khi một goal fund im lặng: `"Health Fund không dùng 3 chu kỳ.
  3.500.000/tháng chuyển đi đâu?"`
- Cache theo `digestHash` trong `insights/{cycleId}`. Cùng dữ liệu → không gọi API.

### Ràng buộc
- Sanitizer vứt mọi câu có tính phán xét (`nên`, `quá nhiều`, `hợp lý`), mọi câu
  suy luận nhân quả, và mọi thứ liên quan tới lời khuyên đầu tư.
- Không màu đỏ, không chuông báo. Mức độ chỉ đổi độ đậm chữ.
- Xoá được toàn bộ nhận xét AI từ Settings, dữ liệu gốc không đụng tới.

## Stage 8 - Mac layout & Polish

→ `STAGE-8-DETAILED.md`

- Layout desktop: hai section mở sẵn, nhập bằng bàn phím thật, phím tắt chọn bucket.
- Chart xu hướng nhiều chu kỳ.
- Trang `/settings/restore` ẩn, theo mẫu `logi`.
- Đo lại tốc độ mở app, ghi số vào `README.md`.
- Rà soát bảo mật theo bảng 11 mục của `logi`.

---

## Những gì KHÔNG làm

- **Không** đồng bộ với ngân hàng, không đọc SMS, không nhập tự động.
- **Không** theo dõi giá thị trường / lãi lỗ của ETF. Chỉ ghi số tiền đã nạp.
- **Không** đa tiền tệ. Chỉ VND.
- **Không** iOS Shortcut. Quyết định 2026-09: web app hoàn toàn.
  Nếu Stage 2 không đạt mốc 1,5s thì mở lại bàn bạc - thêm một API route là đủ.
- **Không** nhập bằng giọng nói ở các stage này. Numpad nhanh hơn nói một câu.
  Cân nhắc lại sau khi dùng thật vài tháng.
- **Không** tư vấn tài chính hay đầu tư, ở bất kỳ đâu trong app.

---

## Nhật ký quyết định

| Ngày | Quyết định | Lý do |
|---|---|---|
| 2026-09-02 | Bỏ Shortcut, làm web app hoàn toàn | Vấn đề là chỗ chứa dữ liệu, không phải chỗ nhập. Đổi lấy ~1-2s chậm hơn, được sửa/xoá và đồng bộ thật |
| 2026-09-02 | Tách `Others` thành nhiều bucket | `Others` chiếm 38,6% chi tiêu nhưng hạn mức chỉ 500k - nó là hố đen, không phải "linh tinh" |
| 2026-09-02 | Tách `healthFund` khỏi `beauty` | Trị sẹo 17,5tr/5 chu kỳ = 23% tổng chi. Bỏ nó ra thì Health còn 1,68tr - vừa khít hạn mức cũ |
| 2026-09-02 | Buffer reset 1tr/chu kỳ, không cộng dồn | Theo ý người dùng. Bù lại bằng biểu đồ 6 chu kỳ để vẫn thấy mẫu lặp |
| 2026-09-02 | Quỹ chỉ giảm sau khi confirm đã chuyển khoản | Số trong app luôn khớp tiền đã thật sự di chuyển |
| 2026-09-02 | Bù tiền chỉ từ Buffer hoặc quỹ | Không cắt hạn mức bucket khác - để hạn mức giữ nguyên cả năm, so sánh các tháng mới có nghĩa |
| 2026-09-02 | Nhắc sau 2 ngày im lặng | Chỉ 27% số ngày có log; nhắc hàng ngày sẽ kêu 266 lần/năm |
