# AMENDMENT - Dòng tiền vào và ra

> Thiết kế sau khi phát hiện quỹ chưa bao giờ được nạp tiền (2026-09-02).
> Ghi đè phần liên quan trong `STAGE-3-DETAILED.md`.

---

## Vì sao

Grep toàn bộ code: **không có chỗ nào cộng tiền vào quỹ theo chu kỳ.** Quỹ chỉ
giảm khi tiêu. `Travel` được cấp 2.000/tháng thì sau 6 tháng phải có ~12tr,
nhưng app sẽ hiện số **âm** vì nó chỉ đếm phần đã tiêu.

`recompute-balances` nói thẳng chuyện đó:

```
LECH travel     luu  6.400   tinh  -1.200
LECH purchases  luu  5.200   tinh  -2.200
```

Và nửa còn lại: app không biết **tiền vào** bao nhiêu. `cycles.incomeVnd` là
một con số gõ vào Generator, không có ngày, không có nguồn, và khoản thu bất
thường (thưởng, tiền ai đó trả lại) không có chỗ nào để ghi.

Nên không trả lời được câu cơ bản nhất: *tháng này vào bao nhiêu, ra bao nhiêu,
còn lại bao nhiêu.*

---

## Mô hình

Ba loại sự kiện, ba chỗ chứa. Đây là điểm mấu chốt của cả bản thiết kế:
**không nhét thứ không phải chi tiêu vào collection `transactions`.**

| Sự kiện | Ở đâu | Ví dụ |
|---|---|---|
| **Tiền vào** | `income/{id}` | lương, thưởng, tiền ai đó trả lại |
| **Chi tiêu** | `transactions/{id}` `direction: 'out'` | ăn uống, trị sẹo, mua đồ |
| **Hoàn lại** | `transactions/{id}` `direction: 'in'` | ứng tiền picnic, bạn bè trả lại |
| **Phân bổ vào quỹ** | `transactions/{id}` `source: 'allocation'` | 2.000 vào Travel ngày 25 |
| **Nạp đầu tư** | `transactions/{id}` trên `etf` | chuyển sang VPS |
| **Bù nội bộ** | `covers/{id}` | Buffer đỡ cho Tech |

### Vì sao `income` là collection riêng

Đã có một lỗi chứng minh: tổng ở History từng **trừ** khoản nạp ETF, vì
refactor làm mọi giao dịch `in` giảm tổng chi tiêu. Nạp ETF không phải chi
tiêu, nhưng nó nằm chung `transactions` nên mọi phép cộng đều phải nhớ loại
nó ra - và sẽ có lần quên.

Thu nhập còn xa "chi tiêu" hơn nữa. Để chung là tự đặt bẫy cho mọi tổng về sau.

### `Income`

```ts
/** Firestore: users/{uid}/income/{id} */
export interface Income {
  id: string;
  occurredAt: number;
  cycle: string;               // '2026-10'
  amountVnd: number;           // luôn dương
  kind: 'salary' | 'other';
  note: string | null;
  createdAt: number;
  updatedAt: number;
}
```

`kind` chỉ có hai giá trị vì chỉ cần phân biệt **khoản đều đặn** với **khoản
bất ngờ**. Thêm nhãn thứ ba là bắt đầu phân loại thu nhập, việc mà một người
làm công ăn lương không cần.

---

## Ngày 25: một hành động, ba việc

Bấm `Apply` trong Generator ghi **một batch**:

1. **Một bản ghi thu nhập** - lương, ngày hôm nay, chu kỳ mới.
2. **Hạn mức** cho các bucket VCB (đã có sẵn).
3. **Một giao dịch `in` cho mỗi quỹ BIDV**, `source: 'allocation'`,
   `note: 'Allocation October'`.

Đó là toàn bộ phần vá lỗ hổng: quỹ được nạp bằng chính cơ chế `direction`
đã có, không phát minh gì mới, và `recompute-balances` tự đúng trở lại vì
tiền vào quỹ giờ **là một bản ghi** chứ không phải phép cộng vô hình.

### Chạy `Apply` hai lần

Id sinh cố định: `alloc-2026-10-travel`, `income-2026-10-salary`. Lần Apply
thứ hai **gỡ hết allocation cũ của chu kỳ đó** (hoàn lại số dư quỹ) rồi ghi
lại. Không cộng dồn, không tạo bản sao.

### ETF **không** được phân bổ tự động

Người dùng đã chốt: nạp VPS là nhập tay, ngày và số tiền theo lúc thật sự
chuyển. Nếu vừa tự phân bổ vừa nhập tay thì mỗi đồng bị đếm hai lần.

Generator hiện ETF là **phần còn dư, kèm chữ "chuyển sang VPS rồi tự ghi vào"**.

