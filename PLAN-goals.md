# Plan: Goals - quỹ riêng cho từng món lớn

Viết ngày 2026-10-06, trên main `29f7089`.

## Vấn đề

`Purchases` đang gánh hai việc khác nhau:

- đồ mua thường xuyên: quần áo, giày, đồ cho chó, đồ gia dụng nhỏ;
- tiền để dành cho món lớn: điện thoại, xe, sau này có thể là đồng hồ.

Tất cả chung một số dư, nên không biết bao nhiêu là tiền điện thoại, bao nhiêu
là tiền quần áo. Mua đôi giày là số dư giảm, và không biết mình vừa ăn vào tiền
của món nào. Cũng không có mục tiêu (giá, tháng mua), nên không biết mỗi tháng
cần để bao nhiêu.

## Hướng giải

- `Purchases` chỉ còn giữ đồ mua thường xuyên.
- Mỗi món lớn là một **goal**: một quỹ BIDV riêng, có số dư riêng, có giá mục
  tiêu và tháng muốn mua.
- Nhiều goal chạy cùng lúc được. Tiền của goal này không bao giờ lẫn sang goal
  khác.
- Quy tắc chọn chỗ: món cần để dành **từ 2 tháng trở lên** thì làm goal. Món trả
  được bằng tiền của một tháng thì để ở `Purchases`.
- Tất cả vẫn ở BIDV. Goal là ngăn ảo trong app, không cần mở tài khoản mới.

## Các quyết định đã chốt (2026-10-06)

- **Goal hiện có: Phone và Vehicle.** Tên `Vehicle` dùng chung cho xe máy hoặc
  ô tô. Đồng hồ để sau, khi nào cần thì tạo goal mới (có thể để trạng thái
  Later). `Reserve` vẫn giữ chi phí xe hằng năm (bảo dưỡng, bảo hiểm), không
  phải tiền mua xe mới.
- **Chia số dư Purchases hiện tại** (2.313.327):

  | Đi đâu | Số tiền |
  |---|---:|
  | Phone (goal mới) | 1.500.000 |
  | Vehicle (goal mới) | 500.000 |
  | Purchases (giữ lại) | 313.327 |
  | **Tổng** | **2.313.327** |

- **Goal ban đầu:**

  | Goal | Giá mục tiêu | Tháng mua | Đã có | Tiền mỗi tháng |
  |---|---:|---|---:|---:|
  | Phone | 15.000k | 2027-04 | 1.500k | **1.929k** |
  | Vehicle | chưa biết | chưa biết | 500k | **1.500k** |

  - Phone: 15.000k chỉ để tham khảo. Tiền mỗi tháng = phần còn thiếu chia đều
    cho 7 lần chia lương còn lại (25/10/2026 đến 25/04/2027):
    (15.000.000 - 1.500.000) / 7 = 1.928.571, làm tròn lên nghìn = 1.929k.
    Trước đây owner để 2.000k mỗi tháng, nên con số này thấp hơn một chút.
  - Vehicle: chưa có giá và ngày, nên giữ cố định 1.500k mỗi tháng. Goal vẫn
    chạy, chỉ chưa tính được "cần bao nhiêu mỗi tháng".
- **Ngân sách goals (`goalsMonthlyVnd`): 3.500k.** Owner nói "khoảng 3.000k",
  nhưng hai số trên cộng lại là 3.429k. Đặt 3.500k cho vừa; sửa được trong
  Settings.
- **Mức chuẩn `Purchases`: 500k** (trước là 3.000k).
- Ảnh hưởng tới ETF: trước đây quỹ Purchases lấy 3.000k mỗi tháng. Giờ là
  500k + 1.929k + 1.500k = 3.929k, nên ETF mỗi tháng giảm khoảng 929k.
- Mỗi goal là một bucket `kind: 'fund'`, `bank: 'BIDV'`, có thêm field `goal`.
  Dùng lại số dư quỹ, chia lương ngày 25, History, backup và
  `recompute-balances` sẵn có.
- `standardVnd` của goal = số tiền để vào goal mỗi tháng. Generator đã biết đọc
  số này, cho sửa ngắn hạn và tô đậm khi lệch.

---

## Mô hình dữ liệu

### Bucket thêm field `goal`

```ts
// src/types/fina.ts
export type GoalStatus = 'saving' | 'later' | 'done';

export interface Goal {
  /** Giá mục tiêu. null = chưa biết giá. */
  targetVnd: number | null;
  /** Tháng muốn mua, dạng '2027-06'. null = chưa định ngày. */
  targetMonth: string | null;
  status: GoalStatus;
}

interface Bucket {
  // ...các field cũ
  /** Chỉ có ở quỹ goal. Quỹ thường để null hoặc không có field. */
  goal?: Goal | null;
}
```

