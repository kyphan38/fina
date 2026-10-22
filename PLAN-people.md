# Plan: People - tiền đi qua tay nhưng không phải chi tiêu của mình

Viết ngày 2026-10-22. Đây là bản để duyệt, chưa có code.

## Vấn đề

App chỉ có **bucket**. Mọi khoản tiền đều phải vào một bucket, nên những khoản
không phải chi tiêu của mình cũng bị tính vào hạn mức:

- ứng tiền khám, bảo hiểm hoàn sau (có khi sang tháng sau, có khi không hoàn đủ);
- mượn bạn bè hoặc người nhà, tháng sau trả;
- ứng giùm team mua hoa, team trả sau;
- team chuyển một cục cho chuyến đi, mình đứng ra chi hộ.

Cách tạm thời đang dùng: ghi IN khi mượn, OUT khi trả, vào cùng bucket. Tổng
cuối cùng vẫn đúng, nhưng:

- hạn mức tháng này trông rộng hơn thật (tiền mượn làm tăng "còn lại");
- tháng trả nợ thì bucket bị vượt, phải sửa hạn mức bằng tay;
- History lẫn khoản chi thật với khoản đi ngang, nên tổng chi khó tin;
- không có chỗ nào cho biết ai đang nợ ai bao nhiêu (đang ghi tay ở Notes).

## Ý tưởng chính

Thêm một loại đích thứ hai bên cạnh bucket: **Người** (một người hoặc một
nhóm: Mẹ, Anh, DV, Team, Bảo hiểm, Trip Đà Lạt).

Mỗi Người có **một số dư**:

| Số dư | Nghĩa |
|---|---|
| dương (+) | họ đang nợ mình |
| âm (-) | mình đang nợ họ, hoặc đang giữ tiền của họ |
| 0 | xong, không ai nợ ai |

Chỉ có hai thao tác, giống OUT / IN ở bucket:

| Thao tác | Dùng khi | Số dư của Người |
|---|---|---|
| **Ra** (tiền đi tới họ) | cho mượn, ứng giùm, chi hộ, trả nợ | tăng |
| **Vào** (tiền từ họ tới) | mượn, được hoàn, họ trả, họ chuyển tiền chung | giảm |

**Quy tắc vàng:** khoản ghi vào Người **không bao giờ** tính vào hạn mức, tổng
chi tiêu, Trends hay AI insight. Chỉ khoản ghi vào bucket mới là chi tiêu của
mình.

## Bốn trường hợp, cùng một cách ghi

### A. Ứng tiền khám, bảo hiểm hoàn sau

```
22/10  Ra  → Bảo hiểm  1.200   khám răng      Bảo hiểm: +1.200
10/11  Vào ← Bảo hiểm  1.000   hoàn           Bảo hiểm:   +200
```

200 không được hoàn. Bấm **Tính là chi tiêu** trên Người đó, chọn bucket
(Health). App ghi:

- một khoản chi 200 vào Health, ở chu kỳ hiện tại;
- một khoản Vào 200 ở Bảo hiểm để số dư về 0.

Hai dòng này có chung `settleId`, nên xoá một dòng thì dòng kia cũng bị xoá.

### B. Mượn tiền, tháng sau trả

```
16/10  Vào ← DV  2.000   mượn              DV: -2.000
       ghi chi tiêu vào bucket như bình thường
25/11  Ra  → DV  2.000   trả               DV:      0
```

- Tiền mượn **không** làm hạn mức rộng ra. Nếu tiêu quá hạn mức thì bucket hiện
  vượt. Đó là sự thật: mình đã tiêu nhiều hơn số mình có.
- Hộp cover có thêm nguồn **Mượn DV** khi bucket bị vượt. Chọn nguồn này thì
  phần vượt được giải thích là do tiền mượn, và lúc đóng sổ chu kỳ không bị tính
  là thiếu.
- Trả nợ là **Ra** ở Người, không phải chi tiêu. Nên tháng trả nợ bucket không bị
  vượt, không cần sửa hạn mức nữa.

