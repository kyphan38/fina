# PLAN-motion - fina: chuyển động và tương tác

Viết ngày 2026-10-20 để giao cho một AI khác làm (hoặc làm trong phiên
này). Owner chưa duyệt: hỏi owner trước khi bắt đầu P1.

## Prompt để dán cho AI làm

```
Work in /Users/kyphan/ws/app/fina. Read ws/app/AGENTS.md, fina/AGENTS.md,
ws/app/DESIGN.md (sections "Motion" and "Layout") and fina/PLAN-motion.md
first. Implement only phase <P1> from PLAN-motion.md, exactly as written.
Follow "Quy tắc cho mọi phase", "CSS dùng chung" and "Lỗi hay gặp". Run
every command in "Kiểm tra mỗi phase" and fix all failures you caused. Then
update the Motion section in README.md and the "Tiến độ" list, commit only
the files you changed on main (no Co-Authored-By), push, and stop. Tell me
in Vietnamese, in short simple sentences, what changed and how to try it.
Do not start the next phase.
```

Đổi `<P1>` thành phase muốn làm. Mỗi lần chỉ một phase.

## Đọc trước khi làm

1. `ws/app/AGENTS.md` và `fina/AGENTS.md`: không em dash (U+2014), code và
   comment bằng tiếng Anh, chữ trên UI càng ít càng tốt, không ghi
   `Co-Authored-By`. Next.js ở đây là bản 16: đọc docs trong
   `node_modules/next/dist/docs/` nếu đụng tới API của Next.
2. `ws/app/DESIGN.md`, phần **Motion**: easing, thời lượng, quy tắc. Plan
   này chỉ áp dụng phần đó cho fina.
3. Code đã làm xong cùng hệ thống này, copy cách làm (không import chéo
   repo): `logi/src/lib/motion.ts`, `logi/src/hooks/usePresence.ts`,
   `logi/src/hooks/useFlip.ts`, `logi/src/components/SheetShell.tsx`,
   `logi/src/components/Toasts.tsx`, `logi/src/hooks/useIndicator.ts`.
   `logi/PLAN-motion.md` ghi các bẫy của React Compiler lint (không
   `setState` trong effect, tính state lúc render).
