import { useState, useRef, useEffect, useCallback } from 'react';
import { searchCompanies } from '../data/companies.js';
import { useAuth } from '../context/AuthContext';
import { getBackendBaseUrl } from '../lib/backendUrl';

const BACKEND = getBackendBaseUrl();

// ── localStorage cache (1 hr TTL) ───────────────────────────
const CACHE_KEY = 'finaxis_company_v5';
const CACHE_TTL = 60 * 60 * 1000;

function getCached(sym) {
  try {
    const store = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
    const entry = store[sym];
    if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data;
  } catch {}
  return null;
}
function setCached(sym, data) {
  try {
    const store = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
    store[sym] = { data, ts: Date.now() };
    const keys = Object.keys(store);
    if (keys.length > 30) {
      keys.sort((a, b) => store[a].ts - store[b].ts).slice(0, 10).forEach(k => delete store[k]);
    }
    localStorage.setItem(CACHE_KEY, JSON.stringify(store));
  } catch {}
}

// ── Yahoo Finance sector → industry mapping ─────────────────
const SECTOR_MAP = {
  'Technology':             'tech',
  'Communication Services': 'tech',
  'Healthcare':             'healthcare',
  'Financial Services':     'finance',
  'Consumer Defensive':     'retail',
  'Consumer Cyclical':      'retail',
  'Industrials':            'manufacturing',
  'Basic Materials':        'manufacturing',
  'Energy':                 'manufacturing',
};

// ── Safe numeric extractor for YF objects ───────────────────
function yfv(obj, ...keys) {
  for (const k of keys) {
    const v = (obj || {})[k];
    if (v !== null && v !== undefined) {
      const raw = (typeof v === 'object' && v !== null) ? v.raw : v;
      const n = Number(raw);
      if (!isNaN(n)) return n;
    }
  }
  return null;
}