- `saving`: đang để dành, được chia tiền ngày 25.
- `later`: chỉ ghi lại ý định. Không được chia tiền, không tính vào ngân sách goals.
- `done`: đã mua xong. Số dư phải về 0, rồi bucket `active: false` (không xoá,
  lịch sử phải giữ).
- Thứ tự goal = `order` có sẵn. Goal đứng trên là goal **ưu tiên** hơn.
- Id goal: `goal-<slug>`, ví dụ `goal-phone`, `goal-vehicle`.

### Settings thêm ngân sách goals

```ts
// meta/settings
goalsMonthlyVnd: number; // mặc định 3_500_000
```

Chỉ dùng để so: tổng `standardVnd` của các goal `saving` lớn hơn số này thì
Settings, Summary và Generator báo nhẹ.

### Chuyển tiền giữa hai quỹ: source mới `move`

Hiện app chưa có cách chuyển tiền giữa hai quỹ. Chia số dư Purchases và đóng
goal đều cần nó.

- Một lần chuyển = **hai giao dịch** cùng `moveId`:
  - `out` ở quỹ nguồn, `source: 'move'`;
  - `in` ở quỹ đích, `source: 'move'`.
- `isSpending` trả `false` cho `move`: đây là đổi ngăn, không phải chi tiêu.
  Không lọt vào Insights, digest AI hay tổng History.
- Ghi bằng một batch, cập nhật `balanceVnd` của hai quỹ cùng lúc.
- `recompute-balances` vẫn đúng mà không cần sửa, vì nó cộng mọi giao dịch.
- Phase này chỉ cho chuyển giữa hai quỹ **cùng BIDV**: không có đồng nào rời
  ngân hàng, nên không cần chuyển khoản thật.

---

## Phase G0 - Sửa mô tả (hint) của từng hũ trong Settings

**Xong (2026-10-06)**, branch `goals/g0-hint`. Unit test 148/148. Đã thử trên
trình duyệt: Edit, Save, tải lại, xoá trống, Esc, con trỏ ở cuối, theme tối,
màn hình điện thoại. Mô tả Food đã trả về như cũ sau khi thử.

Làm trước, vì nó nhỏ, độc lập, và G2 cần nó để sửa
hint của `Purchases`.

Hiện trạng: Settings > **Standard amounts** đã sửa được mức chuẩn (ô số bên
phải). Bấm vào tên thì hiện bong bóng mô tả, nhưng **chỉ đọc**, không sửa được.
Hint chỉ đổi được bằng cách sửa thẳng Firestore.

Thêm (yêu cầu của owner 2026-10-06):

1. Trong bong bóng mô tả, thêm nút **Edit**. Bấm vào thì bong bóng thành ô nhập
   nhiều dòng (textarea), có **Save** và **Cancel**.
   - Ví dụ: `Food` đang là "Meals, coffee, groceries, BHX", sửa được thành gì
     cũng được.
   - Hũ chưa có mô tả: bấm tên vẫn mở bong bóng, hiện "No description" và nút
     Edit.
   - Để trống rồi Save = xoá mô tả (`hint: null`).
   - Tối đa 200 ký tự, có đếm số ký tự còn lại.
2. Ô mức chuẩn giữ nguyên như hiện nay (sửa xong rời ô là lưu).
3. Chỉ sửa mô tả và mức chuẩn. Tên hũ không đổi ở phase này.
4. `src/lib/buckets.ts`: `updateBucket` cho phép `hint` trong `patch`.
5. `firestore.rules`, `validBucket`: `hint` là null hoặc string dài tối đa 200.
6. Sửa mô tả không đụng gì tới chu kỳ, giao dịch hay số dư.

Kiểm tra: tsc, unit test, build. Trên trình duyệt: sửa hint của Food, tải lại
trang vẫn thấy hint mới; xoá trống thì hiện "No description". Xem cả theme
sáng, tối và màn hình điện thoại.

## Phase G1 - Nền: field `goal` và chuyển tiền giữa quỹ

**Xong (2026-10-06)**, branch `goals/g1-move`, đã merge và deploy cả rules.
Unit test 158/158, build đạt. Đã thử trên dữ liệu thật: chuyển 11.000 từ
Purchases sang Travel, History hiện một dòng, tổng chi không đổi, xoá cả hai
nửa thì số dư về đúng. `recompute-balances` (dry-run): mọi số dư đều khớp.

`createGoal` dời sang G2, là nơi đầu tiên dùng nó.

1. `src/types/fina.ts`: thêm `Goal`, `GoalStatus`, `Bucket.goal`, `TxSource`
   thêm `'move'`, `Transaction.moveId?`.
