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
import time
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

# ── Yahoo Finance proxy — persistent session ──────────────────
# Yahoo Finance blocks API calls without a valid cookie+crumb pair.
# We bootstrap a real browser-like session once (visit homepage →
# get cookies → get crumb), then reuse it for all ticker fetches.

_YF_NAV_HEADERS = {           # used when visiting homepage
    "User-Agent":      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept":          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection":      "keep-alive",
    "Upgrade-Insecure-Requests": "1",
}
_YF_API_HEADERS = {           # used for API calls
    "User-Agent":      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept":          "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer":         "https://finance.yahoo.com/",
    "Origin":          "https://finance.yahoo.com",
}

_yf_session_client: httpx.AsyncClient | None = None
_yf_session_crumb:  str   = ""
_yf_session_ts:     float = 0.0
_yf_session_lock            = asyncio.Lock()
_yf_data_cache: dict        = {}
_YF_TTL      = 3600          # 1-hour cache for financial data
_YF_SESS_TTL = 3500          # refresh session after ~1 hour


async def _get_yf_session() -> tuple[httpx.AsyncClient, str]:
    """
    Return (client, crumb). Creates/refreshes the persistent YF session when
    needed. The session visits finance.yahoo.com first so Yahoo sets real
    cookies; only then does the crumb endpoint return a valid token.
    """
    global _yf_session_client, _yf_session_crumb, _yf_session_ts

    async with _yf_session_lock:
        age = time.time() - _yf_session_ts
        if _yf_session_client and _yf_session_crumb and age < _YF_SESS_TTL:
            return _yf_session_client, _yf_session_crumb

        # Build a new persistent client (keeps cookies across requests)
        if _yf_session_client:
            await _yf_session_client.aclose()

        client = httpx.AsyncClient(
            headers=_YF_NAV_HEADERS,
            follow_redirects=True,
            timeout=20.0,
        )

        # Step 1 — visit homepage so Yahoo sets session cookies
        for url in ("https://finance.yahoo.com/", "https://www.yahoo.com/"):
            try:
                await client.get(url)
                break
            except Exception:
                pass

        # Step 2 — accept EU consent if redirected (GDPR pop-up)
        try:
            await client.post(
                "https://consent.yahoo.com/v2/collectConsent",
                data={"agree": ["agree", "agree"], "consentUUID": "default",
                      "sessionId": "default", "inline": "false"},
            )
        except Exception:
            pass

        # Step 3 — switch to API headers and fetch crumb
        client.headers.update(_YF_API_HEADERS)
        crumb = ""
        for base in ("https://query1.finance.yahoo.com",
                     "https://query2.finance.yahoo.com"):
            try:
                r = await client.get(f"{base}/v1/test/getcrumb", timeout=10)
                t = r.text.strip().strip('"')
                if t and t not in ("null", ""):
                    crumb = t
                    break
            except Exception:
                pass

        _yf_session_client = client
        _yf_session_crumb  = crumb
        _yf_session_ts     = time.time()
        return client, crumb


def _yfv(obj, *keys):
    """Extract first non-null numeric value from a YF object."""
    for k in keys:
        v = (obj or {}).get(k, {})
        if isinstance(v, dict):
            raw = v.get("raw")
            if raw is not None:
                try:
                    f = float(raw)
                    if not math.isnan(f):
                        return f
                except (TypeError, ValueError):
                    pass
        elif v is not None:
            try:
                f = float(v)
                if not math.isnan(f):
                    return f
            except (TypeError, ValueError):
                pass
    return None


def _parse_yf_response(data: dict) -> dict:
    """Parse Yahoo Finance quoteSummary into our historical + inputs format."""
    result = (data.get("quoteSummary") or {}).get("result") or [{}]
    r = result[0] if result else {}

    inc_stmts = (r.get("incomeStatementHistory") or {}).get("incomeStatementHistory") or []
    bal_stmts = (r.get("balanceSheetHistory")     or {}).get("balanceSheetStatements") or []
    cf_stmts  = (r.get("cashflowStatementHistory") or {}).get("cashflowStatements")    or []
    profile   = r.get("assetProfile")             or {}
    stats     = r.get("defaultKeyStatistics")     or {}

    def parse_inc(s):
        rev    = _yfv(s, "totalRevenue")
        cogs   = _yfv(s, "costOfRevenue")
        gp     = _yfv(s, "grossProfit") or (rev - cogs if rev and cogs else None)
        op     = _yfv(s, "operatingIncome", "ebit")
        rd     = _yfv(s, "researchDevelopment")
        sga    = _yfv(s, "sellingGeneralAdministrative")
        da     = _yfv(s, "depreciationAndAmortization")
        ebitda = (op + da) if op and da else None
        shares = _yfv(s, "dilutedAverageShares")
        return {
            "year":              (s.get("endDate") or {}).get("fmt", "")[:4],
            "revenue":           rev,
            "cogs":              cogs or (rev - gp if rev and gp else None),
            "grossProfit":       gp,
            "rd":                rd,
            "sga":               sga,
            "operatingExpenses": (rd + sga) if rd and sga else None,
            "operatingIncome":   op,
            "preTaxIncome":      _yfv(s, "incomeBeforeTax"),
            "tax":               _yfv(s, "incomeTaxExpense"),
            "netProfit":         _yfv(s, "netIncome"),
            "interestIncome":    _yfv(s, "interestIncome"),
            "interestExpense":   abs(_yfv(s, "interestExpense") or 0) or None,
            "ebitda":            ebitda,
            "da":                da,
            "eps":               _yfv(s, "dilutedEps"),
            "dilutedShares":     (shares / 1e9) if shares else None,
        }

    def parse_bal(s):
        ca   = _yfv(s, "totalCurrentAssets")
        cash = _yfv(s, "cash")
        sti  = _yfv(s, "shortTermInvestments")
        rec  = _yfv(s, "netReceivables")
        inv  = _yfv(s, "inventory")
        oCA  = None
        if ca and cash is not None:
            oCA = ca - (cash or 0) - (sti or 0) - (rec or 0) - (inv or 0)
            if oCA < 0: oCA = None
        ta   = _yfv(s, "totalAssets")
        eq   = _yfv(s, "totalStockholderEquity")
        return {
            "year":               (s.get("endDate") or {}).get("fmt", "")[:4],
            "currentAssets":      ca,
            "cash":               cash,
            "sti":                sti,
            "receivables":        rec,
            "inventory":          inv,
            "otherCurrentAssets": oCA,
            "totalAssets":        ta,
            "ppe":                _yfv(s, "propertyPlantEquipment"),
            "goodwill":           _yfv(s, "goodWill"),
            "intangibles":        _yfv(s, "intangibleAssets"),
            "otherNonCurrentAssets": _yfv(s, "otherAssets"),
            "currentLiabilities": _yfv(s, "totalCurrentLiabilities"),
            "ap":                 _yfv(s, "accountsPayable"),
            "currentDebt":        _yfv(s, "shortLongTermDebt"),
            "deferredRevCurrent": _yfv(s, "deferredRevenue"),
            "otherCurrentLiab":   _yfv(s, "otherCurrentLiab"),
            "ltDebt":             _yfv(s, "longTermDebt"),
            "otherNonCurrentLiab":_yfv(s, "otherLiab"),
            "totalDebt":          _yfv(s, "shortLongTermDebt", "longTermDebt"),
            "equity":             eq,
            "apic":               _yfv(s, "additionalPaidInCapital"),
            "retainedEarnings":   _yfv(s, "retainedEarnings"),
        }

    def parse_cf(s):
        ops  = _yfv(s, "totalCashFromOperatingActivities")
        capx = _yfv(s, "capitalExpenditures")
        ni   = _yfv(s, "netIncome")
        da   = _yfv(s, "depreciation")
        sbc  = _yfv(s, "stockBasedCompensation")
        wc   = _yfv(s, "changeToWorkingCapital")
        bb   = _yfv(s, "repurchaseOfStock")
        div  = _yfv(s, "dividendsPaid")
        return {
            "year":        (s.get("endDate") or {}).get("fmt", "")[:4],
            "netIncome":   ni,
            "da":          da,
            "sbc":         sbc,
            "wc":          wc,
            "cfOps":       ops,
            "capex":       (-abs(capx) if capx else None),
            "cfInvesting": _yfv(s, "totalCashFromInvestingActivities"),
            "buybacks":    (-abs(bb) if bb else None),
            "dividends":   (-abs(div) if div else None),
            "cfFinancing": _yfv(s, "totalCashFromFinancingActivities"),
        }

    historical = {
        "income":   [parse_inc(s) for s in inc_stmts[:5]],
        "balance":  [parse_bal(s) for s in bal_stmts[:5]],
        "cashflow": [parse_cf(s)  for s in cf_stmts[:5]],
    }

    # Most-recent year → input fields
    inc0 = historical["income"][0]  if historical["income"]  else {}
    bal0 = historical["balance"][0] if historical["balance"] else {}

    cf0 = historical["cashflow"][0] if historical.get("cashflow") else {}
    raw_inputs = {
        "currentAssets":      bal0.get("currentAssets"),
        "currentLiabilities": bal0.get("currentLiabilities"),
        "inventory":          bal0.get("inventory"),
        "cash":               bal0.get("cash"),
        "totalAssets":        bal0.get("totalAssets"),
        "equity":             bal0.get("equity"),
        "totalDebt":          bal0.get("totalDebt"),
        "revenue":            inc0.get("revenue"),
        "grossProfit":        inc0.get("grossProfit"),
        "operatingExpenses":  inc0.get("operatingExpenses"),
        "netProfit":          inc0.get("netProfit"),
        "interestExpense":    inc0.get("interestExpense"),
        "receivables":        bal0.get("receivables"),
        "cogs":               inc0.get("cogs"),
        "da":                 inc0.get("da") or cf0.get("da"),
        "accountsPayable":    bal0.get("ap"),
        "operatingCashFlow":  cf0.get("cfOps"),
    }
    data_fields = {}
    for k, v in raw_inputs.items():
        if v is not None and not (isinstance(v, float) and math.isnan(v)) and abs(v) > 0:
            data_fields[k] = str(int(abs(round(v))))

    sector   = profile.get("sector", "")
    currency = profile.get("financialCurrency") or profile.get("currency") or "USD"
    name     = profile.get("longName") or profile.get("shortName") or ""

    total    = len(raw_inputs)
    filled   = len(data_fields)
    coverage = round((filled / total) * 100) if total else 0

    return {
        "name":       name,
        "sector":     sector,
        "industry":   SECTOR_MAP.get(sector, "general"),
        "currency":   currency,
        "coverage":   coverage,
        "filled":     filled,
        "total":      total,
        "data":       data_fields,
        "historical": historical,
    }

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
# ── Keep-alive ping (used by UptimeRobot every 5 min) ────────
@app.get("/ping")
async def ping():
    return {"status": "ok"}


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
#  Yahoo Finance proxy — no API key, no rate limit
# ─────────────────────────────────────────────────────────────