4. Luật riêng của fina phải giữ:
   - **Mở app là gõ được ngay** (roadmap rule #12, `src/lib/startup.ts`).
     Không có hiệu ứng nào chạy lúc trang mới hiện: Log, Summary, History
     hiện sẵn, không `rise`, không `fade-in`. Hiệu ứng vào chỉ dành cho
     thứ người dùng vừa mở (sheet, toast).
   - **Tiền phải rõ và chính xác.** Không đếm số chạy lên, không nhảy số,
     không làm số mờ đi rồi hiện lại khi mở trang. Số tiền luôn đúng ngay
     khung hình đầu.
   - **Sáu màu bucket (`--b1` .. `--b6`, `bucketAccent`) giữ nguyên**, không
     đổi, không xám hoá, không thêm hue nào khác (DESIGN.md). Thanh tiến
     độ chỉ đổi cách vẽ (transform), không đổi màu. "Over" vẫn là mực đậm
     `var(--over)` cộng chữ `over`, không đỏ.
   - **Không cử chỉ làm mất tiền.** Không vuốt để xoá, không kéo để di
     chuyển tiền. Mọi sửa xoá đi qua sheet có nút.
   - **Numpad không đổi chỗ, không trễ.** Phím nhấn phải đổi ngay khi chạm.

## Hiện trạng (2026-10-20)

- Gần như không có chuyển động. `src/app/globals.css` chỉ có khối
  `prefers-reduced-motion` (0.01ms). Không có keyframe, không có token
  easing.
- 7 bottom sheet tự viết, mỗi cái một kiểu, **không có hiệu ứng vào/ra**
  (bật là hiện, tắt là mất): `AmountSheet` (z-20), `TxEditSheet` (z-20),
  `MoveSheet` và `MoveDetailSheet` trong `MoveSheet.tsx` (z-20),
  `CloseGoalSheet` (z-20), `GeneratorSheet` (z-20), `CoverSheet` (z-30,
  không có đóng, vì tiền đã ra khỏi tài khoản nên phải chọn). Dùng
  `grep -rn "fixed inset-0" src` để chắc không sót cái nào.
- Không có sheet nào đóng bằng vuốt xuống hay phím `Esc`.
- Toast "Undo" của Log (`LogView.tsx`, `role="status"`) hiện và mất đột
  ngột. Hẹn giờ 6s (lỗi 4s).
- Thanh tiến độ vẽ bằng `width` ở 4 chỗ: `BucketTile.tsx`, `SummaryView.tsx`
  (`BudgetRow` và `GoalRow`), `InsightsView.tsx`. Không chỗ nào có
  transition.
- `src/app/(main)/loading.tsx` dùng `animate-pulse` (nhấp nháy), trái với
  DESIGN.md.
- Mũi tên `▼` ở nút Show/Hide của Funds (`LogView.tsx:259`) xoay tức thì.
- Không có tab marker (BottomNav chỉ đổi màu và nét icon).
- Test: `node --test` trên hàm thuần trong `src/lib` (`test/*.test.ts`),
  không có test component. Logic của hiệu ứng phải viết thành hàm thuần
  trong `src/lib/motion.ts`.
- **Không có đường vào app mà không đăng nhập** (không có chế độ E2E), nên
  AI không mở được trang thật. Thử bằng **trang tạm** ở `src/app/zz-*/page.tsx`
  (ngoài `(main)`, không bị cổng đăng nhập chặn), rồi xoá. Cách làm giống
  logi (`logi/PLAN-motion.md`, phần "Kiểm tra mỗi phase"). Nhớ xoá luôn
  `.next/dev/types` sau khi xoá trang tạm, nếu không `typecheck` báo thiếu
  module.

## Quy tắc cho mọi phase

- Theo đúng phần **Motion** trong DESIGN.md: chỉ `opacity` và `transform`,
  reduced motion phải chạy, không vòng lặp gây chú ý, không thư viện mới.
- Mỗi cử chỉ phải có cách thay thế (nút, phím, chữ có sẵn).
- Không đổi logic tiền (`src/lib/*`: money, transactions, covers, moves,
  goals, cycle...). Chỉ đổi UI. Hàm thuần mới phải có test `node --test`.
- Không đổi chữ trên UI.
- Rung: `navigator.vibrate?.(ms)`. iPhone bỏ qua là đúng.
- Mỗi phase xong: cập nhật phần **Motion** trong `README.md` (tạo mới nếu
  chưa có, ngắn, tiếng Anh), ghi một dòng vào "Tiến độ" cuối file này, rồi
  **hỏi owner trước khi làm phase tiếp theo**.

## Kiểm tra mỗi phase

```bash
cd ws/app/fina
npm run typecheck
npm run lint
npm test
npm run build
```

- `npm test` cần `TZ=Asia/Ho_Chi_Minh` (đã nằm trong script).
- Lưu output ra file rồi so số test passed với tổng, đừng chỉ đọc dòng cuối.
- Thử bằng trang tạm trên trình duyệt (`fina-dev` trong
  `ws/app/.claude/launch.json`, cổng 3030). Thử màn 375px và màn rộng
  (>= 900px, fina có layout hai cột), light và dark, và một lần với reduced
  motion bật. Nếu pane trình duyệt đang ẩn thì `visibilityState` là
  `hidden` và animation không chạy: ghi rõ "chưa thấy tốc độ", đừng nói là
  đã xem.
- Commit: chỉ add đúng đường dẫn đã sửa (`git add <file> ...`, không
  `git add -A`). Kiểm tra `git branch --show-current` là `main` trước khi
  commit. Message dạng `feat(motion): ...`. Không co-author. Push lên
  `main` thì Vercel tự deploy.

## Chỗ sửa chính (vị trí ngày 2026-10-20, có thể lệch vài dòng)

| Chỗ | File | Phase |
|---|---|---|
| Khối reduced motion, token | `src/app/globals.css:151-158` | P1 |
| Skeleton | `src/app/(main)/loading.tsx` | P1 |
| Toast Undo, mũi tên Funds | `src/components/LogView.tsx:259,360-385` | P1 |
| 7 bottom sheet | `AmountSheet`, `TxEditSheet`, `MoveSheet` (+ `MoveDetailSheet`), `CloseGoalSheet`, `GeneratorSheet`, `CoverSheet` | P2 |
| Thanh tiến độ | `BucketTile.tsx:55-70`, `SummaryView.tsx:345-350,410`, `InsightsView.tsx:85-90` | P3 |
| Ô tile, nút OUT/IN, phím numpad | `BucketTile.tsx`, `LogView.tsx:300-315`, `Numpad.tsx` | P3 |
| Số đổi sau khi lưu | `LogView.tsx` (Monthly left, tile), `SummaryView.tsx` | P3 |
| Tab dưới cùng | `BottomNav.tsx` | P4 |
| Dòng History vào/ra | `HistoryView.tsx:84-130`, `src/hooks/useHistory.ts` | P4 |

## CSS dùng chung (thêm vào `globals.css`)

Thêm token vào `:root` (một lần, không cần bản dark):

```css
  --ease-soft: cubic-bezier(0.22, 1, 0.36, 1);
```

Thêm khối Motion (đặt trước khối reduced motion). Tên giống mora, logi và
noda:

```css
/* ---- Motion: short, opacity/transform only (DESIGN.md "Motion") ---- */
@keyframes fade-in {
  from { opacity: 0; }
}
.fade-in {
  animation: fade-in 180ms ease-out both;
}

@keyframes fade-out {
  to { opacity: 0; }
}
.fade-out {
  animation: fade-out 200ms ease-in both;
}

@keyframes sheet-up {
  from { transform: translateY(16px); opacity: 0; }
}
.sheet-up {
  animation: sheet-up 200ms var(--ease-soft) both;
}

@keyframes sheet-down {
  to { transform: translateY(16px); opacity: 0; }
}
.sheet-down {
  animation: sheet-down 200ms ease-in both;
}

@keyframes rise {
  from { opacity: 0; transform: translateY(6px); }
}
.rise {
  animation: rise 240ms var(--ease-soft) both;
}

@keyframes row-out {
  to { opacity: 0; transform: translateX(8px); }
}
.row-out {
  animation: row-out 180ms ease-in both;
  pointer-events: none;
}

/* A slow fade in and out for "loading"; never blinks. */
@keyframes breathe {
  0%, 100% { opacity: 0.35; }
  50% { opacity: 1; }
}
.breathe {
  animation: breathe 3.2s ease-in-out infinite;
}
```

Thay khối `@media (prefers-reduced-motion: reduce)` hiện có bằng khối chung,
đặt **sau** mọi keyframe và class motion:

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 1ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 1ms !important;
  }
}
```

## Lỗi hay gặp (đọc kỹ)

1. **Không có test component.** Đừng cài jsdom hay testing-library. Logic
   thành hàm thuần trong `src/lib/motion.ts`, test trong
   `test/motion.test.ts` (giống `test/money.test.ts`).
2. **`matchMedia` không có trong Node.** `reducedMotion()` trả `true` khi
   không có `matchMedia`, nên gọi được trong test và lúc render phía server.
3. **React Compiler lint (Next 16).** Cấm `setState` trong `useEffect`;
   state "đã đổi" tính lúc render (mẫu `prev`/`setPrev` trong
   `logi/src/components/Toasts.tsx`). Một component cha có handler dùng
   `Date.now()` mà map thẻ đang rời đi trong cùng thân hàm có thể bị báo
   nhầm `react-hooks/purity`: tách phần thẻ rời đi ra component con
   (logi đã gặp, xem `StoppedCards` trong `logi/src/app/(main)/now/page.tsx`).
4. **Hydration.** Trang render trên server. Đừng đọc `matchMedia` lúc render
   đầu rồi đổi class theo nó. Đọc trong effect hoặc lúc có sự kiện.
5. **Phím tắt Log.** `useLogKeyboard` nghe `keydown` trên `window` (`Esc`
   xoá số đang gõ, `f` lật OUT/IN, mũi tên chọn bucket) và đang tắt khi
   `CoverSheet` mở. `SheetShell` mới nghe `Esc` để đóng: chỉ cho sheet có
   `onClose`, và chỉ khi sheet đang mở. `CoverSheet` không có `onClose` nên
   không bị ảnh hưởng. Không để `Esc` vừa đóng sheet vừa xoá số.
6. **Numpad trong sheet nghe phím.** `Numpad` có `keyboard` (mặc định bật)
   nghe `window`. Hiệu ứng ra 200ms của sheet nghĩa là sheet còn nằm đó 200ms
   sau khi người dùng bấm đóng: trong lúc đó phải `pointer-events: none` và
   không nhận thêm phím (gợi ý: khi đang rời đi, render sheet với
   `inert`, hoặc đặt `keyboard={false}`).
7. **Nút trong sheet đóng ngay, không chờ hiệu ứng.** Save, Cancel, Confirm
   gọi handler như cũ và sheet mất ngay: toast là phản hồi. Chỉ bấm nền,
   vuốt xuống và `Esc` mới chạy hiệu ứng ra rồi gọi `onClose`.
8. **`transform` trên thanh tiến độ.** `scaleX` cần `transform-origin: left`
   và thẻ rộng 100%. Bo góc `rounded-full` bị méo nhẹ khi co (chấp nhận
   được ở chiều cao 2-4px). Phần "over" luôn 100%, không animate.
9. **Chữ số nhảy ngang.** `body` đã có `tabular-nums`: đừng bỏ.
10. **Không em dash.** Kiểm tra trước khi commit (zsh):
    `grep -rn $'\xe2\x80\x94' src test PLAN-motion.md README.md` phải rỗng.

---

## P1 - Nền móng: CSS, hook, skeleton, toast

### P1.1 CSS và token

File: `src/app/globals.css`.

- Thêm `--ease-soft` và khối Motion như "CSS dùng chung".
- Thay khối reduced motion như trên.

### P1.2 Hàm và hook

File mới: `src/lib/motion.ts`, `src/hooks/usePresence.ts`,
`src/hooks/useFlip.ts`, `test/motion.test.ts`.

- `src/lib/motion.ts`: `reducedMotion()` và `leavingItems()`, copy từ
  `logi/src/lib/motion.ts`. Các hàm của phase sau thêm vào đây.
- `usePresence.ts` và `useFlip.ts`: copy từ logi (bản tính state lúc render,
  không `setState` trong effect), thêm `'use client'`, import
  `reducedMotion` từ `@/lib/motion`.
- Test: `reducedMotion()` trả `true` trong Node; `leavingItems`: `[a,b,c]`
  -> `[a,c]` cho `[b]`, danh sách giống nhau cho `[]`, thêm mới không tính
  là rời.

### P1.3 Skeleton thở chậm

File: `src/app/(main)/loading.tsx`.

- Đổi bốn chỗ `animate-pulse` thành `breathe`. Giữ nguyên kích thước.

### P1.4 Toast Undo vào và ra

File: `src/components/LogView.tsx` (khối `toast`, dòng ~360-385).

- Toast mới: class `rise`.
- Toast hết hạn, bị đóng hoặc bấm Undo: ở lại thêm 200ms với `fade-out` và
  `pointer-events-none`, rồi gỡ. Giữ bản sao toast cuối trong state,
  tính lúc render (mẫu của `logi/Toasts.tsx`). Không thêm `setTimeout`
  mới ngoài cái gỡ 200ms. Reduced motion: gỡ ngay.
- Toast đổi nội dung (lưu liên tiếp nhiều khoản): toast mới thay ngay, không
  chờ cái cũ ra. Dùng `key` theo nội dung để chạy lại `rise`.
- Bấm Undo: logic hiện có (`deleteTransaction`) giữ nguyên, chạy trước.
- Không đổi hẹn giờ 6s/4s và logic `setUndo`.
- Rung: `navigator.vibrate?.(10)` khi lưu thành công (chỉ nhánh không lỗi).

### P1.5 Mũi tên Funds xoay mượt

File: `src/components/LogView.tsx:259`.

- Thêm `inline-block transition-transform duration-200`. Giữ logic
  `-rotate-90`. Vùng Funds mở/đóng vẫn đổi ngay (không animate chiều cao).

Xong khi: lưu một khoản, toast trượt lên nhẹ, sau 6 giây mờ đi; bấm Undo thì
việc hoàn tác chạy ngay và toast mờ đi (nút Undo bị khoá trong lúc mờ); mở app
thấy Log và numpad hiện sẵn, không có gì chạy; reduced motion thì mọi thứ
hiện/mất ngay.

---

## P2 - Một khung sheet chung: vào, ra, vuốt xuống

### P2.1 Component `SheetShell`

File mới: `src/components/SheetShell.tsx`. Hàm thuần thêm vào
`src/lib/motion.ts` (`sheetShouldClose`, `dragOffset`, copy từ logi, kèm
test).

Copy cấu trúc từ `logi/src/components/SheetShell.tsx` (hai lớp: lớp ngoài nhận
transform khi kéo, lớp trong giữ animation CSS). Khác logi:

- Layout cũ của fina là `fixed inset-0 flex flex-col justify-end`: nền mờ
  `bg-black/30` (z-20) hoặc `bg-black/40` (z-30), một nút `Close` `flex-1`
  phía trên, panel ở đáy. `SheetShell` giữ đúng bố cục này (panel dính đáy,
  rộng hết, không `max-w`), nhận `z` (20 hoặc 30) và `dim` (30 hoặc 40).
- Props: `onClose?` (không có = phải trả lời: không vuốt, không bấm nền, không
  `Esc`, như `CoverSheet`), `label`, `z`, `dim`, `locked` (đang lưu thì
  không vuốt), `className` (panel: `max-h`, `rounded-t-2xl border-t border-line
  bg-surface px-4 ...`), `header` (vùng kéo), `children`.
- Thanh nắm 40x4 `bg-line` ở đầu panel, chỉ màn hẹp (`min-[900px]:hidden`).
  Vùng kéo là thanh nắm và dòng tiêu đề (`touch-action: none` chỉ ở đó),
  không đặt trên cả panel (panel cuộn được và có numpad).
- Thanh nắm và tiêu đề: các sheet hiện đặt tiêu đề (`<span className="text-xs
  font-semibold">`) cạnh số tiền lớn trong một hàng `flex justify-between`.
  Giữ hàng đó trong `header` để vùng kéo gồm cả số tiền: **chạm vào số tiền
  không bắt đầu kéo nếu không di chuyển** (dùng ngưỡng 8px như logi).
