// components.jsx — all shared components for the gold pricing system

const { useState, useEffect, useMemo, useRef } = React;

// ───────────────────────── Formatting helpers ─────────────────────────
const fmt = (n, d = 2) =>
  Number(n || 0).toLocaleString('th-TH', {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  });
const fmtInt = (n) => Number(n || 0).toLocaleString('th-TH');

const THAI_MONTHS = [
  'มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน',
  'กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม',
];
const THAI_MONTHS_SHORT = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];

const formatThaiDate = (d, opts = {}) => {
  const date = d instanceof Date ? d : new Date(d);
  const day = date.getDate();
  const m = opts.shortMonth ? THAI_MONTHS_SHORT[date.getMonth()] : THAI_MONTHS[date.getMonth()];
  const y = date.getFullYear() + 543;
  const yStr = opts.shortYear ? String(y).slice(-2) : y;
  if (opts.withTime) {
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    return `${day} ${m} ${yStr}  ${hh}:${mm} น.`;
  }
  return `${day} ${m} ${yStr}`;
};

// ───────────────────────── Weight conversion ─────────────────────────
const GRAMS_PER_BAHT = 15.244;
const toBaht = (value, unit) => {
  const v = Number(value) || 0;
  if (unit === 'baht') return v;
  if (unit === 'salueng') return v / 4;
  if (unit === 'gram') return v / GRAMS_PER_BAHT;
  return v;
};

// ───────────────────────── Header ─────────────────────────
function SiteHeader({ shopName, shopEn }) {
  return (
    <header className="site-header">
      <div className="inner">
        <div className="brand">
          <div className="brand-mark"><span className="glyph">R</span></div>
          <div className="brand-text">
            <div className="name-th">{shopName}</div>
            <div className="name-en">{shopEn}</div>
          </div>
        </div>
        <div className="header-meta">
          <div className="label">วัน เดือน ปี</div>
          <div className="value">{formatThaiDate(new Date(), { withTime: true })}</div>
        </div>
      </div>
    </header>
  );
}