2. `src/lib/buckets.ts`: `toBucket` đọc `goal`. `updateBucket` cho sửa thêm
   `goal` (`hint` đã có từ G0).
3. `firestore.rules`:
   - `validBucket`: `goal` là null hoặc map đúng kiểu (`targetVnd` là int hoặc
     null, `targetMonth` đúng dạng `YYYY-MM` hoặc null, `status` trong 3 giá trị).
   - `validTransaction`: `source` thêm `'move'`, `moveId` là string nếu có.
4. `src/lib/spending.ts`: `move` không tính là chi tiêu.
5. `src/lib/transactions.ts`: `moveBetweenFunds(uid, from, to, amountVnd, note)`
   ghi hai giao dịch + hai lần `increment` trong một batch. Xoá một nửa thì xoá
   luôn nửa kia.
6. History: hiện cặp move thành **một dòng** "Purchases → Phone 1.500". Ẩn
   cùng nút ẩn allocation.
7. `src/hooks/useInsights.ts` và `src/lib/signals.ts`: bỏ qua `move`.
8. Summary, khối BIDV - Funds: thêm nút **Move** mở sheet chọn quỹ nguồn, quỹ
   đích, số tiền. Không cho chuyển quá số dư quỹ nguồn.
9. Test: `spending.test.ts` (move không phải chi tiêu), test mới cho
   `moveBetweenFunds` (tổng số dư không đổi), rules nếu có emulator.

Kiểm tra: tsc, unit test, build. Thử chuyển 1.000 giữa hai quỹ trên dữ liệu
test, xem số dư, History, Insights.

## Phase G2 - Tạo goal và chia số dư Purchases

**Xong (2026-10-06)**, branch `goals/g2-create`. Unit test 164/164, build đạt.
Việc chia tiền đã làm trên dữ liệu thật (qua dev server, rules đã có từ G1):
Phone 1.500.000, Vehicle 500.000, Purchases 313.327, tổng BIDV không đổi
(10.673.327). Purchases: mức chuẩn 500, mô tả mới. `recompute-balances`
(dry-run): mọi số dư đều khớp. Ngân sách goals để mặc định 3.500 (chưa ghi
vào `meta/settings`, chỉ ghi khi sửa).

Lúc thử có tạo nhầm một goal "PhonePhone" (gõ hai lần). Nó có số dư 0 và
không có giao dịch, đã xoá bằng admin SDK rồi tạo lại Phone.

1. `src/lib/buckets.ts`: `createGoal(uid, { name, targetVnd, targetMonth,
   standardVnd })` tạo bucket `goal-<slug>`, `kind: 'fund'`, `bank: 'BIDV'`,
   số dư 0.
2. Settings: mục **Goals** mới.
   - Danh sách goal: tên, giá mục tiêu, tháng mua, tiền mỗi tháng, trạng thái.
   - Nút **New goal**. Sửa tại chỗ như mức chuẩn hiện nay.
   - Mũi tên lên / xuống để đổi thứ tự ưu tiên.
   - Ô **Goals per month** (mặc định 3.500k) và dòng tổng: "Saving goals use
     3.429 of 3.500".
3. `Purchases`: đổi hint thành "Clothes, shoes, dog food, small home items" và
   mức chuẩn 3.000k thành 500k. Owner tự làm trong Settings bằng UI của G0.
4. Sau khi deploy G1 + G2, **làm việc chia tiền trong app** (để lại dấu vết
   trong History):
   1. Tạo goal **Phone**: giá 15.000k, tháng 2027-04, tiền mỗi tháng 1.929k.
   2. Tạo goal **Vehicle**: giá và tháng để trống, tiền mỗi tháng 1.500k.
   3. Move 1.500.000 từ Purchases sang Phone.
   4. Move 500.000 từ Purchases sang Vehicle.
   5. Kiểm tra: Purchases 313.327, Phone 1.500.000, Vehicle 500.000, tổng
      BIDV không đổi so với trước khi chia.

Kiểm tra: tsc, unit test, build. Chạy `recompute-balances` (dry-run) sau khi
chia: không được có dòng `LECH`.

## Phase G3 - Xem tiến độ: Summary và Log

**Xong (2026-10-06)**, branch `goals/g3-progress`. Unit test 171/171, build
đạt. Đã xem trên dữ liệu thật: Summary hiện "Phone 1.500 / 15.000 · Apr 2027
· needs 1.929/mo · on track", "Vehicle 500 · 1.500/mo · no target", "Per
month 3.429 / 3.500". Log có hàng Goals riêng. Goal cũng có nút + để nạp
thêm như quỹ thường.