// ── Parse YF quoteSummary JSON → our data shape ─────────────
function parseYFResponse(json, sym, fallbackName) {
  const r       = ((json?.quoteSummary?.result) || [{}])[0] || {};
  const incList = r?.incomeStatementHistory?.incomeStatementHistory || [];
  const balList = r?.balanceSheetHistory?.balanceSheetStatements   || [];
  const cfList  = r?.cashflowStatementHistory?.cashflowStatements  || [];
  const profile = r?.assetProfile      || {};
  const fdData  = r?.financialData     || {};

  const parseInc = s => {
    const rev  = yfv(s, 'totalRevenue');
    const cogs = yfv(s, 'costOfRevenue');
    const gp   = yfv(s, 'grossProfit') ?? (rev != null && cogs != null ? rev - cogs : null);
    const op   = yfv(s, 'operatingIncome', 'ebit');
    const rd   = yfv(s, 'researchDevelopment');
    const sga  = yfv(s, 'sellingGeneralAdministrative');
    const da   = yfv(s, 'depreciationAndAmortization');
    const ie   = yfv(s, 'interestExpense');
    return {
      year:              (s?.endDate?.fmt || '').slice(0, 4),
      revenue:           rev,
      cogs:              cogs ?? (rev != null && gp != null ? rev - gp : null),
      grossProfit:       gp,
      rd, sga,
      operatingExpenses: (rd != null && sga != null) ? rd + sga : null,
      operatingIncome:   op,
      preTaxIncome:      yfv(s, 'incomeBeforeTax'),
      tax:               yfv(s, 'incomeTaxExpense'),
      netProfit:         yfv(s, 'netIncome'),
      interestExpense:   ie != null ? Math.abs(ie) : null,
      ebitda:            (op != null && da != null) ? op + da : null,
      da,
      eps:               yfv(s, 'dilutedEps'),
    };
  };

  const parseBal = s => {
    const ltd = yfv(s, 'longTermDebt');
    const std = yfv(s, 'shortLongTermDebt');
    const td  = (std ?? 0) + (ltd ?? 0);
    return {
      year:               (s?.endDate?.fmt || '').slice(0, 4),
      currentAssets:      yfv(s, 'totalCurrentAssets'),
      cash:               yfv(s, 'cash'),
      sti:                yfv(s, 'shortTermInvestments'),
      receivables:        yfv(s, 'netReceivables'),
      inventory:          yfv(s, 'inventory'),
      totalAssets:        yfv(s, 'totalAssets'),
      ppe:                yfv(s, 'propertyPlantEquipment'),
      goodwill:           yfv(s, 'goodWill'),
      intangibles:        yfv(s, 'intangibleAssets'),
      currentLiabilities: yfv(s, 'totalCurrentLiabilities'),
      ap:                 yfv(s, 'accountsPayable'),
      currentDebt:        std,
      ltDebt:             ltd,
      totalDebt:          td > 0 ? td : null,
      equity:             yfv(s, 'totalStockholderEquity'),
      apic:               yfv(s, 'additionalPaidInCapital'),
      retainedEarnings:   yfv(s, 'retainedEarnings'),
    };
  };

  const parseCf = s => {
    const capex = yfv(s, 'capitalExpenditures');
    const bb    = yfv(s, 'repurchaseOfStock');
    const div   = yfv(s, 'dividendsPaid');
    return {
      year:        (s?.endDate?.fmt || '').slice(0, 4),
      netIncome:   yfv(s, 'netIncome'),
      da:          yfv(s, 'depreciation'),
      sbc:         yfv(s, 'stockBasedCompensation'),
      wc:          yfv(s, 'changeToWorkingCapital'),
      cfOps:       yfv(s, 'totalCashFromOperatingActivities'),
      capex:       capex != null ? -Math.abs(capex) : null,
      cfInvesting: yfv(s, 'totalCashFromInvestingActivities'),
      buybacks:    bb  != null ? -Math.abs(bb)  : null,
      dividends:   div != null ? -Math.abs(div) : null,
      cfFinancing: yfv(s, 'totalCashFromFinancingActivities'),
    };
  };

  const historical = {
    income:   incList.slice(0, 5).map(parseInc),
    balance:  balList.slice(0, 5).map(parseBal),
    cashflow: cfList.slice(0, 5).map(parseCf),
  };

  const inc0 = historical.income[0]  || {};
  const bal0 = historical.balance[0] || {};

  // financialData module as fallback (always available, even without crumb)
  const fd = r?.financialData || {};
  const fdn = (k) => { const v = yfv(fd, k); return v != null ? v : null; };

  const raw = {
    currentAssets:      bal0.currentAssets,
    currentLiabilities: bal0.currentLiabilities,
    inventory:          bal0.inventory,
    cash:               bal0.cash      ?? fdn('totalCash'),
    totalAssets:        bal0.totalAssets,
    equity:             bal0.equity,
    totalDebt:          bal0.totalDebt ?? fdn('totalDebt'),
    revenue:            inc0.revenue   ?? fdn('totalRevenue'),
    grossProfit:        inc0.grossProfit,
    operatingExpenses:  inc0.operatingExpenses,
    netProfit:          inc0.netProfit,
    interestExpense:    inc0.interestExpense,
    receivables:        bal0.receivables,
    cogs:               inc0.cogs,
  };

  const data = {};
  for (const [k, v] of Object.entries(raw)) {
    if (v != null && !isNaN(v) && Math.abs(v) > 0) data[k] = String(Math.round(Math.abs(v)));
  }

  const total    = Object.keys(raw).length;
  const filled   = Object.keys(data).length;
  const coverage = Math.round((filled / total) * 100);

  const sector   = profile.sector   || '';
  const currency = profile.financialCurrency || profile.currency || 'USD';
  const name     = profile.longName || profile.shortName || fallbackName || sym;

  return { ticker: sym, name, sector, industry: SECTOR_MAP[sector] || 'general',
           currency, coverage, filled, total, data, historical };
}

const MODULES = [
  'incomeStatementHistory', 'balanceSheetHistory',
  'cashflowStatementHistory', 'defaultKeyStatistics',
  'assetProfile', 'financialData',
].join(',');