- Controls trong `header` (nút, input) không bắt đầu kéo (`closest('button,
  a, input, select, textarea')`).
- Vào: nền `fade-in`, panel `sheet-up` (200ms). Ra khi bấm nền, vuốt xuống
  hoặc `Esc`: nền `fade-out`, panel `sheet-down`, đợi 200ms rồi gọi
  `onClose`. Trong lúc ra, `pointer-events: none` và `inert` trên panel (để
  numpad không nhận phím, lỗi hay gặp số 6). Reduced motion: gọi ngay.
- `Esc` đóng sheet trên cùng (chỉ khi có `onClose` và chưa đang ra).

Test thêm vào `test/motion.test.ts`: `sheetShouldClose(120, 400, 0)` là
`true`; `(40, 400, 0.1)` là `false`; `(40, 400, 0.8)` là `true`;
`dragOffset(-50)` là `-10`; `dragOffset(30)` là `30`.

### P2.2 Chuyển các sheet sang `SheetShell`

Làm từng file, mỗi file thử lại bằng trang tạm:

| File | `onClose` | z / dim | Ghi chú |
|---|---|---|---|
| `AmountSheet.tsx` | có | 20 / 30 | Có numpad: kiểm tra `inert` khi đang ra. Bỏ nút `Close` nền cũ. |
| `TxEditSheet.tsx` | có | 20 / 30 | Có xoá: xoá xong gọi `onClose` như cũ (đóng ngay). |
| `MoveSheet.tsx` (và `MoveDetailSheet`) | có | 20 / 30 | |
| `CloseGoalSheet.tsx` | có | 20 / 30 | |
| `GeneratorSheet.tsx` | có | 20 / 30 | `locked` khi đang áp dụng (`busy`). |
| `CoverSheet.tsx` | **không** | 30 / 40 | Phải chọn nguồn hoặc huỷ bản ghi. Chỉ có hiệu ứng vào. |

