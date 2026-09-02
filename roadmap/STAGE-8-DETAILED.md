# STAGE 8 - Mac layout, dọn nợ, và bàn giao

> Stage cuối. Sau stage này app không còn là dự án đang xây, nó là thứ dùng
> hàng ngày.

---

## 0. Mục tiêu

Dùng được trên Mac, trả hết nợ kỹ thuật đã ghi nợ dọc đường, và để lại đủ
tài liệu cho lần quay lại sau sáu tháng.

---

## Task 1 - Layout desktop

Toàn bộ app tới giờ thiết kế cho iPhone. Trên Mac nó là một dải hẹp giữa màn
hình trống.

| Màn hình | Trên Mac |
|---|---|
| **Log** | Hai cột: lưới bucket bên trái, vùng nhập bên phải. `Funds` mở sẵn - không còn lý do gập khi có chỗ |
| **Summary** | Ba khối cạnh nhau thay vì xếp dọc |
| **History** | Bảng thật: cột ngày / bucket / số tiền / ghi chú, sửa ngay tại dòng |
| **Insights** | Biểu đồ rộng ra, xem được 12 chu kỳ thay vì 6 |

### Bàn phím trên Mac
Numpad tự vẽ là để giải quyết bàn phím iOS. Trên Mac nó **cản trở** - có bàn
phím thật ngay đó.

- Gõ số thẳng vào, không cần chạm ô nào.
- **Phím mũi tên** di chuyển trong lưới bucket.
- `Enter` lưu, `Esc` xoá, `-` đảo chiều tiền vào/ra.
- Numpad vẫn hiện, và không phải đường duy nhất.

> **Sửa so với bản nháp:** ban đầu định dùng `1`–`9` để chọn bucket. Không
> được - số là thứ gõ nhiều nhất, và một phím không thể vừa là "4" vừa là
> "chọn Tech". Mũi tên không đụng vào gì cả.

Ngưỡng: `min-width: 900px`. Dưới mức đó giữ nguyên bố cục điện thoại.

### Verify
Trên Mac: gõ `25`, `Enter`, xong - không chạm chuột lần nào.
Trên iPhone: không có gì thay đổi.

---

## Task 2 - Trả nợ kỹ thuật

Ghi nợ trong lúc làm Stage 5-6 và hai amendment. Trả ở đây.

| # | Nợ | Vì sao phải trả |
|---|---|---|
| 1 | `cycles.incomeVnd` trùng với bản ghi trong `income/` | Hai nguồn sự thật cho cùng một con số. Sớm muộn chúng lệch nhau. Bỏ field, suy từ `income` |
| 2 | Giao dịch số dư mở đầu nằm ở chu kỳ `2026-07` không có document | History không liệt kê chu kỳ đó nên chúng vô hình. Hoặc tạo document, hoặc đánh dấu là ngoài lịch sử |
| 3 | `setCycleLimits` và `applyCyclePlan` cùng ghi `limits` | Hai đường vào một chỗ. Giữ cả hai nhưng `setCycleLimits` chỉ dùng cho sửa tay, và nói rõ điều đó trong tên |
| 4 | `Bucket.goal` không còn ai dùng sau khi bỏ mục tiêu Health | Hoặc dùng lại cho quỹ mục tiêu (iPhone, xe máy), hoặc xoá. Field chết là field gây hiểu nhầm |
| 5 | `scripts/seed-testdata.mjs` vẫn nằm trong repo | Nó **xoá sạch dữ liệu**. Sau khi dùng thật thì chuyển vào thư mục riêng hoặc bắt thêm cờ `--i-know` |
| 6 | `reminderQuietDays` và `reminderHour` đang là giá trị test | Trả về **2** và **22** |

### Verify
`grep -rn "incomeVnd" src/` không còn kết quả nào ngoài `income/`.

---

## Task 3 - Rà soát bảo mật

Theo đúng bảng 11 mục của `logi`. Ghi kết quả vào `README.md` kèm ngày.

| # | Kiểm |
|---|---|
| 1 | Không có secret trong lịch sử git |
| 2 | Không có secret trong biến `NEXT_PUBLIC_*` (Firebase web key là public theo thiết kế - ghi rõ) |
| 3 | Rules chặn dữ liệu của người khác |
| 4 | `/api/*` trả 401 khi không có session cookie |
| 5 | Rate limit trên `/api/insight` |
| 6 | Allowlist chặn email khác, kiểm ở **cả** login lẫn mỗi request |
| 7 | Cookie `httpOnly` + `secure` + `sameSite: lax` |
| 8 | Không log số tiền hay ghi chú ở production |
| 9 | Firebase Console → Authorized domains chỉ còn domain thật + `localhost` |
| 10 | Rules chặn `amountVnd` không phải số nguyên |
| 11 | Firebase project riêng, không app nào khác chạm tới |

Mục 9 script không kiểm được - phải mở console bấm tay.

---

## Task 4 - Đo lại tốc độ

Đo trong PWA đã cài, 5 lần ấm và 5 lần nguội, **chỉ tính mẫu trang liên tục
hiển thị**. Ghi số vào `README.md`.

Mốc: **1,5s ấm · 2,5s nguội**. Số đo tuần trước: 1.02 / 1.7 / 2.12 / 2.5.

Sau khi có service worker cache app shell, con số phải **tốt hơn** - nếu
không thì cache đang không ăn, kiểm lại chiến lược trong `sw.js`.

---

## Task 5 - Tài liệu bàn giao

`README.md` phải trả lời được, cho một người quay lại sau sáu tháng:

- **Ba con số** khác nhau thế nào: `standard`, `limit`, và số dư quỹ
- **Tiền vào quỹ bằng đường nào** - và vì sao nó phải là giao dịch chứ không
  phải phép cộng
- **Vì sao `income` là collection riêng** - kèm cái lỗi đã xảy ra
- **Chu kỳ cắt ngày 25** và ca 25/12 nhảy sang năm sau
- **Ước tính lượt đọc Firestore mỗi ngày**, theo mẫu bảng của `logi`
- **Export và restore**, và vì sao restore chỉ thêm chứ không ghi đè
- **Cách tắt Blaze** nếu không muốn trả tiền nữa

Kèm một mục **Edge cases you should know**, như `logi`. Ứng viên: khoản hoàn
tiền rơi sang chu kỳ sau · cover không tự huỷ khi tiền về · Buffer reset nên
không có nợ cộng dồn · tiêu lố quỹ làm số dư âm cho tới khi bù.

---

## Task 6 - Dọn dữ liệu test và bắt đầu dùng thật

1. Export JSON toàn bộ, giữ ngoài máy.
2. Xoá dữ liệu test, import lại 138 dòng thật từ `Budget.numbers`.
3. Chạy `recompute-balances` - phải báo **mọi số dư đều khớp**.
4. Đặt số dư quỹ mở đầu bằng **giao dịch**, không đặt tay.
5. Chạy song song với Numbers **trọn một chu kỳ**. Khớp thì mới nghỉ Numbers.

Điểm 5 không rút ngắn được. Một chu kỳ là lần đầu tiên bước đóng sổ, Generator
và phần chia quỹ chạy thật cùng nhau.

---

## Xong Stage 8 khi

Nhập được trên Mac không cần chuột. Bảng bảo mật 11 mục pass hết. Số đo tốc
độ đạt mốc và đã ghi lại. `Budget.numbers` chạy song song trọn một chu kỳ và
khớp số.

Lúc đó `Budget.numbers` nghỉ được - nhưng **giữ file lại**, đừng xoá.
