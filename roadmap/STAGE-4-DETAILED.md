# STAGE 4 - History, Edit & Import

> Sau mỗi task có **Verify** - phải pass mới đi tiếp.
> Gặp mâu thuẫn thì **DỪNG và hỏi**, không tự đoán.

---

## 0. Mục tiêu

Bỏ được `Budget.numbers`.

Đây là stage quyết định app có thay thế được cách làm cũ hay không. Sau
stage này, mọi thứ Numbers đang giữ đều nằm trong app, và app làm được thứ
Numbers + Shortcut chưa bao giờ làm được: **sửa một khoản đã ghi**.

### KHÔNG làm ở Stage 4
- Hộp thoại bù tiền lúc gõ (Stage 5)
- Push (Stage 6), AI (Stage 7)
- Chart xu hướng nhiều chu kỳ (Stage 7)

---

## Task 1 - Màn hình History

Danh sách giao dịch, mới nhất trên cùng, nhóm theo ngày.

```
HISTORY          [ September ▾ ]  [ All buckets ▾ ]

  Tue 2 Sep
    09:50   Food        25      Cafe
  Sun 31 Aug
    20:36   Beauty   2.663      seo 2000, thuoc 450, kham 150
    20:36   Food       879      tich luy nhieu ngay
  ...
```

### Ràng buộc
- **Một query cho cả chu kỳ**, đúng như màn Log. Đổi bộ lọc bucket thì lọc
  ở client, không bắn thêm query.
- Bộ chọn chu kỳ liệt kê các chu kỳ **có document**, mới nhất trước.
- Danh sách dài thì cắt trang bằng `limit()` + nút "Load more", không dùng
  virtual list - một chu kỳ chỉ khoảng 30-60 dòng.

### Verify
Chu kỳ tháng 9 hiện đủ số dòng đang có trong Firestore. Lọc theo `Food`
ra đúng số dòng.

---

## Task 2 - Sửa và xoá

Tap một dòng → bottom sheet: `amount` · `bucket` · `note` · `occurredAt`,
và nút `Delete`.

### Phần khó: số dư quỹ phải khớp lại

Sửa một giao dịch có thể chạm vào **hai** bucket cùng lúc. Viết một hàm
**thuần** rồi test nó, đừng rải logic này vào component.

`src/lib/tx-edit.ts`:

```ts
/** Số dư quỹ phải cộng thêm bao nhiêu cho mỗi bucket, sau khi sửa/xoá. */
export function balanceDeltas(
  before: { bucketId: string; kind: BucketKind; amountVnd: number } | null,
  after:  { bucketId: string; kind: BucketKind; amountVnd: number } | null,
): Record<string, number>
```

Bảng phải đúng:

| Tình huống | Kết quả |
|---|---|
| Sửa số tiền, cùng một fund | `{ f: +(old − new) }` |
| Đổi fund A → fund B | `{ A: +old, B: −new }` |
| Đổi budget → fund | `{ f: −new }` |
| Đổi fund → budget | `{ f: +old }` |
| Xoá giao dịch của fund | `{ f: +old }` |
| Mọi thay đổi trong nhóm budget | `{}` - budget không có `balanceVnd` |
| Sửa note hoặc ngày, không đổi gì khác | `{}` |

`test/tx-edit.test.ts` phải phủ **đủ 7 dòng trên**.

### Ràng buộc
- Ghi transaction và mọi `increment` số dư trong **cùng một `writeBatch`**.
- Sửa `occurredAt` qua mốc ngày 25 → `cycle` phải tính lại bằng `cycleOf()`.
  Document chỉ đổi field `cycle`; hai chu kỳ liên quan tự cập nhật vì
  `spent` được cộng ở client từ query theo chu kỳ.
- Xoá là **hard delete** cho giao dịch (khác với bucket - bucket chỉ
  `active: false`). Một khoản chi ghi nhầm không có giá trị lịch sử nào.
  Có confirm một bước, không có thùng rác.
- Sửa giao dịch `bucketId: 'etf'` cũng phải chạy đúng - nó là tiền vào,
  dấu ngược lại.

### Verify
Sửa một khoản `Travel` từ 500 → 800 trên iPhone: số dư `Travel` giảm đúng
300, Summary đổi theo ngay. Đổi bucket của nó sang `Purchases`: `Travel`
hoàn lại 800, `Purchases` trừ 800.

---

## Task 3 - Gộp nhiều ngày

Dữ liệu cũ đầy những dòng `accumulative`, `tich luy nhieu ngay`,
`an uong tich luy 1.582`. Đó là những lúc quên log rồi ghi dồn. Thay vì giả
vờ nó xảy ra hôm nay, cho ghi đúng bản chất.

Trong sheet nhập: nút `Range` → chọn ngày bắt đầu và kết thúc → lưu **một**
giao dịch, `occurredAt` = ngày kết thúc, `note` có tiền tố `[range] `.

Không chia đều số tiền ra từng ngày. Không ai biết ngày nào tiêu bao nhiêu,
và bịa ra sẽ làm mọi phân tích sau này sai.

### Verify
Ghi một khoản gộp 3 ngày → hiện trong History với nhãn `[range]`, thuộc
đúng chu kỳ của ngày kết thúc.

---

## Task 4 - Import từ Numbers

`scripts/import-numbers.mjs`. **Mặc định dry-run**, `--commit` mới ghi.

```bash
node --env-file=.env.local scripts/import-numbers.mjs --file overview.csv --uid <UID>
node --env-file=.env.local scripts/import-numbers.mjs --file overview.csv --uid <UID> --commit
```

