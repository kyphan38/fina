// ============================================================
// fina - Widget iPhone cho app Scriptable
//
// Cài đặt:
//  1. Cài Scriptable (App Store, miễn phí).
//  2. Tạo script mới, dán toàn bộ file này vào, đặt tên "fina".
//  3. Bấm ▶ chạy một lần trong app: nhập WIDGET_TOKEN. Token lưu trong
//     Keychain của iPhone, không nằm trong script.
//  4. Ra màn hình chính / màn hình khóa → thêm widget Scriptable →
//     chọn script "fina".
//
// Hỗ trợ: nhỏ, vừa, màn hình khóa (chữ nhật và tròn).
// Đổi token: chạy script trong app, chọn "Đổi token".
// ============================================================

const API = 'https://fina.kyphan38.com/api/widget';
const OPEN_URL = 'https://fina.kyphan38.com/summary';
const KEY = 'fina-widget-token';
const CACHE = 'fina-widget-cache.json';
const REFRESH_MIN = 15;

const ink = Color.dynamic(new Color('#111111'), new Color('#f2f2f2'));
const muted = Color.dynamic(new Color('#6b6b6b'), new Color('#9a9a9a'));
const track = Color.dynamic(new Color('#e3e3e1'), new Color('#3a3a3a'));
const bg = Color.dynamic(new Color('#ffffff'), new Color('#1c1c1e'));

// ---------- dữ liệu ----------

/** 4_550_000 -> '4.550' (đơn vị nghìn, giống app). */
function k(vnd) {
  const n = Math.round(vnd / 1000);
  const s = String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return n < 0 ? '−' + s : s;
}

async function askToken() {
  const a = new Alert();
  a.title = 'fina widget';
  a.message = 'Dán WIDGET_TOKEN';
  a.addSecureTextField('token', '');
  a.addAction('Lưu');
  a.addCancelAction('Huỷ');
  if ((await a.present()) === -1) return null;
  const t = a.textFieldValue(0).trim();
  if (!t) return null;
  Keychain.set(KEY, t);
  return t;
}

async function load(token) {
  const fm = FileManager.local();
  const path = fm.joinPath(fm.documentsDirectory(), CACHE);
  try {
    const req = new Request(API);
    req.headers = { Authorization: 'Bearer ' + token };
    req.timeoutInterval = 15;
    const data = await req.loadJSON();
    if (req.response.statusCode !== 200) throw new Error(data.error || 'HTTP ' + req.response.statusCode);
    fm.writeString(path, JSON.stringify(data));
    return { data, stale: false };
  } catch (e) {
    // Mất mạng thì hiện số lần trước, đánh dấu là cũ - còn hơn ô trống.
    if (fm.fileExists(path)) return { data: JSON.parse(fm.readString(path)), stale: true };
    return { error: String(e.message || e) };
  }
}

// ---------- vẽ ----------

function bar(width, ratio, height = 6) {
  const dc = new DrawContext();
  dc.size = new Size(width, height);
  dc.opaque = false;
  dc.respectScreenScale = true;
  const r = height / 2;
  const bgPath = new Path();
  bgPath.addRoundedRect(new Rect(0, 0, width, height), r, r);
  dc.addPath(bgPath);
  dc.setFillColor(track);
  dc.fillPath();
  const w = Math.max(0, Math.min(1, ratio)) * width;
  if (w > 0) {
    const fg = new Path();
    fg.addRoundedRect(new Rect(0, 0, Math.max(w, height), height), r, r);
    dc.addPath(fg);
    dc.setFillColor(ink);
    dc.fillPath();
  }
  return dc.getImage();
}

function ring(size, ratio, line = 5) {
  const dc = new DrawContext();
  dc.size = new Size(size, size);
  dc.opaque = false;
  dc.respectScreenScale = true;
  const c = size / 2;
  const rad = c - line / 2;
  const arc = (from, to, color) => {
    const p = new Path();
    const steps = 72;
    for (let i = 0; i <= steps; i++) {
      const a = -Math.PI / 2 + 2 * Math.PI * (from + (to - from) * (i / steps));
      const pt = new Point(c + rad * Math.cos(a), c + rad * Math.sin(a));
      if (i === 0) p.move(pt);
      else p.addLine(pt);
    }
    dc.addPath(p);
    dc.setStrokeColor(color);
    dc.setLineWidth(line);
    dc.strokePath();
  };
  // Màn hình khóa tự tô một màu, nên phần nền dùng màu mờ hơn.
  arc(0, 1, new Color('#ffffff', 0.25));
  const r = Math.max(0, Math.min(1, ratio));
  if (r > 0) arc(0, r, Color.white());
  return dc.getImage();
}

function text(stack, s, size, color = ink, weight = 'regular') {
  const t = stack.addText(s);
  t.font = weight === 'bold' ? Font.semiboldSystemFont(size) : Font.systemFont(size);
  t.textColor = color;
  t.lineLimit = 1;
  return t;
}

function header(stack, d, stale) {
  text(stack, `fina · ngày ${d.day}/${d.totalDays}${stale ? ' · cũ' : ''}`, 11, muted);
}

function leftRatio(d) {
  return d.limitVnd > 0 ? d.leftVnd / d.limitVnd : 0;
}

