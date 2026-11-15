# PLAN-refactor (fina)

Trạng thái: Phase 1 xong (2026-11-15), test 228/228, build OK. Phase 2 chưa làm.

Mục tiêu nhỏ: đưa phần khôi phục backup ra khỏi component, và chia `ImportView.tsx` (743 dòng).

Không đổi tính năng. Không đổi giao diện. Không đổi màu bucket.

## Nguyên tắc chung

- Hỏi owner trước khi bắt đầu. Hai phase, mỗi phase một commit.
- Trước và sau: `npm test`, `npm run build`.
- Chỉ di chuyển code. Số tiền và kết quả Summary phải giữ nguyên.

## Hiện trạng

- `components/RestoreView.tsx` tự gọi `getDocs`, `writeBatch`, `doc`, `collection` để xoá và ghi lại dữ liệu. Phần tạo backup thì đã nằm trong `lib/backup.ts`.
- `components/ImportView.tsx` có 4 component con (`Header`, `RowItem`, `NoteInput`, `AddRow`) và hàm thuần `groupByDay`, `toLocalInput`.

## Phase 1: khôi phục backup qua `lib/backup.ts`

1. Thêm `restoreBackup(uid, backup)` vào `lib/backup.ts`. Chuyển toàn bộ phần `getDocs` / `writeBatch` từ `RestoreView` vào đây.
2. Tách phần thuần: kiểm tra file backup hợp lệ, chia batch (giới hạn 500 thao tác mỗi batch). Thêm unit test cho phần này.
3. `RestoreView.tsx` chỉ còn chọn file, hỏi xác nhận, gọi `restoreBackup`, hiện kết quả.

Xong khi: `grep "firebase/firestore" src/components` không còn kết quả.

## Phase 2: chia ImportView

1. Chuyển `RowItem`, `NoteInput`, `AddRow`, `Header` sang `src/components/import/`.
2. Chuyển `groupByDay`, `toLocalInput` sang `lib/import-draft.ts` + unit test.
3. Phần state chính (draft, overflows, reading, saving) có thể chuyển sang hook `useImportDraft` nếu file vẫn trên 300 dòng.

Mục tiêu: `ImportView.tsx` dưới 300 dòng.

## Để sau

`SummaryView.tsx` (582 dòng): chỉ tách khi sắp thêm tính năng cho Summary. Nhớ: số trên widget iPhone phải bằng Summary.