// ───────────────────────── Today's prices ─────────────────────────
function PricesSection({ prices, lastChange }) {
  const p = prices.bar;
  const delta = lastChange.bar || 0;
  const dir = delta >= 0 ? 'up' : 'down';
  return (
    <section>
      <div className="section-head">
        <div className="title">
          <span className="index">No. I.</span>
          <h2>ราคาทองคำแท่งวันนี้</h2>
        </div>
        <span className="meta">PRICE / BAHT · THB</span>
      </div>
      <div className="prices">
        <article className="price-card">
          <div className="type-label">GOLD BAR · ทองคำแท่ง</div>
          <h3 className="type-th">
            ทองคำแท่ง <span className="purity">96.5%</span>
          </h3>
          <div className={`delta ${dir}`}>
            <span className="arrow">{delta >= 0 ? '▲' : '▼'}</span>
            {delta >= 0 ? '+' : ''}{fmt(delta, 0)}
          </div>
          <div className="price-row">
            <div className="col buy">
              <div className="label">รับซื้อ</div>
              <div className="value">{fmt(p.buy, 0)}</div>
              <div className="unit">บาท / ทองหนัก ๑ บาท</div>
            </div>
            <div className="col sell">
              <div className="label">ขายออก</div>
              <div className="value">{fmt(p.sell, 0)}</div>
              <div className="unit">บาท / ทองหนัก ๑ บาท</div>
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}

// ───────────────────────── Chart ─────────────────────────
function PriceChart({ data, range, setRange }) {
  const [hover, setHover] = useState(null);
  const w = 1180, h = 220, padL = 50, padR = 10, padT = 16, padB = 26;
  const slice = useMemo(() => {
    const map = { '7': 7, '30': 30, '90': 90, '365': 365 };
    const n = Math.min(map[range] || 30, data.length);
    return data.slice(-n);
  }, [data, range]);

  const { min, max, points, area } = useMemo(() => {
    const vals = slice.map((d) => d.value);
    const mn = Math.min(...vals);
    const mx = Math.max(...vals);
    const pad = (mx - mn) * 0.2 || 100;
    const minV = mn - pad, maxV = mx + pad;
    const innerW = w - padL - padR;
    const innerH = h - padT - padB;
    const pts = slice.map((d, i) => {
      const x = padL + (i / Math.max(slice.length - 1, 1)) * innerW;
      const y = padT + (1 - (d.value - minV) / (maxV - minV)) * innerH;
      return { x, y, ...d };
    });
    const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    const ar = `${line} L${pts[pts.length-1].x},${h - padB} L${pts[0].x},${h - padB} Z`;
    return { min: minV, max: maxV, points: pts, area: ar, line };
  }, [slice]);

  const lineD = points.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  const first = slice[0]?.value ?? 0;
  const last = slice[slice.length - 1]?.value ?? 0;
  const change = last - first;
  const changePct = first ? (change / first) * 100 : 0;
  const highVal = Math.max(...slice.map((d) => d.value));
  const lowVal = Math.min(...slice.map((d) => d.value));

  const onMove = (e) => {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * w;
    const innerW = w - padL - padR;
    const ratio = Math.max(0, Math.min(1, (x - padL) / innerW));
    const idx = Math.round(ratio * (slice.length - 1));
    setHover(points[idx]);
  };

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => {
    const y = padT + t * (h - padT - padB);
    const v = max - t * (max - min);
    return { y, v };
  });

  return (
    <section>
      <div className="section-head">
        <div className="title">
          <span className="index">No. III.</span>
          <h2>ราคาย้อนหลัง — ทองคำแท่ง ขายออก</h2>
        </div>
        <span className="meta">HISTORICAL · THB / BAHT</span>
      </div>
      <div className="chart-card">
        <div className="chart-header">
          <div>
            <div className="chart-title">ความเคลื่อนไหวของราคาในช่วงที่เลือก</div>
          </div>
          <div className="chart-controls">
            {[
              ['7', '๗ วัน'],
              ['30', '๓๐ วัน'],
              ['90', '๓ เดือน'],
              ['365', '๑ ปี'],
            ].map(([k, l]) => (
              <button key={k} className={range === k ? 'active' : ''} onClick={() => setRange(k)}>{l}</button>
            ))}
          </div>
        </div>
        <svg className="chart-svg" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
          <defs>
            <linearGradient id="goldArea" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#e6c779" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#e6c779" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="goldLine" x1="0" x2="1">
              <stop offset="0%" stopColor="#c9a24a" />
              <stop offset="50%" stopColor="#fae4b3" />
              <stop offset="100%" stopColor="#c9a24a" />
            </linearGradient>
          </defs>
          {ticks.map((t, i) => (
            <g key={i}>
              <line x1={padL} x2={w - padR} y1={t.y} y2={t.y} stroke="#3d3120" strokeWidth="1" strokeDasharray={i === 0 || i === 4 ? '0' : '2 4'} />
              <text x={padL - 8} y={t.y + 4} fill="#9c8b6a" fontSize="10" textAnchor="end" fontFamily="var(--mono)">{fmt(t.v, 0)}</text>
            </g>
          ))}
          <path d={area} fill="url(#goldArea)" />
          <path d={lineD} stroke="url(#goldLine)" strokeWidth="1.75" fill="none" />
          {hover && (
            <g>
              <line x1={hover.x} x2={hover.x} y1={padT} y2={h - padB} stroke="#e6c779" strokeOpacity="0.5" strokeDasharray="2 3" />
              <circle cx={hover.x} cy={hover.y} r="4" fill="#fae4b3" stroke="#1a1208" strokeWidth="1.5" />
              <g transform={`translate(${Math.min(hover.x + 10, w - 150)}, ${Math.max(hover.y - 30, padT)})`}>
                <rect width="140" height="40" fill="#15110b" stroke="#50412a" />
                <text x="10" y="16" fill="#d8c89e" fontSize="11" fontFamily="var(--serif-th)">{formatThaiDate(hover.date, { shortMonth: true, shortYear: true })}</text>
                <text x="10" y="32" fill="#f4dba0" fontSize="13" fontFamily="var(--mono)" fontWeight="500">{fmtInt(hover.value)} บาท</text>
              </g>
            </g>
          )}
          <text x={padL} y={h - 8} fill="#9c8b6a" fontSize="10" fontFamily="var(--serif-th)">{formatThaiDate(slice[0]?.date, { shortMonth: true })}</text>
          <text x={w - padR} y={h - 8} fill="#9c8b6a" fontSize="10" textAnchor="end" fontFamily="var(--serif-th)">{formatThaiDate(slice[slice.length-1]?.date, { shortMonth: true })}</text>
        </svg>
        <div className="chart-stats">
          <span>เปลี่ยนแปลง <b style={{color: change >= 0 ? 'var(--up)' : 'var(--down)'}}>{change >= 0 ? '+' : ''}{fmt(change, 0)} ({changePct >= 0 ? '+' : ''}{fmt(changePct, 2)}%)</b></span>
          <span>สูงสุด <b>{fmt(highVal, 0)}</b></span>
          <span>ต่ำสุด <b>{fmt(lowVal, 0)}</b></span>
          <span>ปัจจุบัน <b style={{color:'var(--gold-bright)'}}>{fmt(last, 0)}</b></span>
        </div>
      </div>
    </section>
  );
}