Giữ nguyên mọi `className` của panel, mọi nội dung, mọi handler. Không đổi
thứ tự phần tử trong panel, ngoài việc đưa hàng tiêu đề + số tiền vào
`header`.

Xong khi: mọi sheet trượt lên khi mở; bấm nền hoặc vuốt xuống thì trượt
xuống; nhấn `Esc` đóng; trong sheet có numpad, gõ số vẫn đúng, và phím không
còn nhận sau khi bấm đóng; `CoverSheet` không đóng được bằng nền, vuốt hay
`Esc`; trên Log, `Esc` vẫn xoá số đang gõ.

---

## P3 - Ô bucket, thanh tiến độ, số đổi

### P3.1 Thanh tiến độ vẽ bằng `scaleX`

File: `BucketTile.tsx`, `SummaryView.tsx` (`BudgetRow`, `GoalRow`),
`InsightsView.tsx`.

- Đổi `style={{ width: X% }}` thành thẻ `w-full origin-left` với
  `transform: scaleX(X / 100)` và
  `transition: transform 500ms var(--ease-soft)`.
- Thanh **bắt đầu ở đúng giá trị** (không chạy từ 0 lúc mở trang): chỉ đổi
  giá trị mới chạy, ví dụ sau khi lưu một khoản ở Log hoặc nạp quỹ ở Summary.