@app.get("/company/yf/{ticker}")
async def get_company_yf(ticker: str):
    """
    Fetch financials for a listed company.
    Priority: yfinance (no key, no rate limit) → Alpha Vantage → FMP
    Results cached 1 hour per ticker.
    """
    sym = ticker.upper().strip()

    # Serve from cache if still fresh
    cached = _yf_data_cache.get(sym)
    if cached and (time.time() - cached["ts"]) < _YF_TTL:
        return cached["data"]

    last_error = "Unknown error"

    # ── 1. yfinance Python library — no API key, no rate limit ───
    try:
        loop   = asyncio.get_event_loop()
        parsed = await loop.run_in_executor(_executor, _yf_fetch_ticker, sym)
        parsed["ticker"] = sym
        _yf_data_cache[sym] = {"data": parsed, "ts": time.time()}
        return parsed
    except Exception as e:
        last_error = str(e)

    # ── 2. Alpha Vantage fallback (25 calls/day) ─────────────────
    av_key = os.environ.get("AV_API_KEY", "")
    if av_key:
        try:
            parsed = await _av_fetch(sym, av_key)
            parsed["ticker"] = sym
            _yf_data_cache[sym] = {"data": parsed, "ts": time.time()}
            return parsed
        except HTTPException:
            raise
        except Exception as e:
            last_error = str(e)

    # ── 3. FMP fallback ───────────────────────────────────────────
    fmp_key = os.environ.get("FMP_API_KEY", "")
    if fmp_key:
        try:
            parsed = await _fmp_fetch(sym, fmp_key)
            parsed["ticker"] = sym
            _yf_data_cache[sym] = {"data": parsed, "ts": time.time()}
            return parsed
        except HTTPException:
            raise
        except Exception as e:
            last_error = str(e)

    raise HTTPException(
        status_code=404,
        detail=f"Could not load data for {sym}. {last_error}",
    )


async def _av_fetch(sym: str, api_key: str) -> dict:
    """Fetch 5-year financials from Alpha Vantage (server-safe, 25 raw calls/day)."""
    AV = "https://www.alphavantage.co/query"

    def _fv(d, *keys):
        for k in keys:
            v = d.get(k)
            if v and v not in ("None", "N/A", "-", ""):
                try:
                    f = float(v)
                    if not math.isnan(f): return f
                except: pass
        return None

    def _is_limited(j: dict) -> bool:
        return bool(j.get("Information") or j.get("Note"))

    async with httpx.AsyncClient(timeout=20) as client:
        # Fetch all 4 in parallel — AV allows 5 req/min so this is fine
        inc_r, bal_r, cf_r, ov_r = await asyncio.gather(
            client.get(f"{AV}?function=INCOME_STATEMENT&symbol={sym}&apikey={api_key}"),
            client.get(f"{AV}?function=BALANCE_SHEET&symbol={sym}&apikey={api_key}"),
            client.get(f"{AV}?function=CASH_FLOW&symbol={sym}&apikey={api_key}"),
            client.get(f"{AV}?function=OVERVIEW&symbol={sym}&apikey={api_key}"),
        )

    inc_j = inc_r.json() if inc_r.status_code == 200 else {}
    bal_j = bal_r.json() if bal_r.status_code == 200 else {}
    cf_j  = cf_r.json()  if cf_r.status_code == 200 else {}
    ov_j  = ov_r.json()  if ov_r.status_code == 200 else {}

    # Rate-limit check — stop here with a clear message
    if _is_limited(inc_j) or _is_limited(bal_j):
        raise HTTPException(
            status_code=429,
            detail="Alpha Vantage daily limit reached (25 calls/day). Quota resets at midnight UTC — try again tomorrow.",
        )

    inc_list = inc_j.get("annualReports") or []
    bal_list = bal_j.get("annualReports") or []
    cf_list  = cf_j.get("annualReports")  or []

    if not inc_list:
        raise HTTPException(status_code=404, detail=f"No Alpha Vantage data for {sym}. Check the ticker.")

    def parse_inc(r):
        rev  = _fv(r, "totalRevenue")
        cogs = _fv(r, "costOfRevenue", "costofGoodsAndServicesSold")
        gp   = _fv(r, "grossProfit") or (rev - cogs if rev and cogs else None)
        op   = _fv(r, "operatingIncome", "ebit")
        rd   = _fv(r, "researchAndDevelopment")
        sga  = _fv(r, "sellingGeneralAndAdministrative")
        da   = _fv(r, "depreciationAndAmortization", "depreciation")
        ni   = _fv(r, "netIncome", "netIncomeFromContinuingOperations")
        ie   = _fv(r, "interestAndDebtExpense", "interestExpense")
        return {
            "year":              r.get("fiscalDateEnding", "")[:4],
            "revenue":           rev,
            "cogs":              cogs or (rev - gp if rev and gp else None),
            "grossProfit":       gp,
            "rd":                rd,
            "sga":               sga,
            "operatingExpenses": (rd + sga) if rd and sga else _fv(r, "operatingExpenses"),
            "operatingIncome":   op,
            "preTaxIncome":      _fv(r, "incomeBeforeTax"),
            "tax":               _fv(r, "incomeTaxExpense"),
            "netProfit":         ni,
            "interestExpense":   abs(ie) if ie else None,
            "ebitda":            _fv(r, "ebitda") or ((op + da) if op and da else None),
            "da":                da,
            "eps":               _fv(r, "dilutedEPS"),
            "dilutedShares":     (_fv(r, "weightedAverageSharesOutstandingDiluted") or 0) / 1e9 or None,
        }

    def parse_bal(r):
        ltd = _fv(r, "longTermDebtNoncurrent", "longTermDebt")
        std = _fv(r, "shortTermDebt", "currentDebt")
        td  = _fv(r, "shortLongTermDebtTotal") or ((std or 0) + (ltd or 0)) or None
        return {
            "year":               r.get("fiscalDateEnding", "")[:4],
            "currentAssets":      _fv(r, "totalCurrentAssets"),
            "cash":               _fv(r, "cashAndCashEquivalentsAtCarryingValue", "cashAndCashEquivalents"),
            "sti":                _fv(r, "shortTermInvestments"),
            "receivables":        _fv(r, "currentNetReceivables", "netReceivables"),
            "inventory":          _fv(r, "inventory"),
            "totalAssets":        _fv(r, "totalAssets"),
            "ppe":                _fv(r, "propertyPlantEquipment"),
            "goodwill":           _fv(r, "goodwill"),
            "intangibles":        _fv(r, "intangibleAssets"),
            "currentLiabilities": _fv(r, "totalCurrentLiabilities"),
            "ap":                 _fv(r, "currentAccountsPayable", "accountsPayable"),
            "currentDebt":        std,
            "ltDebt":             ltd,
            "totalDebt":          td,
            "equity":             _fv(r, "totalShareholderEquity", "totalStockholdersEquity"),
            "apic":               _fv(r, "additionalPaidInCapital"),
            "retainedEarnings":   _fv(r, "retainedEarnings"),
        }

    def parse_cf(r):
        capex = _fv(r, "capitalExpenditures")
        bb    = _fv(r, "paymentsForRepurchaseOfCommonStock", "paymentsForRepurchaseOfEquity")
        div   = _fv(r, "dividendPayout", "dividendPayoutCommonStock")
        return {
            "year":        r.get("fiscalDateEnding", "")[:4],
            "netIncome":   _fv(r, "netIncome", "profitLoss"),
            "da":          _fv(r, "depreciationDepletionAndAmortization"),
            "sbc":         _fv(r, "stockBasedCompensation"),
            "wc":          _fv(r, "changeInOperatingAssets"),
            "cfOps":       _fv(r, "operatingCashflow"),
            "capex":       -abs(capex) if capex else None,
            "cfInvesting": _fv(r, "cashflowFromInvestment"),
            "cfFinancing": _fv(r, "cashflowFromFinancing"),
            "buybacks":    -abs(bb)  if bb  else None,
            "dividends":   -abs(div) if div else None,
        }

    historical = {
        "income":   [parse_inc(r) for r in inc_list[:5]],
        "balance":  [parse_bal(r) for r in bal_list[:5]],
        "cashflow": [parse_cf(r)  for r in cf_list[:5]],
    }

    inc0 = historical["income"][0]  if historical["income"]  else {}
    bal0 = historical["balance"][0] if historical["balance"] else {}

    cf0 = historical["cashflow"][0] if historical.get("cashflow") else {}
    raw_inputs = {
        "currentAssets":      bal0.get("currentAssets"),
        "currentLiabilities": bal0.get("currentLiabilities"),
        "inventory":          bal0.get("inventory"),
        "cash":               bal0.get("cash"),
        "totalAssets":        bal0.get("totalAssets"),
        "equity":             bal0.get("equity"),
        "totalDebt":          bal0.get("totalDebt"),
        "revenue":            inc0.get("revenue"),
        "grossProfit":        inc0.get("grossProfit"),
        "operatingExpenses":  inc0.get("operatingExpenses"),
        "netProfit":          inc0.get("netProfit"),
        "interestExpense":    inc0.get("interestExpense"),
        "receivables":        bal0.get("receivables"),
        "cogs":               inc0.get("cogs"),
        "da":                 inc0.get("da") or cf0.get("da"),
        "accountsPayable":    bal0.get("ap"),
        "operatingCashFlow":  cf0.get("cfOps"),
    }

    data_fields = {}
    for k, v in raw_inputs.items():
        if v is not None and not (isinstance(v, float) and math.isnan(v)) and abs(v) > 0:
            data_fields[k] = str(int(abs(round(v))))

    is_rate_limited = bool(ov_j.get("Information") or ov_j.get("Note"))
    sector   = "" if is_rate_limited else (ov_j.get("Sector", "").title() if ov_j.get("Sector") else "")
    currency = "USD" if is_rate_limited else (ov_j.get("Currency") or "USD")
    name     = sym if is_rate_limited else (ov_j.get("Name") or sym)

    total    = len(raw_inputs)
    filled   = len(data_fields)
    coverage = round((filled / total) * 100) if total else 0

    return {
        "name":       name,
        "sector":     sector,
        "industry":   SECTOR_MAP.get(sector, "general"),
        "currency":   currency,
        "coverage":   coverage,
        "filled":     filled,
        "total":      total,
        "data":       data_fields,
        "historical": historical,
    }