### C. Ứng giùm team

```
20/10  Ra  → Team  500   hoa sinh nhật     Team: +500
05/11  Vào ← Team  500   team trả          Team:    0
```

Food và Social không bị ảnh hưởng gì.

### D. Giữ tiền chung, chi hộ cho chuyến đi

```
01/11  Vào ← Trip Đà Lạt  10.000   team chuyển        Trip: -10.000
02/11  Ra  → Trip Đà Lạt   3.000   khách sạn          Trip:  -7.000
03/11  Ra  → Trip Đà Lạt   6.500   ăn, xe             Trip:    -500
05/11  Ra  → Trip Đà Lạt     500   trả lại phần dư    Trip:       0
```

- **Phần của mình** (ví dụ 2.000) ghi vào quỹ Travel như một khoản chi bình
  thường. Nếu tiền đó cũng nằm trong cục 10.000 thì ghi thêm một dòng
  `Ra → Trip 2.000` (mình góp vào quỹ chung), rồi `Travel OUT 2.000`.
- Nếu cuối chuyến số dư ra **+800** thì mình đã ứng thêm, team nợ mình. Họ chuyển
  trả thì ghi `Vào ← Trip 800`.

## Màn hình thay đổi

### Log

Lưới chọn có thêm một hàng **Người**, nằm dưới Funds. Có nút `+ Người` để tạo
nhanh (chỉ cần tên). Nút OUT / IN đổi chữ thành **Ra / Vào** khi đang chọn một
Người. Khi chọn Người thì không có kiểm tra vượt hạn mức, vì Người không có hạn
mức.

### History

- Mặc định chỉ hiện chi tiêu của mình, và tổng chỉ tính chi tiêu.
- Bộ lọc bucket có thêm nhóm **Người**. Chọn một Người thì hiện các dòng của
  Người đó và số dư đang chạy.
- Hàng của Người có nhãn tên Người, không có màu bucket.

### Summary

Thêm một khối **People** ở cuối, nằm trên Notes. Chỉ hiện những Người có số dư
khác 0:

```
PEOPLE
Bảo hiểm     +200    owes you
Mẹ         -5.000    you owe
Anh        -5.000    you owe
```

Bấm vào một Người: xem lịch sử, **Tính là chi tiêu** (chỉ khi số dư dương), và
**Archive** (chỉ khi số dư bằng 0).

### Generator (ngày lương)

Nếu đang nợ (tổng số dư âm), Generator hiện thêm một dòng trước các bucket:

```
Debts                      -10.000   Pay first
```

Bật **Pay first** thì số đó được trừ khỏi tiền chia. Bấm Apply chỉ trừ tiền khi
chia, **không** tự ghi "đã trả". Khi thật sự chuyển tiền thì bạn ghi
`Ra → Mẹ 5.000`. Lý do: ngày trả thật có thể khác ngày Apply, và app chỉ ghi
những gì đã thật sự xảy ra.

### Đối chiếu ngân hàng

```
Ngân hàng = tiền của mình trong các hũ - tổng số dư Người
```

Ví dụ: hũ có 4.000, đang nợ 2.000 (số dư -2.000), người khác nợ mình 500
(số dư +500), thì tài khoản có 4.000 + 2.000 - 500 = 5.500. Summary có thể hiện
phép tính này ở dưới khối People.

## Dữ liệu

### `people/{id}`

```ts
export interface Person {
  id: string;            // 'me', 'anh', 'team-trip-da-lat'
  name: string;
  balanceVnd: number;    // + họ nợ mình, - mình nợ họ. Denormalized như fund.
  archived: boolean;
  createdAt: number;
  updatedAt: number;
}
```

### Giao dịch

Dùng lại collection `transactions`, thêm một trường:

```ts
personId?: string;       // có trường này thì bucketId = 'people'
```