- Màu giữ nguyên (`bucketAccent`, `var(--over)`, `var(--b6)`, `bg-muted`).
  Phần "over" (100%) không đổi.
- Hàm thuần `barScale(used, limit)` (0..1, giới hạn, an toàn khi `limit`
  là 0 hoặc `undefined`) thêm vào `src/lib/motion.ts` thay cho ba chỗ tự
  tính `pct`, kèm test: `barScale(50, 100)` là `0.5`; `(150, 100)` là `1`;
  `(10, 0)` là `0`; `(10, undefined)` là `0`; `(-5, 100)` là `0`.

### P3.2 Số đổi sau khi lưu

File: hook mới `src/hooks/useChanged.ts`, `LogView.tsx`, `BucketTile.tsx`,
`SummaryView.tsx`.

- Khi một số tiền **đổi giá trị lúc đang xem** (lưu một khoản, Undo, nạp
  quỹ), số mới hiện bằng `fade-in` (180ms). Lúc mở trang không có gì chạy.
- `useChanged(value)`: trả `true` sau lần đổi đầu tiên (state `prev` tính
  lúc render, không effect). Dùng `key={value}` trên thẻ chữ để chạy lại.
- Áp dụng cho: "Monthly left" ở Log, giá trị trong mỗi `BucketTile`, "Monthly
  left" / "Left" và tổng ở Summary. Không áp dụng cho số đang gõ ở numpad.
