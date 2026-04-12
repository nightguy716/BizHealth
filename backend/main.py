"""
BizHealth FastAPI Backend — Anthropic Claude
--------------------------------------------
POST /analyze  →  structured financial analysis via Claude claude-haiku-4-5

Deploy to Render:
1. render.com → New Web Service → connect nightguy716/BizHealth repo
2. Root Directory:  backend
3. Build Command:   pip install -r requirements.txt
4. Start Command:   uvicorn main:app --host 0.0.0.0 --port $PORT
5. Environment variable: ANTHROPIC_API_KEY = sk-ant-...
6. Copy the Render URL → add VITE_BACKEND_URL in Vercel dashboard → Redeploy
"""

import os
import io
import json
import math
import asyncio
import requests
from concurrent.futures import ThreadPoolExecutor
from typing import Optional, List
import anthropic
import httpx
import yfinance as yf
import pandas as pd
import xlsxwriter
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

_executor = ThreadPoolExecutor(max_workers=4)

app = FastAPI(title="BizHealth API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)

SYSTEM_PROMPT = """You are a senior financial analyst with expertise across SMEs, large-cap corporations, and listed companies globally. You analyse financial ratios and translate them into clear, actionable intelligence tailored to the entity's scale and context.

You must respond with ONLY a valid JSON object — no markdown, no explanation outside the JSON — with exactly these keys:

{
  "executive_summary": "2-3 sentence overview of overall financial health, mentioning specific ratio values and the company/entity name if known",
  "health_verdict": "exactly one of: Strong | Moderate | Below Average | Critical",
  "top_risks": [
    { "title": "short title max 6 words", "description": "2 sentences mentioning actual ratio values", "urgency": "High | Medium | Low" }
  ],
  "top_opportunities": [
    { "title": "short title max 6 words", "description": "2 sentences with specific, actionable insight scaled to the entity size", "impact": "High | Medium | Low" }
  ],
  "priority_actions": [
    { "action": "specific action scaled to entity size, mentioning numbers", "timeline": "e.g. This week | Next 30 days | Next quarter", "expected_impact": "what metric will improve and by roughly how much" }
  ],
  "industry_context": "one paragraph comparing to global/sector peers, referencing the specific industry and entity scale"
}

Rules:
- top_risks: exactly 3 items
- top_opportunities: exactly 3 items
- priority_actions: exactly 5 items
- If the entity is a large listed company (e.g. Amazon, Microsoft, TCS), frame advice for institutional investors, CFOs, and analysts — not SME owners
- If the entity is an SME or unknown, frame advice for business owners in plain English
- Always mention actual ratio values in descriptions
- Tailor industry_context to global norms for listed companies, or local/regional norms for SMEs"""


class CompanyCtx(BaseModel):
    name:     str = ''
    ticker:   str = ''
    currency: str = 'INR'
    isListed: bool = False

class AnalysisRequest(BaseModel):
    ratios:   dict
    statuses: dict
    industry: str
    score:    int
    company:  CompanyCtx = CompanyCtx()


@app.get("/")
def root():
    return {"status": "BizHealth API running", "model": "claude-haiku-4-5", "version": "1.0.0"}


@app.get("/health")
def health():
    return {"status": "ok"}


# ─────────────────────────────────────────────────────────────
#  COMPANY SEARCH  —  proxy Yahoo Finance suggest API
# ─────────────────────────────────────────────────────────────
@app.get("/search")
async def search_companies(q: str = Query(..., min_length=1)):
    url = (
        "https://query2.finance.yahoo.com/v1/finance/search"
        f"?q={q}&newsCount=0&quotesCount=10&enableFuzzyQuery=true"
    )
    headers = {"User-Agent": "Mozilla/5.0"}
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            r = await client.get(url, headers=headers)
            data = r.json()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Yahoo Finance search failed: {e}")

    quotes = data.get("quotes", [])
    results = []
    for item in quotes:
        if item.get("quoteType") in ("EQUITY", "ETF"):
            results.append({
                "ticker":   item.get("symbol", ""),
                "name":     item.get("longname") or item.get("shortname", ""),
                "exchange": item.get("exchange", ""),
                "type":     item.get("quoteType", ""),
            })
    return {"results": results[:8]}


# ─────────────────────────────────────────────────────────────
#  COMPANY FINANCIALS  —  yfinance → our 14 input fields
# ─────────────────────────────────────────────────────────────
SECTOR_MAP = {
    "Technology":          "tech",
    "Communication Services": "tech",
    "Healthcare":          "healthcare",
    "Financial Services":  "finance",
    "Consumer Defensive":  "retail",
    "Consumer Cyclical":   "retail",
    "Industrials":         "manufacturing",
    "Basic Materials":     "manufacturing",
    "Energy":              "manufacturing",
    "Real Estate":         "general",
    "Utilities":           "general",
}

def _safe(df: pd.DataFrame, keys: list[str]):
    """Return the first non-NaN float from df index matching any of keys."""
    if df is None or df.empty:
        return None
    for k in keys:
        if k in df.index:
            try:
                v = df[k].iloc[0]
                if v is not None and not (isinstance(v, float) and math.isnan(v)):
                    return float(v)
            except Exception:
                pass
    return None


YF_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept":          "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer":         "https://finance.yahoo.com/",
}