// ───────────────────────── Calculator ─────────────────────────
function Calculator({ prices, onCommit }) {
  const [mode, setMode] = useState('sell');    // sell | buy
  const type = 'bar';                          // เฉพาะทองคำแท่ง
  const [weight, setWeight] = useState('1');
  const [unit, setUnit] = useState('baht');    // baht | salueng | gram
  const [discount, setDiscount] = useState('0');

  const weightBaht = toBaht(weight, unit);

  const calc = useMemo(() => {
    const p = prices[type];
    const pricePerBaht = mode === 'sell' ? p.sell : p.buy;
    const basePrice = pricePerBaht * weightBaht;
    const total = basePrice - Number(discount || 0);
    const descAction = mode === 'sell' ? 'ขายทองให้ลูกค้า' : 'รับซื้อทองจากลูกค้า';
    return { pricePerBaht, basePrice, laborFee: 0, oldBuy: 0, total, descAction };
  }, [mode, weight, unit, discount, prices, weightBaht]);

  const canCommit = weightBaht > 0 && calc.total !== 0 && !isNaN(calc.total);

  const commit = () => {
    if (!canCommit) return;
    onCommit({
      mode, type, weight: Number(weight), unit, weightBaht,
      pricePerBaht: calc.pricePerBaht,
      labor: 0, laborFee: 0,
      basePrice: calc.basePrice,
      discount: Number(discount || 0),
      oldType: null, oldWeight: 0, oldUnit: null, oldWeightBaht: 0, oldPricePerBaht: 0, oldBuy: 0,
      total: calc.total,
      descAction: calc.descAction,
    });
  };

  return (
    <section>
      <div className="section-head">
        <div className="title">
          <span className="index">No. II.</span>
          <h2>คำนวณราคา</h2>
        </div>
        <span className="meta">CALCULATOR · GOLD BAR</span>
      </div>
      <div className="calc-layout">
        <div className="calc-form">
          <div className="field-group">
            <div className="field">
              <label><span className="th">ประเภทรายการ</span> Transaction</label>
              <div className="seg">
                <button className={mode === 'sell' ? 'active' : ''} onClick={() => setMode('sell')}>ขายให้ลูกค้า</button>
                <button className={mode === 'buy' ? 'active' : ''} onClick={() => setMode('buy')}>รับซื้อจากลูกค้า</button>
              </div>
            </div>

            <div className="field">
              <label><span className="th">น้ำหนักทองคำแท่ง</span> Weight</label>
              <div className="weight-input">
                <input
                  type="text"
                  inputMode="decimal"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value.replace(/[^0-9.]/g, ''))}
                  placeholder="0.00"
                />
                <div className="unit-pick">
                  <button className={unit === 'baht' ? 'active' : ''} onClick={() => setUnit('baht')}>บาท</button>
                  <button className={unit === 'salueng' ? 'active' : ''} onClick={() => setUnit('salueng')}>สลึง</button>
                  <button className={unit === 'gram' ? 'active' : ''} onClick={() => setUnit('gram')}>กรัม</button>
                </div>
              </div>
              <div style={{fontSize:11, color:'var(--text-mute)', marginTop:6, fontFamily:'var(--mono)', letterSpacing:'0.05em'}}>
                = {fmt(weightBaht, 4)} บาท · {fmt(weightBaht * GRAMS_PER_BAHT, 3)} ก.
              </div>
            </div>

            <div className="extra-grid">
              <div className="field">
                <label><span className="th">ส่วนลด</span> Discount</label>
                <div className="simple-input">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value.replace(/[^0-9]/g, ''))}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="calc-result">
          <div className="result-eyebrow">{calc.descAction}</div>
          <div className="result-title">
            ยอดรวม{mode === 'buy' ? 'รับซื้อ' : 'ที่ลูกค้าต้องชำระ'}
          </div>
          <div className={`result-amount ${calc.total <= 0 ? 'zero' : ''}`}>
            <span className="baht-sign">฿</span>{fmt(Math.max(calc.total, 0), 2)}
          </div>
          <div className="result-sub">
            น้ำหนักทองคำ {fmt(weightBaht, 4)} บาท ({fmt(weightBaht * GRAMS_PER_BAHT, 3)} กรัม)
          </div>

          <div className="result-breakdown">
            <div className="row">
              <span>ราคาเนื้อทอง ({fmt(weightBaht, 4)} × {fmt(calc.pricePerBaht, 0)})</span>
              <span className="v">{fmt(calc.basePrice, 2)}</span>
            </div>
            {Number(discount) > 0 && (
              <div className="row">
                <span>ส่วนลด</span>
                <span className="v" style={{color:'var(--down)'}}>− {fmt(Number(discount), 2)}</span>
              </div>
            )}
            <div className="row total">
              <span>รวมสุทธิ</span>
              <span className="v">฿ {fmt(calc.total, 2)}</span>
            </div>
          </div>

          <div className="action-row">
            <button className="btn-primary" disabled={!canCommit} onClick={commit}>
              บันทึก &amp; ออกใบประเมิน
            </button>
            <button className="btn-ghost" onClick={() => { setWeight(''); setDiscount('0'); }}>
              ล้าง
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