async def _fmp_fetch(sym: str, api_key: str) -> dict:
    """Fetch 5-year financials from Financial Modeling Prep (works from server IPs)."""
    FMP = "https://financialmodelingprep.com/api/v3"

    async with httpx.AsyncClient(timeout=20) as client:
        inc_r, bal_r, cf_r, prof_r = await asyncio.gather(
            client.get(f"{FMP}/income-statement/{sym}?limit=5&apikey={api_key}"),
            client.get(f"{FMP}/balance-sheet-statement/{sym}?limit=5&apikey={api_key}"),
            client.get(f"{FMP}/cash-flow-statement/{sym}?limit=5&apikey={api_key}"),
            client.get(f"{FMP}/profile/{sym}?apikey={api_key}"),
        )

    def _j(r): return r.json() if r.status_code == 200 else []

    inc_list  = _j(inc_r)
    bal_list  = _j(bal_r)
    cf_list   = _j(cf_r)
    prof_list = _j(prof_r)

    if not inc_list or not isinstance(inc_list, list) or "Error Message" in str(inc_list):
        raise HTTPException(status_code=404, detail=f"No FMP data found for {sym}. Check the ticker or API key.")

    def fv(d, *keys):
        for k in keys:
            v = d.get(k)
            if v is not None:
                try:
                    f = float(v)
                    if not math.isnan(f): return f
                except: pass
        return None

    def parse_inc(d):
        rev  = fv(d, "revenue")
        cogs = fv(d, "costOfRevenue")
        gp   = fv(d, "grossProfit")
        rd   = fv(d, "researchAndDevelopmentExpenses")
        sga  = fv(d, "sellingGeneralAndAdministrativeExpenses")
        op   = fv(d, "operatingIncome")
        ie   = fv(d, "interestExpense")
        da   = fv(d, "depreciationAndAmortization")
        ni   = fv(d, "netIncome")
        return {
            "year":              d.get("calendarYear", d.get("date", "")[:4]),
            "revenue":           rev,
            "cogs":              cogs,
            "grossProfit":       gp,
            "rd":                rd,
            "sga":               sga,
            "operatingExpenses": fv(d, "operatingExpenses") or ((rd+sga) if rd and sga else None),
            "operatingIncome":   op,
            "preTaxIncome":      fv(d, "incomeBeforeTax"),
            "tax":               fv(d, "incomeTaxExpense"),
            "netProfit":         ni,
            "interestExpense":   abs(ie) if ie else None,
            "ebitda":            fv(d, "ebitda") or ((op+da) if op and da else None),
            "da":                da,
            "eps":               fv(d, "epsDiluted", "eps"),
            "dilutedShares":     (fv(d, "weightedAverageShsOutDil") or 0) / 1e9 or None,
        }

    def parse_bal(d):
        ltd = fv(d, "longTermDebt")
        std = fv(d, "shortTermDebt")
        td  = fv(d, "totalDebt") or ((std or 0) + (ltd or 0)) or None
        return {
            "year":               d.get("calendarYear", d.get("date", "")[:4]),
            "currentAssets":      fv(d, "totalCurrentAssets"),
            "cash":               fv(d, "cashAndCashEquivalents"),
            "sti":                fv(d, "shortTermInvestments"),
            "receivables":        fv(d, "netReceivables"),
            "inventory":          fv(d, "inventory"),
            "totalAssets":        fv(d, "totalAssets"),
            "ppe":                fv(d, "propertyPlantEquipmentNet"),
            "goodwill":           fv(d, "goodwill"),
            "intangibles":        fv(d, "intangibleAssets"),
            "currentLiabilities": fv(d, "totalCurrentLiabilities"),
            "ap":                 fv(d, "accountPayables"),
            "currentDebt":        std,
            "ltDebt":             ltd,
            "totalDebt":          td,
            "equity":             fv(d, "totalStockholdersEquity", "totalEquity"),
            "apic":               fv(d, "commonStock"),
            "retainedEarnings":   fv(d, "retainedEarnings"),
        }

    def parse_cf(d):
        capex = fv(d, "capitalExpenditure", "investmentsInPropertyPlantAndEquipment")
        bb    = fv(d, "commonStockRepurchased")
        div   = fv(d, "dividendsPaid")
        return {
            "year":        d.get("calendarYear", d.get("date", "")[:4]),
            "netIncome":   fv(d, "netIncome"),
            "da":          fv(d, "depreciationAndAmortization"),
            "sbc":         fv(d, "stockBasedCompensation"),
            "wc":          fv(d, "changeInWorkingCapital"),
            "cfOps":       fv(d, "operatingCashFlow", "netCashProvidedByOperatingActivities"),
            "capex":       (-abs(capex) if capex else None),
            "cfInvesting": fv(d, "netCashUsedForInvestingActivites"),
            "cfFinancing": fv(d, "netCashUsedProvidedByFinancingActivities"),
            "buybacks":    (-abs(bb)  if bb  else None),
            "dividends":   (-abs(div) if div else None),
        }

    historical = {
        "income":   [parse_inc(d) for d in inc_list[:5]],
        "balance":  [parse_bal(d) for d in bal_list[:5]],
        "cashflow": [parse_cf(d)  for d in cf_list[:5]],
    }

    inc0 = historical["income"][0]  if historical["income"]  else {}
    bal0 = historical["balance"][0] if historical["balance"] else {}

    cf0 = historical["cashflow"][0] if historical.get("cashflow") else {}
    raw_inputs = {
        "currentAssets":      bal0.get("currentAssets"),
        "currentLiabilities": bal0.get("currentLiabilities"),
        "inventory":          bal0.get("inventory"),
        "cash":               bal0.get("cash"),
        "totalAssets":        bal0.get("totalAssets"),
        "equity":             bal0.get("equity"),
        "totalDebt":          bal0.get("totalDebt"),
        "revenue":            inc0.get("revenue"),
        "grossProfit":        inc0.get("grossProfit"),
        "operatingExpenses":  inc0.get("operatingExpenses"),
        "netProfit":          inc0.get("netProfit"),
        "interestExpense":    inc0.get("interestExpense"),
        "receivables":        bal0.get("receivables"),
        "cogs":               inc0.get("cogs"),
        "da":                 inc0.get("da") or cf0.get("da"),
        "accountsPayable":    bal0.get("ap"),
        "operatingCashFlow":  cf0.get("cfOps"),
    }

    data_fields = {}
    for k, v in raw_inputs.items():
        if v is not None and not (isinstance(v, float) and math.isnan(v)) and abs(v) > 0:
            data_fields[k] = str(int(abs(round(v))))

    prof  = prof_list[0] if prof_list and isinstance(prof_list, list) else {}
    sector   = prof.get("sector", "")
    currency = prof.get("currency", "USD")
    name     = prof.get("companyName", sym)

    total    = len(raw_inputs)
    filled   = len(data_fields)
    coverage = round((filled / total) * 100) if total else 0

    return {
        "name":       name,
        "sector":     sector,
        "industry":   SECTOR_MAP.get(sector, "general"),
        "currency":   currency,
        "coverage":   coverage,
        "filled":     filled,
        "total":      total,
        "data":       data_fields,
        "historical": historical,
    }