FMP_BASE = "https://financialmodelingprep.com/api/v3"


def _fv(d: dict, *keys):
    """Return first numeric value found in dict from a list of keys."""
    for k in keys:
        v = d.get(k)
        if v is not None:
            try:
                f = float(v)
                if not math.isnan(f):
                    return f
            except (TypeError, ValueError):
                pass
    return None


@app.get("/company/{ticker}")
async def get_company(ticker: str):
    """
    Fetches financial statements from Financial Modeling Prep (FMP).
    Requires FMP_API_KEY environment variable (free at financialmodelingprep.com).
    Falls back to Yahoo Finance search for name/sector metadata.
    """
    fmp_key = os.environ.get("FMP_API_KEY")
    if not fmp_key:
        raise HTTPException(
            status_code=503,
            detail="FMP_API_KEY not configured. Add it in Railway → Variables."
        )

    sym = ticker.upper().replace(".NS", "").replace(".BO", "")  # FMP uses bare tickers

    inc_url = f"{FMP_BASE}/income-statement/{sym}?limit=1&apikey={fmp_key}"
    bal_url = f"{FMP_BASE}/balance-sheet-statement/{sym}?limit=1&apikey={fmp_key}"

    try:
        async with httpx.AsyncClient(timeout=20) as client:
            inc_r, bal_r = await asyncio.gather(
                client.get(inc_url),
                client.get(bal_url),
            )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"FMP request failed: {e}")

    if inc_r.status_code != 200:
        raise HTTPException(status_code=inc_r.status_code,
                            detail=f"FMP income statement returned {inc_r.status_code}")

    inc_list = inc_r.json()
    bal_list = bal_r.json()

    if not inc_list or not isinstance(inc_list, list):
        raise HTTPException(status_code=404, detail=f"No data found for {sym} on FMP")

    inc = inc_list[0]   # most recent annual
    bal = bal_list[0] if bal_list and isinstance(bal_list, list) else {}

    # ── income statement ─────────────────────────────────────────
    revenue    = _fv(inc, "revenue")
    gross_p    = _fv(inc, "grossProfit")
    cogs_raw   = _fv(inc, "costOfRevenue")
    op_exp     = _fv(inc, "operatingExpenses")   # SG&A + other (excludes COGS)
    net_income = _fv(inc, "netIncome")
    interest   = _fv(inc, "interestExpense")

    # FMP reports interestExpense as positive
    if interest is not None:
        interest = abs(interest)

    # Derive missing values
    if gross_p is None and revenue and cogs_raw:
        gross_p = revenue - cogs_raw
    if cogs_raw is None and revenue and gross_p:
        cogs_raw = revenue - gross_p

    # ── balance sheet ─────────────────────────────────────────────
    cur_assets   = _fv(bal, "totalCurrentAssets")
    cur_liab     = _fv(bal, "totalCurrentLiabilities")
    inventory    = _fv(bal, "inventory")
    cash         = _fv(bal, "cashAndCashEquivalents", "cashAndShortTermInvestments")
    total_assets = _fv(bal, "totalAssets")
    equity       = _fv(bal, "totalStockholdersEquity", "stockholdersEquity")
    total_debt   = _fv(bal, "totalDebt", "longTermDebt")
    receivables  = _fv(bal, "netReceivables", "accountsReceivable")

    # ── metadata ──────────────────────────────────────────────────
    name     = inc.get("symbol", sym)
    sector   = ""
    currency = inc.get("reportedCurrency", "USD")

    # Try FMP company profile for sector/name
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            pr = await client.get(f"{FMP_BASE}/profile/{sym}?apikey={fmp_key}")
            profiles = pr.json()
            if profiles and isinstance(profiles, list):
                p      = profiles[0]
                name   = p.get("companyName", sym)
                sector = p.get("sector", "")
                currency = p.get("currency", currency)
    except Exception:
        pass

    raw = {
        "currentAssets":      cur_assets,
        "currentLiabilities": cur_liab,
        "inventory":          inventory,
        "cash":               cash,
        "totalAssets":        total_assets,
        "equity":             equity,
        "totalDebt":          total_debt,
        "revenue":            revenue,
        "grossProfit":        gross_p,
        "operatingExpenses":  op_exp,
        "netProfit":          net_income,
        "interestExpense":    interest,
        "receivables":        receivables,
        "cogs":               cogs_raw,
    }

    mapped = {}
    for k, v in raw.items():
        if v is not None and not (isinstance(v, float) and math.isnan(v)) and abs(v) > 0:
            mapped[k] = str(int(abs(round(v))))

    industry = SECTOR_MAP.get(sector, "general")
    total    = len(raw)
    filled   = len(mapped)
    coverage = round((filled / total) * 100)

    return {
        "ticker":   sym,
        "name":     name,
        "sector":   sector,
        "industry": industry,
        "currency": currency,
        "coverage": coverage,
        "filled":   filled,
        "total":    total,
        "data":     mapped,
    }


