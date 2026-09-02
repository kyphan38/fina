# STAGE 3 - Summary & Cycle

> Sau mỗi task có **Verify** - phải pass mới đi tiếp.
> Gặp mâu thuẫn thì **DỪNG và hỏi**, không tự đoán.

---

## 0. Mục tiêu

Thấy được toàn cảnh một chu kỳ, và đóng sổ được khi nó kết thúc.

Stage 2 mới trả lời "tôi vừa tiêu gì". Stage 3 trả lời "chu kỳ này tôi đang
đứng ở đâu" và "chu kỳ vừa rồi kết thúc thế nào".

### Điều kiện vào stage
Số đo tốc độ Stage 2 đã ghi vào `ROADMAP.md` và **đạt mốc 1,5s / 2,5s**.
Chưa đạt thì dừng, bàn lại phương án nhập, không đi tiếp.

### KHÔNG làm ở Stage 3
- Sửa / xoá giao dịch, import (Stage 4)
- Hộp thoại bù tiền ngay lúc gõ (Stage 5) - stage này chỉ bù ở bước đóng sổ
- Chart nhiều chu kỳ, AI (Stage 7)

---

## Task 1 - Vòng đời document `cycles/{cycleId}`

`src/lib/cycles.ts`:

```ts
ensureCycle(uid, cycleId, buckets): Promise<Cycle>
watchCycle(uid, cycleId, cb): () => void
closeCycle(uid, cycle, plan): Promise<void>
```

### Chu kỳ được tạo lúc nào

**Tạo lười (lazy)**, lần đầu màn hình Summary mở một chu kỳ chưa có document.
Lúc tạo, `limits` được **chép từ `baselineVnd` của mọi bucket `budget` đang
active** và từ đó **đóng băng**.

Đóng băng là điểm mấu chốt: sửa baseline trong Settings không được phép làm
đổi con số của chu kỳ đang chạy, càng không được đổi số của chu kỳ đã qua.
Nếu không, mở lại biểu đồ tháng trước sẽ thấy số khác lần trước - và không
ai biết số nào đúng.

### Chu kỳ lịch sử (từ import ở Stage 4)

Những chu kỳ trước khi app tồn tại **không có hạn mức thật**. Tuyệt đối
không bịa ra bằng cách chép baseline hiện tại.

Chúng được tạo với `status: 'closed'`, `limits: {}`, `incomeVnd: null`.
Summary của các chu kỳ đó chỉ hiện **số đã tiêu**, không hiện thanh hạn mức,
và có một dòng nhỏ: `No limits recorded for this cycle.`

### Verify
Mở Summary lần đầu → Firestore có `cycles/2026-09` với `limits` đủ 6 bucket
budget, `status: 'open'`. Đổi `food.baselineVnd` trong Settings → `limits`
của `2026-09` **không đổi**.

---

## Task 2 - Màn hình Summary

Ba khối, đúng thứ tự dòng tiền: tiêu → tích → đầu tư.

```
SUMMARY · September            Day 9 of 31

VCB - Monthly
  Food        2.640 / 3.000   ████████░░
  Beauty      1.790 / 1.800   █████████░
  Social        420 /   700   ██████░░░░
  Tech          990 /   800   ██████████  −190
  Utilities     100 /   200   █████░░░░░
  Buffer        190 / 1.000   ██░░░░░░░░
  ─────────────────────────────────────
  Spent 6.130       Left 1.570 / 7.700

BIDV - Funds
  Health Fund   12.400   ▸ 42.000 · Sep 2027   ███░░░░░░░
  Purchases      4.820
  Travel         7.400
  Reserve        3.150
  Emergency      2.250
  ─────────────────────────────────────
  Total 30.020

VPS
  ETF          181.139                    [ Add deposit ]

              [ Plan next cycle → ]
```

### Ràng buộc
- Dùng **đúng hai listener** như màn hình Log: `buckets` và một query cho
  cả chu kỳ. Không thêm query mỗi bucket.
- Bucket vượt hạn mức: số âm, màu `--over`, thanh đầy. Không có chuông báo.
- `healthFund` có `goal` → hiện thanh tiến độ và mốc thời gian.
- Chọn được chu kỳ khác để xem lại (Stage 4 mới có lịch sử thật, nhưng
  bộ chọn làm luôn ở đây).

### Verify
Cộng tay tổng chi tiêu chu kỳ hiện tại từ Firestore Console → khớp với
`Spent`. Tổng số dư quỹ khớp với `Total`.

---

## Task 3 - Nạp ETF

ETF chỉ nhận tiền, không bao giờ chi. Nên nó **không nằm trên lưới Log** và
có đường riêng.

Nút `Add deposit` trong khối VPS: nhập số tiền (numpad như Log) + ngày →
tăng `etf.balanceVnd` và ghi một `transaction` với `bucketId: 'etf'`,
`bank: 'VPS'`.

