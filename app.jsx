// app.jsx — root state, persistence, and composition

const { useState, useEffect, useMemo, useCallback } = React;

const STORAGE_HISTORY = 'gc_history_v1';
const STORAGE_COUNTER = 'gc_counter_v1';

// Editable defaults — Tweaks panel writes to this block.
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "shopName": "ห้างทอง รัตนกาญจน์",
  "shopEn": "Ratanakarn Gold · Est. 2510",
  "barBuy": 48250,
  "barSell": 48350,
  "jewelryBuy": 47402,
  "jewelrySell": 48850,
  "yesterdayBar": 48200,
  "yesterdayJewelry": 47950,
  "updatedAt": "๑๓ พ.ค. ๒๕๖๙   ๐๙.๑๕ น."
}/*EDITMODE-END*/;

// ───────────────────────── Mock 1-year chart series ─────────────────────────
function generateSeries(endValue, days = 365) {
  const out = [];
  let v = endValue * 0.85;
  let seed = 1234;
  const rand = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    const trend = ((days - i) / days) * (endValue - endValue * 0.85);
    const noise = (rand() - 0.5) * 250;
    const swing = Math.sin(i / 18) * 180;
    v = endValue * 0.85 + trend + noise + swing;
    out.push({ date, value: Math.round(v) });
  }
  out[out.length - 1].value = endValue;
  return out;
}

function makeCode(counter) {
  const d = new Date();
  const yy = String((d.getFullYear() + 543) % 100).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `GC-${yy}${mm}${dd}-${String(counter).padStart(4, '0')}`;
}

// ───────────────────────── App ─────────────────────────
function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [history, setHistory] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_HISTORY);
      return raw ? JSON.parse(raw) : seedHistory();
    } catch {
      return seedHistory();
    }
  });
  const [counter, setCounter] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_COUNTER);
      return raw ? Number(raw) : history.length + 1;
    } catch {
      return history.length + 1;
    }
  });
  const [activeReceipt, setActiveReceipt] = useState(null);
  const [range, setRange] = useState('30');
  const [query, setQuery] = useState('');

  const prices = useMemo(() => ({
    bar:     { buy: t.barBuy, sell: t.barSell },
    jewelry: { buy: t.jewelryBuy, sell: t.jewelrySell },
  }), [t.barBuy, t.barSell, t.jewelryBuy, t.jewelrySell]);

  const lastChange = useMemo(() => ({
    bar: t.barSell - t.yesterdayBar,
    jewelry: t.jewelrySell - t.yesterdayJewelry,
  }), [t.barSell, t.jewelrySell, t.yesterdayBar, t.yesterdayJewelry]);

  const chartData = useMemo(() => generateSeries(t.barSell, 365), [t.barSell]);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_HISTORY, JSON.stringify(history)); } catch {}
  }, [history]);
  useEffect(() => {
    try { localStorage.setItem(STORAGE_COUNTER, String(counter)); } catch {}
  }, [counter]);

  const handleCommit = useCallback((payload) => {
    const code = makeCode(counter);
    const record = { ...payload, code, timestamp: new Date().toISOString() };
    setHistory((h) => [...h, record]);
    setCounter((c) => c + 1);
    setActiveReceipt(record);
  }, [counter]);

  const handleLookup = (r) => setActiveReceipt(r);

  return (
    <>
      <SiteHeader shopName={t.shopName} shopEn={t.shopEn} />

      <main className="page">
        <PricesSection prices={prices} lastChange={lastChange} />
        <Calculator prices={prices} onCommit={handleCommit} />
        <PriceChart data={chartData} range={range} setRange={setRange} />
        <HistorySection
          records={history}
          onLookup={handleLookup}
          query={query}
          setQuery={setQuery}
        />
      </main>

      <SiteFooter shopName={t.shopName} />

      <Receipt
        record={activeReceipt}
        shopName={t.shopName}
        onClose={() => setActiveReceipt(null)}
      />

      <TweaksPanel title="Tweaks">
        <TweakSection label="ข้อมูลร้าน" />
        <TweakText  label="ชื่อร้าน"   value={t.shopName} onChange={(v) => setTweak('shopName', v)} />
        <TweakText  label="ชื่อ EN"    value={t.shopEn}   onChange={(v) => setTweak('shopEn', v)} />

        <TweakSection label="ราคาทองวันนี้ (บาทต่อทอง ๑ บาท)" />
        <TweakNumber label="ทองแท่ง รับซื้อ" value={t.barBuy}      step={50} onChange={(v) => setTweak('barBuy', v)} />
        <TweakNumber label="ทองแท่ง ขายออก" value={t.barSell}     step={50} onChange={(v) => setTweak('barSell', v)} />

        <TweakSection label="ราคาวานนี้ (สำหรับเทียบ ▲▼)" />
        <TweakNumber label="ทองแท่ง วานนี้"  value={t.yesterdayBar}     step={50} onChange={(v) => setTweak('yesterdayBar', v)} />

        <TweakSection label="ข้อมูล" />
        <TweakButton label="ล้างประวัติทั้งหมด" onClick={() => {
          if (confirm('ล้างประวัติการคำนวณทั้งหมด?')) {
            setHistory([]);
            setCounter(1);
          }
        }} />
      </TweaksPanel>
    </>
  );
}