- Không đếm số chạy, không đổi màu. Chỉ mờ-vào nhẹ.

### P3.3 Chạm có phản hồi

File: `BucketTile.tsx`, `LogView.tsx` (nút OUT/IN), `Numpad.tsx`.

- Ô bucket: `transition-colors duration-150` cho đổi chọn (nền mực đậm khi
  chọn). Không đổi kích thước.
- Nút OUT/IN: cùng `transition-colors duration-150`.
- Phím numpad và nút Save: `active:scale-[0.97] transition-transform
  duration-100`. Nhấn phải đổi ngay khi chạm (CSS `:active`, không chờ JS).
  Giữ `active:bg-sunk` hiện có.
- Hiệu ứng chỉ là `transform` và màu, không đổi layout, nên không ảnh
  hưởng tốc độ gõ.

Xong khi: lưu một khoản ở Log thì thanh của ô đó đầy dần, số còn lại mờ vào
nhẹ; mở app và chuyển trang thì thanh và số hiện sẵn đúng giá trị; gõ nhanh
trên numpad không thấy trễ; bấm chọn bucket thì nền đổi mượt.

---

## P4 - Tab và danh sách

### P4.1 Vạch tab dưới cùng trượt theo

File: `BottomNav.tsx`, file mới `src/hooks/useIndicator.ts` (copy từ logi).

