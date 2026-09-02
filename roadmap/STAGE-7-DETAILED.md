# STAGE 7 - Insights

> Sau mỗi task có **Verify** - phải pass mới đi tiếp.
> Gặp mâu thuẫn thì **DỪNG và hỏi**, không tự đoán.

---

## 0. Mục tiêu

Hiểu xu hướng. **Không** phải nghe lời khuyên.

Nguyên tắc chi phối cả stage, một dòng:

> **Code làm phép tính. Model chỉ chọn cái đáng nói.**

Model không bao giờ được giao việc cộng trừ, và không bao giờ được phép đánh
giá một khoản chi là hợp lý hay không. Đó là phán xét, và nó nằm sát lời
khuyên tài chính cá nhân - thứ app này không đưa ra ở bất kỳ đâu.

### Điều kiện vào stage
Cần **ít nhất 3 chu kỳ đã đóng sổ** có dữ liệu thật. Dưới mức đó thì mọi
"xu hướng" chỉ là nhiễu, và một nhận xét dựng từ 2 điểm dữ liệu tệ hơn là
không có nhận xét nào.

### KHÔNG làm ở Stage 7
- Layout desktop, phím tắt (Stage 8)
- Hỏi tự do bằng ngôn ngữ tự nhiên
- Bất cứ thứ gì đụng tới danh mục đầu tư

---

## Task 1 - Bù dữ liệu cho các chu kỳ cũ

`closedTotals` và `closedIncomeVnd` chỉ được ghi từ khi bước đóng sổ có chúng.
Chu kỳ import và chu kỳ seed không có.

`scripts/backfill-cycle-totals.mjs` - dry-run mặc định: đọc giao dịch và thu
nhập của từng chu kỳ đã đóng, tính bằng **chính `cashflow.ts`** (không chép
lại công thức), ghi vào document chu kỳ.

Sau bước này, xem cả năm chỉ tốn **12 lượt đọc** thay vì đọc lại vài nghìn
giao dịch.

### Verify
Chạy xong, tổng `closedTotals` của một chu kỳ khớp với bảng Cash flow khi mở
chính chu kỳ đó trên Summary.

---

## Task 2 - Bảng dòng tiền theo năm

Màn hình `Insights`, khối đầu tiên. Đọc `closedTotals` - không đọc giao dịch.

```
2026                    In        Out   Invested       Left

  Sep                39.065      3.840      3.425     31.800
  Aug                39.065      7.770          0     31.295
  ...
  ──────────────────────────────────────────────────────────
  Year              312.520     84.200    181.139     47.181
```

Chu kỳ chưa có `closedTotals` hiện `—`, **không hiện số 0**. Số 0 nói dối,
dấu gạch thì không.

### Ràng buộc
- Chu kỳ **đang chạy** tính trực tiếp từ giao dịch (nó chưa đóng), và đánh
  dấu là chưa xong.
- Chọn được năm.

### Verify
Cộng tay `In` của các tháng → khớp dòng `Year`.

---

## Task 3 - Chỉ số, do code tính

`src/lib/signals.ts`. Đầu vào là các chu kỳ đã đóng + chu kỳ hiện tại. Không
gọi mạng, không AI. **Có test.**

| Nhóm | Chỉ số |
|---|---|
| Theo bucket | trung bình / trung vị 6 chu kỳ · chu kỳ này lệch bao nhiêu % · số chu kỳ vượt hạn mức trên 6 |
| Nhịp | ngày thứ mấy của chu kỳ · đã tiêu bao nhiêu % hạn mức · chỉ tính bucket được đánh dấu "tiêu đều" |
| Bất thường | một giao dịch lớn hơn **3 lần** trung vị của chính bucket đó · một bucket tăng **3 chu kỳ liên tiếp** |
| Dòng tiền | `Left` tăng hay giảm qua các chu kỳ · tỉ lệ đầu tư trên thu nhập |
| Quỹ | quỹ không được đụng tới **3 chu kỳ** liền · quỹ đang âm |

### Nhịp chỉ áp cho bucket "tiêu đều"
`Food` tiêu rải đều nên so với nhịp tuyến tính là hợp lý. `Health`,
`Purchases`, `Tech` tiêu theo cục - so với nhịp đều sẽ báo động giả liên tục
rồi bị bỏ qua. Thêm `evenlySpent: boolean` vào bucket, mặc định chỉ `Food` và
`Utilities` bật.