# ─────────────────────────────────────────────────────────────
#  IB-STYLE EXCEL EXPORT
# ─────────────────────────────────────────────────────────────

class IncomeYear(BaseModel):
    year: str = ''
    revenue: Optional[float] = None
    grossProfit: Optional[float] = None
    cogs: Optional[float] = None
    operatingExpenses: Optional[float] = None
    operatingIncome: Optional[float] = None
    netProfit: Optional[float] = None
    interestExpense: Optional[float] = None
    ebitda: Optional[float] = None

class BalanceYear(BaseModel):
    year: str = ''
    currentAssets: Optional[float] = None
    currentLiabilities: Optional[float] = None
    inventory: Optional[float] = None
    cash: Optional[float] = None
    totalAssets: Optional[float] = None
    equity: Optional[float] = None
    totalDebt: Optional[float] = None
    receivables: Optional[float] = None

class Historical(BaseModel):
    income: List[IncomeYear] = []
    balance: List[BalanceYear] = []

class ExcelRequest(BaseModel):
    company:    CompanyCtx = CompanyCtx()
    industry:   str = 'general'
    score:      int = 0
    ratios:     dict = {}
    statuses:   dict = {}
    inputs:     dict = {}
    historical: Historical = Historical()
    ai_insights: dict = {}


# Colour palette (R, G, B)
NAVY    = '#003366'
BLUE2   = '#1F3864'
BLUE3   = '#2E75B6'
LBLUE   = '#D6E4F0'
WHITE   = '#FFFFFF'
GREEN   = '#00B050'
AMBER   = '#FFC000'
RED_C   = '#FF4444'
LGREY   = '#F2F2F2'
DGREY   = '#595959'
BLACK   = '#000000'

STATUS_HEX = {'green': GREEN, 'amber': AMBER, 'red': RED_C, 'na': '#AAAAAA'}
STATUS_LBL = {'green': 'Healthy', 'amber': 'Borderline', 'red': 'Critical', 'na': 'N/A'}


def _millions(v):
    if v is None: return None
    return round(v / 1_000_000, 2)

def _pct(num, den):
    if num is None or den is None or den == 0: return None
    return round((num / den) * 100, 1)

def _growth(curr, prev):
    if curr is None or prev is None or prev == 0: return None
    return round(((curr - prev) / abs(prev)) * 100, 1)