def _yf_fetch_ticker(sym: str) -> dict:
    """
    Blocking — run in executor.
    Uses yfinance library which manages Yahoo Finance auth internally.
    Maps DataFrame rows (financial line items) to our 14-field input format.
    """
    import pandas as pd

    tk = yf.Ticker(sym)

    inc_df: pd.DataFrame | None = None
    bal_df: pd.DataFrame | None = None
    cf_df:  pd.DataFrame | None = None
    info:   dict = {}

    try: inc_df = tk.financials
    except Exception: pass
    try: bal_df = tk.balance_sheet
    except Exception: pass
    try: cf_df  = tk.cashflow
    except Exception: pass
    try: info   = tk.info or {}
    except Exception: pass

    has_inc = inc_df is not None and not inc_df.empty
    has_bal = bal_df is not None and not bal_df.empty

    if not has_inc and not has_bal:
        raise ValueError(f"No financial data found for {sym} — ticker may be invalid or delisted.")

    # ── Field-name aliases (yfinance renames between versions) ──
    _INC_REVENUE    = ['Total Revenue', 'Revenue', 'TotalRevenue']
    _INC_COGS       = ['Cost Of Revenue', 'CostOfRevenue', 'Cost of Revenue']
    _INC_GP         = ['Gross Profit', 'GrossProfit']
    _INC_RD         = ['Research And Development', 'Research Development', 'Research & Development']
    _INC_SGA        = ['Selling General Administrative', 'Selling General And Administrative',
                       'Selling General And Admin', 'SG&A', 'Selling And Marketing Expense']
    _INC_OP         = ['Operating Income', 'Operating Income Loss', 'OperatingIncome', 'EBIT']
    _INC_PRETAX     = ['Pretax Income', 'Income Before Tax', 'PretaxIncome']
    _INC_TAX        = ['Tax Provision', 'Income Tax Expense', 'TaxProvision']
    _INC_NI         = ['Net Income', 'Net Income Common Stockholders', 'NetIncome',
                       'Net Income Including Noncontrolling Interests']
    _INC_IE         = ['Interest Expense', 'Interest Expense Non Operating',
                       'Interest And Debt Expense', 'InterestExpense']
    _INC_DA         = ['Reconciled Depreciation', 'Depreciation And Amortization',
                       'Depreciation Amortization Depletion', 'Depreciation', 'D&A']
    _INC_EBITDA     = ['EBITDA', 'Normalized EBITDA']
    _INC_EPS        = ['Diluted EPS', 'Basic EPS', 'DilutedEPS']

    _BAL_TA         = ['Total Assets', 'TotalAssets']
    _BAL_CA         = ['Current Assets', 'Total Current Assets', 'TotalCurrentAssets']
    _BAL_CASH       = ['Cash And Cash Equivalents', 'Cash',
                       'Cash Cash Equivalents And Short Term Investments',
                       'Cash And Short Term Investments']
    _BAL_REC        = ['Receivables', 'Net Receivables', 'Accounts Receivable', 'NetReceivables']
    _BAL_INV        = ['Inventory', 'Inventories']
    _BAL_CL         = ['Current Liabilities', 'Total Current Liabilities', 'TotalCurrentLiabilities']
    _BAL_LTD        = ['Long Term Debt', 'LongTermDebt', 'Long Term Debt And Capital Lease Obligation']
    _BAL_STD        = ['Current Debt', 'Short Long Term Debt', 'Current Debt And Capital Lease Obligation',
                       'ShortLongTermDebt']
    _BAL_EQ         = ['Stockholders Equity', 'Common Stock Equity', 'Total Stockholder Equity',
                       'TotalStockholderEquity', 'Stockholders Equity Net Of Treasury Stock']
    _BAL_RE         = ['Retained Earnings', 'RetainedEarnings']
    _BAL_PPE        = ['Net PPE', 'Property Plant Equipment Net', 'Net Property Plant And Equipment']
    _BAL_GW         = ['Goodwill', 'GoodWill']
    _BAL_APIC       = ['Additional Paid In Capital', 'Capital Surplus']

    _CF_OPS         = ['Operating Cash Flow', 'Total Cash From Operating Activities']
    _CF_CAPEX       = ['Capital Expenditure', 'Capital Expenditures', 'Purchase Of PPE']
    _CF_INV         = ['Investing Cash Flow', 'Total Cash From Investing Activities']
    _CF_FIN         = ['Financing Cash Flow', 'Total Cash From Financing Activities']
    _CF_DA          = ['Depreciation And Amortization', 'Reconciled Depreciation', 'Depreciation']
    _CF_SBC         = ['Stock Based Compensation', 'Share Based Compensation']
    _CF_NI          = ['Net Income', 'Net Income From Continuing Operations']
    _CF_WC          = ['Change In Working Capital', 'Changes In Working Capital']
    _CF_BB          = ['Repurchase Of Capital Stock', 'Common Stock Repurchase',
                       'Payments For Repurchase Of Common Stock']
    _CF_DIV         = ['Cash Dividends Paid', 'Common Stock Dividend Paid', 'Dividends Paid']

    def gv(df: pd.DataFrame | None, col, *label_lists) -> float | None:
        """Get the first non-NaN value from df at column=col, trying all label aliases."""
        if df is None or df.empty:
            return None
        for labels in label_lists:
            for label in (labels if isinstance(labels, list) else [labels]):
                if label in df.index:
                    try:
                        raw = df.at[label, col]
                        if raw is not None and not (isinstance(raw, float) and math.isnan(raw)):
                            return float(raw)
                    except Exception:
                        pass
        return None

    def parse_inc(col):
        rev  = gv(inc_df, col, _INC_REVENUE)
        cogs = gv(inc_df, col, _INC_COGS)
        gp   = gv(inc_df, col, _INC_GP)
        if gp is None and rev and cogs: gp = rev - cogs
        op   = gv(inc_df, col, _INC_OP)
        rd   = gv(inc_df, col, _INC_RD)
        sga  = gv(inc_df, col, _INC_SGA)
        da   = gv(inc_df, col, _INC_DA)
        ni   = gv(inc_df, col, _INC_NI)
        ie   = gv(inc_df, col, _INC_IE)
        ebitda = gv(inc_df, col, _INC_EBITDA) or ((op + da) if op and da else None)
        return {
            "year":              str(col.year) if hasattr(col, "year") else str(col)[:4],
            "revenue":           rev,
            "cogs":              cogs or (rev - gp if rev and gp else None),
            "grossProfit":       gp,
            "rd":                rd,
            "sga":               sga,
            "operatingExpenses": (rd + sga) if rd and sga else None,
            "operatingIncome":   op,
            "preTaxIncome":      gv(inc_df, col, _INC_PRETAX),
            "tax":               gv(inc_df, col, _INC_TAX),
            "netProfit":         ni,
            "interestExpense":   abs(ie) if ie else None,
            "ebitda":            ebitda,
            "da":                da,
            "eps":               gv(inc_df, col, _INC_EPS),
        }

    def parse_bal(col):
        ltd = gv(bal_df, col, _BAL_LTD)
        std = gv(bal_df, col, _BAL_STD)
        td  = (std or 0) + (ltd or 0)
        return {
            "year":               str(col.year) if hasattr(col, "year") else str(col)[:4],
            "currentAssets":      gv(bal_df, col, _BAL_CA),
            "cash":               gv(bal_df, col, _BAL_CASH),
            "receivables":        gv(bal_df, col, _BAL_REC),
            "inventory":          gv(bal_df, col, _BAL_INV),
            "totalAssets":        gv(bal_df, col, _BAL_TA),
            "ppe":                gv(bal_df, col, _BAL_PPE),
            "goodwill":           gv(bal_df, col, _BAL_GW),
            "currentLiabilities": gv(bal_df, col, _BAL_CL),
            "ltDebt":             ltd,
            "currentDebt":        std,
            "totalDebt":          td if td > 0 else None,
            "equity":             gv(bal_df, col, _BAL_EQ),
            "retainedEarnings":   gv(bal_df, col, _BAL_RE),
            "apic":               gv(bal_df, col, _BAL_APIC),
        }

    def parse_cf(col):
        capex = gv(cf_df, col, _CF_CAPEX)
        bb    = gv(cf_df, col, _CF_BB)
        div   = gv(cf_df, col, _CF_DIV)
        return {
            "year":        str(col.year) if hasattr(col, "year") else str(col)[:4],
            "netIncome":   gv(cf_df, col, _CF_NI),
            "da":          gv(cf_df, col, _CF_DA),
            "sbc":         gv(cf_df, col, _CF_SBC),
            "wc":          gv(cf_df, col, _CF_WC),
            "cfOps":       gv(cf_df, col, _CF_OPS),
            "capex":       -abs(capex) if capex else None,
            "cfInvesting": gv(cf_df, col, _CF_INV),
            "buybacks":    -abs(bb)    if bb    else None,
            "dividends":   -abs(div)   if div   else None,
            "cfFinancing": gv(cf_df, col, _CF_FIN),
        }

    inc_cols = list(inc_df.columns[:5]) if has_inc else []
    bal_cols = list(bal_df.columns[:5]) if has_bal else []
    cf_cols  = list(cf_df.columns[:5])  if (cf_df is not None and not cf_df.empty) else []

    historical = {
        "income":   [parse_inc(c) for c in inc_cols],
        "balance":  [parse_bal(c) for c in bal_cols],
        "cashflow": [parse_cf(c)  for c in cf_cols],
    }

    inc0 = historical["income"][0]  if historical["income"]  else {}
    bal0 = historical["balance"][0] if historical["balance"] else {}

    cf0 = historical["cashflow"][0] if historical.get("cashflow") else {}
    raw_inputs = {
        "currentAssets":      bal0.get("currentAssets"),
        "currentLiabilities": bal0.get("currentLiabilities"),
        "inventory":          bal0.get("inventory"),
        "cash":               bal0.get("cash"),
        "totalAssets":        bal0.get("totalAssets"),
        "equity":             bal0.get("equity"),
        "totalDebt":          bal0.get("totalDebt"),
        "revenue":            inc0.get("revenue"),
        "grossProfit":        inc0.get("grossProfit"),
        "operatingExpenses":  inc0.get("operatingExpenses"),
        "netProfit":          inc0.get("netProfit"),
        "interestExpense":    inc0.get("interestExpense"),
        "receivables":        bal0.get("receivables"),
        "cogs":               inc0.get("cogs"),
        "da":                 inc0.get("da") or cf0.get("da"),
        "accountsPayable":    bal0.get("ap"),
        "operatingCashFlow":  cf0.get("cfOps"),
    }

    data_fields = {}
    for k, v in raw_inputs.items():
        if v is not None and not (isinstance(v, float) and math.isnan(v)) and abs(v) > 0:
            data_fields[k] = str(int(abs(round(v))))

    sector   = info.get("sector", "")
    currency = info.get("currency", "USD")
    name     = info.get("longName") or info.get("shortName") or sym

    total    = len(raw_inputs)
    filled   = len(data_fields)
    coverage = round((filled / total) * 100) if total else 0

    return {
        "name":       name,
        "sector":     sector,
        "industry":   SECTOR_MAP.get(sector, "general"),
        "currency":   currency,
        "coverage":   coverage,
        "filled":     filled,
        "total":      total,
        "data":       data_fields,
        "historical": historical,
    }


# ─────────────────────────────────────────────────────────────
#  IB-STYLE EXCEL EXPORT — Models
# ─────────────────────────────────────────────────────────────

class IncomeYear(BaseModel):
    year: str = ''
    revenue: Optional[float] = None
    grossProfit: Optional[float] = None
    cogs: Optional[float] = None
    rd: Optional[float] = None
    sga: Optional[float] = None
    operatingExpenses: Optional[float] = None
    operatingIncome: Optional[float] = None
    preTaxIncome: Optional[float] = None
    tax: Optional[float] = None
    netProfit: Optional[float] = None
    interestIncome: Optional[float] = None
    interestExpense: Optional[float] = None
    ebitda: Optional[float] = None
    da: Optional[float] = None
    eps: Optional[float] = None
    dilutedShares: Optional[float] = None   # in billions

class BalanceYear(BaseModel):
    year: str = ''
    currentAssets: Optional[float] = None
    cash: Optional[float] = None
    sti: Optional[float] = None             # short-term investments
    receivables: Optional[float] = None
    inventory: Optional[float] = None
    otherCurrentAssets: Optional[float] = None
    totalAssets: Optional[float] = None
    ppe: Optional[float] = None
    goodwill: Optional[float] = None
    intangibles: Optional[float] = None
    otherNonCurrentAssets: Optional[float] = None
    currentLiabilities: Optional[float] = None
    ap: Optional[float] = None
    currentDebt: Optional[float] = None
    deferredRevCurrent: Optional[float] = None
    otherCurrentLiab: Optional[float] = None
    ltDebt: Optional[float] = None
    otherNonCurrentLiab: Optional[float] = None
    totalDebt: Optional[float] = None
    equity: Optional[float] = None
    apic: Optional[float] = None
    retainedEarnings: Optional[float] = None

class CashFlowYear(BaseModel):
    year: str = ''
    netIncome: Optional[float] = None
    da: Optional[float] = None
    sbc: Optional[float] = None
    wc: Optional[float] = None
    cfOps: Optional[float] = None
    capex: Optional[float] = None           # stored as negative
    cfInvesting: Optional[float] = None
    buybacks: Optional[float] = None        # stored as negative
    dividends: Optional[float] = None       # stored as negative
    cfFinancing: Optional[float] = None

class Historical(BaseModel):
    income:   List[IncomeYear]    = []
    balance:  List[BalanceYear]   = []
    cashflow: List[CashFlowYear]  = []

class ExcelRequest(BaseModel):
    company:    CompanyCtx = CompanyCtx()
    industry:   str = 'general'
    score:      int = 0
    ratios:     dict = {}
    statuses:   dict = {}
    inputs:     dict = {}
    historical: Historical = Historical()
    ai_insights: dict = {}


# ── Colour palette ────────────────────────────────────────────
_NAVY_HDR = '#0D1B3E'   # dark navy header (matches reference IB model)
_NAVY     = '#003366'
_WHITE    = '#FFFFFF'
_BLACK    = '#000000'
_DGREY    = '#595959'
_LGREY    = '#F5F5F5'
_GREEN    = '#00B050'
_AMBER    = '#FFC000'
_RED_C    = '#FF4444'
_BLUE_INP = '#4472C4'   # blue for DCF assumption cells

STATUS_LBL = {'green': 'Healthy', 'amber': 'Borderline', 'red': 'Critical', 'na': 'N/A'}

