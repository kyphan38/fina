// ============================================================
// fina - Database id trong Firebase project kyphan38-fina-app.
//
// Mỗi app một project Firebase riêng, nên fina dùng database mặc định.
// Dùng chung project nghĩa là chung Auth user pool, chung tên Cloud Function,
// chung quota, và một lần deploy nhầm ghi đè rules của app kia.
// Xem logi/roadmap/PLAN-project-split-logi.md.
//
// Giữ hằng số này để sau còn một chỗ duy nhất mà đổi.
// ============================================================
export const DB_ID = "(default)";