def build_excel(req: ExcelRequest) -> bytes:
    output = io.BytesIO()
    wb = xlsxwriter.Workbook(output, {'in_memory': True, 'nan_inf_to_errors': True})

    co   = req.company.name or 'Company'
    tick = req.company.ticker or ''
    curr = req.company.currency or 'USD'
    unit = f'{curr} millions'

    # ── Format library ────────────────────────────────────────
    def fmt(**kw):
        base = {'font_name': 'Calibri', 'font_size': 10, 'valign': 'vcenter'}
        base.update(kw)
        return wb.add_format(base)

    hdr_fmt   = fmt(bold=True, font_color=WHITE, bg_color=NAVY,   font_size=11, align='center', border=1)
    sub_fmt   = fmt(bold=True, font_color=WHITE, bg_color=BLUE3,  align='left',  border=1)
    label_fmt = fmt(bold=True, font_color=BLACK, bg_color=LGREY,  align='left',  border=1, indent=1)
    num_fmt   = fmt(num_format='#,##0.00', align='right', border=1)
    pct_fmt   = fmt(num_format='0.0"%"',   align='right', border=1)
    txt_fmt   = fmt(align='left',  border=1)
    txt_ctr   = fmt(align='center',border=1)
    bold_txt  = fmt(bold=True, align='left', border=1)
    title_fmt = fmt(bold=True, font_size=16, font_color=NAVY)
    meta_fmt  = fmt(font_size=10, font_color=DGREY)
    wrap_fmt  = fmt(text_wrap=True, align='left', valign='top', border=1)

    grn_fmt   = fmt(bold=True, font_color=WHITE, bg_color=GREEN,  align='center', border=1)
    amb_fmt   = fmt(bold=True, font_color=BLACK, bg_color=AMBER,  align='center', border=1)
    red_fmt   = fmt(bold=True, font_color=WHITE, bg_color=RED_C,  align='center', border=1)
    na_fmt    = fmt(font_color='#888888', align='center', border=1)

    def status_fmt(s):
        return {'green': grn_fmt, 'amber': amb_fmt, 'red': red_fmt}.get(s, na_fmt)

    pos_fmt = fmt(num_format='0.0"%"', font_color=GREEN, align='right', border=1, bold=True)
    neg_fmt = fmt(num_format='0.0"%"', font_color=RED_C, align='right', border=1, bold=True)

    def growth_fmt(v):
        if v is None: return na_fmt
        return pos_fmt if v >= 0 else neg_fmt

    # ════════════════════════════════════════════════════════
    # SHEET 1 — SUMMARY
    # ════════════════════════════════════════════════════════
    ws = wb.add_worksheet('Summary')
    ws.set_column('A:A', 32)
    ws.set_column('B:B', 18)
    ws.set_column('C:C', 18)
    ws.set_column('D:D', 18)
    ws.set_column('E:E', 22)
    ws.freeze_panes(6, 0)

    # Title block
    ws.merge_range('A1:E1', f'BizHealth — Financial Analysis Report', title_fmt)
    ws.merge_range('A2:E2', f'{co}  ({tick})  ·  Industry: {req.industry.title()}', meta_fmt)
    from datetime import date
    ws.merge_range('A3:E3', f'Analysis Date: {date.today().strftime("%d %B %Y")}  ·  Currency: {unit}', meta_fmt)
    ws.merge_range('A4:E4', '', fmt())

    verdict = ('STRONG' if req.score >= 80 else 'MODERATE' if req.score >= 60
               else 'BELOW AVERAGE' if req.score >= 40 else 'CRITICAL')
    vfmt = grn_fmt if req.score >= 80 else amb_fmt if req.score >= 60 else red_fmt

    ws.write('A5', 'Health Score', label_fmt)
    ws.write('B5', f'{req.score}/100', num_fmt)
    ws.write('C5', 'Verdict', label_fmt)
    ws.merge_range('D5:E5', verdict, vfmt)

    # Status counts
    counts = {'green': 0, 'amber': 0, 'red': 0, 'na': 0}
    for s in req.statuses.values(): counts[s] = counts.get(s, 0) + 1
    ws.write('A6', 'Status Breakdown', label_fmt)
    ws.write('B6', f"✓ Healthy: {counts['green']}", grn_fmt)
    ws.write('C6', f"~ Borderline: {counts['amber']}", amb_fmt)
    ws.write('D6', f"✗ Critical: {counts['red']}", red_fmt)
    ws.write('E6', f"– N/A: {counts['na']}", na_fmt)

    ws.write_row(7, 0, ['RATIO', 'VALUE', 'STATUS', 'BENCHMARK', 'INTERPRETATION'], hdr_fmt)

    RATIO_ROWS = [
        ('── LIQUIDITY', None, None, None, None),
        ('Current Ratio', 'currentRatio', 'x', 1.5, None),
        ('Quick Ratio', 'quickRatio', 'x', 1.0, None),
        ('Cash Ratio', 'cashRatio', 'x', 0.5, None),
        ('── PROFITABILITY', None, None, None, None),
        ('Gross Margin', 'grossMargin', '%', 30, None),
        ('Operating Margin', 'operatingMargin', '%', 15, None),
        ('Net Margin', 'netMargin', '%', 10, None),
        ('Return on Equity', 'roe', '%', 15, None),
        ('Return on Assets', 'roa', '%', 5, None),
        ('── EFFICIENCY', None, None, None, None),
        ('Asset Turnover', 'assetTurnover', 'x', 1.0, None),
        ('Fixed Asset Turnover', 'fixedAssetTurnover', 'x', 2.0, None),
        ('Receivables Days', 'receivablesDays', 'days', 45, None),
        ('Inventory Days', 'inventoryDays', 'days', 60, None),
        ('── LEVERAGE', None, None, None, None),
        ('Debt to Equity', 'debtToEquity', 'x', 1.5, None),
        ('Interest Coverage', 'interestCoverage', 'x', 3.0, None),
    ]

    INTERP = {
        'currentRatio': 'Ability to cover short-term liabilities with current assets.',
        'quickRatio': 'Liquidity excluding inventory.',
        'cashRatio': 'Strictest liquidity — cash vs current liabilities.',
        'grossMargin': 'Revenue retained after direct production costs.',
        'operatingMargin': 'Profitability from core operations.',
        'netMargin': 'Bottom-line profitability after all expenses.',
        'roe': 'Return generated on shareholders equity.',
        'roa': 'Efficiency of asset utilisation to generate profit.',
        'assetTurnover': 'Revenue generated per unit of total assets.',
        'fixedAssetTurnover': 'Revenue efficiency from fixed/long-term assets.',
        'receivablesDays': 'Average days to collect customer payments.',
        'inventoryDays': 'Average days inventory is held before sale.',
        'debtToEquity': 'Financial leverage — debt relative to equity.',
        'interestCoverage': 'Ability to service interest from operating earnings.',
    }

    row = 8
    for (lbl, key, unit_r, bench, _) in RATIO_ROWS:
        if key is None:
            ws.merge_range(row, 0, row, 4, lbl, sub_fmt)
            row += 1
            continue
        val    = req.ratios.get(key)
        status = req.statuses.get(key, 'na')
        sfmt   = status_fmt(status)
        disp   = f"{val:.2f}{unit_r}" if val is not None else 'N/A'
        ws.write(row, 0, lbl, label_fmt)
        ws.write(row, 1, disp, txt_ctr)
        ws.write(row, 2, STATUS_LBL[status], sfmt)
        ws.write(row, 3, f">{bench}{unit_r}" if unit_r != 'days' else f"<{bench} days", txt_ctr)
        ws.write(row, 4, INTERP.get(key, ''), txt_fmt)
        row += 1

    # ════════════════════════════════════════════════════════
    # SHEET 2 — INCOME STATEMENT
    # ════════════════════════════════════════════════════════
    inc_years = req.historical.income
    ws2 = wb.add_worksheet('Income Statement')
    ws2.set_column('A:A', 30)
    for i in range(len(inc_years)):
        ws2.set_column(i+1, i+1, 14)
        if len(inc_years) > 1:
            ws2.set_column(i+1+len(inc_years), i+1+len(inc_years), 12)

    ws2.merge_range(0, 0, 0, max(1, len(inc_years)*2),
                    f'{co} — Income Statement ({unit})', title_fmt)
    years = [y.year for y in inc_years]

    # Headers
    ws2.write(1, 0, 'Line Item', hdr_fmt)
    for i, yr in enumerate(years):
        ws2.write(1, i+1, yr, hdr_fmt)
    for i in range(len(years)-1):
        ws2.write(1, len(years)+1+i, f"YoY {years[i]}/{years[i+1]}", hdr_fmt)

    def write_inc_row(r, label, values, is_pct=False, bold=False):
        lf = bold_txt if bold else label_fmt
        nf = pct_fmt if is_pct else num_fmt
        ws2.write(r, 0, label, lf)
        for i, v in enumerate(values):
            ws2.write(r, i+1, v, nf)
        # YoY growth
        for i in range(len(values)-1):
            g = _growth(values[i], values[i+1])
            gf = growth_fmt(g)
            ws2.write(r, len(values)+1+i, f"{g:+.1f}%" if g is not None else 'N/A', gf)

    r = 2
    ws2.merge_range(r, 0, r, max(1, len(inc_years)*2), '── Revenue & Gross Profit', sub_fmt); r += 1
    write_inc_row(r, 'Revenue', [_millions(y.revenue) for y in inc_years], bold=True); r += 1
    write_inc_row(r, 'Cost of Revenue (COGS)', [_millions(y.cogs) for y in inc_years]); r += 1
    write_inc_row(r, 'Gross Profit', [_millions(y.grossProfit) for y in inc_years], bold=True); r += 1
    write_inc_row(r, 'Gross Margin %', [_pct(y.grossProfit, y.revenue) for y in inc_years], is_pct=True); r += 1

    ws2.merge_range(r, 0, r, max(1, len(inc_years)*2), '── Operating Performance', sub_fmt); r += 1
    write_inc_row(r, 'Operating Expenses (SG&A)', [_millions(y.operatingExpenses) for y in inc_years]); r += 1
    write_inc_row(r, 'Operating Income (EBIT)', [_millions(y.operatingIncome) for y in inc_years], bold=True); r += 1
    write_inc_row(r, 'Operating Margin %', [_pct(y.operatingIncome, y.revenue) for y in inc_years], is_pct=True); r += 1
    write_inc_row(r, 'Interest Expense', [_millions(y.interestExpense) for y in inc_years]); r += 1

    ws2.merge_range(r, 0, r, max(1, len(inc_years)*2), '── Bottom Line', sub_fmt); r += 1
    write_inc_row(r, 'Net Income', [_millions(y.netProfit) for y in inc_years], bold=True); r += 1
    write_inc_row(r, 'Net Margin %', [_pct(y.netProfit, y.revenue) for y in inc_years], is_pct=True); r += 1
    if any(y.ebitda for y in inc_years):
        write_inc_row(r, 'EBITDA', [_millions(y.ebitda) for y in inc_years]); r += 1

    ws2.freeze_panes(2, 1)

    # ════════════════════════════════════════════════════════
    # SHEET 3 — BALANCE SHEET
    # ════════════════════════════════════════════════════════
    bal_years = req.historical.balance
    ws3 = wb.add_worksheet('Balance Sheet')
    ws3.set_column('A:A', 30)
    for i in range(max(1, len(bal_years))):
        ws3.set_column(i+1, i+1, 14)

    ws3.merge_range(0, 0, 0, max(1, len(bal_years)),
                    f'{co} — Balance Sheet ({unit})', title_fmt)
    ws3.write(1, 0, 'Line Item', hdr_fmt)
    for i, yr in enumerate(bal_years):
        ws3.write(1, i+1, yr.year, hdr_fmt)

    def write_bal_row(r, label, values, bold=False):
        lf = bold_txt if bold else label_fmt
        ws3.write(r, 0, label, lf)
        for i, v in enumerate(values):
            ws3.write(r, i+1, v, num_fmt)

    r = 2
    ws3.merge_range(r, 0, r, max(1, len(bal_years)), '── Assets', sub_fmt); r += 1
    write_bal_row(r, 'Cash & Equivalents',    [_millions(y.cash) for y in bal_years]); r += 1
    write_bal_row(r, 'Accounts Receivable',   [_millions(y.receivables) for y in bal_years]); r += 1
    write_bal_row(r, 'Inventory',             [_millions(y.inventory) for y in bal_years]); r += 1
    write_bal_row(r, 'Total Current Assets',  [_millions(y.currentAssets) for y in bal_years], bold=True); r += 1
    write_bal_row(r, 'Total Assets',          [_millions(y.totalAssets) for y in bal_years], bold=True); r += 1

    ws3.merge_range(r, 0, r, max(1, len(bal_years)), '── Liabilities & Equity', sub_fmt); r += 1
    write_bal_row(r, 'Total Current Liabilities', [_millions(y.currentLiabilities) for y in bal_years], bold=True); r += 1
    write_bal_row(r, 'Total Debt',            [_millions(y.totalDebt) for y in bal_years]); r += 1
    write_bal_row(r, 'Total Equity',          [_millions(y.equity) for y in bal_years], bold=True); r += 1

    ws3.freeze_panes(2, 1)

    # ════════════════════════════════════════════════════════
    # SHEET 4 — AI INSIGHTS  (if available)
    # ════════════════════════════════════════════════════════
    if req.ai_insights:
        ws4 = wb.add_worksheet('AI Insights')
        ws4.set_column('A:A', 22)
        ws4.set_column('B:B', 90)
        ws4.merge_range('A1:B1', f'{co} — AI Financial Intelligence', title_fmt)

        r = 1
        def ai_block(heading, items, key_field='description'):
            nonlocal r
            ws4.merge_range(r, 0, r, 1, heading, sub_fmt); r += 1
            if isinstance(items, str):
                ws4.merge_range(r, 0, r, 1, items, wrap_fmt)
                ws4.set_row(r, 60); r += 1
            elif isinstance(items, list):
                for item in items:
                    title = item.get('title', item.get('action', ''))
                    desc  = item.get(key_field, item.get('expected_impact', ''))
                    ws4.write(r, 0, title, bold_txt)
                    ws4.write(r, 1, desc, wrap_fmt)
                    ws4.set_row(r, 40); r += 1

        ai_block('Executive Summary', req.ai_insights.get('executive_summary',''))
        ai_block('Top Risks',        req.ai_insights.get('top_risks', []))
        ai_block('Opportunities',    req.ai_insights.get('top_opportunities', []))
        ai_block('Priority Actions', req.ai_insights.get('priority_actions', []), key_field='expected_impact')
        ai_block('Industry Context', req.ai_insights.get('industry_context',''))

    wb.close()
    return output.getvalue()