# ── Industry comps data (illustrative) ───────────────────────
_COMPS: dict = {
    'tech': [
        ('AMD',      'AMD',  220,  235,  23.0, 4.5, 10.2, 52.2, 16.5),
        ('Intel',    'INTC',  90,  115,  53.0, 8.0,  2.2, 14.4,  None),
        ('Broadcom', 'AVGO', 800,  900,  51.0,30.0, 17.6, 30.0, 24.5),
        ('Qualcomm', 'QCOM', 165,  175,  39.0,10.0,  4.5, 17.5, 15.2),
        ('Marvell',  'MRVL',  60,   70,   6.0, 1.5, 11.7, 46.7, 30.1),
    ],
    'healthcare': [
        ('Johnson & Johnson', 'JNJ',  380, 420,  88.0, 25.0,  4.8, 16.8, 19.2),
        ('Pfizer',           'PFE',  140, 165,  63.0, 12.0,  2.6, 13.8, 12.1),
        ('AbbVie',           'ABBV', 290, 330,  58.0, 19.0,  5.7, 17.4, 21.3),
        ('Merck',            'MRK',  220, 250,  63.0, 20.0,  4.0, 12.5, 14.8),
        ('Bristol-Myers',    'BMY',  110, 135,  48.0, 13.0,  2.8, 10.4,  9.5),
    ],
    'finance': [
        ('JPMorgan Chase',  'JPM', 620, 650, 180.0, 65.0, 3.6, 10.0, 12.5),
        ('Bank of America', 'BAC', 280, 310,  98.0, 35.0, 3.2,  8.9, 10.8),
        ('Goldman Sachs',   'GS',  180, 200,  55.0, 22.0, 3.6,  9.1, 11.2),
        ('Morgan Stanley',  'MS',  160, 175,  58.0, 20.0, 3.0,  8.8, 10.5),
        ('Wells Fargo',     'WFC', 210, 240,  82.0, 28.0, 2.9,  8.6, 10.2),
    ],
    'retail': [
        ('Walmart',    'WMT',  550, 600, 680.0, 28.0, 0.9, 21.4, 30.5),
        ('Costco',     'COST', 380, 400, 238.0, 10.0, 1.7, 40.0, 50.2),
        ('Amazon',     'AMZN',1800,1950, 575.0, 90.0, 3.4, 21.7, 45.8),
        ('Target',     'TGT',   65,  78, 108.0,  8.0, 0.7,  9.8, 14.5),
        ('Home Depot', 'HD',   330, 365, 153.0, 25.0, 2.4, 14.6, 22.3),
    ],
    'manufacturing': [
        ('Caterpillar', 'CAT', 170, 200, 64.0, 12.0, 3.1, 16.7, 15.2),
        ('Honeywell',   'HON', 130, 155, 38.0,  9.0, 4.1, 17.2, 20.5),
        ('GE Aerospace','GE',  180, 210, 39.0,  7.0, 5.4, 30.0, 35.8),
        ('3M',          'MMM',  60,  80, 24.0,  5.0, 3.3, 16.0, 14.2),
        ('Deere',       'DE',  120, 140, 48.0, 10.0, 2.9, 14.0, 12.8),
    ],
    'general': [
        ('Apple',     'AAPL', 3200, 3250, 400.0, 130.0,  8.1, 25.0, 31.2),
        ('Microsoft', 'MSFT', 2800, 2820, 245.0, 120.0, 11.5, 23.5, 37.8),
        ('Alphabet',  'GOOGL',2000, 2050, 340.0, 110.0,  6.0, 18.6, 23.5),
        ('Meta',      'META', 1200, 1220, 165.0,  80.0,  7.4, 15.3, 27.8),
        ('Berkshire', 'BRK.B', 900,  920, 364.0,  40.0,  2.5, 23.0, 20.1),
    ],
}

# ── DCF growth rate assumptions per industry ─────────────────
_DCF_GROWTH = {
    'tech':          [0.30, 0.22, 0.18, 0.14, 0.12],
    'healthcare':    [0.12, 0.10, 0.09, 0.08, 0.07],
    'finance':       [0.09, 0.08, 0.07, 0.06, 0.05],
    'retail':        [0.07, 0.06, 0.06, 0.05, 0.04],
    'manufacturing': [0.07, 0.06, 0.06, 0.05, 0.04],
    'general':       [0.10, 0.08, 0.07, 0.06, 0.05],
}
_DCF_EBITDA_MARGIN = {
    'tech': [0.28, 0.30, 0.31, 0.31, 0.32],
    'healthcare': [0.25, 0.26, 0.27, 0.27, 0.27],
    'finance':    [0.35, 0.36, 0.37, 0.37, 0.37],
    'retail':     [0.08, 0.08, 0.09, 0.09, 0.09],
    'manufacturing': [0.16, 0.17, 0.17, 0.18, 0.18],
    'general':    [0.22, 0.23, 0.24, 0.24, 0.25],
}


def _mm(v):
    """Raw value → $ millions (2 dp)."""
    if v is None: return None
    return round(v / 1_000_000, 2)

def _ratio(num, den):
    """Returns decimal fraction for Excel % format."""
    if num is None or den is None or den == 0: return None
    return num / den

def _yoy(curr, prev):
    """YoY growth as decimal fraction."""
    if curr is None or prev is None or prev == 0: return None
    return (curr - prev) / abs(prev)