### Đọc file
Numbers export CSV theo từng sheet. Cột: `Date, Month, Category, Amount, Note`.
- `Date`: `24 Jul 2026 at 06:12`
- `Amount`: dấu phẩy thập phân, đơn vị nghìn - dùng lại `toVnd()`
- `Month`: **chỉ để đối chiếu, không dùng làm nguồn**. Tính `cycle` từ `Date`
  bằng `cycleOf()`, rồi so với cột `Month`. Lệch dòng nào thì in ra cảnh báo -
  đó là dấu hiệu luật ngày 25 hiểu sai, phải dừng lại xem.

### Bảng map

| Category cũ | Ghi chú chứa | → bucket |
|---|---|---|
| FDU | `bros` `anh em` `friends` `happy hour` `dl team` `w harry` `voi ban` `voi anh h` `moi ` | `social` |
| FDU | `card` `4g` | `utilities` |
| FDU | `gasoline` | `buffer` |
| FDU | còn lại | `food` |
| Health | `seo` `laser` | `healthFund` |
| Health | `may hap dien` | `purchases` |
| Health | còn lại | `beauty` |
| Tech | mọi thứ | `tech` |
| Others | `tu lanh` `may say` `ghe cong` `tam ga` `ban lam viec` `den cho ban` `dung cu setup` `boc ghe` `hop quan ao` `coolmate` `do an minu` | `purchases` |
| Others | `wifi` `card dt` | `reserve` |
| Others | `ca phe` | `food` |
| Others | `sach` `bang diem` `film` `grab` `cho me` `photocopy` `op lung` | `buffer` |
| bất kỳ | `self fund` `all for travelling` | **bỏ** - chuyển quỹ, không phải chi tiêu |
| bất kỳ | `placeholder` `bi ben` `stuff for safety` | **bỏ** - người dùng không nhớ là gì |

So khớp trên ghi chú đã `toLowerCase()`, bỏ dấu tiếng Việt.

**Dòng không khớp luật nào → script DỪNG và in dòng đó ra, hỏi người dùng.**
Không được đoán, không được nhét vào `buffer` cho xong.

### Con số phải khớp

Chạy dry-run trên 138 dòng gốc phải ra **đúng** bảng này:

| bucket | dòng | tổng (nghìn) |
|---|---:|---:|
| `purchases` | 12 | 23.557 |
| `healthFund` | 4 | 17.553 |
| `food` | 65 | 12.980 |
| `beauty` | 18 | 8.250 |
| `social` | 12 | 3.281 |
| `tech` | 9 | 3.235 |
| `reserve` | 2 | 3.100 |
| `buffer` | 8 | 1.710 |
| `utilities` | 2 | 214 |
| **import** | **132** | **73.880** |
| bỏ - chuyển quỹ | 2 | 7.413 |
| bỏ - không nhớ | 3 | 2.894 |
| **cần hỏi** | **1** | 13 |

Dòng "cần hỏi" là một dòng `Others` ngày 8/4/2026, 13.337đ, **ghi chú rỗng**.
Script phải dừng ở đúng dòng này. Nếu nó chạy trót lọt 138/138 thì luật
"dừng khi không khớp" đã hỏng - sửa script, đừng sửa con số.

### Ghi vào Firestore
- `source: 'import'`
- `id`: sinh từ hash của `Date + Category + Amount + Note` để chạy lại
  nhiều lần không tạo bản sao
- Chu kỳ chưa có document → tạo với `status: 'closed'`, `limits: {}`,
  `incomeVnd: null`. **Không bịa hạn mức cũ** bằng baseline hiện tại.
- Sau khi ghi xong: chạy `scripts/recompute-balances.mjs` để dựng lại
  `balanceVnd` của mọi fund từ toàn bộ lịch sử.

### Verify
Dry-run ra đúng bảng trên. Sau `--commit`, tổng theo chu kỳ trong app khớp
với `Budget.numbers` mở song song.

---

## Task 5 - Export & backup

Firestore free tier **không tự backup**. Đây là toàn bộ mạng lưới an toàn.

- `Settings → Export`: JSON đầy đủ (buckets, transactions, cycles, covers)
  và CSV với cột `Cycle | Month | Year | Date | Bucket | Bank | Amount | Note`.
- `Month` và `Year` sinh từ `cycle` lúc export - không lưu trong DB.
- Nhắc export: mở app ngày đầu mỗi chu kỳ, nếu lần export gần nhất quá 35
  ngày thì hiện một dòng trong Settings. Một dòng chữ, không phải modal.
- `/settings/restore` (ẩn, không có link tới): chọn file JSON, xem preview,
  gõ `RESTORE` để xác nhận. Restore **chỉ thêm bản ghi còn thiếu**, khớp
  theo `id`. Không ghi đè, không xoá. Chạy hai lần là an toàn.

### Verify
Export → xoá một giao dịch → restore → giao dịch quay lại, không có bản sao.
Restore lần hai → không đổi gì.

---

## Xong Stage 4 khi

138 dòng cũ nằm trong app, tổng theo từng chu kỳ khớp với `Budget.numbers`.
Sửa một giao dịch cũ trên iPhone thì Summary đổi theo ngay và số dư quỹ vẫn
đúng. Export ra file, restore lại được.

Lúc đó `Budget.numbers` có thể nghỉ - nhưng **giữ file lại**, đừng xoá cho
tới khi app chạy êm qua trọn một chu kỳ.