- Hiện chỉ đổi màu chữ và nét icon. Thêm **một** vạch 2px x 40px mực đậm ở
  đáy mỗi thanh (`absolute`, `bottom-0` trên phần tab, `md:hidden` không
  cần vì fina dùng thanh dưới cả trên Mac), trượt sang tab đang chọn bằng
  `translateX` (260ms `var(--ease-soft)`). Tab đang chọn có `data-active`.
- `aria-current` và hành vi `Link` giữ nguyên.
- Lần đầu và khi đổi cỡ màn: vạch đứng đúng chỗ, không trượt từ 0.
- Chỉ làm vạch. Không đổi icon, không đổi chữ, không thêm nền.

### P4.2 Dòng History vào và ra

File: `HistoryView.tsx`, `src/hooks/useHistory.ts` (chỉ đọc, không đổi
logic).

- `h.rows` đổi theo realtime (Firestore): MoMo import, giao dịch từ máy
  khác, xoá trong `TxEditSheet`. Một dòng **mới** xuất hiện lúc đang xem
  thì vào bằng `rise`. Lần tải trang đầu thì không chạy.
- Một dòng **bị xoá** lúc đang xem: ở lại 180ms với `row-out`, rồi gỡ
  (dùng `leavingItems`). Dòng bên dưới trượt lên bằng `useFlip`.
- Phần tử rời đi không bấm được (`pointer-events: none`, render ở component
  con riêng, lỗi hay gặp số 3) và không có `onClick` mở sheet.
- Nhóm theo ngày (`groupByDay`) giữ nguyên. Nếu cả nhóm biến mất thì tiêu đề
  ngày cũng biến mất ngay (không animate), chỉ animate dòng.
- Tổng ở cuối (`h.total`) dùng `useChanged` như P3.2.

Xong khi: đổi tab thì vạch trượt; xoá một khoản trong History thì dòng trượt
sang phải và mờ đi rồi các dòng dưới nhích lên; mở History thì mọi dòng hiện
sẵn, không có gì chạy.

---

## Không làm (ghi lại để AI sau khỏi đề xuất lại)

- **Đếm số chạy lên** (count-up) cho tổng tiền: tiền phải đúng ngay khung
  hình đầu và không gây tò mò. Chỉ có `fade-in` khi số đổi.
- **Vuốt để xoá hoặc sửa dòng**: dễ mất tiền khi cuộn. Xoá đi qua sheet.
- **Confetti hay hiệu ứng ăn mừng** khi đóng goal hoặc đủ mục tiêu.
- **Hiệu ứng khi mở trang** (fade, rise) trên Log, Summary, History: ảnh
  hưởng rule #12 (gõ được ngay) và DESIGN.md quy tắc 8.