def build_excel(req: ExcelRequest) -> bytes:
    from datetime import date
    output = io.BytesIO()
    wb = xlsxwriter.Workbook(output, {'in_memory': True, 'nan_inf_to_errors': True})

    co   = req.company.name or 'Company'
    tick = req.company.ticker or ''
    curr = req.company.currency or 'USD'
    today_str = date.today().strftime('%d %B %Y')

    # ── Format factory ────────────────────────────────────────
    def F(**kw):
        base = {'font_name': 'Calibri', 'font_size': 10, 'valign': 'vcenter'}
        base.update(kw)
        return wb.add_format(base)

    # Title / meta
    f_title   = F(bold=True, font_size=14, font_color=_NAVY_HDR)
    f_sub     = F(font_size=10, font_color=_DGREY)
    f_cover_h = F(bold=True, font_size=11, font_color=_NAVY_HDR)
    f_cover_t = F(font_size=10, font_color=_BLACK)
    f_cover_b = F(bold=True, font_size=10, font_color=_BLACK)

    # Header row (dark navy)
    f_hdr = F(bold=True, font_color=_WHITE, bg_color=_NAVY_HDR, align='center', border=1)

    # Section label (ALL CAPS, bold, no fill)
    f_sec = F(bold=True, font_size=10, font_color=_BLACK)

    # Bold row (subtotal) — left label
    f_bold_lbl = F(bold=True, font_color=_BLACK, border=1)
    # Bold row — right number
    f_bold_num = F(bold=True, font_color=_BLACK, num_format='#,##0', align='right', border=1)

    # Regular row — label (1-space indent)
    f_lbl = F(font_color=_BLACK, border=1, indent=1)
    # Regular row — number
    f_num = F(num_format='#,##0', align='right', border=1)

    # % sub-row (grey italic, 2-space indent)
    f_pct_lbl = F(font_color=_DGREY, border=1, indent=2, italic=True)
    f_pct_num = F(num_format='0.0%', align='right', border=1, font_color=_DGREY, italic=True)

    # YoY growth
    f_pos = F(num_format='0.0%', align='right', border=1, font_color=_GREEN, italic=True)
    f_neg = F(num_format='0.0%', align='right', border=1, font_color=_RED_C, italic=True)
    f_na  = F(align='center', border=1, font_color='#AAAAAA')

    # EPS / shares
    f_eps = F(bold=True, num_format='$0.00', align='right', border=1)
    f_shr = F(num_format='0.0', align='right', border=1)

    # DCF blue input
    f_inp_pct = F(font_color=_BLUE_INP, num_format='0.0%', align='right', border=1)
    f_inp_num = F(font_color=_BLUE_INP, num_format='0.00', align='right', border=1)

    # Status
    f_grn = F(bold=True, font_color=_WHITE,  bg_color=_GREEN, align='center', border=1)
    f_amb = F(bold=True, font_color=_BLACK,  bg_color=_AMBER, align='center', border=1)
    f_red = F(bold=True, font_color=_WHITE,  bg_color=_RED_C, align='center', border=1)
    f_nas = F(font_color='#888888', align='center', border=1)
    f_txt = F(align='left', border=1)
    f_ctr = F(align='center', border=1)
    f_wrap= F(text_wrap=True, align='left', valign='top', border=1)

    def sfmt(s):
        return {'green': f_grn, 'amber': f_amb, 'red': f_red}.get(s, f_nas)

    def gfmt(v):
        if v is None: return f_pct_num
        return f_pos if v >= 0 else f_neg

    # ── Reversed (oldest→newest) views for Excel display ──────
    inc = list(reversed(req.historical.income))
    bal = list(reversed(req.historical.balance))
    cf  = list(reversed(req.historical.cashflow))
    n_inc = len(inc)
    n_bal = len(bal)
    n_cf  = len(cf)

    # ──────────────────────────────────────────────────────────
    # SHEET 1 — COVER & NOTES
    # ──────────────────────────────────────────────────────────
    ws0 = wb.add_worksheet('Cover & Notes')
    ws0.set_column('A:A', 28)
    ws0.set_column('B:B', 70)
    ws0.set_zoom(90)

    # Title block
    ws0.merge_range('A1:B1', '', F(font_size=4))  # spacer
    entity_title = f'{co.upper()}  |  INVESTMENT BANKING FINANCIAL MODEL'
    ws0.merge_range('A2:B2', entity_title if tick else co.upper(), f_title)
    meta_line = f'Ticker: {tick}  |  Industry: {req.industry.title()}  |  Currency: {curr}  |  Units: $ Millions'
    ws0.merge_range('A3:B3', meta_line, f_sub)
    ws0.merge_range('A4:B4', f'Source: Alpha Vantage  |  Data as of {today_str}', f_sub)
    ws0.merge_range('A5:B5', '', F(font_size=4))

    # Model Contents table
    ws0.write('A6', 'Model Contents', f_cover_h)
    contents = [
        ('Cover & Notes',    'This sheet — model overview, color coding, key assumptions.'),
        ('Financial Ratios', 'Current-period ratios across Liquidity, Profitability, Efficiency & Leverage.'),
        ('Income Statement', f'Historical P&L FY{inc[0].year if inc else "—"}–FY{inc[-1].year if inc else "—"}. Revenue, Gross Profit, EBITDA, EBIT, Net Income, EPS.'),
        ('Balance Sheet',    f'Historical B/S FY{bal[0].year if bal else "—"}–FY{bal[-1].year if bal else "—"}. Assets, Liabilities, Shareholders\' Equity.'),
        ('Cash Flow',        f'Historical CFS FY{cf[0].year if cf else "—"}–FY{cf[-1].year if cf else "—"}. Operating, Investing, Financing + Free Cash Flow.'),
        ('DCF Valuation',    '5-year DCF model. WACC = 10%, TGR = 4%. Blue cells are editable assumptions.'),
        ('Comps',            f'{req.industry.title()} sector peer trading comparables. Illustrative multiples.'),
        ('AI Insights',      'AI-generated executive summary, risks, opportunities, and priority actions.'),
    ]
    for i, (sheet, desc) in enumerate(contents):
        ws0.write(6+i, 0, sheet, f_cover_b)
        ws0.write(6+i, 1, desc,  f_cover_t)

    # Color Coding legend
    ws0.write('A15', 'Color Coding', f_cover_h)
    ws0.write('A16', 'Blue text',   F(bold=True, font_color=_BLUE_INP))
    ws0.write('B16', 'Hardcoded inputs / assumptions — change these to run scenarios', f_cover_t)
    ws0.write('A17', 'Black text',  f_cover_b)
    ws0.write('B17', 'Calculated formulas', f_cover_t)
    ws0.write('A18', 'Green fill',  F(bold=True, font_color=_WHITE, bg_color=_GREEN))
    ws0.write('B18', 'Healthy / positive indicator', f_cover_t)
    ws0.write('A19', 'Amber fill',  F(bold=True, font_color=_BLACK, bg_color=_AMBER))
    ws0.write('B19', 'Borderline / watch indicator', f_cover_t)
    ws0.write('A20', 'Red fill',    F(bold=True, font_color=_WHITE, bg_color=_RED_C))
    ws0.write('B20', 'Critical / negative indicator', f_cover_t)

    # Key DCF Assumptions
    growth_rates = _DCF_GROWTH.get(req.industry, _DCF_GROWTH['general'])
    ebitda_margins = _DCF_EBITDA_MARGIN.get(req.industry, _DCF_EBITDA_MARGIN['general'])
    ws0.write('A22', 'Key Assumptions (DCF)', f_cover_h)
    assumptions = [
        ('Revenue Growth', f'FY+1: {growth_rates[0]:.0%}, FY+2: {growth_rates[1]:.0%}, FY+3: {growth_rates[2]:.0%}, FY+4: {growth_rates[3]:.0%}, FY+5: {growth_rates[4]:.0%}'),
        ('EBITDA Margin',  f'~{ebitda_margins[2]:.0%}–{ebitda_margins[4]:.0%} — based on industry norms for {req.industry}'),
        ('WACC',           '10% — reflects equity risk premium for the sector'),
        ('Terminal Growth','4% — long-run nominal GDP growth + industry tailwinds'),
        ('D&A % Revenue',  '2% — capex-light assumption; adjust for asset-heavy industries'),
        ('CapEx % Revenue','4% — typical maintenance + growth capex assumption'),
        ('Tax Rate',       '21% — US federal statutory rate; adjust for non-US entities'),
    ]
    for i, (k, v) in enumerate(assumptions):
        ws0.write(22+i, 0, k, f_cover_b)
        ws0.write(22+i, 1, v, f_cover_t)

    # ──────────────────────────────────────────────────────────
    # SHEET 2 — FINANCIAL RATIOS
    # ──────────────────────────────────────────────────────────
    ws1 = wb.add_worksheet('Financial Ratios')
    ws1.set_column('A:A', 28)
    ws1.set_column('B:B', 14)
    ws1.set_column('C:C', 14)
    ws1.set_column('D:D', 14)
    ws1.set_column('E:E', 46)

    ws1.write(0, 0, f'{co} ({tick})' if tick else co, f_title)
    ws1.write(1, 0, f'Financial Ratios  |  {req.industry.title()}  |  Score: {req.score}/100  |  {today_str}', f_sub)

    verdict = ('STRONG' if req.score >= 80 else 'MODERATE' if req.score >= 60
               else 'BELOW AVERAGE' if req.score >= 40 else 'CRITICAL')
    v_sfmt = f_grn if req.score >= 80 else f_amb if req.score >= 60 else f_red

    ws1.write(2, 0, 'Health Score', f_bold_lbl)
    ws1.write(2, 1, f'{req.score}/100', f_ctr)
    ws1.write(2, 2, 'Verdict', f_bold_lbl)
    ws1.merge_range(2, 3, 2, 4, verdict, v_sfmt)

    counts = {'green': 0, 'amber': 0, 'red': 0, 'na': 0}
    for s in req.statuses.values(): counts[s] = counts.get(s, 0) + 1
    ws1.write(3, 0, 'Healthy', f_grn); ws1.write(3, 1, counts['green'], f_grn)
    ws1.write(3, 2, 'Borderline', f_amb); ws1.write(3, 3, counts['amber'], f_amb)
    ws1.write(3, 4, f"Critical: {counts['red']}  |  N/A: {counts['na']}", f_red)

    ws1.write_row(4, 0, ['RATIO', 'VALUE', 'STATUS', 'BENCHMARK', 'INTERPRETATION'], f_hdr)

    RATIO_ROWS = [
        ('LIQUIDITY', None, None, None),
        ('Current Ratio',       'currentRatio',       'x',    '>1.5x'),
        ('Quick Ratio',         'quickRatio',          'x',   '>1.0x'),
        ('Cash Ratio',          'cashRatio',            'x',  '>0.5x'),
        ('PROFITABILITY', None, None, None),
        ('Gross Margin',        'grossMargin',          '%',  '>30%'),
        ('Operating Margin',    'operatingMargin',      '%',  '>15%'),
        ('Net Margin',          'netMargin',            '%',  '>10%'),
        ('Return on Equity',    'roe',                  '%',  '>15%'),
        ('Return on Assets',    'roa',                  '%',   '>5%'),
        ('EFFICIENCY', None, None, None),
        ('Asset Turnover',      'assetTurnover',        'x',  '>1.0x'),
        ('Fixed Asset Turnover','fixedAssetTurnover',   'x',  '>2.0x'),
        ('Receivables Days',    'receivablesDays',   'days',  '<45d'),
        ('Inventory Days',      'inventoryDays',     'days',  '<60d'),
        ('LEVERAGE', None, None, None),
        ('Debt to Equity',      'debtToEquity',         'x',  '<1.5x'),
        ('Interest Coverage',   'interestCoverage',     'x',  '>3.0x'),
    ]
    INTERP = {
        'currentRatio':       'Ability to cover short-term liabilities with current assets.',
        'quickRatio':         'Liquidity excluding inventory — stricter liquidity test.',
        'cashRatio':          'Strictest measure — cash only vs current liabilities.',
        'grossMargin':        'Revenue retained after direct production costs.',
        'operatingMargin':    'Profitability from core operations before tax & interest.',
        'netMargin':          'Bottom-line profitability after all expenses and taxes.',
        'roe':                'Return generated on shareholders\' equity.',
        'roa':                'Efficiency of total assets in generating profit.',
        'assetTurnover':      'Revenue generated per unit of total assets.',
        'fixedAssetTurnover': 'Revenue efficiency from fixed / long-term assets.',
        'receivablesDays':    'Average days to collect customer payments.',
        'inventoryDays':      'Average days inventory is held before sale.',
        'debtToEquity':       'Financial leverage — total debt relative to equity.',
        'interestCoverage':   'Ability to service interest payments from operating earnings.',
    }

    rr = 5
    for row_def in RATIO_ROWS:
        lbl, key, unit_r, bench = row_def
        if key is None:
            ws1.merge_range(rr, 0, rr, 4, lbl, F(bold=True, font_color=_WHITE, bg_color=_NAVY_HDR, border=1))
            rr += 1; continue
        val    = req.ratios.get(key)
        status = req.statuses.get(key, 'na')
        disp   = f'{val:.2f}{unit_r}' if val is not None else 'N/A'
        ws1.write(rr, 0, lbl,   f_lbl)
        ws1.write(rr, 1, disp,  f_ctr)
        ws1.write(rr, 2, STATUS_LBL[status], sfmt(status))
        ws1.write(rr, 3, bench, f_ctr)
        ws1.write(rr, 4, INTERP.get(key, ''), f_txt)
        rr += 1

    ws1.freeze_panes(5, 0)

    # ──────────────────────────────────────────────────────────
    # SHEET 3 — INCOME STATEMENT
    # ──────────────────────────────────────────────────────────
    ws2 = wb.add_worksheet('Income Statement')
    ws2.set_column('A:A', 30)
    for c in range(n_inc): ws2.set_column(c+1, c+1, 13)
    ws2.freeze_panes(3, 1)

    # Title
    ws2.write(0, 0, f'{co} ({tick})'.upper() if tick else co.upper(), f_title)
    ws2.write(1, 0, f'Income Statement  |  Fiscal Years Ending Dec/Jan 31  |  $ in Millions', f_sub)

    # Header row
    ws2.write(2, 0, '($mm)', f_hdr)
    for i, y in enumerate(inc):
        ws2.write(2, i+1, f'FY{y.year}', f_hdr)

    # Helper: write a data row
    def irow(r, label, vals, lf=None, nf=None):
        ws2.write(r, 0, label, lf or f_lbl)
        for i, v in enumerate(vals):
            ws2.write(r, i+1, v, nf or f_num)

    def ipct(r, label, vals):
        """Write a % sub-row (grey italic)."""
        ws2.write(r, 0, label, f_pct_lbl)
        for i, v in enumerate(vals):
            ws2.write(r, i+1, v, f_pct_num)

    def iyoy(r, label, raw_vals):
        """Write a YoY growth row."""
        ws2.write(r, 0, label, f_pct_lbl)
        for i in range(n_inc):
            if i == 0:
                ws2.write(r, 1, None, f_pct_num)
            else:
                g = _yoy(raw_vals[i], raw_vals[i-1])
                ws2.write(r, i+1, g, gfmt(g))

    def blank_row(r):
        for c in range(n_inc+1): ws2.write(r, c, None, f_lbl)

    row = 3
    # ── REVENUE ──────────────────────────────────────────────
    ws2.write(row, 0, 'REVENUE', f_sec); row += 1
    irow(row, '  Total Revenue', [_mm(y.revenue) for y in inc], f_bold_lbl, f_bold_num); row += 1
    iyoy(row, '    YoY Growth',  [y.revenue for y in inc]); row += 1
    blank_row(row); row += 1

    # ── PROFITABILITY ─────────────────────────────────────────
    ws2.write(row, 0, 'PROFITABILITY', f_sec); row += 1
    irow(row, '  Cost of Revenue',      [_mm(y.cogs) for y in inc]); row += 1
    irow(row, 'Gross Profit',            [_mm(y.grossProfit) for y in inc], f_bold_lbl, f_bold_num); row += 1
    ipct(row, '    Gross Margin',        [_ratio(y.grossProfit, y.revenue) for y in inc]); row += 1
    blank_row(row); row += 1

    irow(row, '  Research & Development',[_mm(y.rd) for y in inc]); row += 1
    ipct(row, '    % of Revenue',        [_ratio(y.rd, y.revenue) for y in inc]); row += 1
    irow(row, '  Selling, General & Admin',[_mm(y.sga) for y in inc]); row += 1
    blank_row(row); row += 1

    irow(row, 'Operating Income (EBIT)', [_mm(y.operatingIncome) for y in inc], f_bold_lbl, f_bold_num); row += 1
    ipct(row, '    EBIT Margin',          [_ratio(y.operatingIncome, y.revenue) for y in inc]); row += 1
    blank_row(row); row += 1

    irow(row, '  Interest Income',        [_mm(y.interestIncome) for y in inc]); row += 1
    irow(row, '  Interest Expense',       [_mm(y.interestExpense) for y in inc]); row += 1
    blank_row(row); row += 1

    irow(row, 'Pre-Tax Income',           [_mm(y.preTaxIncome) for y in inc], f_bold_lbl, f_bold_num); row += 1
    irow(row, '  Income Tax Provision',   [_mm(y.tax) for y in inc]); row += 1
    blank_row(row); row += 1

    irow(row, 'Net Income',               [_mm(y.netProfit) for y in inc], f_bold_lbl, f_bold_num); row += 1
    ipct(row, '    Net Margin',            [_ratio(y.netProfit, y.revenue) for y in inc]); row += 1
    blank_row(row); row += 1

    # ── KEY METRICS ───────────────────────────────────────────
    ws2.write(row, 0, 'KEY METRICS', f_sec); row += 1
    irow(row, '  EBITDA',                 [_mm(y.ebitda) for y in inc], f_bold_lbl, f_bold_num); row += 1
    ipct(row, '    EBITDA Margin',        [_ratio(y.ebitda, y.revenue) for y in inc]); row += 1
    irow(row, '  D&A',                    [_mm(y.da) for y in inc]); row += 1
    irow(row, '  Diluted EPS',            [y.eps for y in inc], f_bold_lbl, f_eps); row += 1
    irow(row, '  Diluted Shares (B)',     [y.dilutedShares for y in inc], f_lbl, f_shr); row += 1

    # ──────────────────────────────────────────────────────────
    # SHEET 4 — BALANCE SHEET
    # ──────────────────────────────────────────────────────────
    ws3 = wb.add_worksheet('Balance Sheet')
    ws3.set_column('A:A', 30)
    for c in range(n_bal): ws3.set_column(c+1, c+1, 13)
    ws3.freeze_panes(3, 1)

    ws3.write(0, 0, f'{co} ({tick})'.upper() if tick else co.upper(), f_title)
    ws3.write(1, 0, f'Balance Sheet  |  Fiscal Years Ending Dec/Jan 31  |  $ in Millions', f_sub)
    ws3.write(2, 0, '($mm)', f_hdr)
    for i, y in enumerate(bal): ws3.write(2, i+1, f'FY{y.year}', f_hdr)

    def brow(r, label, vals, lf=None, nf=None):
        ws3.write(r, 0, label, lf or f_lbl)
        for i, v in enumerate(vals):
            ws3.write(r, i+1, v, nf or f_num)

    def bblank(r):
        for c in range(n_bal+1): ws3.write(r, c, None, f_lbl)

    row = 3
    # ── ASSETS ───────────────────────────────────────────────
    ws3.write(row, 0, 'ASSETS', f_sec); row += 1
    brow(row, '  Cash & Equivalents',       [_mm(y.cash) for y in bal]); row += 1
    brow(row, '  Short-Term Investments',   [_mm(y.sti) for y in bal]); row += 1
    brow(row, '  Accounts Receivable',      [_mm(y.receivables) for y in bal]); row += 1
    brow(row, '  Inventory',                [_mm(y.inventory) for y in bal]); row += 1
    brow(row, '  Other Current Assets',     [_mm(y.otherCurrentAssets) for y in bal]); row += 1
    brow(row, 'Total Current Assets',       [_mm(y.currentAssets) for y in bal], f_bold_lbl, f_bold_num); row += 1
    bblank(row); row += 1
    brow(row, '  Net PP&E',                 [_mm(y.ppe) for y in bal]); row += 1
    brow(row, '  Goodwill',                 [_mm(y.goodwill) for y in bal]); row += 1
    brow(row, '  Other Intangibles',        [_mm(y.intangibles) for y in bal]); row += 1
    brow(row, '  Other Non-Current Assets', [_mm(y.otherNonCurrentAssets) for y in bal]); row += 1
    brow(row, 'Total Assets',               [_mm(y.totalAssets) for y in bal], f_bold_lbl, f_bold_num); row += 1
    bblank(row); row += 1

    # ── LIABILITIES ───────────────────────────────────────────
    ws3.write(row, 0, 'LIABILITIES', f_sec); row += 1
    brow(row, '  Accounts Payable',         [_mm(y.ap) for y in bal]); row += 1
    brow(row, '  Current Debt',             [_mm(y.currentDebt) for y in bal]); row += 1
    brow(row, '  Deferred Revenue (Current)',[_mm(y.deferredRevCurrent) for y in bal]); row += 1
    brow(row, '  Other Current Liabilities',[_mm(y.otherCurrentLiab) for y in bal]); row += 1
    brow(row, 'Total Current Liabilities',  [_mm(y.currentLiabilities) for y in bal], f_bold_lbl, f_bold_num); row += 1
    bblank(row); row += 1
    brow(row, '  Long-Term Debt',           [_mm(y.ltDebt) for y in bal]); row += 1
    brow(row, '  Other Non-Current Liab.',  [_mm(y.otherNonCurrentLiab) for y in bal]); row += 1
    # Total liabilities = total assets - equity (if not given directly)
    def _total_liab(y):
        if y.totalAssets and y.equity:
            return _mm(y.totalAssets - y.equity)
        return None
    brow(row, 'Total Liabilities',          [_total_liab(y) for y in bal], f_bold_lbl, f_bold_num); row += 1
    bblank(row); row += 1

    # ── SHAREHOLDERS' EQUITY ──────────────────────────────────
    ws3.write(row, 0, "SHAREHOLDERS' EQUITY", f_sec); row += 1
    brow(row, '  Additional Paid-In Capital',[_mm(y.apic) for y in bal]); row += 1
    brow(row, '  Retained Earnings',         [_mm(y.retainedEarnings) for y in bal]); row += 1
    brow(row, 'Total Equity',                [_mm(y.equity) for y in bal], f_bold_lbl, f_bold_num); row += 1

    # ──────────────────────────────────────────────────────────
    # SHEET 5 — CASH FLOW
    # ──────────────────────────────────────────────────────────
    ws4 = wb.add_worksheet('Cash Flow')
    ws4.set_column('A:A', 30)
    for c in range(n_cf): ws4.set_column(c+1, c+1, 13)
    ws4.freeze_panes(3, 1)

    ws4.write(0, 0, f'{co} ({tick})'.upper() if tick else co.upper(), f_title)
    ws4.write(1, 0, 'Cash Flow Statement  |  Fiscal Years Ending Dec/Jan 31  |  $ in Millions', f_sub)
    ws4.write(2, 0, '($mm)', f_hdr)
    for i, y in enumerate(cf): ws4.write(2, i+1, f'FY{y.year}', f_hdr)

    def crow(r, label, vals, lf=None, nf=None):
        ws4.write(r, 0, label, lf or f_lbl)
        for i, v in enumerate(vals):
            ws4.write(r, i+1, v, nf or f_num)

    def cblank(r):
        for c in range(n_cf+1): ws4.write(r, c, None, f_lbl)

    row = 3
    # ── OPERATING ─────────────────────────────────────────────
    ws4.write(row, 0, 'OPERATING ACTIVITIES', f_sec); row += 1
    crow(row, '  Net Income',              [_mm(y.netIncome) for y in cf]); row += 1
    crow(row, '  D&A',                     [_mm(y.da) for y in cf]); row += 1
    crow(row, '  Stock-Based Compensation',[_mm(y.sbc) for y in cf]); row += 1
    crow(row, '  Change in Working Capital',[_mm(y.wc) for y in cf]); row += 1
    # Other operating = cfOps - ni - da - sbc - wc
    def _other_ops(y):
        if y.cfOps is None: return None
        known = (y.netIncome or 0) + (y.da or 0) + (y.sbc or 0) + (y.wc or 0)
        other = y.cfOps - known
        return _mm(other) if abs(other) > 1e3 else None
    crow(row, '  Other Operating Items',   [_other_ops(y) for y in cf]); row += 1
    crow(row, 'Cash from Operations',      [_mm(y.cfOps) for y in cf], f_bold_lbl, f_bold_num); row += 1
    cblank(row); row += 1

    # ── INVESTING ─────────────────────────────────────────────
    ws4.write(row, 0, 'INVESTING ACTIVITIES', f_sec); row += 1
    crow(row, '  Capital Expenditure (CapEx)',[_mm(y.capex) for y in cf]); row += 1
    crow(row, 'Cash from Investing',       [_mm(y.cfInvesting) for y in cf], f_bold_lbl, f_bold_num); row += 1
    cblank(row); row += 1

    # ── FINANCING ─────────────────────────────────────────────
    ws4.write(row, 0, 'FINANCING ACTIVITIES', f_sec); row += 1
    crow(row, '  Share Buybacks',          [_mm(y.buybacks) for y in cf]); row += 1
    crow(row, '  Dividends Paid',          [_mm(y.dividends) for y in cf]); row += 1
    # Debt repayment = cfFinancing - buybacks - dividends
    def _debt_rep(y):
        if y.cfFinancing is None: return None
        other = y.cfFinancing - (y.buybacks or 0) - (y.dividends or 0)
        return _mm(other) if abs(other) > 1e3 else None
    crow(row, '  Debt / Other Financing',  [_debt_rep(y) for y in cf]); row += 1
    crow(row, 'Cash from Financing',       [_mm(y.cfFinancing) for y in cf], f_bold_lbl, f_bold_num); row += 1
    cblank(row); row += 1

    # ── FREE CASH FLOW ────────────────────────────────────────
    ws4.write(row, 0, 'FREE CASH FLOW & LIQUIDITY', f_sec); row += 1
    def _fcf(y):
        if y.cfOps and y.capex: return _mm(y.cfOps + y.capex)
        if y.cfOps: return _mm(y.cfOps)
        return None
    crow(row, '  Free Cash Flow',          [_fcf(y) for y in cf], f_bold_lbl, f_bold_num); row += 1

    # FCF conversion = FCF / NI
    ws4.write(row, 0, '    FCF Conversion (FCF/NI)', f_pct_lbl)
    for i, y in enumerate(cf):
        fcf = (y.cfOps or 0) + (y.capex or 0) if y.cfOps else None
        v = _ratio(fcf, y.netIncome) if fcf and y.netIncome else None
        ws4.write(row, i+1, v, f_pct_num)
    row += 1

    # Beginning / ending cash from balance sheet
    # (Use bal list if aligned; otherwise leave blank)
    def _beg_cash(i_cf):
        y = cf[i_cf]
        # find matching bal year
        for b in bal:
            if b.year == y.year:
                # beginning = prior year's ending
                break
        return None   # can't reliably derive without prior year
    crow(row, '  Ending Cash', [None]*n_cf); row += 1

    # ──────────────────────────────────────────────────────────
    # SHEET 6 — DCF VALUATION
    # ──────────────────────────────────────────────────────────
    ws5 = wb.add_worksheet('DCF Valuation')
    ws5.set_column('A:A', 34)
    for c in range(5): ws5.set_column(c+1, c+1, 14)
    ws5.freeze_panes(3, 1)

    ws5.write(0, 0, f'{co} ({tick})'.upper() if tick else co.upper(), f_title)
    ws5.write(1, 0, 'DCF Valuation Model  |  $ in Millions  |  Blue cells = Assumptions (change these)', f_sub)

    # Base year data
    base_inc = inc[-1] if inc else IncomeYear()
    base_rev_raw = base_inc.revenue   # raw value

    proj_yrs  = [f'FY{date.today().year + i}E' for i in range(1, 6)]
    gr        = _DCF_GROWTH.get(req.industry, _DCF_GROWTH['general'])
    em        = _DCF_EBITDA_MARGIN.get(req.industry, _DCF_EBITDA_MARGIN['general'])
    da_pct    = [0.02]*5
    capex_pct = [0.04]*5
    nwc_pct   = [0.02]*5
    tax_rate  = [0.21]*5
    wacc      = 0.10
    tgr       = 0.04

    ws5.write(2, 0, '($mm)', f_hdr)
    for i, yr in enumerate(proj_yrs): ws5.write(2, i+1, yr, f_hdr)

    row = 3
    ws5.write(row, 0, 'KEY ASSUMPTIONS  (Blue = Input)', f_sec); row += 1
    assumption_rows = [
        ('  Revenue Growth Rate', gr,       f_inp_pct),
        ('  EBITDA Margin',       em,       f_inp_pct),
        ('  D&A % of Revenue',    da_pct,   f_inp_pct),
        ('  CapEx % of Revenue',  capex_pct,f_inp_pct),
        ('  Change in NWC % Rev', nwc_pct,  f_inp_pct),
        ('  Tax Rate',            tax_rate, f_inp_pct),
    ]
    for lbl, vals, nf in assumption_rows:
        ws5.write(row, 0, lbl, f_lbl)
        for i, v in enumerate(vals): ws5.write(row, i+1, v, nf)
        row += 1

    # Build projected financials
    base_rev = _mm(base_rev_raw) or 1000.0
    rev_proj = []
    for g in gr:
        base_rev = round(base_rev * (1 + g), 1)
        rev_proj.append(base_rev)

    ebitda_proj = [round(rev_proj[i] * em[i], 1) for i in range(5)]
    da_proj     = [round(rev_proj[i] * da_pct[i], 1) for i in range(5)]
    capex_proj  = [round(rev_proj[i] * capex_pct[i], 1) for i in range(5)]
    nwc_proj    = [round(rev_proj[i] * nwc_pct[i], 1) for i in range(5)]
    ebit_proj   = [round(ebitda_proj[i] - da_proj[i], 1) for i in range(5)]
    tax_proj    = [round(ebit_proj[i] * tax_rate[i], 1) for i in range(5)]
    nopat_proj  = [round(ebit_proj[i] - tax_proj[i], 1) for i in range(5)]
    ufcf_proj   = [round(nopat_proj[i] + da_proj[i] - capex_proj[i] - nwc_proj[i], 1) for i in range(5)]

    row += 1
    ws5.write(row, 0, 'PROJECTED FINANCIALS', f_sec); row += 1
    proj_rows = [
        ('  Revenue',          rev_proj,    f_bold_lbl, f_bold_num),
        ('  EBITDA',           ebitda_proj, f_lbl,      f_num),
        ('  (-) D&A',          da_proj,     f_lbl,      f_num),
        ('EBIT',               ebit_proj,   f_bold_lbl, f_bold_num),
        ('  (-) Taxes on EBIT',tax_proj,    f_lbl,      f_num),
        ('NOPAT',              nopat_proj,  f_bold_lbl, f_bold_num),
        ('  (+) D&A Add-Back', da_proj,     f_lbl,      f_num),
        ('  (-) CapEx',        capex_proj,  f_lbl,      f_num),
        ('  (-) Change in NWC',nwc_proj,    f_lbl,      f_num),
    ]
    for lbl, vals, lf, nf in proj_rows:
        ws5.write(row, 0, lbl, lf)
        for i, v in enumerate(vals): ws5.write(row, i+1, v, nf)
        row += 1
    ws5.write(row, 0, 'Unlevered Free Cash Flow (UFCF)', f_bold_lbl)
    for i, v in enumerate(ufcf_proj): ws5.write(row, i+1, v, f_bold_num)
    row += 2

    # WACC & TV
    ws5.write(row, 0, 'WACC & TERMINAL VALUE', f_sec); row += 1
    disc = [round(1 / (1+wacc)**(i+1), 4) for i in range(5)]
    pv   = [round(ufcf_proj[i] * disc[i], 1) for i in range(5)]
    tv   = round(ufcf_proj[-1] * (1+tgr) / (wacc - tgr), 1)
    pv_tv= round(tv * disc[-1], 1)
    sum_pv = round(sum(pv), 1)
    ev   = round(sum_pv + pv_tv, 1)

    wacc_rows = [
        ('  WACC',             [wacc]*5,   f_inp_pct),
        ('  Terminal Growth',  [tgr]*5,    f_inp_pct),
        ('  Discount Factor',  disc,       f_inp_num),
        ('  PV of UFCF',       pv,         f_num),
    ]
    for lbl, vals, nf in wacc_rows:
        ws5.write(row, 0, lbl, f_lbl)
        for i, v in enumerate(vals): ws5.write(row, i+1, v, nf)
        row += 1

    row += 1
    ws5.write(row, 0, 'VALUATION SUMMARY', f_sec); row += 1
    summ_rows = [
        ('  Sum of PV (FCFs)',            sum_pv),
        ('  Terminal Value (Gordon Growth)',tv),
        ('  PV of Terminal Value',         pv_tv),
        ('  Enterprise Value',             ev),
    ]
    for lbl, v in summ_rows:
        ws5.write(row, 0, lbl, f_bold_lbl)
        ws5.write(row, 1, v, f_bold_num)
        row += 1

    # ──────────────────────────────────────────────────────────
    # SHEET 7 — COMPS
    # ──────────────────────────────────────────────────────────
    ws6 = wb.add_worksheet('Comps')
    ws6.set_column('A:A', 22)
    ws6.set_column('B:B', 8)
    ws6.set_column('C:C', 14)
    ws6.set_column('D:D', 10)
    ws6.set_column('E:E', 14)
    ws6.set_column('F:F', 14)
    ws6.set_column('G:G', 8)
    ws6.set_column('H:H', 10)
    ws6.set_column('I:I', 8)

    industry_label = req.industry.upper().replace('_', ' ')
    ws6.write(0, 0, f'{industry_label} PEER TRADING COMPARABLES', f_title)
    ws6.write(1, 0, 'Public Market Multiples  |  LTM Financials  |  Source: Public Filings / Market Data  |  Illustrative', f_sub)

    hdrs = ['Company', 'Ticker', 'Market Cap\n($B)', 'EV ($B)', 'Revenue\n($B)', 'EBITDA\n($B)', 'EV/Rev', 'EV/EBITDA', 'P/E']
    for i, h in enumerate(hdrs): ws6.write(2, i, h, f_hdr)

    peers = _COMPS.get(req.industry, _COMPS['general'])
    f_peer_num = F(num_format='#,##0.0', align='right', border=1)
    f_peer_mult= F(num_format='0.0"x"', align='right', border=1)
    f_peer_lbl = F(font_color=_BLACK, border=1)
    f_peer_tkr = F(font_color=_BLACK, align='center', border=1)

    for ri, (name_p, ticker_p, mcap, ev_p, rev_p, ebitda_p, ev_rev, ev_ebitda, pe) in enumerate(peers):
        rr = 3 + ri
        ws6.write(rr, 0, name_p,   f_peer_lbl)
        ws6.write(rr, 1, ticker_p, f_peer_tkr)
        ws6.write(rr, 2, mcap,     f_peer_num)
        ws6.write(rr, 3, ev_p,     f_peer_num)
        ws6.write(rr, 4, rev_p,    f_peer_num)
        ws6.write(rr, 5, ebitda_p, f_peer_num)
        ws6.write(rr, 6, ev_rev,   f_peer_mult)
        ws6.write(rr, 7, ev_ebitda,f_peer_mult)
        ws6.write(rr, 8, pe if pe else 'N/M', f_peer_mult if pe else f_ctr)

    # Median row
    mrow = 3 + len(peers)
    ws6.write(mrow, 0, 'PEER MEDIAN', F(bold=True, font_color=_WHITE, bg_color=_NAVY_HDR, border=1))
    for c in range(1, 9): ws6.write(mrow, c, 'Median', F(bold=True, font_color=_WHITE, bg_color=_NAVY_HDR, align='center', border=1))

    # ──────────────────────────────────────────────────────────
    # SHEET 8 — AI INSIGHTS
    # ──────────────────────────────────────────────────────────
    if req.ai_insights:
        ws7 = wb.add_worksheet('AI Insights')
        ws7.set_column('A:A', 24)
        ws7.set_column('B:B', 88)

        ws7.write(0, 0, f'{co} — AI Financial Intelligence', f_title)
        ws7.write(1, 0, f'Generated by Claude AI  |  {today_str}', f_sub)

        ai_r = 2
        def ai_block(heading, items, key_field='description'):
            nonlocal ai_r
            ws7.merge_range(ai_r, 0, ai_r, 1, heading,
                F(bold=True, font_color=_WHITE, bg_color=_NAVY_HDR, border=1))
            ai_r += 1
            if isinstance(items, str):
                ws7.merge_range(ai_r, 0, ai_r, 1, items, f_wrap)
                ws7.set_row(ai_r, 60); ai_r += 1
            elif isinstance(items, list):
                for item in items:
                    title = item.get('title', item.get('action', ''))
                    desc  = item.get(key_field, item.get('expected_impact', ''))
                    ws7.write(ai_r, 0, title, f_bold_lbl)
                    ws7.write(ai_r, 1, desc,  f_wrap)
                    ws7.set_row(ai_r, 40); ai_r += 1

        ai_block('Executive Summary', req.ai_insights.get('executive_summary', ''))
        ai_block('Top Risks',         req.ai_insights.get('top_risks', []))
        ai_block('Opportunities',     req.ai_insights.get('top_opportunities', []))
        ai_block('Priority Actions',  req.ai_insights.get('priority_actions', []), key_field='expected_impact')
        ai_block('Industry Context',  req.ai_insights.get('industry_context', ''))

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