1. `src/lib/goals.ts` (hàm thuần, có test):
   - `monthsLeft(targetMonth, now)`: số lần chia lương (ngày 25) còn lại, từ
     hôm nay tới ngày 25 của `targetMonth`, tính cả hai đầu. Nhỏ nhất là 1.
     Ví dụ: hôm nay 06/10/2026, tháng mua 2027-04 thì ra 7.
   - `needPerMonth(goal, balance, now)` = (giá - đã có) / số tháng còn lại, làm
     tròn lên nghìn. null khi thiếu giá hoặc tháng.
   - `goalStatus`: `on track` / `behind` (tiền mỗi tháng nhỏ hơn số cần) /
     `ready` (đã đủ tiền) / `no target`.
   - `etaMonth(goal, balance)`: với tiền mỗi tháng hiện tại thì tháng nào đủ.
2. Summary: khối mới **Goals** nằm dưới BIDV - Funds.
   - Mỗi goal: tên, `1.500 / 15.000`, thanh tiến độ màu xám (theo `DESIGN.md`),
     tháng mua, "needs 1.929/mo, set 1.929/mo · on track".
   - Goal `later` hiện mờ ở cuối, không có thanh.
   - Dòng tổng: tiền mỗi tháng của goal saving so với `goalsMonthlyVnd`.
   - Goal không còn nằm trong khối BIDV - Funds nữa (để khỏi đếm hai lần trong
     mắt người đọc). Tổng BIDV vẫn cộng cả goal, ghi rõ "incl. goals".
3. Log: nhóm Funds tách hai hàng: quỹ thường, rồi **Goals**. Chỉ hiện goal
   `saving`. Log vào goal = lúc mua thật.
4. `src/lib/signals.ts`: goal **không** tính vào `idleFunds`. Goal đứng yên
   nhiều tháng là chuyện bình thường, báo "quỹ không dùng 3 chu kỳ" là báo sai.
5. Widget iPhone: không đổi (widget chỉ hiện hũ budget).

Kiểm tra: tsc, unit test (`goals.test.ts`, `signals.test.ts`), build, xem
Summary và Log ở cả theme sáng và tối, màn hình điện thoại.

## Phase G4 - Generator ngày 25 và đóng goal

Branch `goals/g4-generator`.

1. `src/lib/generator.ts`: tách `goals` ra khỏi `funds` thành nhóm riêng, có
   `goalsTotalVnd`. Chỉ goal `saving` được chia. ETF vẫn ăn phần còn dư.
2. GeneratorSheet: nhóm **Goals** dưới BIDV - Funds.
   - Số điền sẵn từ `standardVnd` của goal, sửa được cho chu kỳ này.
   - Tô đậm khi tiền chia **nhỏ hơn số cần** để kịp tháng mua (ngoài luật lệch
     20% so với chuẩn đã có).
   - Hiện con số: "needs 1.929".
   - Tổng goals lớn hơn `goalsMonthlyVnd` thì báo nhẹ, kèm số chênh.
3. `applyCyclePlan`: goal đi chung đường `fundAllocations` như quỹ thường
   (giao dịch `alloc-<chu kỳ>-<goal id>`). Không cần đổi logic.
4. Đóng goal (Summary, trên dòng goal `ready` hoặc sau khi đã log khoản mua):
   - Còn dư: nút **Close goal** chuyển phần dư về `Purchases` bằng một `move`,
     rồi đặt `status: 'done'`, `active: false`.
   - Âm (mua đắt hơn số đã để dành): bắt chọn quỹ để bù bằng `move` trước khi
     đóng.
   - Số dư đúng 0: đóng luôn.

Kiểm tra: tsc, unit test (`generator`: goal later không được chia, tổng goals,
cờ "chia ít hơn số cần"), build, chạy thử Generator trên dữ liệu test cho
chu kỳ 2026-10.

---

## Cách làm

- Mỗi phase một branch, mỗi mục lớn một commit.
- Trước mỗi commit: `git branch --show-current` và `git status --short`, chỉ
  stage đúng file của mình.
- Cuối mỗi phase: tsc, unit test, build, kiểm tra trên trình duyệt, rồi **hỏi
  trước khi merge và push**.
- UI chỉ dùng màu xám, theo `DESIGN.md`. Chữ trên UI bằng tiếng Anh.

## Để sau

- Goal ở ngân hàng khác BIDV (cần chuyển khoản thật, giống `needsTransfer` của
  cover).
- Tự chia ngân sách goals theo thứ tự ưu tiên khi tổng số cần vượt ngân sách.
- Đồng hồ: tạo goal `later` khi bắt đầu nghĩ tới.