@app.post("/export/excel")
async def export_excel(req: ExcelRequest):
    try:
        data = build_excel(req)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    co   = (req.company.name or 'BizHealth').replace(' ', '-')
    name = f"BizHealth-{co}-Analysis.xlsx"
    return StreamingResponse(
        io.BytesIO(data),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={name}",
                 "Access-Control-Expose-Headers": "Content-Disposition"},
    )


@app.post("/analyze")
async def analyze(req: AnalysisRequest):
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY not configured on server")

    client = anthropic.Anthropic(api_key=api_key)

    # Build human-readable ratio summary for Claude
    ratio_lines = []
    for key, val in req.ratios.items():
        status = req.statuses.get(key, "na")
        display = f"{val:.4f}" if val is not None else "N/A"
        ratio_lines.append(f"  {key:<22} {display:<12} [{status.upper()}]")

    verdict_word = (
        "Strong" if req.score >= 80 else
        "Moderate" if req.score >= 60 else
        "Below Average" if req.score >= 40 else
        "Critical"
    )

    co = req.company
    entity_label = f"{co.name} ({co.ticker})" if co.ticker else (co.name or "the business")
    entity_type  = "Listed company" if co.isListed else "SME / private business"
    currency_note = f"Currency: {co.currency}" if co.currency else ""

    user_message = f"""Please analyse this entity's financial health and return your JSON response.

Entity:        {entity_label}
Type:          {entity_type}
Industry:      {req.industry}
{currency_note}
Health Score:  {req.score}/100 ({verdict_word})

Financial Ratios:
{"  RATIO                  VALUE        STATUS"}
{"  " + "-"*44}
{chr(10).join(ratio_lines)}

Return ONLY the JSON object. No preamble."""

    try:
        message = client.messages.create(
            model="claude-haiku-4-5",
            max_tokens=2048,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_message}],
        )

        raw = message.content[0].text.strip()

        # Strip markdown code fences if Claude wraps in them
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
            raw = raw.strip()

        result = json.loads(raw)
        return result

    except json.JSONDecodeError as e:
        raise HTTPException(status_code=500, detail=f"Claude returned invalid JSON: {e}")
    except anthropic.APIError as e:
        raise HTTPException(status_code=502, detail=f"Anthropic API error: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
