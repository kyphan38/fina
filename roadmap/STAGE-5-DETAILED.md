# STAGE 5 - Overspend & Cover

> Sau mỗi task có **Verify** - phải pass mới đi tiếp.
> Gặp mâu thuẫn thì **DỪNG và hỏi**, không tự đoán.

---

## 0. Mục tiêu

Tiêu lố không còn biến mất khỏi sổ.

Đây là stage sửa đúng điều người dùng nói lúc bàn thiết kế:

> *"Tuy nhiên khó khăn là kiểu nếu tôi xài lố, thì tháng sau dường như tôi ignore."*

Không phải thiếu kỷ luật. Numbers **không có chỗ nào để ghi một số âm**, nên
nó không hỏi, nên không ai trả lời. Stage này tạo ra chỗ đó.

### KHÔNG làm ở Stage 5
- Push (Stage 6), AI (Stage 7)
- Chart nhiều chu kỳ
- Tự động chuyển tiền giữa ngân hàng - app không bao giờ làm việc đó

---

## Task 1 - Phát hiện lố: hàm thuần trước, UI sau

`src/lib/overflow.ts`:

```ts
/** Phần vượt của MỘT giao dịch, tính theo trạng thái TRƯỚC khi ghi nó. */
export function overflowOf(args: {
  kind: BucketKind;
  limitVnd: number | undefined;   // budget: hạn mức chu kỳ
  spentVnd: number;               // budget: đã tiêu trước giao dịch này
  balanceVnd: number;             // fund: số dư trước giao dịch này
  amountVnd: number;
}): number   // 0 nếu không vượt
```

| Tình huống | Kết quả |
|---|---|
| budget, còn 200, tiêu 990 | `790` |
| budget, còn 200, tiêu 200 | `0` - vừa khít không phải lố |
| budget không có `limitVnd` (chu kỳ lịch sử) | `0` - không có hạn mức thì không có gì để vượt |
| fund còn 7.400, tiêu 9.000 | `1.600` |
| fund đang âm −500, tiêu 100 | `100` - âm rồi thì tiêu thêm bao nhiêu lố bấy nhiêu |
| bucket `etf` | `0` - tiền chỉ đi vào |

`test/overflow.test.ts` phủ đủ 6 dòng.

---

## Task 2 - Nguồn bù: một nguồn duy nhất

`src/lib/covers.ts`:

```ts
export function coverOptions(args: {
  buckets: Bucket[];
  bufferLimitVnd: number;
  bufferUsedVnd: number;     // spent[buffer] + covered[buffer]
  neededVnd: number;
}): { bucket: Bucket; availableVnd: number; enough: boolean }[]
```

### Quy tắc
- Nguồn hợp lệ: **`buffer`** và mọi bucket `kind: 'fund'` ở BIDV.
  `etf` không bao giờ là nguồn bù - nó là đích đến, không phải ví.
- **Một nguồn cho mỗi lần bù.** Không chia 200 chỗ này 590 chỗ kia.
  Chia nhỏ làm sổ sách rối mà chẳng được gì.
- Buffer không đủ → vẫn hiện nhưng **làm mờ**, `enough: false`, không bấm được.
  Ẩn đi thì người dùng không hiểu vì sao nó biến mất.

### Verify
Buffer còn 200, cần 790 → Buffer bị mờ, các quỹ BIDV bấm được, `etf` không
có trong danh sách.

---

## Task 3 - Buffer "đã dùng" là gì

Đây là chỗ dễ tính sai nhất, phải viết rõ trước khi code.

Bù từ Buffer **KHÔNG tạo giao dịch mới**. Nếu tạo, tổng chi tiêu của chu kỳ
sẽ đội lên hai lần cho cùng một đồng tiền.

```
spent[b]     = tổng transactions của bucket b        (không đổi)
covered[b]   = tổng covers có fromBucketId = b, status 'done'
Buffer đã dùng = spent[buffer] + covered[buffer]
Tổng chi VCB   = Σ spent[b]        ← CHỈ transactions, không cộng covers
```

Cover chỉ **di chuyển tiền giữa các hũ**, không sinh ra khoản chi mới.

### Hệ quả ở bước đóng sổ

Bù từ Buffer nằm trong VCB nên không đổi tổng. Bù từ **quỹ BIDV** thì có -
tiền từ ngoài chảy vào. Nên công thức Stage 3 phải sửa:

```ts
surplus = Σ(limits[b] − spent[b])  +  Σ(covers từ BIDV, status 'done')
```

