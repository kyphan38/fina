import Link from 'next/link';

// In-app guide, in Vietnamese on purpose: it is the one place where long copy
// is allowed (AGENTS.md, UI copy exception). Keep it in sync when a flow changes.

const SECTIONS = [
  { id: 'model', title: 'Cách app nghĩ về tiền' },
  { id: 'log', title: 'Ghi chi tiêu' },
  { id: 'cover', title: 'Khi bucket bị vượt' },
  { id: 'recurring', title: 'Khoản định kỳ' },
  { id: 'history', title: 'History' },
  { id: 'summary', title: 'Summary' },
  { id: 'payday', title: 'Ngày lương: đóng sổ và chia lương' },
  { id: 'debt', title: 'People: mượn, ứng, chi hộ' },
  { id: 'widget', title: 'Widget' },
  { id: 'settings', title: 'Settings, bucket và sao lưu' },
] as const;

export default function GuidePage() {
  return (
    <article className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-x-none pb-16 pt-6 text-sm leading-relaxed">
      <header className="flex items-baseline justify-between">
        <h1 className="text-xl font-semibold">Hướng dẫn</h1>
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
          <B>Chu kỳ</B> bắt đầu từ ngày nhận lương và mang tên tháng kết thúc. Ngày nhận lương là ngày 25.
          Nếu ngày 25 rơi vào thứ 7 hoặc chủ nhật thì là thứ 6 trước đó. Ví dụ: 25/10/2026 là chủ nhật, nên
          chu kỳ November bắt đầu từ thứ 6, 23/10.
        </P>
        <P>
          Lương về sớm vì lý do khác (Tết, lễ): trong tuần trước ngày bắt đầu, Summary có nút{' '}
          <B>Paid today?</B>. Bấm Start thì chu kỳ mới bắt đầu hôm nay, và các khoản đã ghi hôm nay được chuyển
          sang chu kỳ mới.
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
              Có thể cộng trừ trong một lần ghi: <Code>25+30-4</Code> = 51.000đ. Phép tính được lưu lại và hiện mờ
              dưới số tiền trong History.
            </>,
            <>
              Hàng nút nhỏ trên ô Note: <B>số tiền hay dùng</B> của bucket đang chọn (ghi ít nhất 2 lần trong 60
              ngày). Chạm vào ô Note thì hàng này đổi thành <B>note hay viết</B>. Bấm một nút để điền.
            </>,
            <>
              Bấm vào số <B>left</B> ở trên cùng để xem tổng tiền đang có ở BIDV (quỹ và goals). Bấm lại để quay về.
            </>,
            <>
              Nút <B>OUT / IN</B>. OUT là chi tiền. IN là <B>tiền vào lại</B> (hoàn tiền, bạn bè trả lại).
              IN sẽ trừ vào số đã tiêu của bucket đó. Tiền mượn thì ghi ở People, không ghi IN vào bucket.
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
            <>
              Thứ tự gợi ý: Buffer, rồi các bucket VCB còn dư (ví dụ Beauty bù cho Food, không cần chuyển
              khoản), rồi các quỹ BIDV.
            </>,
            <>
              Nếu lấy từ BIDV sang VCB, bạn phải chuyển khoản thật. App hiện một dải nhắc ở dưới màn hình cho
              đến khi bạn xác nhận đã chuyển.
            </>,
            <>Bỏ qua cũng được. Bucket sẽ hiện màu đỏ, và cuối chu kỳ sẽ bị tính là vượt.</>,
          ]}
        />
      </Section>

      <Section id="recurring">
        <P>
          Tiền nhà, điện thoại, gói tháng... Thêm ở <B>Settings → Recurring</B>: tên, bucket, số tiền, ngày trong
          tháng.
        </P>
        <List
          items={[
            <>Đến ngày đó, đầu màn Log hiện một dòng, ví dụ &quot;Rent 3.000 · log · skip&quot;.</>,
            <>
              <B>log</B> điền sẵn bucket, số tiền và note. Bạn bấm Save như bình thường (vẫn có cover và Undo).
            </>,
            <><B>skip</B> ẩn khoản đó đến chu kỳ sau, không ghi gì.</>,
            <>App không bao giờ tự ghi.</>,
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
              Dòng People mặc định bị ẩn, tổng chỉ tính chi tiêu. Bấm <B>+N people</B> để hiện. Trong bộ lọc có
              nhóm <B>People</B>: chọn một người thì chỉ hiện các dòng của người đó, cuối danh sách là số dư hiện tại.
            </>,
            <>
              <B>search</B>: tìm trên mọi chu kỳ. Gõ chữ để tìm theo note hoặc tên bucket (không cần dấu). Gõ số để
              tìm theo số tiền, ví dụ <Code>35</Code> = 35.000đ. Có tổng tiền ở cuối.
            </>,
            <>
              <B>MoMo</B>: nhập lịch sử MoMo, kiểm tra từng dòng rồi mới lưu. Nếu sau khi lưu có bucket bị vượt, app hỏi lấy tiền từ đâu cho từng bucket.
            </>,
            <>
              <B>Trends</B>: Buffer 6 chu kỳ gần nhất, xu hướng của từng bucket, <B>Last N cycles</B> (trung bình,
              chu kỳ cao nhất và tổng của từng bucket, chỉ tính chu kỳ đã đóng), và nhận xét do AI viết.
            </>,
          ]}
        />
      </Section>

      <Section id="summary">
        <Rows
          rows={[
            ['People', 'Ai đang nợ ai: chỉ những người có số dư khác 0. Người đã xong hiện mờ ở dòng "settled". Bấm vào một người để xem lịch sử, Count as spending, hoặc Archive. Dòng "Bank holds ... more than the buckets" cho biết tài khoản ngân hàng có nhiều (hoặc ít) hơn tổng các bucket bao nhiêu, vì tiền của người khác.'],
            ['Notes', 'Ghi chú tự do, mặc định đóng. Khi đóng vẫn hiện dòng đầu tiên. Dùng cho những việc cần nhớ.'],
            ['VCB - Monthly', 'Đã dùng / hạn mức của từng bucket. Edit limits chỉ sửa chu kỳ này. "out by 22": Food hoặc Utilities sẽ hết tiền vào ngày 22 nếu cứ chi như hiện tại.'],
            ['BIDV - Funds', 'Số dư từng quỹ. Dấu + để nạp thêm tiền, Move để chuyển tiền giữa các quỹ (không tính là chi tiêu).'],
            ['Goals', 'Quỹ có mục tiêu: cần bao nhiêu mỗi tháng, đang nhanh hay chậm. Close khi đã mua xong. Tạo goal ở Settings → Goals; "Plan a purchase" cho biết quỹ nào đủ tiền ngay hoặc cần để dành bao nhiêu mỗi tháng.'],
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
              <B>Đóng sổ.</B> Sang ngày lương, Summary hiện màn hình đóng chu kỳ. Nếu còn dư, chọn chuyển phần dư
              vào ETF, Reserve, hoặc giữ lại (Hold). Bấm Close thì chu kỳ mới mới mở.
            </>,
            <>
              <B>Chia lương.</B> Plan next cycle → nhập số tiền cần chia → kiểm tra từng dòng → Apply.
            </>,
            <>
              Nếu goals cần nhiều hơn ngân sách goals, bấm <B>fit to budget</B>: chia theo thứ tự ưu tiên của goals
              (goal đầu đủ trước). Vẫn sửa tay được trước khi Apply.
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
          <B>People</B> là tiền đi qua tay nhưng không phải chi tiêu của bạn: mượn, cho mượn, ứng tiền khám chờ bảo
          hiểm hoàn, ứng giùm team, giữ tiền chung cho chuyến đi. Khoản ghi vào People{' '}
          <B>không bao giờ</B> tính vào hạn mức, tổng chi, Trends, widget hay AI.
        </P>
        <Rows
          rows={[
            ['Số dư', 'Mỗi người có một số dư. Dương (+): họ nợ bạn. Âm (-): bạn nợ họ, hoặc đang giữ tiền của họ. 0: xong.'],
            ['Tạo người', 'Ở Log, hàng People dưới Funds, bấm "+ person", gõ tên (Mẹ, DV, Team, Bảo hiểm, Trip Đà Lạt).'],
            ['OUT', 'Tiền đi tới họ: cho mượn, ứng giùm, chi hộ, trả nợ. Dòng tên đổi thành "to Mẹ". Số dư tăng.'],
            ['IN', 'Tiền từ họ tới: mượn, được hoàn, họ trả, họ chuyển tiền chung. Dòng tên đổi thành "from Mẹ". Số dư giảm.'],
            ['Tài khoản', 'Khi chọn một người, chọn thêm VCB, BIDV hoặc Cash (tiền mặt), để đối chiếu ngân hàng cho đúng.'],
          ]}
        />
        <List
          items={[
            <>
              <B>Mượn rồi tiêu:</B> ghi IN ở người cho mượn. Tiêu thì ghi OUT vào bucket như bình thường. Tiền mượn
              không làm hạn mức rộng ra: tiêu quá thì bucket hiện vượt. Khi trả, ghi OUT ở người đó, không phải chi
              tiêu, nên tháng trả nợ bucket không bị vượt.
            </>,
            <>
              <B>Bảo hiểm hoàn thiếu:</B> ứng 1.200 (OUT ở Bảo hiểm), được hoàn 1.000 (IN). Còn +200. Ở Summary bấm
              vào Bảo hiểm → <B>Count as spending</B>, chọn bucket (ví dụ Health). App ghi 200 là chi tiêu của chu
              kỳ hiện tại và đưa số dư về 0. Hai dòng này đi cùng nhau: xoá một dòng thì dòng kia cũng bị xoá.
            </>,
            <>
              <B>Giữ tiền chung cho chuyến đi:</B> team chuyển 10.000 (IN ở Trip). Mỗi lần chi hộ ghi OUT ở Trip.
              Phần của bạn ghi vào quỹ Travel như chi tiêu bình thường. Cuối chuyến số dư về 0 là khớp.
            </>,
            <>
              Một dòng People không sửa được. Muốn sửa thì xoá ở History rồi ghi lại.
            </>,
            <>
              Khi số dư về 0, bấm vào người đó ở Summary → <B>Archive</B> để ẩn khỏi Log.
            </>,
          ]}
        />
      </Section>

      <Section id="widget">
        <P>
          Widget Scriptable trên màn hình chính hiện: ngày trong chu kỳ, tiền <B>còn lại</B> (tổng hạn mức trừ
          số đã tiêu), số đã tiêu, mức có thể tiêu mỗi ngày, và từng bucket VCB.
        </P>
        <P>
          Widget nhỏ hiện thêm 2 bucket gần hết hạn mức nhất. Widget vừa hiện 6 bucket; nếu có hơn 6 thì hiện 6
          bucket gần hết nhất.
        </P>
        <P>Một bucket hiện số âm nghĩa là tiền vào (IN) nhiều hơn tiền chi.</P>
        <P>
          Sau khi app cập nhật widget, dán lại file <Code>scriptable/fina-widget.js</Code> vào app Scriptable.
        </P>
      </Section>

      <Section id="settings">
        <List
          items={[
            <>Theme, Standard của từng bucket, và mô tả bucket (bấm vào tên để sửa).</>,
            <>
              <B>add monthly bucket</B>: thêm một bucket VCB (ví dụ Parents). Có hiệu lực ngay chu kỳ này. Bấm vào
              tên bucket → <B>Hide</B> để ẩn: bucket biến mất khỏi Log và Generator, giao dịch cũ vẫn còn. Bucket
              ẩn hiện mờ trong Settings, bấm <B>show</B> để bật lại. Quỹ còn tiền thì không ẩn được.
            </>,
            <>
              <B>Salary</B> (cuối Settings): màn lương, mở bằng Face ID. Lần đầu trên một thiết bị thì bấm Set up
              Face ID.
            </>,
            <>Nhắc nhở: thông báo lúc 22:00 nếu đã hai ngày không ghi gì. Cần cài app ra màn hình chính.</>,
            <>
              <B>Sao lưu:</B> Google Cloud tự sao lưu mỗi ngày (giữ 7 ngày). Export JSON hoặc CSV là bản của riêng
              bạn; app nhắc nếu đã hơn 35 ngày chưa export. Restore chỉ thêm những gì còn thiếu, không ghi đè,
              không xoá.
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
      <h2 className="mb-3 text-[13px] font-medium text-muted">
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