### Verify
`test/signals.test.ts` dựng 6 chu kỳ giả và kiểm từng chỉ số. Không có chỉ số
nào cần gọi mạng.

---

## Task 4 - Những gì hiện được mà **không** cần AI

Làm hết phần này trước khi đụng tới Gemini. Nhiều khả năng nó đã đủ.

- **Biểu đồ Buffer 6 chu kỳ.** Người dùng chọn Buffer reset mỗi tháng, nên
  không có con số cộng dồn nào cho thấy mẫu lặp. Biểu đồ này là thứ bù lại:

```
T4  ▓▓▓▓▓░░░░░   520 / 1.000
T5  ▓▓▓▓▓▓▓▓▓▓ 1.000 / 1.000  tràn 340
T6  ▓▓▓░░░░░░░   310 / 1.000
```

- **Xu hướng từng bucket** qua 6 chu kỳ, cột đơn giản.
- **`Beauty · vượt 4/6 chu kỳ gần đây`** - dấu hiệu **hạn mức đặt sai**, không
  phải người dùng tiêu sai. Câu chữ phải nói đúng như vậy.
- **`Travel không dùng 3 chu kỳ · 6.400`** - tiền đang nằm im.

### Verify
Mọi con số ở đây tính lại tay được từ Firestore.

---

## Task 5 - Nhận xét bằng AI

Chỉ tới đây mới gọi model, và chỉ để **diễn đạt** những gì Task 3 đã tính.

```
signals.ts  ->  digest.ts  ->  /api/insight  ->  insight-sanitize.ts
(code tính)     (JSON nhỏ)     (Gemini Flash)    (vứt câu không hợp lệ)
```

### `digest.ts`
Gói ~15 chỉ số thành JSON nhỏ. **Giao dịch thô không bao giờ rời máy.**
Không gửi ghi chú, không gửi tên khoản chi.

### Sanitizer vứt câu nào
- có **con số không nằm trong digest**
- có từ chỉ **quan hệ nhân quả**: `because`, `led to`, `caused`
- có **phán xét**: `should`, `too much`, `unreasonable`, `wasteful`
- có bất cứ thứ gì liên quan tới **lời khuyên đầu tư**
- có **từ y khoa**: `burnout`, `unhealthy`

Vứt hết thì panel hiện `Nothing notable in this period.` - và đó là một kết
quả hợp lệ, không phải lỗi.

### Chặn gọi thừa
- Cache ở `insights/{cycleId}`, khoá theo `digestHash`. Cùng dữ liệu → không
  gọi API.
- `canAnalyze()` chặn khi **dưới 3 chu kỳ đã đóng**, hoặc chu kỳ hiện tại
  chưa đi được 1/3 quãng đường.
- Nút `Refresh` ép gọi lại. Sửa một giao dịch làm đổi hash, nên lần chạy sau
  là thật.

### Ràng buộc
- `GEMINI_API_KEY` chỉ server-side. Không bao giờ có tiền tố `NEXT_PUBLIC_`.
- Rate limit trên `/api/insight`, verify session cookie **trước** mọi việc khác.
- Không log digest ở production. Lỗi API chỉ log `e.message`.
- Mức độ nghiêm trọng chỉ đổi **độ đậm chữ**. Không màu đỏ, không chuông.
- Xoá toàn bộ nhận xét AI từ Settings; dữ liệu gốc không đụng tới.

### Verify
Tắt mạng giữa chừng → panel báo lỗi gọn, không trắng màn hình.
Sửa một giao dịch → hash đổi → lần chạy sau gọi API thật.
Chạy hai lần liên tiếp không sửa gì → **không có** request thứ hai.

---

## Task 6 - Gắn vào bước đóng sổ

Đóng sổ xong thì hiện luôn nhận xét của chu kỳ vừa đóng. Đó là lúc người dùng
đang nhìn số liệu và sẵn sàng đọc - hơn hẳn một tab phải tự nhớ mà mở.

---

## Xong Stage 7 khi

Mở Insights thấy bảng dòng tiền cả năm khớp với cộng tay. Biểu đồ Buffer và
xu hướng bucket đọc được. Nhận xét AI chạy, và **mọi con số trong câu đều
kiểm chứng được** từ Firestore.