`test/cycle-close.test.ts` thêm ca này.

### Verify
Food lố 300, bù từ Buffer → tổng chi VCB **không đổi**, Buffer hiện
`490 / 1.000`. Bù 300 từ Reserve thay vì Buffer → surplus chu kỳ **tăng 300**.

---

## Task 4 - Luồng A: bù từ Buffer (VCB → VCB)

```
Save 990 vào Tech
   |  giao dịch đã lưu, KHÔNG chờ gì cả
   v
"Tech vượt 790. Bù từ đâu?"   -> chọn Buffer
   v
"Bù 790 từ Buffer?"            -> Xác nhận
   v
cover { status: 'done', needsTransfer: false }
```

Hai chạm. Không có chuyển khoản vì cùng một ngân hàng.

### Ràng buộc
- Sheet hiện **sau khi** giao dịch đã nằm trong Firestore. Tắt sheet đi cũng
  không mất record - chỉ còn lại một dải nhắc.
- Sheet **dismiss được**. Bắt buộc chọn ngay là làm chậm đúng lúc cần nhanh.

---

## Task 5 - Luồng B: bù từ quỹ BIDV (cần chuyển khoản thật)

```
"Tech vượt 790. Bù từ đâu?"   -> chọn Reserve
   v
cover { status: 'pending', needsTransfer: true }   <- GHI XUỐNG TRƯỚC
   v
"Chuyển 790.000 từ BIDV sang VCB"   [ Copy ]  [ Để sau ]
   v
người dùng rời app, chuyển khoản, quay lại
   v
"Đã chuyển 790 từ Reserve chưa?"    [ Rồi ]  [ Chưa ]
   v  chỉ khi bấm "Rồi"
reserve.balanceVnd -= 790 ; cover.status = 'done'
```

### Ràng buộc kỹ thuật
- Cover **phải nằm trong Firestore trước khi người dùng rời app.** iOS hay
  kill PWA khi chuyển sang app ngân hàng; quay lại dù app khởi động lại từ
  đầu vẫn phải hỏi đúng câu đó.
- Bắt lúc quay lại bằng `visibilitychange` **và** lúc app khởi động - hai
  đường, vì không đường nào chắc chắn trên iOS.
- **Không** deep link mở app ngân hàng. Chỉ `Copy` số tiền
  (`navigator.clipboard.writeText`, có fallback chọn text khi bị chặn).
- Quỹ **chỉ giảm sau khi xác nhận**. Trong lúc chờ, ô Tech vẫn hiện `−790`
  màu đỏ. Đó là trạng thái thật: đã tiêu, chưa được bù.

### Verify
Gõ một khoản vượt hạn mức → chọn Reserve → **tắt hẳn app** khỏi app switcher
→ mở lại → app vẫn hỏi "đã chuyển chưa" → bấm Rồi → Reserve giảm đúng, Tech
hết đỏ.

---

## Task 6 - Dải nhắc và chặn đóng sổ

- Còn cover `pending` → dải nhỏ trên màn Log và Summary:
  `Tech vượt 790 · chọn nguồn bù` hoặc `Chuyển 790 từ Reserve · đã chuyển?`
- Màn **đóng sổ chặn lại** khi còn cover `pending`:
  `2 khoản bù chưa xong. Xử lý xong mới đóng được chu kỳ.`

Đây là điểm cuối cùng mà việc tiêu lố có thể trôi qua. Chặn ở đây thì nó
không trôi được nữa.

---

## Task 7 - Đưa quyết định lên sớm, gỡ bản gộp cuối chu kỳ

Stage 3 để việc bù ở bước đóng sổ. Giờ nó đã diễn ra ngay lúc gõ, nên phần
"chọn quỹ bù" trong `CycleClose` chỉ còn là **lưới an toàn** cho phần lệch
còn sót (làm tròn, giao dịch nhập sau).

Giữ lại, nhưng đổi câu chữ để không ai tưởng đó là chỗ chính:
`Còn lệch 120 sau khi đã bù. Lấy từ đâu?`

---

## Xong Stage 5 khi

Trên iPhone: tiêu vượt hạn mức Tech → chọn Reserve → tắt app hoàn toàn → mở
lại → vẫn được hỏi → xác nhận → Reserve giảm đúng, Tech hết đỏ, Summary khớp.

Và: bù từ Buffer không làm tổng chi tiêu chu kỳ đội lên.