- **Chuyển trang kiểu View Transitions**: làm sau, nếu thấy cần.
- **Animate chiều cao** của vùng Funds hoặc các nhóm Show/Hide: đổi ngay là
  đủ, tránh layout shift trên màn hình đã chật.
- **Đổi màu bucket hay làm thanh nhiều màu hơn**: sáu màu bucket cố định.
- **Rung khi gõ từng phím numpad**: gõ nhanh sẽ rung liên tục.

## Tiến độ

(AI làm ghi một dòng mỗi phase: ngày, commit, ghi chú.)
- P1 (2026-10-20): Motion CSS block + `--ease-soft`, one global reduced-motion block, `src/lib/motion.ts` + test, `usePresence`, `useFlip`, skeleton `breathe`, `ToastBar` (rise, fade-out, Undo locked while leaving) with a `{id, text, undoable}` toast state in `LogView`, 10ms vibrate on a good save, Funds arrow transition. Toast and arrow checked on a temporary page (rise, replace, leaving with pointer-events none, Undo runs once, error toast has no Undo, a rotate transition runs). The dev service worker (`fina-v1`) served an old stylesheet until it was unregistered. Real Log page not tried (needs sign-in). `next typegen` kept failing on a stale `.next/dev/types` entry for a deleted page until it was removed.
- P2 (2026-10-20): `SheetShell` (`src/components/SheetShell.tsx`) for AmountSheet (also used by MoveSheet), TxEditSheet, MoveDetailSheet, CloseGoalSheet, GeneratorSheet; CoverSheet uses it without `onClose`. `sheetShouldClose`/`dragOffset` + tests. Deviation from the plan: the sheet swallows keydown in the capture phase while it exits (instead of only `inert`), because the numpad listens on `window` and `inert` does not stop that. Breakpoint for the swipe is 899px (fina turns two-column at 900). Checked on a temporary page: sheet-up on open, Esc and backdrop play sheet-down, keys swallowed while leaving, inner buttons close at once, slow short drag springs back, long drag slides out and closes, CoverSheet ignores Esc/backdrop/swipe and has no handle. Real sheets not tried (needs sign-in); the pane was visible but transitions were only checked by state and class.
- P3 (2026-10-20): `BarFill` (scaleX) in BucketTile, Summary `BudgetRow` and `GoalRow`, Insights `BufferRow`; `barScale` + tests; `Settle` + `useChanged` for tile values, Log "Monthly left", Summary rows and totals; press feedback on tiles, OUT/IN and numpad. Deviation from the plan: `useLogData` and `useSummary` now return `settled` (new `useFirstSnapshots`, wraps each listener callback with `mark(i)`), because their listeners answer one after another: without it a tile would first show a full bar (no spend loaded yet) and then animate down on load. `settled` turns true one frame after the last first snapshot so the render that brings the last data is still treated as load. Insights bars never animate (a report). Checked on a temporary page with listeners answering late: bar goes 0 to 0.4 with no transition and no fade, then the transition arms; later changes animate and fade. Real Log and Summary not tried (needs sign-in).
- P4 (2026-10-21): `BottomNav` sliding line via `useIndicator`; `useRowMotion` (hook) + `rowChanges` (+ tests) for History rows in/out with `useFlip`; `useHistory` now returns `settled` (`useFirstSnapshots(2)`); History total uses `Settle`. Deviations from the plan: the row logic lives in a hook so a temporary page can test it, and "more than 3 rows changed" counts as a swap (another cycle, filter or import) because the selected cycle changes before its transactions arrive, which would otherwise look like every row leaving and arriving. The indicator is an `li` (not a `span`) inside the `ul` to keep the markup valid. Checked on a temporary page (animation frames stubbed with a timer because the preview pane was not painted; the dev service worker had to be unregistered again after each reload): load plays nothing, add rises, delete slides out and is not tappable, a scope change and a big swap play nothing, the nav line starts in place and slides on a tab change. Real BottomNav and HistoryView not tried (need sign-in). All four phases done.