### Bucket VCB **không** có bản ghi phân bổ

Chỉ quỹ mới cần. Với bucket tháng, `limit − spent` đã nói đủ, và tiền vẫn nằm
trong VCB dù có ghi hay không - đúng nguyên tắc *app theo dõi hũ tiền, không
theo dõi số dư ngân hàng*. Ghi thêm 6 dòng mỗi tháng chỉ để cân sổ là làm
nặng History mà không trả lời thêm câu hỏi nào.

---

## Bảng dòng tiền

Đây là thứ người dùng hỏi: *vào bao nhiêu, ra bao nhiêu, còn bao nhiêu.*

```
CASH FLOW · October                    Year 2026

  In                    39.065            312.520
    Salary              39.065            312.520
    Other                    0                  0

  Out                    8.240             84.200
    VCB spending         6.130             61.400
    Funds spending       2.110             22.800

  Invested               3.425            181.139

  Left                  27.400             47.181
```

### Công thức

```
In        = Σ income.amountVnd
Out       = Σ transactions out − Σ transactions in     (bỏ bucket etf,
                                                        bỏ source 'allocation')
Invested  = Σ transactions trên bucket etf
Left      = In − Out − Invested
```

Ba dòng loại trừ ở `Out` là toàn bộ chỗ dễ sai, nên chúng nằm trong **một hàm
thuần có test**, không rải vào component.

- **`allocation` bị loại**: chuyển tiền từ VCB sang BIDV không phải tiêu.
- **`etf` bị loại**: đầu tư không phải tiêu, nó có dòng riêng.
- **`in` bị trừ**: ứng 850 tiền picnic rồi nhận lại 430 thì tiêu 420.

`Left` là tiền còn nằm trong tài khoản, chưa tiêu và chưa đem đầu tư. Nếu nó
lớn dần qua nhiều tháng, đó là dấu hiệu cần chuyển thêm sang VPS - và đó
chính là câu hỏi người dùng muốn app trả lời.

### Ở đâu
- **Chu kỳ**: một khối trong `Summary`, dưới VPS.
- **Năm**: trong `Insights`, cộng từ các chu kỳ. Rẻ - mỗi chu kỳ chụp sẵn
  tổng lúc đóng sổ (`closedTotals`), nên xem cả năm chỉ tốn 12 lượt đọc.

---

## Đóng sổ, viết lại

Với quỹ đã được nạp thật, bước đóng sổ rõ nghĩa hơn:

```
surplus = Σ(limits − spent) của bucket budget   +   Σ covers lấy từ BIDV
```

Phần dư đi vào `ETF`, `Reserve`, hoặc giữ nguyên - như cũ. Thêm một việc:
**chụp lại kết quả vào document chu kỳ** (`closedTotals`, `closedIncome`), để
bảng dòng tiền theo năm không phải đọc lại toàn bộ giao dịch.

---

## Thu nhập bất thường

Nút `Add income` trong `Summary`, cạnh `Add deposit`. Số tiền + ngày + ghi
chú, `kind: 'other'`. Dùng cho thưởng, hoặc khoản "chuyển vào không ngờ" mà
người dùng có nhắc lúc bàn thiết kế ban đầu.

---

## Việc phải làm

| # | Việc |
|---|---|
| 1 | `Income` type + `income/{id}` + rules |
| 2 | `source` thêm `'allocation'`; rules cho phép |
| 3 | Generator `Apply` ghi income + limits + allocation trong một batch, idempotent |
| 4 | `src/lib/cashflow.ts` - hàm thuần In/Out/Invested/Left, có test |
| 5 | Khối `Cash flow` trong Summary |
| 6 | `Add income` |
| 7 | Đóng sổ chụp `closedTotals` + `closedIncome` |
| 8 | Bảng theo năm trong Insights |
| 9 | History ẩn `source: 'allocation'` mặc định, có nút hiện |
| 10 | `recompute-balances` bỏ cảnh báo - giờ nó đúng trở lại |

---

## Đã cân nhắc và KHÔNG làm

- **Cho bucket VCB một số dư thật.** Nghe cân đối hơn, nhưng nó biến mọi
  bucket tháng thành một cái ví phải nạp, và người dùng sẽ phải hiểu vì sao
  Food có "số dư" trong khi tiền thật nằm chung một tài khoản VCB.
- **Kế toán kép đầy đủ.** Mỗi giao dịch có tài khoản nợ và tài khoản có thì
  sổ luôn cân, nhưng đây là app một người dùng ghi tiền ăn sáng.
- **Phân loại thu nhập chi tiết.** `salary` và `other` là đủ để trả lời câu
  hỏi đã đặt ra.