function small(w, d, stale) {
  header(w, d, stale);
  w.addSpacer();
  text(w, 'Còn lại', 11, muted);
  const big = text(w, k(d.leftVnd), 30, ink, 'bold');
  big.minimumScaleFactor = 0.6;
  text(w, `/ ${k(d.limitVnd)} nghìn`, 11, muted);
  w.addSpacer();
  w.addImage(bar(126, d.limitVnd > 0 ? d.spentVnd / d.limitVnd : 0)).imageSize = new Size(126, 6);
  w.addSpacer(6);
  text(w, `~${k(d.perDayVnd)} / ngày còn lại`, 11, muted);
}

function medium(w, d, stale) {
  const row = w.addStack();
  row.layoutHorizontally();

  const left = row.addStack();
  left.layoutVertically();
  left.size = new Size(104, 0);
  header(left, d, stale);
  left.addSpacer();
  text(left, 'Còn lại', 11, muted);
  const big = text(left, k(d.leftVnd), 26, ink, 'bold');
  big.minimumScaleFactor = 0.6;
  text(left, `Đã tiêu ${k(d.spentVnd)}`, 11, muted);
  left.addSpacer();
  text(left, `~${k(d.perDayVnd)} / ngày`, 11, muted);

  row.addSpacer(14);

  const right = row.addStack();
  right.layoutVertically();
  right.addSpacer();
  const list = d.buckets.slice(0, 6);
  list.forEach((b, i) => {
    const line = right.addStack();
    line.layoutHorizontally();
    line.centerAlignContent();
    const name = line.addStack();
    name.size = new Size(54, 0);
    text(name, b.name, 11);
    line.addSpacer(6);
    const ratio = b.limitVnd ? b.usedVnd / b.limitVnd : 0;
    line.addImage(bar(64, ratio)).imageSize = new Size(64, 6);
    line.addSpacer();
    const over = b.limitVnd != null && b.usedVnd > b.limitVnd;
    text(
      line,
      b.limitVnd != null ? `${k(b.usedVnd)}/${k(b.limitVnd)}` : k(b.usedVnd),
      11,
      over ? ink : muted,
      over ? 'bold' : 'regular',
    );
    if (i < list.length - 1) right.addSpacer(5);
  });
  right.addSpacer();
}

function lockRect(w, d) {
  const row = w.addStack();
  row.layoutHorizontally();
  row.centerAlignContent();
  row.addImage(ring(40, leftRatio(d))).imageSize = new Size(40, 40);
  row.addSpacer(8);
  const col = row.addStack();
  col.layoutVertically();
  const big = text(col, k(d.leftVnd), 18, Color.white(), 'bold');
  big.minimumScaleFactor = 0.6;
  text(col, `còn lại · ~${k(d.perDayVnd)}/ngày`, 11, Color.white());
}

function lockCircle(w, d) {
  const z = w.addStack();
  z.backgroundImage = ring(56, leftRatio(d), 4);
  z.size = new Size(56, 56);
  z.centerAlignContent();
  const t = text(z, k(d.leftVnd), 12, Color.white(), 'bold');
  t.minimumScaleFactor = 0.5;
}

function message(w, s) {
  text(w, 'fina', 11, muted);
  w.addSpacer();
  const t = w.addText(s);
  t.font = Font.systemFont(12);
  t.textColor = ink;
}

// ---------- chạy ----------

async function build(family) {
  const w = new ListWidget();
  const lock = family && family.startsWith('accessory');
  if (!lock) {
    w.backgroundColor = bg;
    w.setPadding(14, 16, 14, 16);
  }
  w.url = OPEN_URL;
  w.refreshAfterDate = new Date(Date.now() + REFRESH_MIN * 60_000);

  const token = Keychain.contains(KEY) ? Keychain.get(KEY) : null;
  if (!token) {
    message(w, 'Mở Scriptable và chạy script "fina" để nhập token.');
    return w;
  }

  const res = await load(token);
  if (res.error) {
    message(w, lock ? 'fina: lỗi' : `Không tải được.\n${res.error}`);
    return w;
  }

  const d = res.data;
  if (family === 'medium' || family === 'large') medium(w, d, res.stale);
  else if (family === 'accessoryRectangular') lockRect(w, d);
  else if (family === 'accessoryCircular') lockCircle(w, d);
  else if (family === 'accessoryInline') text(w, `fina ${k(d.leftVnd)} còn lại`, 12, Color.white());
  else small(w, d, res.stale);
  return w;
}

if (config.runsInWidget) {
  Script.setWidget(await build(config.widgetFamily));
} else {
  // Chạy trong app: lần đầu hỏi token, sau đó cho xem thử từng cỡ.
  if (!Keychain.contains(KEY)) await askToken();
  const a = new Alert();
  a.title = 'fina widget';
  a.addAction('Xem cỡ nhỏ');
  a.addAction('Xem cỡ vừa');
  a.addAction('Đổi token');
  a.addCancelAction('Đóng');
  const pick = await a.present();
  if (pick === 0) await (await build('small')).presentSmall();
  if (pick === 1) await (await build('medium')).presentMedium();
  if (pick === 2) await askToken();
}
Script.complete();
