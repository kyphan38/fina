# STAGE 2 - Buckets & Quick Log

> Sau mỗi task có **Verify** - phải pass mới đi tiếp.
> Gặp mâu thuẫn thì **DỪNG và hỏi**, không tự đoán.

---

## 0. Mục tiêu

Ghi được một khoản chi, **nhanh**. Đây là stage quan trọng nhất của cả dự án:
nếu màn hình Log không đủ nhanh thì mọi thứ còn lại vô nghĩa, vì người dùng sẽ
quay về Shortcut + Numbers.

Mốc phải đạt: **từ chạm icon tới lúc gõ được số ≤ 1,5s** (app còn trong RAM),
**≤ 2,5s** (iOS đã kill app).

### KHÔNG làm ở Stage 2
- Summary, đóng sổ, Generator (Stage 3)
- History, sửa, xoá, import (Stage 4)
- Hộp thoại bù tiền khi tiêu lố (Stage 5) - stage này **chỉ hiện đỏ**
- Chart, AI, push

---

## Task 1 - `src/types/fina.ts`

Chép nguyên mô hình dữ liệu từ `ROADMAP.md` mục "Mô hình dữ liệu":
`Bucket`, `Transaction`, `Cycle`, `Cover`, `Settings`.

Kèm hằng số:
```ts
export const CYCLE_START_DAY = 25;
export const TIMEZONE = 'Asia/Ho_Chi_Minh';
export const REMINDER_HOUR = 22;
export const REMINDER_QUIET_DAYS = 2;
```

Và bộ hũ khởi tạo (`SEED_BUCKETS`) đúng bảng trong `ROADMAP.md`, đơn vị **VND**:
`food` 3_000_000, `beauty` 1_800_000, `social` 700_000, `tech` 800_000,
`utilities` 200_000, `buffer` 1_000_000 (tất cả `kind:'budget'`, `bank:'VCB'`);
`healthFund` 3_500_000, `purchases` 4_100_000, `travel` 1_200_000,
`reserve` 0, `emergency` 250_000 (`kind:'fund'`, `bank:'BIDV'`);
`etf` (`kind:'fund'`, `bank:'VPS'`, baseline 0 - nó là phần dư).

`reserve` để 0 vì người dùng chưa chốt con số. **Hỏi lại trước khi seed**,
và ghi chú trong Settings rằng riêng wifi cần ≥ 250.000/tháng.

`healthFund.goal = { targetVnd: 42_000_000, targetDate: '2027-09' }`.

---

## Task 2 - `src/lib/cycle.ts`

```ts
cycleOf(d: Date, startDay?: number): string       // '2026-09'
cycleRange(cycle: string, startDay?: number): { startAt: number; endAt: number }
cycleLabel(cycle: string): { month: string; year: number }  // 'September', 2026
cycleProgress(cycle: string, now?: Date): { day: number; total: number }
```

**Viết test trước khi viết màn hình.** `test/cycle.test.ts`, chạy với
`TZ=Asia/Ho_Chi_Minh`. Ca bắt buộc pass, lấy từ dữ liệu thật:

| Input | Kỳ vọng |
|---|---|
| `24 Jul 2026` | `2026-07` |
| `25 Jul 2026` | `2026-08` |
| `27 Jul 2026` | `2026-08` |
| `24 Aug 2026` | `2026-08` |
| `25 Aug 2026` | `2026-09` |
| `2 Sep 2026` | `2026-09` |
| `25 Dec 2026` | `2027-01` ← đổi năm |
| `24 Dec 2026` | `2026-12` |

Ca cuối là chỗ dễ sai nhất. Không pass thì đừng đi tiếp.

---

## Task 3 - `src/lib/money.ts`

```ts
toVnd(input: string): number | null   // '155.36' → 155360 ; '25' → 25000
fromVnd(v: number): string            // 155360 → '155.36' ; 25000 → '25'
formatVnd(v: number): string          // 155360 → '155,36'  (hiển thị)
```

- Nhận **cả `.` và `,`** làm dấu thập phân (bàn phím iOS ép dùng `,`).
- Tối đa 3 chữ số sau dấu thập phân (vì 1 đơn vị = 1.000đ, nên .001 = 1đ).
- Làm tròn về số nguyên đồng. `toVnd('25.3456')` → `25346`.
- Input rỗng, `'.'`, `'0'` → `null`.

`test/money.test.ts` phải có ca `toVnd(fromVnd(x)) === x` cho 20 giá trị lấy từ
dữ liệu thật: `15000, 272093, 5020400, 155360, 32142, 4205471, 990000, 25000`...

---

## Task 4 - Seed buckets

Màn hình `Settings` có nút **"Initialize buckets"**, chạy một lần, ghi
`SEED_BUCKETS` vào `users/{uid}/buckets/`. Bấm lần hai → báo "đã có, bỏ qua",
**không ghi đè**.

Settings cũng cho sửa: `name`, `baselineVnd`, `order`, `active`.
Chưa cần tạo bucket mới ở stage này.

### Verify
Firestore Console thấy 12 document trong `buckets`. Sửa `food.baselineVnd` trên
Settings → giá trị đổi trong DB.

---

## Task 5 - Màn hình Log

Đây là task chính. Mockup đã duyệt: bố cục, khoảng cách, màu, chữ đều theo nó.

### Bố cục