// ───────────────────────── History ─────────────────────────
function HistorySection({ records, onLookup, query, setQuery }) {
  const [filter, setFilter] = useState('all');
  const filtered = useMemo(() => {
    let r = records;
    if (filter !== 'all') r = r.filter((x) => x.mode === filter);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      r = r.filter((x) =>
        x.code.toLowerCase().includes(q) ||
        formatThaiDate(x.timestamp, { shortMonth: true }).toLowerCase().includes(q),
      );
    }
    return r.slice().reverse();
  }, [records, query, filter]);

  return (
    <section className="history-section">
      <div className="section-head">
        <div className="title">
          <span className="index">No. IV.</span>
          <h2>ประวัติการคำนวณ</h2>
        </div>
        <span className="meta">LEDGER · {fmtInt(records.length)} รายการ</span>
      </div>

      <div className="history-search">
        <div className="search-input">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ค้นหารหัสรายการ เช่น GC-690513-0001"
          />
        </div>
        <div className="seg" style={{minWidth:280}}>
          <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>ทั้งหมด</button>
          <button className={filter === 'sell' ? 'active' : ''} onClick={() => setFilter('sell')}>ขาย</button>
          <button className={filter === 'buy' ? 'active' : ''} onClick={() => setFilter('buy')}>รับซื้อ</button>
          <button className={filter === 'trade' ? 'active' : ''} onClick={() => setFilter('trade')}>เปลี่ยน</button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="history-empty">
          <div className="symbol">∽</div>
          <div>{records.length === 0 ? 'ยังไม่มีรายการคำนวณ' : 'ไม่พบรายการที่ค้นหา'}</div>
        </div>
      ) : (
        <table className="history-table">
          <thead>
            <tr>
              <th>Code<span className="th">รหัสรายการ</span></th>
              <th>Date<span className="th">วัน เวลา</span></th>
              <th>Type<span className="th">รายการ</span></th>
              <th>Weight<span className="th">น้ำหนัก</span></th>
              <th>Price<span className="th">ราคาต่อบาท</span></th>
              <th style={{textAlign:'right'}}>Total<span className="th">ยอดรวม (บาท)</span></th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.code}>
                <td className="code">{r.code}</td>
                <td>{formatThaiDate(r.timestamp, { shortMonth: true, withTime: true })}</td>
                <td>
                  <span className={`badge ${r.mode}`}>
                    {r.mode === 'sell' ? 'ขายให้ลูกค้า' : r.mode === 'buy' ? 'รับซื้อ' : 'เปลี่ยน/ต่อ'}
                  </span>
                  <span className="badge bar" style={{marginLeft:6}}>{r.type === 'bar' ? 'แท่ง' : 'รูปพรรณ'}</span>
                </td>
                <td style={{fontFamily:'var(--mono)'}}>{fmt(r.weight, 2)} {r.unit === 'baht' ? 'บ.' : r.unit === 'salueng' ? 'สลึง' : 'ก.'}</td>
                <td style={{fontFamily:'var(--mono)'}}>{fmt(r.pricePerBaht, 0)}</td>
                <td className="amount">{fmt(r.total, 2)}</td>
                <td className="actions" style={{textAlign:'right'}}>
                  <button className="icon-btn" onClick={() => onLookup(r)}>ดู / พิมพ์</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