Đây là ngoại lệ duy nhất mà một `transaction` mang nghĩa **tiền vào**.
Ghi nó vào `transactions` thay vì chỉ tăng số dư, vì Stage 4 phải sửa và
Stage 7 phải đọc được lịch sử nạp.

`spentByBucket()` và mọi tổng "đã tiêu" phải **loại bucket `etf`** ra.
Nếu không, mỗi lần nạp ETF sẽ hiện như một khoản chi khổng lồ.

### Verify
Nạp 3.425 → `etf.balanceVnd` tăng đúng, và tổng `Spent` của VCB **không đổi**.

---

## Task 4 - Đóng sổ chu kỳ

Kích hoạt khi `now >= cycle.endAt` và `status === 'open'`.
Chưa đóng sổ thì Summary của chu kỳ mới **chưa mở** - một chút ma sát cố ý,
để việc tiêu lố không trôi qua trong im lặng.

```
Cycle September closed

  Food        2.640 / 3.000    +360
  Beauty      1.790 / 1.800     +10
  Social        420 /   700    +280
  Tech          990 /   800    −190
  Utilities     100 /   200    +100
  Buffer        190 / 1.000    +810
  ──────────────────────────────────
  Surplus                    1.570

  Move surplus to:  [ ETF ]  [ Reserve ]  [ Hold ]
                      ▲ mặc định

  [ Close cycle ]
```

### Công thức
```
surplusVnd = Σ (limits[bucketId] − spent[bucketId])   với mọi bucket kind='budget'
```
Có thể âm.

### Khi `surplusVnd` âm
Bắt chọn **một** quỹ để bù, ghi một `cover` với `toBucketId: null`,
`fromBucketId: <quỹ>`, `needsTransfer: true` nếu quỹ ở BIDV.
Đây là bản gộp cuối chu kỳ; Stage 5 đưa quyết định này lên sớm hơn, ngay
lúc gõ số.

### Ghi gì khi đóng
Một `writeBatch`:
- `cycles/{id}`: `status:'closed'`, `closedAt`, `surplusVnd`, `surplusTo`
- nếu `surplusTo === 'etf'` → `etf.balanceVnd += surplus`
- nếu `surplusTo === 'reserve'` → `reserve.balanceVnd += surplus`
- `surplusTo === 'hold'` → không cộng vào đâu cả

### Ràng buộc
- Firestore rules đã chặn update chu kỳ `closed`. **Đừng nới rules.**
  Đóng nhầm thì sửa bằng script có chủ đích, không phải bằng một nút trong UI.
- Không tự động chuyển tiền, không tự tạo giao dịch. Chỉ ghi con số.
- Đóng sổ **không** reset gì cả: hạn mức chu kỳ mới đến từ `ensureCycle()`.

### Verify
Tạo một chu kỳ giả đã hết hạn → mở app → màn đóng sổ hiện đúng số →
bấm Close → `etf.balanceVnd` tăng đúng bằng surplus → chu kỳ mới mở với
`limits` lấy từ baseline hiện tại.

---

## Task 5 - Generator

Nút `Plan next cycle` trong Summary. Đây là **công cụ độc lập** - nó không
bao giờ tự đồng bộ ngược vào `limits`.

```
GENERATOR

  Salary                    [ 39.065 ]

  VCB - Monthly                          7.500    19%
    Food 3.000 · Beauty 1.800 · Social 700
    Tech 800 · Utilities 200 · Buffer 1.000

  BIDV - Funds                           9.050    23%
    Health Fund 3.500 · Purchases 4.100
    Travel 1.200 · Reserve 0 · Emergency 250

  VPS
    ETF                                 22.515    58%
    ▲ phần còn dư

  [ Use as limits for October ]
```

### Quy tắc
- Các nhóm là **SỐ TIỀN CỐ ĐỊNH** (`baselineVnd`). ETF = `salary − Σ baseline`.
- `%` là **kết quả tính ra**, không phải đầu vào. Đừng làm ô nhập %.
- ETF âm (lương thấp hơn tổng phân bổ) → hiện đỏ kèm số thiếu. Không tự
  cắt bớt bucket nào.
- `Use as limits` chỉ **điền sẵn** `limits` cho chu kỳ chưa mở, và ghi
  `incomeVnd`. Chu kỳ đã mở thì nút này bị vô hiệu - `limits` đã đóng băng.

### Verify
Nhập 39.065 → ETF ra 22.515 và 58%. Sửa `food` baseline lên 4.000 →
ETF tụt đúng 1.000.

---

## Xong Stage 3 khi

Trên iPhone: mở Summary, thấy đúng tình hình chu kỳ tháng 9; cộng tay từ
Firestore ra cùng con số. Tạo một chu kỳ đã hết hạn, đóng sổ được, phần dư
chảy vào ETF đúng số. Generator nhập lương ra đúng ETF.

Ghi vào `README.md` bảng Stage log.