```
┌─────────────────────────────────────┐
│ Cycle September          Monthly left│
│ Day 9 of 30                    5.412 │
├─────────────────────────────────────┤
│ MONTHLY                             │
│ ┌────────┬────────┬────────┐        │
│ │ Food   │ Beauty │ Social │        │
│ │  2.975 │  1.800 │    700 │        │
│ ├────────┼────────┼────────┤        │
│ │ Tech   │ Utils  │ Buffer │        │
│ └────────┴────────┴────────┘        │
│                                     │
│ FUNDS                      Show ▼   │
│ (gập lại, nhớ trạng thái)           │
├─────────────────────────────────────┤
│ Food                            25  │
│ [ Note (optional)              ]    │
│ ┌────┬────┬────┐                    │
│ │ 1  │ 2  │ 3  │                    │
│ │ 4  │ 5  │ 6  │                    │
│ │ 7  │ 8  │ 9  │                    │
│ │ .  │ 0  │ ⌫  │                    │
│ ├────┴────┴────┤                    │
│ │     Save     │                    │
│ └──────────────┘                    │
└─────────────────────────────────────┘
```

### Quy tắc bắt buộc

1. **Vị trí ô cố định**, theo `bucket.order`. Tuyệt đối không tự sắp lại theo tần
   suất - Food chiếm 45% số lần log, ô mà nhảy chỗ là hỏng muscle memory.
2. **Numpad tự vẽ.** Không dùng `<input>` cho số, không gọi `.focus()`.
   iOS không tự mở bàn phím khi app vừa mở, và animation bàn phím tốn ~250ms.
3. Section `Funds` gập mặc định, trạng thái lưu ở `localStorage`. Mở ra rồi thì
   **giữ nguyên** cho tới khi người dùng tự đóng (để đi du lịch cả tuần không
   phải mở lại mỗi lần).
4. Ô fund có **viền nét đứt** để phân biệt với ô monthly. Không dùng màu.
5. Mỗi ô hiện: tên, số còn lại (budget) hoặc số dư (fund), vạch tiến độ 2px ở đáy.
   `spent > limit` → số và vạch đổi sang `--over`, có dấu `−` trước số.
6. Ô Note tuỳ chọn. Chạm mới hiện bàn phím chữ. **Không bao giờ chặn Save.**
7. `Save` vô hiệu khi chưa chọn bucket hoặc `toVnd()` trả `null`.

### Lưu giao dịch

Một `writeBatch` duy nhất:
- `set` document mới trong `transactions` (id sinh ở client để ghi optimistic được)
- nếu bucket là `fund` → `update` `balanceVnd` bằng `increment(-amountVnd)`

`bank` **chép từ bucket** vào transaction, không tra ngược lúc đọc.
`cycle` tính bằng `cycleOf(new Date())`.

Sau khi bấm Save: UI cập nhật **ngay** (optimistic), toast hiện
`Food · 25 · 2.975 of 3.000 left`, ô Note xoá, amount về 0, **bucket vẫn giữ nguyên
lựa chọn** (hay log liên tiếp cùng nhóm).

Tiêu lố ở stage này: chỉ hiện đỏ. **Chưa hỏi gì.**

### Đọc dữ liệu - giữ quota

- Một listener cho `buckets` (12 doc).
- Một query cho `transactions where cycle == currentCycle` - **một query cho cả
  chu kỳ**, không phải một query mỗi bucket.
- Cả hai `unsubscribe` khi unmount. Rò listener là cách nhanh nhất đốt hết
  50k lượt đọc/ngày của free tier.

`spent` mỗi bucket tính ở **client** từ danh sách giao dịch của chu kỳ. Không
denormalize `spent` - nó đổi mỗi lần sửa giao dịch, và Stage 4 sẽ cho sửa.

### Verify
- Chạm Food → gõ `25` → Save → ô Food giảm đúng 25.000, toast đúng.
- Gõ `155.36` → lưu ra đúng `155360` trong Firestore.
- Gõ `155,36` → cũng ra `155360`.
- Bật máy bay → log một khoản → tắt máy bay → giao dịch tự lên Firestore.
- Mở section Funds → đóng app → mở lại → vẫn đang mở.

---

## Task 6 - Đo tốc độ

Trong `Settings`, thêm một dòng chỉ để đo:

```
Cold start: 1.34s   (last 5: 1.34 / 1.28 / 2.41 / 1.30 / 1.36)
```

Đo từ `performance.timing.navigationStart` (hoặc
`performance.getEntriesByType('navigation')[0].startTime`) tới lúc **numpad nhận
chạm đầu tiên**. Lưu 5 lần gần nhất vào `localStorage`.

Cách đo thật trên iPhone:
1. Add to Home Screen từ Safari.
2. Mở app, log một khoản → ghi số (trường hợp "ấm").
3. Vuốt tắt app khỏi app switcher, đợi 5 phút, mở lại → ghi số (trường hợp "nguội").
4. Lặp 5 lần mỗi trường hợp.

### Verify
Ghi số đo thật vào `ROADMAP.md` mục Stage 2.

**Nếu không đạt 1,5s / 2,5s:** DỪNG, báo người dùng, đừng đi tiếp Stage 3.
Phương án dự phòng đã bàn: thêm một API route nhận POST từ iOS Shortcut
(token trong header, chỉ cho tạo giao dịch, có rate limit). Đó là quyết định của
người dùng, không phải của agent.

---

## Xong Stage 2 khi

Trên iPhone, mở app từ icon màn hình chính, chạm Food, gõ 25, Save - trong vòng
3 giây kể từ lúc chạm icon. Giao dịch nằm trong Firestore với `cycle` đúng,
`amountVnd` là số nguyên, `bank` là `VCB`.

Và số đo tốc độ đã được ghi lại.