// ── Attempt 1: backend proxy (handles session/crumb server-side) ─
async function fetchViaBackend(sym, fallbackName) {
  const res = await fetch(`${BACKEND}/company/yf/${encodeURIComponent(sym)}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    if (res.status === 429) {
      throw new Error(err.detail || 'Too many lookups. Please wait a few minutes before trying again.');
    }
    throw new Error(err.detail || `Backend returned ${res.status}`);
  }
  return res.json();
}

// ── Attempt 2: corsproxy.io (adds CORS headers, free, open-source) ─
// corsproxy.io forwards the request from its own server and injects
// Access-Control-Allow-Origin so our browser can read the response.
async function fetchViaProxy(sym, fallbackName) {
  const PROXY = 'https://corsproxy.io/?';

  // Get crumb through proxy (YF session on proxy's server may already exist)
  let crumb = '';
  try {
    const cr = await fetch(
      PROXY + encodeURIComponent('https://query2.finance.yahoo.com/v1/test/getcrumb'),
      { signal: AbortSignal.timeout(8000) }
    );
    if (cr.ok) crumb = (await cr.text()).trim().replace(/"/g, '');
  } catch {}

  const yfUrl =
    `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(sym)}` +
    `?modules=${encodeURIComponent(MODULES)}` +
    (crumb ? `&crumb=${encodeURIComponent(crumb)}` : '');

  const res = await fetch(PROXY + encodeURIComponent(yfUrl),
    { signal: AbortSignal.timeout(15000) });

  if (!res.ok) throw new Error(`Proxy returned ${res.status} for ${sym}`);
  const json = await res.json();
  const err  = json?.quoteSummary?.error;
  if (err) throw new Error(err.description || err.code || 'No data');
  return parseYFResponse(json, sym, fallbackName);
}

// ── Main fetch: backend → proxy → error ─────────────────────
async function fetchCompanyData(ticker, fallbackName) {
  const sym = ticker.toUpperCase().trim();

  const cached = getCached(sym);
  if (cached) return cached;

  // Try backend first
  if (BACKEND) {
    try {
      const data = await fetchViaBackend(sym, fallbackName);
      setCached(sym, data);
      return data;
    } catch (e) {
      console.warn('Backend fetch failed, trying proxy:', e.message);
    }
  }

  // Fall back to corsproxy.io
  try {
    const data = await fetchViaProxy(sym, fallbackName);
    setCached(sym, data);
    return data;
  } catch (e) {
    throw new Error(
      `Could not load "${sym}". ` +
      `Try again in a few seconds — or check the ticker is correct (e.g. use RELIANCE.NS for Indian stocks).`
    );
  }
}

// ══════════════════════════════════════════════════════════════
export default function CompanySearch({ onSelect }) {
  const { saveSearch } = useAuth();
  const [query,    setQuery]   = useState('');
  const [results,  setResults] = useState([]);
  const [open,     setOpen]    = useState(false);
  const [fetching, setFetching]= useState(false);
  const [loaded,   setLoaded]  = useState(null);
  const [error,    setError]   = useState('');

  const debounceRef  = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    const h = e => { if (!containerRef.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const doSearch = useCallback((q) => {
    if (!q || q.length < 1) { setResults([]); setOpen(false); return; }
    const hits = searchCompanies(q, 8);
    setResults(hits);
    setOpen(hits.length > 0);
  }, []);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(query), 120);
    return () => clearTimeout(debounceRef.current);
  }, [query, doSearch]);

  const selectCompany = async (company) => {
    setOpen(false); setLoaded(null); setError('');
    setQuery(company.name || company.ticker);
    setFetching(true);
    try {
      const d = await fetchCompanyData(company.ticker, company.name);
      setLoaded({ ticker: d.ticker, name: d.name, currency: d.currency,
                  coverage: d.coverage, filled: d.filled, total: d.total });
      // Persist to user's search history if logged in
      saveSearch(d.ticker, d.name, d.sector, d.currency, d.filled, d.total).catch(() => {});
      onSelect(d);
    } catch (e) {
      setError(e.message || 'Could not load financials.');
    } finally { setFetching(false); }
  };

  const clear = () => { setQuery(''); setLoaded(null); setError(''); setResults([]); };

  return (
    <div ref={containerRef} data-tour="search" className="relative">

      {/* Search input */}
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4a5568" strokeWidth="2">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <input type="text" value={query}
          onChange={e => { setQuery(e.target.value); setLoaded(null); setError(''); }}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Search ticker · AAPL · RELIANCE.NS · TCS ..."
          className="w-full text-xs outline-none"
          style={{
            paddingLeft: 32, paddingRight: 56, height: 38,
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 4,
            color: 'var(--text-1)', fontFamily: 'var(--font-sans)',
            transition: 'border-color 0.15s',
          }}
          onFocus={e  => e.target.style.borderColor = 'var(--border-hi)'}
          onBlur={e   => e.target.style.borderColor = 'var(--border)'}
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
          {fetching ? (
            <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none" style={{ color:'var(--gold)' }}>
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31 11"/>
            </svg>
          ) : query ? (
            <button onClick={clear} style={{ background:'none', border:'none', color:'var(--text-4)', fontSize:14, cursor:'pointer', lineHeight:1 }}>✕</button>
          ) : null}
          <span style={{ fontFamily:"'var(--font-sans)'", fontSize:10, color:'var(--text-4)', border:'1px solid var(--border)', borderRadius:3, padding:'2px 5px', letterSpacing:'0.04em' }}>⌘K</span>
        </div>
      </div>

      {/* Dropdown */}
      {open && results.length > 0 && (
        <div className="absolute z-50 left-0 right-0 mt-1 overflow-hidden"
          style={{ top:'100%', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:4 }}>
          {results.map((r, i) => (
            <button key={r.ticker} onClick={() => selectCompany(r)}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-left"
              style={{ borderBottom: i < results.length-1 ? '1px solid var(--border)' : 'none', background:'none', border_bottom: i < results.length-1 ? '1px solid var(--border)' : 'none' }}
              onMouseEnter={e => e.currentTarget.style.background='var(--surface-hi)'}
              onMouseLeave={e => e.currentTarget.style.background='transparent'}>
              <span style={{ fontFamily:"'var(--font-sans)'", fontSize:12, fontWeight:600, color:'var(--text-1)', minWidth:72, flexShrink:0 }}>
                {r.ticker}
              </span>
              <div className="min-w-0 flex-1">
                <p style={{ fontSize:12, color:'var(--text-3)', margin:0, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{r.name}</p>
              </div>
              {r.exchange && (
                <span style={{ fontFamily:"'var(--font-sans)'", fontSize:10, color:'var(--gold)', border:'1px solid #2461d4', borderRadius:3, padding:'1px 5px', flexShrink:0 }}>
                  {r.exchange}
                </span>
              )}
              {r.sector && (
                <span style={{ fontFamily:"'var(--font-sans)'", fontSize:10, color:'var(--text-4)', border:'1px solid var(--border)', borderRadius:3, padding:'1px 5px', flexShrink:0 }}>
                  {r.sector}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Loaded confirmation */}
      {loaded && !fetching && (
        <div className="mt-2 overflow-hidden" style={{ border:'1px solid #16a34a', borderRadius:4 }}>
          <div className="flex items-center gap-2 px-3 py-2" style={{ background:'var(--surface)' }}>
            <div style={{ width:6, height:6, borderRadius:'50%', background:'#16a34a', flexShrink:0 }} />
            <span style={{ fontFamily:"'var(--font-sans)'", fontSize:11, fontWeight:600, color:'#16a34a', flexShrink:0 }}>{loaded.ticker}</span>
            <span style={{ fontSize:11, color:'var(--text-3)', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{loaded.name}</span>
            {loaded.currency && (
              <span style={{ fontFamily:"'var(--font-sans)'", fontSize:10, color:'#b45309', border:'1px solid #b45309', borderRadius:3, padding:'1px 5px', flexShrink:0 }}>
                {loaded.currency}
              </span>
            )}
            <button onClick={clear} style={{ background:'none', border:'none', color:'var(--text-4)', fontSize:13, cursor:'pointer', flexShrink:0 }}>✕</button>
          </div>
          {loaded.coverage !== undefined && (
            <div className="px-3 py-1.5" style={{ background:'var(--surface)', borderTop:'1px solid var(--border)' }}>
              <div className="flex justify-between mb-1" style={{ fontFamily:"'var(--font-sans)'", fontSize:9 }}>
                <span style={{ color:'var(--text-4)' }}>FIELDS LOADED — {loaded.filled}/{loaded.total}</span>
                <span style={{ color: loaded.coverage >= 80 ? '#16a34a' : '#b45309', fontWeight:700 }}>{loaded.coverage}%</span>
              </div>
              <div className="h-[2px] rounded-full overflow-hidden" style={{ background:'var(--border)' }}>
                <div className="h-full rounded-full transition-all duration-700"
                  style={{ width:`${loaded.coverage}%`, background: loaded.coverage >= 80 ? '#16a34a' : '#b45309' }} />
              </div>
              {loaded.coverage < 100 && (
                <p style={{ fontSize:9, marginTop:4, color:'var(--text-4)', lineHeight:1.4 }}>
                  Missing fields are normal — those ratios show N/A.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {error && (
        <p style={{ marginTop:6, fontFamily:"'var(--font-sans)'", fontSize:10, color:'#dc2626', lineHeight:1.5 }}>[!] {error}</p>
      )}
    </div>
  );
}
