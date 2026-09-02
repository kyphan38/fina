# AMENDMENT - Standard, Baseline, Limit

> Sửa sau lần dùng thật đầu tiên (2026-09-02). Ghi đè phần liên quan trong
> `STAGE-3-DETAILED.md`.

---

## Vì sao

Người dùng đổi baseline của `Tech` xuống 100 trong Settings, quay lại Log
vẫn thấy 800, và hỏi lại một câu rất đúng: *"vậy Bucket ở Setting để làm gì?"*

Đó không phải hiểu nhầm. **App đang không có cách nào đổi hạn mức của chu
kỳ đang chạy.** `limits` đóng băng lúc mở chu kỳ (đúng, và giữ), Settings chỉ
chạm tới chu kỳ *sau*, còn nút Apply trong Generator thì chưa bao giờ được
làm - nó đang hiện chữ "Planning only".

Ba khái niệm khác nhau đang dùng chung một cái tên.

## Ba con số, ba cái tên

| | Là gì | Sửa ở đâu | Ảnh hưởng |
|---|---|---|---|
| **Standard** | mức chuẩn của người dùng, mốc để so | Settings | không gì cả |
| **Baseline** | mức mặc định khi mở chu kỳ mới | Settings | chu kỳ **sau** |
| **Limit** | hạn mức của chu kỳ đang chạy | Generator → Apply, hoặc sửa tay ở Summary | chu kỳ **này** |

Generator dùng vào ngày 25. Bấm **Apply** thì Baseline chảy sang Limit. Các
ngày khác hai con số không dính nhau - đúng nguyên tắc #14.

## Thay đổi mô hình dữ liệu

`Bucket` thêm hai field:

```ts
/** Mức chuẩn người dùng tự đặt. Chỉ để so sánh, không bao giờ tự áp dụng. */
standardVnd: number;
/** Bucket này gồm những gì. Hiện khi chọn bucket, tự ẩn khi bắt đầu gõ. */
hint: string | null;
```

## Bộ số chuẩn mới

Người dùng chốt 2026-09-02. Thay **cả** `standardVnd` lẫn `baselineVnd`.

| VCB | cũ | mới | | BIDV | cũ | mới |
|---|---:|---:|---|---|---:|---:|
| Food | 3.000 | 3.000 | | Health | 3.500 | 3.000 |
| Beauty | 1.800 | 1.000 | | Purchases | 4.100 | 3.000 |
| Social | 700 | 1.000 | | Travel | 1.200 | 2.000 |
| Tech | 800 | 500 | | Reserve | 0 | 2.000 |
| Utilities | 200 | 500 | | Emergency | 250 | 500 |
| Buffer | 1.000 | 1.000 | | | | |
| **Tổng** | 7.500 | **7.000** | | **Tổng** | 9.050 | **10.500** |

Tổng phân bổ **17.500**. Với lương 39.065 thì ETF còn **21.565**.

`Beauty` xuống 1.000 dù trung bình 5 chu kỳ thật là 1.683 - người dùng biết
và cố ý siết. Ghi lại ở đây để sáu tháng sau khỏi tưởng là lỗi nhập.

## Việc phải làm

### 1. Ba cái tên hiện rõ trong UI
- Settings: khối `Buckets` → **`Standard amounts`**, kèm dòng
  *"Used when a new cycle opens. Changing these does not touch the cycle you are in."*
- Mỗi dòng hiện cả `standard` và `baseline`, lệch nhau thì thấy ngay.

### 2. Generator có nút Apply thật
- `Apply to <tháng>` ghi `limits` + `incomeVnd` cho **chu kỳ đang chạy**.
- Có bước xác nhận: nó ghi đè hạn mức đang dùng.
- Chu kỳ đã đóng thì nút bị vô hiệu (rules cũng chặn).

### 3. Sửa tay Limit của chu kỳ đang chạy
Summary → `Edit limits` → sửa từng dòng → lưu. Nhãn ghi rõ **this cycle only**.
Cần cho những lúc lỡ tay hoặc phát sinh giữa tháng.

### 4. Gợi ý nội dung bucket
Chọn bucket → dòng dưới hiện `hint` + `chuẩn N`, **tự ẩn ngay khi gõ số đầu tiên**.
Không thêm cử chỉ mới, không tốn chỗ lúc đang nhập.

### 5. ETF
- Nạp tiền: thêm ô **chọn ngày** (nạp bù cho hôm trước là chuyện thường).
- Danh sách các lần nạp trong khối VPS, **gập được** - sẽ nhiều dần.

### 6. `Health Fund` → `Health`, bỏ goal
Đổi `name`, **giữ nguyên `id` là `healthFund`** để lịch sử không đứt.
`goal` về `null` - không cần thanh tiến độ nữa.

### 7. Sửa lại phép đo Cold start
Số đo ra `82s` và `17.27s` xen với `1.02s`. Đó không phải app lúc nhanh lúc
chậm: iOS đánh thức PWA đang treo mà **không tạo navigation mới**, nên
`navigationStart` vẫn là lần mở gốc còn `performance.now()` đếm cả thời gian
máy nằm trong túi.

Chỉ ghi mẫu nào mà trang **liên tục hiển thị** từ lúc điều hướng tới lúc
numpad vẽ xong. Trang từng bị ẩn giữa chừng → bỏ mẫu, và nói rõ là đã bỏ.

Những số thật đo được: **1.02 / 1.7 / 2.12 / 2.5** - đạt mốc 1,5s ấm / 2,5s nguội.

## Đã cân nhắc và KHÔNG làm

- **Nén thêm màn hình Log.** Standalone 812px đã không cuộn gì cả. Ép thêm
  phải bỏ ô Note hoặc dồn header - đổi tính dễ đọc lấy chỗ trống không ai cần.
- **Nạp sẵn 5 route vào service worker cache.** Offline chuyển sang tab chưa
  mở bao giờ thì hỏng; người dùng gần như không bao giờ offline, và nó thêm
  5 request lúc mở app. Không đáng.