- `bucketId: 'people'` là một bucket giả, **không có document**. Nhờ vậy mọi
  query theo chu kỳ vẫn chỉ cần một lần đọc.
- `isSpending()` trả `false` khi có `personId`. Đây là chỗ duy nhất cần đổi để
  Summary, History, Trends và widget cùng đúng (giống cách đã làm với ETF và
  allocation).
- Hướng: `out` = Ra, `in` = Vào. `balanceVnd` của Người đổi trong cùng batch,
  giống fund.
- `bank` vẫn ghi (VCB / BIDV / Cash) để đối chiếu đúng tài khoản.
- `recompute-balances` cộng lại cả số dư Người.

Có một cách khác là làm collection riêng `peopleEntries`. Không chọn cách đó vì
History và việc đối chiếu sẽ phải đọc hai nơi, và mỗi tổng đều phải nhớ gộp lại.
Bài học từ lỗi ETF là ngược lại: để chung thì phải loại ra ở một chỗ duy nhất,
nhưng việc loại ra có test bảo vệ.

### Cover từ tiền mượn

Cover hiện cần `fromBucketId`. Thêm `fromPersonId`: cover từ một Người thì
không chuyển tiền giữa các hũ. Nó chỉ đánh dấu phần vượt là "do tiền mượn". Lúc
đóng sổ, `computeSurplus` cộng phần này lại để chu kỳ không bị tính là thiếu.

## Chuyển dữ liệu hiện tại

| Hiện tại | Sau khi chuyển |
|---|---|
| Phone fund IN 5.000 "Mượn anh 5tr" | `Vào ← Anh 5.000` |
| Beauty IN 5.000 "Mượn mẹ 5tr (tiền mặt)" | `Vào ← Mẹ 5.000`, bank Cash |
| Beauty IN 2.000 "Mượn DV 2tr" | `Vào ← DV 2.000` |

Kết quả:

- Beauty hiện đúng số đã tiêu thật (tăng thêm 7.000). Có thể bị vượt hạn mức của
  chu kỳ October.
- Phone fund về **-5.000**: đã chi nhiều hơn số tiền trong quỹ đúng bằng khoản
  mượn. BIDV vẫn khớp ngân hàng: -4.674 + 5.000 = 326.
- People: Anh -5.000, Mẹ -5.000, DV -2.000. Notes không cần ghi nợ nữa.

Mình sẽ viết một script chuyển đổi, chạy thử trước, rồi bạn duyệt rồi mới ghi
thật. Nên chạy **trước khi đóng sổ October**, để số liệu đóng sổ là số liệu đúng.

## Thứ tự làm

1. `Person`, `personId`, `isSpending` và test. Chưa có UI.
2. Log: hàng Người, Ra / Vào, tạo Người.
3. Summary: khối People, màn hình chi tiết, Tính là chi tiêu, Archive.
4. History: bộ lọc Người, tổng chỉ tính chi tiêu.
5. Script chuyển 3 khoản mượn hiện tại.
6. Generator: dòng Debts và Pay first.
7. Cover từ tiền mượn.
8. Cập nhật trang Hướng dẫn.

Bước 1 đến 5 là đủ dùng. Bước 6 và 7 làm sau cũng được.

## Cần bạn chốt

1. Tên hiển thị: **People** (tiếng Anh, theo UI hiện tại) hay **Người**?
2. Cần thêm Cash làm `bank` không? Tiền mẹ đưa là tiền mặt. Nếu không có Cash
   thì phải ghi là VCB, và VCB sẽ lệch với ngân hàng 58k.
3. "Tính là chi tiêu" ghi vào chu kỳ **hiện tại** (đơn giản, không đụng chu kỳ
   đã đóng) hay chu kỳ của **khoản Ra ban đầu** (History đúng hơn, nhưng có thể
   phải mở lại chu kỳ đã đóng)? Mình đề xuất chu kỳ hiện tại.
4. Pay first trong Generator: chỉ trừ khi chia (như trên), hay tự ghi luôn
   "đã trả"?