// ───────────────────────── Seed history ─────────────────────────
function seedHistory() {
  const now = new Date();
  const mkAgo = (mins) => {
    const d = new Date(now); d.setMinutes(d.getMinutes() - mins);
    return d.toISOString();
  };
  return [
    {
      code: 'GC-690513-0001',
      timestamp: mkAgo(220),
      mode: 'sell', type: 'jewelry',
      weight: 1, unit: 'baht', weightBaht: 1,
      pricePerBaht: 48850, basePrice: 48850,
      labor: 500, laborFee: 500, discount: 0,
      oldBuy: 0, total: 49350, descAction: 'ขายทองให้ลูกค้า',
    },
    {
      code: 'GC-690513-0002',
      timestamp: mkAgo(180),
      mode: 'buy', type: 'jewelry',
      weight: 2, unit: 'baht', weightBaht: 2,
      pricePerBaht: 47402, basePrice: 94804,
      labor: 0, laborFee: 0, discount: 0,
      oldBuy: 0, total: 94804, descAction: 'รับซื้อทองจากลูกค้า',
    },
    {
      code: 'GC-690513-0003',
      timestamp: mkAgo(95),
      mode: 'sell', type: 'bar',
      weight: 5, unit: 'baht', weightBaht: 5,
      pricePerBaht: 48350, basePrice: 241750,
      labor: 0, laborFee: 0, discount: 250,
      oldBuy: 0, total: 241500, descAction: 'ขายทองให้ลูกค้า',
    },
    {
      code: 'GC-690513-0004',
      timestamp: mkAgo(42),
      mode: 'trade', type: 'jewelry',
      weight: 2, unit: 'baht', weightBaht: 2,
      pricePerBaht: 48850, basePrice: 97700,
      labor: 500, laborFee: 1000, discount: 0,
      oldType: 'jewelry', oldWeight: 1, oldUnit: 'baht', oldWeightBaht: 1,
      oldPricePerBaht: 47402, oldBuy: 47402,
      total: 51298, descAction: 'เปลี่ยน / ต่อทอง',
    },
    {
      code: 'GC-690513-0005',
      timestamp: mkAgo(12),
      mode: 'sell', type: 'jewelry',
      weight: 2, unit: 'salueng', weightBaht: 0.5,
      pricePerBaht: 48850, basePrice: 24425,
      labor: 500, laborFee: 250, discount: 0,
      oldBuy: 0, total: 24675, descAction: 'ขายทองให้ลูกค้า',
    },
  ];
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