// ───────────────────────── Receipt modal ─────────────────────────
function Receipt({ record, shopName, onClose }) {
  if (!record) return null;
  const unitLabel = record.unit === 'baht' ? 'บาท' : record.unit === 'salueng' ? 'สลึง' : 'กรัม';
  const oldUnitLabel = record.oldUnit === 'baht' ? 'บาท' : record.oldUnit === 'salueng' ? 'สลึง' : 'กรัม';

  return (
    <div className="receipt-backdrop" onClick={onClose}>
      <div className="receipt" onClick={(e) => e.stopPropagation()}>
        <div className="receipt-header">
          <div className="receipt-mark">R</div>
          <div className="receipt-shop">{shopName}</div>
          <div className="receipt-sub">Ratanakarn Gold · Est. 2510</div>
          <div className="receipt-doc">ใบประเมินราคาทองคำ</div>
          <div className="receipt-code">{record.code}</div>
        </div>

        <div className="receipt-body">
          <div className="row"><span className="k">วัน เวลา</span><span className="v">{formatThaiDate(record.timestamp, { shortMonth: true, withTime: true })}</span></div>
          <div className="row"><span className="k">ประเภทรายการ</span><span className="v">{record.descAction}</span></div>
          <div className="row"><span className="k">ชนิดทอง</span><span className="v">{record.type === 'bar' ? 'ทองคำแท่ง 96.5%' : 'ทองรูปพรรณ 96.5%'}</span></div>
          <div className="row"><span className="k">น้ำหนัก</span><span className="v">{fmt(record.weight, 2)} {unitLabel} ({fmt(record.weightBaht, 4)} บาท)</span></div>
          <div className="row"><span className="k">ราคา/บาท</span><span className="v">{fmt(record.pricePerBaht, 2)}</span></div>
          <div className="row"><span className="k">ราคาเนื้อทอง</span><span className="v">{fmt(record.basePrice, 2)}</span></div>
          {record.laborFee > 0 && (
            <div className="row"><span className="k">ค่ากำเหน็จ ({fmtInt(record.labor)} × {fmt(record.weightBaht, 4)})</span><span className="v">+ {fmt(record.laborFee, 2)}</span></div>
          )}
          {record.mode === 'trade' && record.oldBuy > 0 && (
            <>
              <div className="row"><span className="k">ทองเก่านำมาเปลี่ยน</span><span className="v">{fmt(record.oldWeight, 2)} {oldUnitLabel} · {record.oldType === 'bar' ? 'แท่ง' : 'รูปพรรณ'}</span></div>
              <div className="row"><span className="k">มูลค่าทองเก่า (รับซื้อ)</span><span className="v">− {fmt(record.oldBuy, 2)}</span></div>
            </>
          )}
          {record.discount > 0 && (
            <div className="row"><span className="k">ส่วนลด</span><span className="v">− {fmt(record.discount, 2)}</span></div>
          )}
        </div>

        <div className="receipt-total">
          <span className="k">รวมสุทธิ</span>
          <span className="v">฿ {fmt(record.total, 2)}</span>
        </div>

        <div className="receipt-qr">
          <div className="qr-grid" aria-hidden></div>
          <div className="text">
            ตรวจสอบความถูกต้องของใบประเมินได้ที่
            <b>{record.code}</b>
            ราคาอ้างอิงประกาศจากสมาคมค้าทองคำ
          </div>
        </div>

        <div className="receipt-foot">
          ราคาอ้างอิงจากสมาคมค้าทองคำแห่งประเทศไทย<br/>
          ใบประเมินมีอายุ ๓๐ นาที นับจากเวลาที่ออก · ราคาทองคำมีการเปลี่ยนแปลงตลอดวัน<br/>
          ขอบพระคุณที่ใช้บริการ
        </div>

        <div className="receipt-actions">
          <button onClick={() => window.print()}>พิมพ์ใบประเมิน</button>
          <button className="close" onClick={onClose}>ปิด</button>
        </div>
      </div>
    </div>
  );
}

// ───────────────────────── Footer ─────────────────────────
function SiteFooter({ shopName }) {
  return (
    <footer className="site-foot">
      <div className="ornament-row">❖ &nbsp;&nbsp; ✦ &nbsp;&nbsp; ❖</div>
      <div>{shopName} · ห้างทองคำมาตรฐาน ๙๖.๕ %</div>
      <div style={{marginTop:6}}>ราคาอ้างอิงจากสมาคมค้าทองคำแห่งประเทศไทย · ระบบนี้ใช้สำหรับประเมินราคาเบื้องต้น</div>
    </footer>
  );
}

// Expose to window for app.jsx
Object.assign(window, {
  SiteHeader, PricesSection, PriceChart,
  Calculator, HistorySection, Receipt, SiteFooter,
  fmt, fmtInt, formatThaiDate, toBaht, GRAMS_PER_BAHT,
});
