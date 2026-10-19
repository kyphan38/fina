import Link from 'next/link';

// In-app guide, in Vietnamese on purpose: it is the one place where long copy
// is allowed (AGENTS.md, UI copy exception). Keep it in sync when a flow changes.

const SECTIONS = [
  { id: 'model', title: 'Cách app nghĩ về tiền' },
  { id: 'log', title: 'Ghi chi tiêu' },
  { id: 'cover', title: 'Khi bucket bị vượt' },
  { id: 'history', title: 'History' },
  { id: 'summary', title: 'Summary' },
  { id: 'payday', title: 'Ngày 25: đóng sổ và chia lương' },
  { id: 'debt', title: 'Mượn và trả nợ' },
  { id: 'widget', title: 'Widget' },
  { id: 'settings', title: 'Settings và sao lưu' },
] as const;

export default function GuidePage() {
  return (
    <article className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-x-none pb-16 pt-6 text-sm leading-relaxed">
      <header className="flex items-baseline justify-between">
        <h1 className="text-lg font-semibold">Hướng dẫn</h1>
        <Link href="/settings" className="text-xs text-muted hover:text-ink active:text-ink">
          ← Settings
        </Link>
      </header>

      <nav className="mt-6">
        <ol className="flex flex-col gap-1 text-muted">
          {SECTIONS.map((s, n) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className="hover:text-ink">
                <span className="inline-block w-5 text-faint">{n + 1}</span>
                {s.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <Section id="model">
        <P>Mỗi đồng tiền nằm trong một <B>hũ</B> (bucket). Có ba nơi:</P>
        <Rows
          rows={[
            ['VCB - Monthly', 'Chi tiêu hằng tháng: Food, Beauty, Social, Tech, Utilities, Buffer. Mỗi chu kỳ có một hạn mức, hết chu kỳ thì làm lại từ đầu.'],
            ['BIDV - Funds', 'Quỹ để dành: Travel, Purchases, Reserve, Health, Emergency và các Goal. Số dư cộng dồn qua các tháng.'],
            ['VPS', 'ETF. Tiền đầu tư, không tính là chi tiêu.'],
          ]}
        />
        <P>
          <B>Chu kỳ</B> chạy từ ngày 25 đến ngày 24 tháng sau, và mang tên tháng kết thúc. Ví dụ, chu kỳ
          October là từ 25/9 đến 24/10.
        </P>
        <P>Hai con số cần phân biệt:</P>
        <Rows
          rows={[
            ['Standard', 'Mức bình thường của một bucket. Sửa trong Settings. Dùng làm số gợi ý cho chu kỳ mới.'],
            ['Limit', 'Hạn mức của riêng chu kỳ này. Đặt ở Generator, hoặc Summary → Edit limits. Sửa Standard không làm đổi Limit đã chốt.'],
          ]}
        />
        <P>
          App theo dõi <B>hũ tiền</B>, không theo dõi số dư ngân hàng. Nếu ghi đủ mọi khoản thì hai bên vẫn
          khớp nhau.
        </P>
      </Section>

      <Section id="log">
        <List
          items={[
            <>Chọn bucket, gõ số tiền, bấm Save.</>,
            <>
              Số tiền tính theo <B>nghìn đồng</B>: <Code>45</Code> = 45.000đ, <Code>1,5</Code> = 1.500đ.
            </>,
            <>
              Có thể cộng trừ trong một lần ghi: <Code>25+30-4</Code> = 51.000đ.
            </>,
            <>
              Nút <B>OUT / IN</B>. OUT là chi tiền. IN là <B>tiền vào lại</B> (hoàn tiền, bạn bè trả lại,
              mượn tiền). IN sẽ trừ vào số đã tiêu của bucket đó.
            </>,
            <>Ghi chú không bắt buộc, nhưng nên ghi cho khoản lớn hoặc khoản lạ.</>,
            <>
              Trên Mac: phím mũi tên để chọn bucket, số để gõ tiền, <Code>f</Code> để đổi OUT/IN,{' '}
              <Code>Enter</Code> để lưu, <Code>Esc</Code> để xoá.
            </>,
          ]}
        />
      </Section>

      <Section id="cover">
        <P>
          Nếu một khoản chi làm bucket vượt hạn mức, app vẫn lưu khoản đó. Sau đó app hỏi bạn muốn lấy tiền
          ở đâu để <B>cover</B> (bù vào phần vượt).
        </P>
        <List
          items={[
            <>Buffer luôn được gợi ý đầu tiên, sau đó mới tới các quỹ BIDV.</>,
            <>
              Nếu lấy từ BIDV sang VCB, bạn phải chuyển khoản thật. App hiện một dải nhắc ở dưới màn hình cho
              đến khi bạn xác nhận đã chuyển.
            </>,
            <>Bỏ qua cũng được. Bucket sẽ hiện màu đỏ, và cuối chu kỳ sẽ bị tính là vượt.</>,
          ]}
        />
      </Section>

      <Section id="history">
        <List
          items={[
            <>
              <B>Entries</B>: toàn bộ giao dịch của chu kỳ. Lọc theo chu kỳ và bucket. Bấm vào một dòng để
              sửa bucket, OUT/IN, ngày giờ, ghi chú, hoặc xoá.
            </>,
            <>
              <B>MoMo</B>: nhập lịch sử MoMo, kiểm tra từng dòng rồi mới lưu.
            </>,
            <>
              <B>Trends</B>: Buffer 6 chu kỳ gần nhất, xu hướng của từng bucket, và nhận xét do AI viết.
            </>,
          ]}
        />
      </Section>

      <Section id="summary">
        <Rows
          rows={[
            ['Notes', 'Ghi chú tự do, mặc định đóng. Khi đóng vẫn hiện dòng đầu tiên. Dùng để ghi nợ và những việc cần nhớ.'],
            ['VCB - Monthly', 'Đã dùng / hạn mức của từng bucket. Edit limits chỉ sửa chu kỳ này.'],
            ['BIDV - Funds', 'Số dư từng quỹ. Dấu + để nạp thêm tiền, Move để chuyển tiền giữa các quỹ (không tính là chi tiêu).'],
            ['Goals', 'Quỹ có mục tiêu: cần bao nhiêu mỗi tháng, đang nhanh hay chậm. Close khi đã mua xong.'],
            ['VPS', 'Ghi lại mỗi lần nạp ETF.'],
            ['Plan next cycle', 'Mở Generator để chia lương.'],
          ]}
        />
        <P>Biểu tượng bánh răng ở góc trên mở Settings.</P>
      </Section>

      <Section id="payday">
        <Steps
          items={[
            <>
              <B>Đóng sổ.</B> Sang ngày 25, Summary hiện màn hình đóng chu kỳ. Nếu còn dư, chọn chuyển phần dư
              vào ETF, Reserve, hoặc giữ lại (Hold). Bấm Close thì chu kỳ mới mới mở.
            </>,
            <>
              <B>Chia lương.</B> Plan next cycle → nhập số tiền cần chia → kiểm tra từng dòng → Apply.
            </>,
            <>
              Apply làm ba việc cùng lúc: ghi khoản lương, chốt hạn mức VCB, và nạp tiền vào từng quỹ BIDV.
              Bấm Apply lần hai sẽ ghi đè, không bị cộng dồn.
            </>,
            <>
              <B>ETF thì tự làm.</B> Generator chỉ hiện phần còn lại. Bạn chuyển sang VPS rồi ghi vào Summary →
              VPS.
            </>,
            <>Chuyển khoản thật giữa VCB và BIDV cho khớp với số đã chia.</>,
          ]}
        />
      </Section>

      <Section id="debt">
        <P>
          App chưa có mục &quot;Nợ&quot; riêng. Cách làm dưới đây giúp app luôn khớp với tài khoản ngân hàng.
        </P>
        <Rows
          rows={[
            ['Khi mượn', 'Ghi IN vào đúng bucket hoặc quỹ đã dùng tiền mượn, ghi chú "Mượn <ai> <bao nhiêu>". Dùng tab Log, đừng dùng dấu + ở Summary.'],
            ['Khi tiêu', 'Ghi OUT như bình thường.'],
            ['Ghi nhớ', 'Thêm một dòng vào Notes ở Summary: ai, bao nhiêu, ngày nào.'],
            ['Khi trả', 'Ghi OUT vào cùng bucket đã ghi IN, ghi chú "Trả <ai>". Xoá dòng đó trong Notes.'],
          ]}
        />
        <P>
          <B>Ngày lương, nếu trả nợ:</B> trong Generator (hoặc Edit limits), cộng số tiền trả nợ vào hạn mức
          của bucket đó. Ví dụ: Beauty 1.000 + trả nợ 7.000 = 8.000. Như vậy khoản OUT trả nợ không làm bucket
          bị vượt. Sau đó mới chia phần còn lại vào các quỹ.
        </P>
        <P>
          Đừng ghi IN vào một bucket khác với bucket đã tiêu. Tổng vẫn đúng, nhưng một bucket sẽ bị âm, còn
          bucket kia trông như sắp hết tiền.
        </P>
      </Section>

      <Section id="widget">
        <P>
          Widget Scriptable trên màn hình chính hiện: ngày trong chu kỳ, tiền <B>còn lại</B> (tổng hạn mức trừ
          số đã tiêu), số đã tiêu, mức có thể tiêu mỗi ngày, và từng bucket VCB.
        </P>
        <P>Một bucket hiện số âm nghĩa là tiền vào (IN) nhiều hơn tiền chi.</P>
      </Section>

      <Section id="settings">
        <List
          items={[
            <>Theme, Standard của từng bucket, và mô tả bucket (bấm vào tên để sửa).</>,
            <>Nhắc nhở: thông báo lúc 22:00 nếu đã hai ngày không ghi gì. Cần cài app ra màn hình chính.</>,
            <>
              <B>Sao lưu:</B> Export JSON (toàn bộ) hoặc CSV. App nhắc nếu đã hơn 35 ngày chưa export.
              Restore chỉ thêm những gì còn thiếu, không ghi đè, không xoá.
            </>,
          ]}
        />
      </Section>
    </article>
  );
}

function Section({ id, children }: { id: (typeof SECTIONS)[number]['id']; children: React.ReactNode }) {
  const n = SECTIONS.findIndex((s) => s.id === id);
  return (
    <section id={id} className="mt-10 scroll-mt-4 border-t border-line pt-3">
      <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.09em] text-faint">
        {n + 1} · {SECTIONS[n].title}
      </h2>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p>{children}</p>;
}

function B({ children }: { children: React.ReactNode }) {
  return <b className="font-semibold">{children}</b>;
}

function Code({ children }: { children: React.ReactNode }) {
  return <code className="rounded bg-sunk px-1 py-0.5 text-[12px]">{children}</code>;
}

function List({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {items.map((item, n) => (
        <li key={n} className="flex gap-2.5">
          <span aria-hidden className="text-faint">
            ·
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function Steps({ items }: { items: React.ReactNode[] }) {
  return (
    <ol className="flex flex-col gap-2">
      {items.map((item, n) => (
        <li key={n} className="flex gap-2.5">
          <span className="w-4 shrink-0 text-faint">{n + 1}</span>
          <span>{item}</span>
        </li>
      ))}
    </ol>
  );
}

function Rows({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="divide-y divide-line border-y border-line">
      {rows.map(([term, desc]) => (
        <div key={term} className="py-2 min-[600px]:flex min-[600px]:gap-4">
          <dt className="font-medium min-[600px]:w-36 min-[600px]:shrink-0">{term}</dt>
          <dd className="text-muted">{desc}</dd>
        </div>
      ))}
    </dl>
  );
}
