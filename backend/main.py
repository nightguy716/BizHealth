"""
Valoreva FastAPI Backend ? Anthropic Claude
--------------------------------------------
POST /analyze  ?  structured financial analysis via Claude claude-haiku-4-5

Deploy to Render:
1. render.com ? New Web Service ? connect nightguy716/Valoreva repo
2. Root Directory:  backend (connect nightguy716/Valoreva repo)
3. Build Command:   pip install -r requirements.txt
4. Start Command:   uvicorn main:app --host 0.0.0.0 --port $PORT
5. Environment variable: ANTHROPIC_API_KEY = sk-ant-...
6. Copy the Render URL ? add VITE_BACKEND_URL in Vercel dashboard ? Redeploy
"""

import os
import io
import csv
import json
import math
import time
import asyncio
import requests
import anthropic
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from typing import Optional, List
import httpx

# Load environment variables from backend/.env when running locally.
# On Railway/production, env vars are injected by the platform so this is a no-op.
try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
except ImportError:
    pass
# yfinance / pandas / xlsxwriter are imported lazily inside the functions that need them
# so Uvicorn can bind and /health responds quickly on cold start (Railway healthchecks).
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

# ?????????????????????????????????????????????????????????????
#  RATE LIMITING  ? in-memory, per IP
#  No external dependency needed ? resets on Railway redeploy
#  which is fine (we don't want persistent bans, just abuse prevention)
# ?????????????????????????????????????????????????????????????

# Storage: { ip: { "analyze": [...], "lookup": [...], "search": [...] } }
_rate_store: dict = defaultdict(lambda: {"analyze": [], "lookup": [], "search": []})

# Limits
_AI_LIMIT_PER_DAY    = 7      # AI analysis calls per IP per day
_LOOKUP_LIMIT_PER_HR = 30     # Full company data fetches per IP per hour
_SEARCH_LIMIT_PER_HR = 300    # Autocomplete search queries per IP per hour (very cheap)

def _get_ip(request: Request) -> str:
    """Extract real client IP, handling proxies (Vercel to Railway)."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"

def _is_owner(request: Request) -> bool:
    """
    Owner bypass for rate limiting. The frontend attaches the shared secret
    `x-owner-key` header when VITE_OWNER_KEY is configured, and the backend
    compares it to OWNER_KEY env var. If both are set and match, skip limits.
    """
    server_key = os.environ.get("OWNER_KEY", "").strip()
    if not server_key:
        return False
    client_key = request.headers.get("x-owner-key", "").strip()
    return bool(client_key) and client_key == server_key

def _check_rate(ip: str, kind: str, request: Request | None = None) -> None:
    """
    Raise HTTP 429 if the IP has exceeded its quota.
    kind = "analyze"  ? 7 per day
    kind = "lookup"   ? 30 per hour  (full quoteSummary fetches)
    kind = "search"   ? 300 per hour (lightweight autocomplete only)
    """
    if request is not None and _is_owner(request):
        return  # owner bypass: unlimited

    now   = time.time()
    store = _rate_store[ip]
    times = store.get(kind, [])

    if kind == "analyze":
        window  = 86400
        limit   = _AI_LIMIT_PER_DAY
        msg     = (
            f"You've used all {_AI_LIMIT_PER_DAY} free AI analyses for today. "
            "Limit resets at midnight UTC ? come back tomorrow or upgrade to Pro."
        )
    elif kind == "search":
        window  = 3600
        limit   = _SEARCH_LIMIT_PER_HR
        msg     = "Too many search queries. Please slow down."
    else:
        window  = 3600
        limit   = _LOOKUP_LIMIT_PER_HR
        msg     = (
            f"Too many company lookups ({_LOOKUP_LIMIT_PER_HR}/hour). "
            "Please wait a few minutes before trying again."
        )

    # Drop timestamps outside the window
    store[kind] = [t for t in times if now - t < window]

    if len(store[kind]) >= limit:
        raise HTTPException(status_code=429, detail=msg)

    # Record this call
    store[kind].append(now)


def _get_usage(ip: str) -> dict:
    """Return remaining quota for an IP ? surfaced to frontend."""
    now   = time.time()
    store = _rate_store[ip]
    ai_used     = len([t for t in store.get("analyze", []) if now - t < 86400])
    lookup_used = len([t for t in store.get("lookup",  []) if now - t < 3600])
    search_used = len([t for t in store.get("search",  []) if now - t < 3600])
    return {
        "ai_analyses_used":      ai_used,
        "ai_analyses_remaining": max(0, _AI_LIMIT_PER_DAY - ai_used),
        "ai_analyses_limit":     _AI_LIMIT_PER_DAY,
        "lookups_used":          lookup_used,
        "lookups_remaining":     max(0, _LOOKUP_LIMIT_PER_HR - lookup_used),
        "lookups_limit":         _LOOKUP_LIMIT_PER_HR,
        "searches_used":         search_used,
        "searches_remaining":    max(0, _SEARCH_LIMIT_PER_HR - search_used),
    }

# ?? Shared requests session for yfinance ? browser-like headers ??????????????
# Without this, Yahoo Finance's servers detect the bare Python requests agent
# and block cloud IPs (especially for non-US tickers like .NS, .BO).
_YF_BROWSER_SESSION = requests.Session()
_YF_BROWSER_SESSION.headers.update({
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept":          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Referer":         "https://finance.yahoo.com/",
    "Origin":          "https://finance.yahoo.com",
    "DNT":             "1",
    "Connection":      "keep-alive",
})

_executor = ThreadPoolExecutor(max_workers=4)

# ?? Yahoo Finance proxy ? persistent session ??????????????????
# Yahoo Finance blocks API calls without a valid cookie+crumb pair.
# We bootstrap a real browser-like session once (visit homepage ?
# get cookies ? get crumb), then reuse it for all ticker fetches.

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

        # Step 1 ? visit homepage so Yahoo sets session cookies
        for url in ("https://finance.yahoo.com/", "https://www.yahoo.com/"):
            try:
                await client.get(url)
                break
            except Exception:
                pass

        # Step 2 ? accept EU consent if redirected (GDPR pop-up)
        try:
            await client.post(
                "https://consent.yahoo.com/v2/collectConsent",
                data={"agree": ["agree", "agree"], "consentUUID": "default",
                      "sessionId": "default", "inline": "false"},
            )
        except Exception:
            pass

        # Step 3 ? switch to API headers and fetch crumb
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

    # Most-recent year ? input fields
    inc0 = historical["income"][0]  if historical["income"]  else {}
    bal0 = historical["balance"][0] if historical["balance"] else {}
    cf0  = historical["cashflow"][0] if historical.get("cashflow") else {}

    # ?? financialData fallback helper (works without crumb) ??
    fd = r.get("financialData") or {}
    def _sv(d, *keys):
        for k in keys:
            v = d.get(k)
            if isinstance(v, dict):
                v = v.get("raw")
            if v is not None and not (isinstance(v, float) and math.isnan(v)):
                return v
        return None

    # financialData provides reliable fallbacks even when history modules are blocked
    fd_rev    = _sv(fd, "totalRevenue")
    fd_cash   = _sv(fd, "totalCash")
    fd_debt   = _sv(fd, "totalDebt")
    fd_ocf    = _sv(fd, "operatingCashflow")
    fd_gp     = _sv(fd, "grossProfits")
    fd_ebitda = _sv(fd, "ebitda")
    # Derive net profit from margin ? revenue when not directly available
    pm        = _sv(fd, "profitMargins")
    fd_np     = (pm * fd_rev) if (pm and fd_rev) else None

    raw_inputs = {
        "currentAssets":      bal0.get("currentAssets"),
        "currentLiabilities": bal0.get("currentLiabilities"),
        "inventory":          bal0.get("inventory"),
        "cash":               bal0.get("cash")            or fd_cash,
        "totalAssets":        bal0.get("totalAssets"),
        "equity":             bal0.get("equity"),
        "totalDebt":          bal0.get("totalDebt")       or fd_debt,
        "revenue":            inc0.get("revenue")         or fd_rev,
        "grossProfit":        inc0.get("grossProfit")     or fd_gp,
        "operatingExpenses":  inc0.get("operatingExpenses"),
        "netProfit":          inc0.get("netProfit")       or fd_np,
        "interestExpense":    inc0.get("interestExpense"),
        "receivables":        bal0.get("receivables"),
        "cogs":               inc0.get("cogs"),
        "da":                 inc0.get("da")              or cf0.get("da"),
        "accountsPayable":    bal0.get("ap"),
        "operatingCashFlow":  cf0.get("cfOps")            or fd_ocf,
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

    # ?? Market valuation multiples (reuse _sv defined above) ?
    def _sv(d, *keys):  # noqa: F811 ? redefine for clarity
        for k in keys:
            v = d.get(k)
            if isinstance(v, dict):
                v = v.get("raw")
            if v is not None and not (isinstance(v, float) and math.isnan(v)):
                return v
        return None

    market_data = {
        "currentPrice":         _sv(fd,    "currentPrice"),
        "targetMeanPrice":      _sv(fd,    "targetMeanPrice"),
        "recommendationKey":    fd.get("recommendationKey"),
        "numberOfAnalysts":     _sv(fd,    "numberOfAnalystOpinions"),
        "revenueGrowthYoY":     _sv(fd,    "revenueGrowth"),
        "earningsGrowthYoY":    _sv(fd,    "earningsGrowth"),
        "trailingPE":           _sv(stats, "trailingPE"),
        "forwardPE":            _sv(stats, "forwardPE"),
        "priceToBook":          _sv(stats, "priceToBook"),
        "priceToSales":         _sv(stats, "priceToSalesTrailing12Months"),
        "enterpriseValue":      _sv(stats, "enterpriseValue"),
        "evToRevenue":          _sv(stats, "enterpriseToRevenue"),
        "evToEbitda":           _sv(stats, "enterpriseToEbitda"),
        "pegRatio":             _sv(stats, "pegRatio"),
        "trailingEps":          _sv(stats, "trailingEps"),
        "forwardEps":           _sv(stats, "forwardEps"),
        "sharesOutstanding":    _sv(stats, "sharesOutstanding"),
        "marketCap":            _sv(stats, "marketCap"),
        "dividendYield":        _sv(stats, "dividendYield"),
        "payoutRatio":          _sv(stats, "payoutRatio"),
        "beta":                 _sv(stats, "beta"),
        "shortRatio":           _sv(stats, "shortRatio"),
    }
    # Remove None values to keep payload clean
    market_data = {k: v for k, v in market_data.items() if v is not None}

    return {
        "name":        name,
        "sector":      sector,
        "industry":    SECTOR_MAP.get(sector, "general"),
        "currency":    currency,
        "coverage":    coverage,
        "filled":      filled,
        "total":       total,
        "data":        data_fields,
        "historical":  historical,
        "market_data": market_data,
    }


# ?????????????????????????????????????????????????????????????
#  Direct Yahoo Finance quoteSummary fetch via browser session
#  Uses the persistent httpx client + crumb (handles .NS / .BO)
# ?????????????????????????????????????????????????????????????
_MODULES = (
    "incomeStatementHistory,balanceSheetHistory,cashflowStatementHistory,"
    "defaultKeyStatistics,assetProfile,financialData"
)

async def _httpx_yf_fetch(sym: str) -> dict:
    """
    Fetch Yahoo Finance quoteSummary using the persistent browser session
    (real cookies + crumb).  More reliable than the yfinance library for
    international tickers (.NS, .BO) on cloud server IPs.
    """
    client, crumb = await _get_yf_session()
    url = (
        f"https://query1.finance.yahoo.com/v10/finance/quoteSummary/{sym}"
        f"?modules={_MODULES}"
        + (f"&crumb={crumb}" if crumb else "")
    )
    try:
        r = await client.get(url, timeout=20)
    except Exception:
        # Try query2 if query1 fails
        url2 = url.replace("query1", "query2")
        r = await client.get(url2, timeout=20)

    if r.status_code != 200:
        raise ValueError(f"Yahoo Finance returned {r.status_code} for {sym}")

    data = r.json()
    err  = (data.get("quoteSummary") or {}).get("error")
    if err:
        raise ValueError(f"Yahoo Finance error for {sym}: {err}")

    result = (data.get("quoteSummary") or {}).get("result") or []
    if not result:
        raise ValueError(f"No quoteSummary result for {sym}")

    return _parse_yf_response(data)


app = FastAPI(title="Valoreva API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)

SYSTEM_PROMPT = """You are a senior financial analyst with expertise across SMEs, large-cap corporations, and listed companies globally. You analyse financial ratios and translate them into clear, actionable intelligence tailored to the entity's scale and context.

You must respond with ONLY a valid JSON object ? no markdown, no explanation outside the JSON ? with exactly these keys:

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
- If the entity is a large listed company (e.g. Amazon, Microsoft, TCS), frame advice for institutional investors, CFOs, and analysts ? not SME owners
- If the entity is an SME or unknown, frame advice for business owners in plain English
- Always mention actual ratio values in descriptions
- Tailor industry_context to global norms for listed companies, or local/regional norms for SMEs"""


class CompanyCtx(BaseModel):
    name:     str = ''
    ticker:   str = ''
    currency: str = 'INR'
    isListed: bool = False
    sector:   str = ''
    marketData: dict = {}

class AnalysisRequest(BaseModel):
    ratios:   dict
    statuses: dict
    industry: str = "general"
    score:    int
    company:  CompanyCtx = CompanyCtx()


@app.get("/")
def root():
    return {"status": "Valoreva API running", "model": "claude-haiku-4-5", "version": "3.3.0", "data_source": "yfinance+financialData-fallback"}


@app.get("/health")
def health():
    return {"status": "ok"}


# ?????????????????????????????????????????????????????????????
# ?? Keep-alive ping (used by UptimeRobot every 5 min) ????????
@app.get("/ping")
async def ping():
    return {"status": "ok"}


#  COMPANY SEARCH  ?  proxy Yahoo Finance suggest API
# ?????????????????????????????????????????????????????????????
@app.get("/usage")
async def get_usage(request: Request):
    """Return remaining quota for the calling IP ? polled by the frontend."""
    if _is_owner(request):
        return {
            "ai_analyses_used": 0, "ai_analyses_remaining": 9999, "ai_analyses_limit": 9999,
            "lookups_used": 0,     "lookups_remaining":     9999, "lookups_limit":     9999,
            "searches_used": 0,    "searches_remaining":    9999,
            "owner": True,
        }
    return _get_usage(_get_ip(request))


@app.post("/admin/reset-rate-limits")
async def reset_rate_limits(request: Request):
    """Clear the in-memory rate-limit store (owner-only)."""
    if not _is_owner(request):
        raise HTTPException(status_code=403, detail="Forbidden")
    _rate_store.clear()
    return {"ok": True, "message": "Rate-limit store cleared"}


@app.get("/search")
async def search_companies(request: Request, q: str = Query(..., min_length=1)):
    _check_rate(_get_ip(request), "search", request)

    # Use browser-like API headers ? YF search doesn't need cookies/crumb,
    # just a real-looking User-Agent + Referer to avoid IP blocking.
    from urllib.parse import quote as _urlencode
    search_headers = {**_YF_API_HEADERS}
    data = {}
    for base in ("https://query2.finance.yahoo.com", "https://query1.finance.yahoo.com"):
        url = (
            f"{base}/v1/finance/search"
            f"?q={_urlencode(q)}&newsCount=0&quotesCount=10&enableFuzzyQuery=true"
        )
        try:
            async with httpx.AsyncClient(headers=search_headers, timeout=8, follow_redirects=True) as sc:
                r = await sc.get(url)
                if r.status_code == 200:
                    data = r.json()
                    break
        except Exception:
            continue

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


# ?????????????????????????????????????????????????????????????
#  COMPANY FINANCIALS  ?  yfinance ? our 14 input fields
# ?????????????????????????????????????????????????????????????
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

def _safe(df, keys: list[str]):
    """Return the first non-NaN float from df index matching any of keys."""
    import pandas as pd
    if df is None or not isinstance(df, pd.DataFrame) or df.empty:
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
            detail="FMP_API_KEY not configured. Add it in Railway ? Variables."
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

    # ?? income statement ?????????????????????????????????????????
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

    # ?? balance sheet ?????????????????????????????????????????????
    cur_assets   = _fv(bal, "totalCurrentAssets")
    cur_liab     = _fv(bal, "totalCurrentLiabilities")
    inventory    = _fv(bal, "inventory")
    cash         = _fv(bal, "cashAndCashEquivalents", "cashAndShortTermInvestments")
    total_assets = _fv(bal, "totalAssets")
    equity       = _fv(bal, "totalStockholdersEquity", "stockholdersEquity")
    total_debt   = _fv(bal, "totalDebt", "longTermDebt")
    receivables  = _fv(bal, "netReceivables", "accountsReceivable")

    # ?? metadata ??????????????????????????????????????????????????
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


# ?????????????????????????????????????????????????????????????
#  Yahoo Finance proxy ? no API key, no rate limit
# ?????????????????????????????????????????????????????????????

@app.get("/company/yf/{ticker}")
async def get_company_yf(ticker: str, request: Request):
    """
    Fetch financials for a listed company.
    Priority: yfinance (no key, no rate limit) ? Alpha Vantage ? FMP
    Results cached 1 hour per ticker.
    """
    _check_rate(_get_ip(request), "lookup", request)
    sym = ticker.upper().strip()

    # Serve from cache if still fresh
    cached = _yf_data_cache.get(sym)
    if cached and (time.time() - cached["ts"]) < _YF_TTL:
        return cached["data"]

    last_error = "Unknown error"

    # ?? 1. yfinance (primary) ?????????????????????????????????????????????
    #  yfinance 0.2.61+ manages its own cookie/crumb auth internally.
    try:
        loop   = asyncio.get_event_loop()
        parsed = await asyncio.wait_for(
            loop.run_in_executor(_executor, _yf_fetch_ticker, sym),
            timeout=18.0
        )
        # Only use result if it filled a meaningful number of fields
        if parsed.get("filled", 0) >= 4:
            parsed["ticker"] = sym
            _yf_data_cache[sym] = {"data": parsed, "ts": time.time()}
            return parsed
        # Sparse result ? fall through to httpx for richer data
        last_error = f"yfinance returned only {parsed.get('filled',0)} fields"
    except (asyncio.TimeoutError, Exception) as e:
        last_error = str(e)

    # ?? 1b. httpx quoteSummary fallback ??????????????????????????????????
    try:
        parsed = await asyncio.wait_for(_httpx_yf_fetch(sym), timeout=15.0)
        parsed["ticker"] = sym
        _yf_data_cache[sym] = {"data": parsed, "ts": time.time()}
        return parsed
    except Exception as e:
        last_error = str(e)

    # ?? 2. Alpha Vantage fallback (25 calls/day) ?????????????????
    av_key = os.environ.get("AV_API_KEY", "")
    if av_key:
        try:
            parsed = await _av_fetch(sym, av_key)
            parsed["ticker"] = sym
            _yf_data_cache[sym] = {"data": parsed, "ts": time.time()}
            return parsed
        except HTTPException as e:
            last_error = e.detail   # store, don't re-raise ? let FMP try
        except Exception as e:
            last_error = str(e)

    # ?? 3. FMP fallback ???????????????????????????????????????????
    fmp_key = os.environ.get("FMP_API_KEY", "")
    if fmp_key:
        try:
            parsed = await _fmp_fetch(sym, fmp_key)
            parsed["ticker"] = sym
            _yf_data_cache[sym] = {"data": parsed, "ts": time.time()}
            return parsed
        except HTTPException as e:
            last_error = e.detail   # store, don't re-raise
        except Exception as e:
            last_error = str(e)

    raise HTTPException(
        status_code=404,
        detail=f"No financial data available for {sym}. The ticker may be invalid, delisted, or not yet covered ? please try a different company.",
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
        # Fetch all 4 in parallel ? AV allows 5 req/min so this is fine
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

    # Rate-limit check ? stop here with a clear message
    if _is_limited(inc_j) or _is_limited(bal_j):
        raise HTTPException(
            status_code=429,
            detail="Alpha Vantage daily limit reached (25 calls/day). Quota resets at midnight UTC ? try again tomorrow.",
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


def _yf_fetch_ticker(sym: str, session=None) -> dict:
    """
    Blocking ? run in executor.
    Uses yfinance's own internal cookie/crumb auth (0.2.61+), which is
    more reliable than any custom session we can pass from the async layer.
    The session param is kept for signature compatibility but ignored.
    """
    import pandas as pd
    import yfinance as yf

    inc_df: pd.DataFrame | None = None
    bal_df: pd.DataFrame | None = None
    cf_df:  pd.DataFrame | None = None
    info:   dict = {}

    # Let yfinance manage its own authentication ? do NOT pass a session.
    # yfinance 0.2.61+ handles cookie/crumb internally and is more reliable.
    tk = yf.Ticker(sym)

    # Try new canonical names first (0.2.61+), fall back to old names (0.2.54)
    try:
        inc_df = getattr(tk, 'income_stmt', None)
        if inc_df is None or (hasattr(inc_df, 'empty') and inc_df.empty):
            inc_df = tk.financials
    except Exception:
        pass

    try:
        bal_df = tk.balance_sheet
    except Exception:
        pass

    try:
        cf_df = getattr(tk, 'cash_flow', None)
        if cf_df is None or (hasattr(cf_df, 'empty') and cf_df.empty):
            cf_df = tk.cashflow
    except Exception:
        pass

    try: info = tk.info or {}
    except Exception: pass

    has_inc = inc_df is not None and not inc_df.empty
    has_bal = bal_df is not None and not bal_df.empty

    if not has_inc and not has_bal:
        raise ValueError(
            f"No financial data found for {sym}. "
            "The ticker may be invalid, delisted, or not supported by Yahoo Finance."
        )

    # ?? Field-name aliases (yfinance renames between versions) ??
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

    # ?? info-based fallbacks (tk.info always returns even when stmts fail) ??
    def _iv(*keys):
        for k in keys:
            v = info.get(k)
            if v is not None and not (isinstance(v, float) and math.isnan(v)):
                return v
        return None

    inf_rev  = _iv("totalRevenue")
    inf_cash = _iv("totalCash")
    inf_debt = _iv("totalDebt")
    inf_ocf  = _iv("operatingCashflow", "freeCashflow")
    inf_gp   = _iv("grossProfits")
    pm_info  = _iv("profitMargins")
    inf_np   = (pm_info * inf_rev) if (pm_info and inf_rev) else None

    raw_inputs = {
        "currentAssets":      bal0.get("currentAssets"),
        "currentLiabilities": bal0.get("currentLiabilities"),
        "inventory":          bal0.get("inventory"),
        "cash":               bal0.get("cash")         or inf_cash,
        "totalAssets":        bal0.get("totalAssets"),
        "equity":             bal0.get("equity"),
        "totalDebt":          bal0.get("totalDebt")    or inf_debt,
        "revenue":            inc0.get("revenue")      or inf_rev,
        "grossProfit":        inc0.get("grossProfit")  or inf_gp,
        "operatingExpenses":  inc0.get("operatingExpenses"),
        "netProfit":          inc0.get("netProfit")    or inf_np,
        "interestExpense":    inc0.get("interestExpense"),
        "receivables":        bal0.get("receivables"),
        "cogs":               inc0.get("cogs"),
        "da":                 inc0.get("da")           or cf0.get("da"),
        "accountsPayable":    bal0.get("ap"),
        "operatingCashFlow":  cf0.get("cfOps")         or inf_ocf,
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


# ?????????????????????????????????????????????????????????????
#  IB-STYLE EXCEL EXPORT ? Models
# ?????????????????????????????????????????????????????????????

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


# ?? Colour palette ????????????????????????????????????????????
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

# ?? Industry comps data (illustrative) ???????????????????????
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

# ?? DCF growth rate assumptions per industry ?????????????????
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
    """Raw value ? $ millions (2 dp)."""
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
    import xlsxwriter
    from xlsxwriter.utility import xl_rowcol_to_cell
    from datetime import date
    output = io.BytesIO()
    wb = xlsxwriter.Workbook(output, {'in_memory': True, 'nan_inf_to_errors': True})

    co   = req.company.name or 'Company'
    tick = req.company.ticker or ''
    curr = req.company.currency or 'USD'
    today_str = date.today().strftime('%d %B %Y')

    # ?? Format factory ????????????????????????????????????????
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

    # Bold row (subtotal) ? left label
    f_bold_lbl = F(bold=True, font_color=_BLACK, border=1)
    # Bold row ? right number
    f_bold_num = F(bold=True, font_color=_BLACK, num_format='#,##0', align='right', border=1)

    # Regular row ? label (1-space indent)
    f_lbl = F(font_color=_BLACK, border=1, indent=1)
    # Regular row ? number
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

    # ?? Reversed (oldest?newest) views for Excel display ??????
    inc = list(reversed(req.historical.income))
    bal = list(reversed(req.historical.balance))
    cf  = list(reversed(req.historical.cashflow))
    n_inc = len(inc)
    n_bal = len(bal)
    n_cf  = len(cf)

    # ??????????????????????????????????????????????????????????
    # SHEET 1 ? COVER & NOTES
    # ??????????????????????????????????????????????????????????
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
        ('Cover & Notes',    'This sheet ? model overview, color coding, key assumptions.'),
        ('Model Inputs',     'Editable driver cells used by formulas in ratio and valuation sheets.'),
        ('Financial Ratios', 'Current-period ratios across Liquidity, Profitability, Efficiency & Leverage.'),
        ('Income Statement', f'Historical P&L FY{inc[0].year if inc else "?"}?FY{inc[-1].year if inc else "?"}. Revenue, Gross Profit, EBITDA, EBIT, Net Income, EPS.'),
        ('Balance Sheet',    f'Historical B/S FY{bal[0].year if bal else "?"}?FY{bal[-1].year if bal else "?"}. Assets, Liabilities, Shareholders\' Equity.'),
        ('Cash Flow',        f'Historical CFS FY{cf[0].year if cf else "?"}?FY{cf[-1].year if cf else "?"}. Operating, Investing, Financing + Free Cash Flow.'),
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
    ws0.write('B16', 'Hardcoded inputs / assumptions ? change these to run scenarios', f_cover_t)
    ws0.write('A17', 'Black text',  f_cover_b)
    ws0.write('B17', 'Calculated formulas / linked outputs', f_cover_t)
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
        ('EBITDA Margin',  f'~{ebitda_margins[2]:.0%}?{ebitda_margins[4]:.0%} ? based on industry norms for {req.industry}'),
        ('WACC',           '10% ? reflects equity risk premium for the sector'),
        ('Terminal Growth','4% ? long-run nominal GDP growth + industry tailwinds'),
        ('D&A % Revenue',  '2% ? capex-light assumption; adjust for asset-heavy industries'),
        ('CapEx % Revenue','4% ? typical maintenance + growth capex assumption'),
        ('Tax Rate',       '21% ? US federal statutory rate; adjust for non-US entities'),
    ]
    for i, (k, v) in enumerate(assumptions):
        ws0.write(22+i, 0, k, f_cover_b)
        ws0.write(22+i, 1, v, f_cover_t)

    # ??????????????????????????????????????????????????????????
    # SHEET 2 ? MODEL INPUTS (editable drivers)
    # ??????????????????????????????????????????????????????????
    ws_in = wb.add_worksheet('Model Inputs')
    ws_in.set_column('A:A', 28)
    ws_in.set_column('B:B', 18)
    ws_in.set_column('C:C', 56)
    ws_in.freeze_panes(3, 1)

    ws_in.write(0, 0, f'{co} ({tick})' if tick else co, f_title)
    ws_in.write(1, 0, 'Editable assumptions and current-period inputs used by formulas below.', f_sub)
    ws_in.write_row(2, 0, ['INPUT FIELD', 'VALUE', 'NOTES'], f_hdr)

    latest_inc = inc[-1] if n_inc else IncomeYear()
    latest_bal = bal[-1] if n_bal else BalanceYear()
    latest_cf  = cf[-1]  if n_cf else CashFlowYear()

    fallback_inputs = {
        'currentAssets': latest_bal.currentAssets,
        'currentLiabilities': latest_bal.currentLiabilities,
        'inventory': latest_bal.inventory,
        'cash': latest_bal.cash,
        'totalAssets': latest_bal.totalAssets,
        'equity': latest_bal.equity,
        'totalDebt': latest_bal.totalDebt if latest_bal.totalDebt is not None else ((latest_bal.currentDebt or 0) + (latest_bal.ltDebt or 0) or None),
        'revenue': latest_inc.revenue,
        'grossProfit': latest_inc.grossProfit,
        'operatingExpenses': latest_inc.operatingExpenses,
        'netProfit': latest_inc.netProfit,
        'interestExpense': latest_inc.interestExpense,
        'receivables': latest_bal.receivables,
        'cogs': latest_inc.cogs,
        'da': latest_inc.da if latest_inc.da is not None else latest_cf.da,
        'accountsPayable': latest_bal.ap,
        'operatingCashFlow': latest_cf.cfOps,
    }

    INPUT_FIELDS = [
        ('Current Assets', 'currentAssets', 'Used in liquidity and working-capital ratios'),
        ('Current Liabilities', 'currentLiabilities', 'Used in liquidity ratios'),
        ('Inventory', 'inventory', 'Used in quick ratio and inventory days'),
        ('Cash', 'cash', 'Used in cash ratio and net debt calculations'),
        ('Total Assets', 'totalAssets', 'Used in ROA and turnover calculations'),
        ('Equity', 'equity', 'Used in ROE and debt/equity calculations'),
        ('Total Debt', 'totalDebt', 'Used in leverage calculations'),
        ('Revenue', 'revenue', 'Used in margin and efficiency calculations'),
        ('Gross Profit', 'grossProfit', 'Used in gross/operating margin assumptions'),
        ('Operating Expenses', 'operatingExpenses', 'Used in operating margin and EBIT proxies'),
        ('Net Profit', 'netProfit', 'Used in ROE/ROA and net margin'),
        ('Interest Expense', 'interestExpense', 'Used in interest coverage'),
        ('Receivables', 'receivables', 'Used in receivables days'),
        ('COGS', 'cogs', 'Used in inventory days'),
        ('D&A', 'da', 'Used in advanced EBITDA and DCF'),
        ('Accounts Payable', 'accountsPayable', 'Used in DPO/CCC'),
        ('Operating Cash Flow', 'operatingCashFlow', 'Used in cash-conversion quality'),
    ]
    input_row_map: dict[str, int] = {}
    for i, (label, key, note) in enumerate(INPUT_FIELDS, start=3):
        input_row_map[key] = i
        v = req.inputs.get(key, fallback_inputs.get(key))
        try:
            v = float(v) if v not in (None, '') else None
        except Exception:
            v = None
        ws_in.write(i, 0, label, f_lbl)
        ws_in.write(i, 1, v, f_inp_num if v is not None else f_num)
        ws_in.write(i, 2, note, f_txt)

    # ??????????????????????????????????????????????????????????
    # SHEET 3 ? FINANCIAL RATIOS
    # ??????????????????????????????????????????????????????????
    ws1 = wb.add_worksheet('Financial Ratios')
    ws1.set_column('A:A', 28)
    ws1.set_column('B:B', 14)
    ws1.set_column('C:C', 14)
    ws1.set_column('D:D', 14)
    ws1.set_column('E:E', 46)

    ws1.write(0, 0, f'{co} ({tick})' if tick else co, f_title)
    ws1.write(1, 0, f'Financial Ratios  |  {req.industry.title()}  |  Score: {req.score}/100  |  {today_str}', f_sub)

    ws1.write(2, 0, 'Health Score', f_bold_lbl)
    # Formula-driven score from status column (editable model behavior).
    ws1.write_formula(2, 1, '=IF((COUNTIF(C6:C24,"Healthy")+COUNTIF(C6:C24,"Borderline")+COUNTIF(C6:C24,"Critical"))=0,0,ROUND(((COUNTIF(C6:C24,"Healthy")*2+COUNTIF(C6:C24,"Borderline"))/((COUNTIF(C6:C24,"Healthy")+COUNTIF(C6:C24,"Borderline")+COUNTIF(C6:C24,"Critical"))*2))*100,0))', f_ctr)
    ws1.write(2, 2, 'Verdict', f_bold_lbl)
    ws1.write_formula(2, 3, '=IF(B3>=80,"STRONG",IF(B3>=60,"MODERATE",IF(B3>=40,"BELOW AVERAGE","CRITICAL")))', f_ctr)
    ws1.write(2, 4, '', f_ctr)

    ws1.write(3, 0, 'Healthy', f_grn); ws1.write_formula(3, 1, '=COUNTIF(C6:C24,"Healthy")', f_grn)
    ws1.write(3, 2, 'Borderline', f_amb); ws1.write_formula(3, 3, '=COUNTIF(C6:C24,"Borderline")', f_amb)
    ws1.write_formula(3, 4, '="Critical: "&COUNTIF(C6:C24,"Critical")&"  |  N/A: "&COUNTIF(C6:C24,"N/A")', f_red)

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
        'quickRatio':         'Liquidity excluding inventory ? stricter liquidity test.',
        'cashRatio':          'Strictest measure ? cash only vs current liabilities.',
        'grossMargin':        'Revenue retained after direct production costs.',
        'operatingMargin':    'Profitability from core operations before tax & interest.',
        'netMargin':          'Bottom-line profitability after all expenses and taxes.',
        'roe':                'Return generated on shareholders\' equity.',
        'roa':                'Efficiency of total assets in generating profit.',
        'assetTurnover':      'Revenue generated per unit of total assets.',
        'fixedAssetTurnover': 'Revenue efficiency from fixed / long-term assets.',
        'receivablesDays':    'Average days to collect customer payments.',
        'inventoryDays':      'Average days inventory is held before sale.',
        'debtToEquity':       'Financial leverage ? total debt relative to equity.',
        'interestCoverage':   'Ability to service interest payments from operating earnings.',
    }

    # formulas linked to Model Inputs sheet
    def inpref(key: str) -> str:
        return f"'Model Inputs'!$B${input_row_map[key] + 1}"

    ratio_formula = {
        'currentRatio':        f'=IFERROR({inpref("currentAssets")}/{inpref("currentLiabilities")},"")',
        'quickRatio':          f'=IFERROR(({inpref("currentAssets")}-{inpref("inventory")})/{inpref("currentLiabilities")},"")',
        'cashRatio':           f'=IFERROR({inpref("cash")}/{inpref("currentLiabilities")},"")',
        'grossMargin':         f'=IFERROR(({inpref("grossProfit")}/{inpref("revenue")})*100,"")',
        'operatingMargin':     f'=IFERROR((({inpref("grossProfit")}-{inpref("operatingExpenses")})/{inpref("revenue")})*100,"")',
        'netMargin':           f'=IFERROR(({inpref("netProfit")}/{inpref("revenue")})*100,"")',
        'roe':                 f'=IFERROR(({inpref("netProfit")}/{inpref("equity")})*100,"")',
        'roa':                 f'=IFERROR(({inpref("netProfit")}/{inpref("totalAssets")})*100,"")',
        'assetTurnover':       f'=IFERROR({inpref("revenue")}/{inpref("totalAssets")},"")',
        'fixedAssetTurnover':  f'=IFERROR({inpref("revenue")}/({inpref("totalAssets")}-{inpref("currentAssets")}),"")',
        'receivablesDays':     f'=IFERROR(({inpref("receivables")}/{inpref("revenue")})*365,"")',
        'inventoryDays':       f'=IFERROR(({inpref("inventory")}/{inpref("cogs")})*365,"")',
        'debtToEquity':        f'=IFERROR({inpref("totalDebt")}/{inpref("equity")},"")',
        'interestCoverage':    f'=IFERROR(({inpref("grossProfit")}-{inpref("operatingExpenses")})/{inpref("interestExpense")},"")',
    }

    def status_formula(key: str, val_cell: str) -> str:
        higher = {
            'currentRatio': (1.5, 1.0), 'quickRatio': (1.0, 0.7), 'cashRatio': (0.5, 0.2),
            'grossMargin': (30, 15), 'operatingMargin': (15, 8), 'netMargin': (10, 4),
            'roe': (15, 8), 'roa': (5, 2), 'assetTurnover': (1.0, 0.7),
            'fixedAssetTurnover': (2.0, 1.2), 'interestCoverage': (3.0, 1.5),
        }
        lower = {'receivablesDays': (45, 60), 'inventoryDays': (60, 90), 'debtToEquity': (1.5, 2.5)}
        if key in higher:
            h, b = higher[key]
            return f'=IF(ISNUMBER({val_cell}),IF({val_cell}>={h},"Healthy",IF({val_cell}>={b},"Borderline","Critical")),"N/A")'
        if key in lower:
            h, b = lower[key]
            return f'=IF(ISNUMBER({val_cell}),IF({val_cell}<={h},"Healthy",IF({val_cell}<={b},"Borderline","Critical")),"N/A")'
        return '= "N/A"'

    rr = 5
    for row_def in RATIO_ROWS:
        lbl, key, unit_r, bench = row_def
        if key is None:
            ws1.merge_range(rr, 0, rr, 4, lbl, F(bold=True, font_color=_WHITE, bg_color=_NAVY_HDR, border=1))
            rr += 1; continue
        ws1.write(rr, 0, lbl,   f_lbl)
        vfmt = f_num if unit_r == 'x' else f_pct_num if unit_r == '%' else F(num_format='0.0', align='right', border=1)
        cached_val = req.ratios.get(key)
        ws1.write_formula(rr, 1, ratio_formula.get(key, '=NA()'), vfmt, cached_val if cached_val is not None else None)
        vcell = xl_rowcol_to_cell(rr, 1)
        ws1.write_formula(rr, 2, status_formula(key, vcell), f_ctr)
        ws1.write(rr, 3, bench, f_ctr)
        ws1.write(rr, 4, INTERP.get(key, ''), f_txt)
        rr += 1

    ws1.conditional_format(6, 2, rr-1, 2, {'type': 'text', 'criteria': 'containing', 'value': 'Healthy', 'format': f_grn})
    ws1.conditional_format(6, 2, rr-1, 2, {'type': 'text', 'criteria': 'containing', 'value': 'Borderline', 'format': f_amb})
    ws1.conditional_format(6, 2, rr-1, 2, {'type': 'text', 'criteria': 'containing', 'value': 'Critical', 'format': f_red})
    ws1.conditional_format(6, 2, rr-1, 2, {'type': 'text', 'criteria': 'containing', 'value': 'N/A', 'format': f_nas})

    ws1.freeze_panes(5, 0)

    # ??????????????????????????????????????????????????????????
    # SHEET 3 ? INCOME STATEMENT
    # ??????????????????????????????????????????????????????????
    ws2 = wb.add_worksheet('Income Statement')
    ws2.set_column('A:A', 30)
    for c in range(n_inc): ws2.set_column(c+1, c+1, 13)
    raw_inc_col = max(11, n_inc + 3)  # hidden raw data area used for formula-linked visible cells
    if n_inc > 0:
        ws2.set_column(raw_inc_col, raw_inc_col + n_inc - 1, 12, None, {'hidden': True})
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
            # store loaded value in hidden columns and expose visible formula-linked cells
            raw_c = raw_inc_col + i
            ws2.write(r, raw_c, v, nf or f_num)
            ws2.write_formula(r, i+1, f'={xl_rowcol_to_cell(r, raw_c)}', nf or f_num, v)

    def ipct(r, label, vals):
        """Write a % sub-row (grey italic)."""
        ws2.write(r, 0, label, f_pct_lbl)
        for i, v in enumerate(vals):
            raw_c = raw_inc_col + i
            ws2.write(r, raw_c, v, f_pct_num)
            ws2.write_formula(r, i+1, f'={xl_rowcol_to_cell(r, raw_c)}', f_pct_num, v)

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
    # ?? REVENUE ??????????????????????????????????????????????
    ws2.write(row, 0, 'REVENUE', f_sec); row += 1
    irow(row, '  Total Revenue', [_mm(y.revenue) for y in inc], f_bold_lbl, f_bold_num); row += 1
    iyoy(row, '    YoY Growth',  [y.revenue for y in inc]); row += 1
    blank_row(row); row += 1

    # ?? PROFITABILITY ?????????????????????????????????????????
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

    # ?? KEY METRICS ???????????????????????????????????????????
    ws2.write(row, 0, 'KEY METRICS', f_sec); row += 1
    irow(row, '  EBITDA',                 [_mm(y.ebitda) for y in inc], f_bold_lbl, f_bold_num); row += 1
    ipct(row, '    EBITDA Margin',        [_ratio(y.ebitda, y.revenue) for y in inc]); row += 1
    irow(row, '  D&A',                    [_mm(y.da) for y in inc]); row += 1
    irow(row, '  Diluted EPS',            [y.eps for y in inc], f_bold_lbl, f_eps); row += 1
    irow(row, '  Diluted Shares (B)',     [y.dilutedShares for y in inc], f_lbl, f_shr); row += 1

    # Formula layer (editable model behavior): derived lines and latest-year links.
    if n_inc > 0:
        for c in range(1, n_inc + 1):
            c_ref = xl_rowcol_to_cell
            # Core derived lines
            ws2.write_formula(9,  c, f'=IFERROR({c_ref(4,c)}-{c_ref(8,c)},"")', f_bold_num)   # Gross Profit
            ws2.write_formula(10, c, f'=IFERROR({c_ref(9,c)}/{c_ref(4,c)},"")', f_pct_num)     # Gross Margin
            ws2.write_formula(16, c, f'=IFERROR({c_ref(9,c)}-{c_ref(12,c)}-{c_ref(14,c)},"")', f_bold_num)  # EBIT
            ws2.write_formula(17, c, f'=IFERROR({c_ref(16,c)}/{c_ref(4,c)},"")', f_pct_num)    # EBIT Margin
            ws2.write_formula(22, c, f'=IFERROR({c_ref(16,c)}+{c_ref(19,c)}-{c_ref(20,c)},"")', f_bold_num) # Pre-Tax
            ws2.write_formula(25, c, f'=IFERROR({c_ref(22,c)}-{c_ref(23,c)},"")', f_bold_num)  # Net Income
            ws2.write_formula(26, c, f'=IFERROR({c_ref(25,c)}/{c_ref(4,c)},"")', f_pct_num)    # Net Margin
            ws2.write_formula(29, c, f'=IFERROR({c_ref(16,c)}+{c_ref(31,c)},"")', f_bold_num)  # EBITDA
            ws2.write_formula(30, c, f'=IFERROR({c_ref(29,c)}/{c_ref(4,c)},"")', f_pct_num)    # EBITDA Margin
            # YoY rows become dynamic formulas
            if c == 1:
                ws2.write(5,  c, None, f_pct_num)   # Revenue YoY first year blank
            else:
                ws2.write_formula(5, c, f'=IF(OR({c_ref(4,c)}="",{c_ref(4,c-1)}="",{c_ref(4,c-1)}=0),"",({c_ref(4,c)}-{c_ref(4,c-1)})/ABS({c_ref(4,c-1)}))', gfmt(0))

        # Link latest displayed year to model drivers (so user edits cascade visibly).
        lc = n_inc
        ws2.write_formula(4,  lc, '=IFERROR(\'Model Inputs\'!B11/1000000,"")', f_bold_num)  # Revenue
        ws2.write_formula(8,  lc, '=IFERROR(\'Model Inputs\'!B14/1000000,"")', f_num)       # COGS
        ws2.write_formula(12, lc, '=IFERROR(\'Model Inputs\'!B9/1000000*0.03,"")', f_num)   # R&D proxy
        ws2.write_formula(14, lc, '=IFERROR(\'Model Inputs\'!B10/1000000,"")', f_num)       # SG&A proxy from OpEx
        ws2.write_formula(20, lc, '=IFERROR(\'Model Inputs\'!B13/1000000,"")', f_num)       # Interest Expense
        ws2.write_formula(23, lc, '=IFERROR(\'Model Inputs\'!B12/1000000*0.25,"")', f_num)  # Tax proxy
        ws2.write_formula(31, lc, '=IFERROR(\'Model Inputs\'!B15/1000000,"")', f_num)       # D&A

    # ??????????????????????????????????????????????????????????
    # SHEET 4 ? BALANCE SHEET
    # ??????????????????????????????????????????????????????????
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
    # ?? ASSETS ???????????????????????????????????????????????
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

    # ?? LIABILITIES ???????????????????????????????????????????
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

    # ?? SHAREHOLDERS' EQUITY ??????????????????????????????????
    ws3.write(row, 0, "SHAREHOLDERS' EQUITY", f_sec); row += 1
    brow(row, '  Additional Paid-In Capital',[_mm(y.apic) for y in bal]); row += 1
    brow(row, '  Retained Earnings',         [_mm(y.retainedEarnings) for y in bal]); row += 1
    brow(row, 'Total Equity',                [_mm(y.equity) for y in bal], f_bold_lbl, f_bold_num); row += 1

    if n_bal > 0:
        for c in range(1, n_bal + 1):
            c_ref = xl_rowcol_to_cell
            ws3.write_formula(9,  c, f'=IFERROR(SUM({c_ref(4,c)}:{c_ref(8,c)}),"")', f_bold_num)    # Total Current Assets
            ws3.write_formula(15, c, f'=IFERROR({c_ref(9,c)}+{c_ref(11,c)}+{c_ref(12,c)}+{c_ref(13,c)}+{c_ref(14,c)},"")', f_bold_num)  # Total Assets
            ws3.write_formula(22, c, f'=IFERROR(SUM({c_ref(18,c)}:{c_ref(21,c)}),"")', f_bold_num)   # Total Current Liabilities
            ws3.write_formula(26, c, f'=IFERROR({c_ref(22,c)}+{c_ref(24,c)}+{c_ref(25,c)},"")', f_bold_num)  # Total Liabilities
            ws3.write_formula(31, c, f'=IFERROR({c_ref(29,c)}+{c_ref(30,c)},"")', f_bold_num)         # Total Equity

        lc = n_bal
        ws3.write_formula(4,  lc, '=IFERROR(\'Model Inputs\'!B7/1000000,"")', f_num)        # Cash
        ws3.write_formula(6,  lc, '=IFERROR(\'Model Inputs\'!B16/1000000,"")', f_num)       # Receivables
        ws3.write_formula(7,  lc, '=IFERROR(\'Model Inputs\'!B6/1000000,"")', f_num)        # Inventory
        ws3.write_formula(9,  lc, '=IFERROR(\'Model Inputs\'!B4/1000000,"")', f_bold_num)   # Current Assets
        ws3.write_formula(15, lc, '=IFERROR(\'Model Inputs\'!B8/1000000,"")', f_bold_num)   # Total Assets
        ws3.write_formula(19, lc, '=IFERROR(\'Model Inputs\'!B10/1000000*0.15,"")', f_num)  # Current Debt proxy
        ws3.write_formula(22, lc, '=IFERROR(\'Model Inputs\'!B5/1000000,"")', f_bold_num)   # Current Liabilities
        ws3.write_formula(24, lc, '=IFERROR(\'Model Inputs\'!B10/1000000*0.85,"")', f_num)  # LT Debt proxy
        ws3.write_formula(31, lc, '=IFERROR(\'Model Inputs\'!B9/1000000,"")', f_bold_num)   # Total Equity

    # ??????????????????????????????????????????????????????????
    # SHEET 5 ? CASH FLOW
    # ??????????????????????????????????????????????????????????
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
    # ?? OPERATING ?????????????????????????????????????????????
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

    # ?? INVESTING ?????????????????????????????????????????????
    ws4.write(row, 0, 'INVESTING ACTIVITIES', f_sec); row += 1
    crow(row, '  Capital Expenditure (CapEx)',[_mm(y.capex) for y in cf]); row += 1
    crow(row, 'Cash from Investing',       [_mm(y.cfInvesting) for y in cf], f_bold_lbl, f_bold_num); row += 1
    cblank(row); row += 1

    # ?? FINANCING ?????????????????????????????????????????????
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

    # ?? FREE CASH FLOW ????????????????????????????????????????
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

    if n_cf > 0:
        for c in range(1, n_cf + 1):
            c_ref = xl_rowcol_to_cell
            ws4.write_formula(8,  c, f'=IFERROR({c_ref(9,c)}-{c_ref(4,c)}-{c_ref(5,c)}-{c_ref(6,c)}-{c_ref(7,c)},"")', f_num)     # Other Operating
            ws4.write_formula(13, c, f'=IFERROR({c_ref(12,c)},"")', f_bold_num)                                                    # Cash from Investing
            ws4.write_formula(18, c, f'=IFERROR({c_ref(19,c)}-{c_ref(16,c)}-{c_ref(17,c)},"")', f_num)                            # Debt/Other
            ws4.write_formula(22, c, f'=IFERROR({c_ref(9,c)}+{c_ref(12,c)},"")', f_bold_num)                                       # FCF
            ws4.write_formula(23, c, f'=IFERROR({c_ref(22,c)}/{c_ref(4,c)},"")', f_pct_num)                                        # FCF Conversion

        lc = n_cf
        ws4.write_formula(4,  lc, '=IFERROR(\'Model Inputs\'!B12/1000000,"")', f_num)       # Net Income
        ws4.write_formula(5,  lc, '=IFERROR(\'Model Inputs\'!B15/1000000,"")', f_num)       # D&A
        ws4.write_formula(7,  lc, '=IFERROR((\'Model Inputs\'!B16+\'Model Inputs\'!B6-\'Model Inputs\'!B17)/1000000,"")', f_num)  # WC proxy
        ws4.write_formula(9,  lc, '=IFERROR(\'Model Inputs\'!B18/1000000,"")', f_bold_num)  # CFO
        ws4.write_formula(12, lc, '=IFERROR(-ABS(\'Model Inputs\'!B11*0.04/1000000),"")', f_num)  # CapEx proxy
        ws4.write_formula(16, lc, '=IFERROR(-ABS(\'Model Inputs\'!B10*0.02/1000000),"")', f_num)  # Buybacks proxy
        ws4.write_formula(17, lc, '=IFERROR(-ABS(\'Model Inputs\'!B12*0.1/1000000),"")', f_num)   # Dividends proxy
        ws4.write_formula(19, lc, '=IFERROR(-ABS(\'Model Inputs\'!B10*0.01/1000000),"")', f_bold_num)  # Financing proxy
        if n_bal >= lc:
            ws4.write_formula(24, lc, f'=IFERROR(\'Balance Sheet\'!{xl_rowcol_to_cell(4, lc)},"")', f_num)  # Ending cash linked to BS

    # ??????????????????????????????????????????????????????????
    # SHEET 6 ? DCF VALUATION
    # ??????????????????????????????????????????????????????????
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
    base_rev = _mm(base_rev_raw) or 1000.0
    ws5.write(row, 0, 'BASE INPUT', f_sec); row += 1
    base_rev_row = row
    ws5.write(row, 0, '  Base Revenue FY0 ($mm)', f_lbl)
    ws5.write(row, 1, base_rev, f_inp_num)
    for i in range(2, 6):
        ws5.write(row, i, None, f_num)
    row += 2

    ws5.write(row, 0, 'KEY ASSUMPTIONS  (Blue = Input)', f_sec); row += 1
    gr_row = row
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

    row += 1
    ws5.write(row, 0, 'PROJECTED FINANCIALS', f_sec); row += 1
    rev_row = row
    ws5.write(row, 0, '  Revenue', f_bold_lbl); row += 1
    ebitda_row = row
    ws5.write(row, 0, '  EBITDA', f_lbl); row += 1
    da_row = row
    ws5.write(row, 0, '  (-) D&A', f_lbl); row += 1
    ebit_row = row
    ws5.write(row, 0, 'EBIT', f_bold_lbl); row += 1
    tax_row = row
    ws5.write(row, 0, '  (-) Taxes on EBIT', f_lbl); row += 1
    nopat_row = row
    ws5.write(row, 0, 'NOPAT', f_bold_lbl); row += 1
    da_add_row = row
    ws5.write(row, 0, '  (+) D&A Add-Back', f_lbl); row += 1
    capex_row = row
    ws5.write(row, 0, '  (-) CapEx', f_lbl); row += 1
    nwc_row = row
    ws5.write(row, 0, '  (-) Change in NWC', f_lbl); row += 1
    ufcf_row = row
    ws5.write(row, 0, 'Unlevered Free Cash Flow (UFCF)', f_bold_lbl)
    for i in range(5):
        c = i + 1
        rev_cell = xl_rowcol_to_cell(rev_row, c)
        growth_cell = xl_rowcol_to_cell(gr_row, c, True, False)
        if i == 0:
            base_cell = xl_rowcol_to_cell(base_rev_row, 1, True, True)
            ws5.write_formula(rev_row, c, f'=IFERROR({base_cell}*(1+{growth_cell}),"")', f_bold_num)
        else:
            prev_rev = xl_rowcol_to_cell(rev_row, c-1)
            ws5.write_formula(rev_row, c, f'=IFERROR({prev_rev}*(1+{growth_cell}),"")', f_bold_num)
        ws5.write_formula(ebitda_row, c, f'=IFERROR({rev_cell}*{xl_rowcol_to_cell(gr_row+1, c, True, False)},"")', f_num)
        ws5.write_formula(da_row, c, f'=IFERROR({rev_cell}*{xl_rowcol_to_cell(gr_row+2, c, True, False)},"")', f_num)
        ws5.write_formula(ebit_row, c, f'=IFERROR({xl_rowcol_to_cell(ebitda_row, c)}-{xl_rowcol_to_cell(da_row, c)},"")', f_bold_num)
        ws5.write_formula(tax_row, c, f'=IFERROR({xl_rowcol_to_cell(ebit_row, c)}*{xl_rowcol_to_cell(gr_row+5, c, True, False)},"")', f_num)
        ws5.write_formula(nopat_row, c, f'=IFERROR({xl_rowcol_to_cell(ebit_row, c)}-{xl_rowcol_to_cell(tax_row, c)},"")', f_bold_num)
        ws5.write_formula(da_add_row, c, f'=IFERROR({xl_rowcol_to_cell(da_row, c)},"")', f_num)
        ws5.write_formula(capex_row, c, f'=IFERROR({rev_cell}*{xl_rowcol_to_cell(gr_row+3, c, True, False)},"")', f_num)
        ws5.write_formula(nwc_row, c, f'=IFERROR({rev_cell}*{xl_rowcol_to_cell(gr_row+4, c, True, False)},"")', f_num)
        ws5.write_formula(ufcf_row, c, f'=IFERROR({xl_rowcol_to_cell(nopat_row, c)}+{xl_rowcol_to_cell(da_add_row, c)}-{xl_rowcol_to_cell(capex_row, c)}-{xl_rowcol_to_cell(nwc_row, c)},"")', f_bold_num)
    row += 2

    # WACC & TV
    ws5.write(row, 0, 'WACC & TERMINAL VALUE', f_sec); row += 1
    wacc_row = row
    ws5.write(row, 0, '  WACC', f_lbl)
    for i in range(5): ws5.write(row, i+1, wacc, f_inp_pct)
    row += 1
    tgr_row = row
    ws5.write(row, 0, '  Terminal Growth', f_lbl)
    for i in range(5): ws5.write(row, i+1, tgr, f_inp_pct)
    row += 1
    disc_row = row
    ws5.write(row, 0, '  Discount Factor', f_lbl)
    for i in range(5):
        c = i + 1
        ws5.write_formula(row, c, f'=IFERROR(1/(1+{xl_rowcol_to_cell(wacc_row, c)})^{i+1},"")', f_inp_num)
    row += 1
    pv_row = row
    ws5.write(row, 0, '  PV of UFCF', f_lbl)
    for i in range(5):
        c = i + 1
        ws5.write_formula(row, c, f'=IFERROR({xl_rowcol_to_cell(ufcf_row, c)}*{xl_rowcol_to_cell(disc_row, c)},"")', f_num)
    row += 1

    row += 1
    ws5.write(row, 0, 'VALUATION SUMMARY', f_sec); row += 1
    sum_pv_row = row
    ws5.write(row, 0, '  Sum of PV (FCFs)', f_bold_lbl)
    ws5.write_formula(row, 1, f'=SUM(B{pv_row+1}:F{pv_row+1})', f_bold_num)
    row += 1
    tv_row = row
    ws5.write(row, 0, '  Terminal Value (Gordon Growth)', f_bold_lbl)
    ws5.write_formula(row, 1, f'=IFERROR((F{ufcf_row+1}*(1+F{tgr_row+1}))/(F{wacc_row+1}-F{tgr_row+1}),"")', f_bold_num)
    row += 1
    pv_tv_row = row
    ws5.write(row, 0, '  PV of Terminal Value', f_bold_lbl)
    ws5.write_formula(row, 1, f'=IFERROR(B{tv_row+1}*F{disc_row+1},"")', f_bold_num)
    row += 1
    ws5.write(row, 0, '  Enterprise Value', f_bold_lbl)
    ws5.write_formula(row, 1, f'=IFERROR(B{sum_pv_row+1}+B{pv_tv_row+1},"")', f_bold_num)
    row += 1

    # ??????????????????????????????????????????????????????????
    # SHEET 7 ? COMPS
    # ??????????????????????????????????????????????????????????
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

    # ??????????????????????????????????????????????????????????
    # SHEET 8 ? AI INSIGHTS
    # ??????????????????????????????????????????????????????????
    if req.ai_insights:
        ws7 = wb.add_worksheet('AI Insights')
        ws7.set_column('A:A', 24)
        ws7.set_column('B:B', 88)

        ws7.write(0, 0, f'{co} ? AI Financial Intelligence', f_title)
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

    co   = (req.company.name or 'Valoreva').replace(' ', '-')
    name = f"Valoreva-{co}-Analysis.xlsx"
    return StreamingResponse(
        io.BytesIO(data),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={name}",
                 "Access-Control-Expose-Headers": "Content-Disposition"},
    )


@app.post("/analyze")
async def analyze(req: AnalysisRequest, request: Request):
    _check_rate(_get_ip(request), "analyze", request)
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
    sector_note = f"Company sector: {co.sector}" if co.sector else ""
    market_data_note = ""
    if isinstance(co.marketData, dict) and co.marketData:
        md_lines = []
        for k in ("market_cap", "enterprise_value", "pe", "pb", "ev_ebitda"):
            v = co.marketData.get(k)
            if v is not None and v != "":
                md_lines.append(f"{k}: {v}")
        if md_lines:
            market_data_note = "Market data:\n" + "\n".join(f"  - {x}" for x in md_lines)

    user_message = f"""Please analyse this entity's financial health and return your JSON response.

Entity:        {entity_label}
Type:          {entity_type}
Industry:      {req.industry}
{sector_note}
{currency_note}
Health Score:  {req.score}/100 ({verdict_word})
{market_data_note}

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


# ??? 3-AI Debate endpoint ?????????????????????????????????????????????????????

class DebateRequest(BaseModel):
    ticker: str
    company_name: str
    sector: str | None = None
    thesis: str           # user's investment thesis / trade idea
    financials: dict | None = None  # optional key ratios for richer context
    max_rounds: int | None = None   # optional: 4-5 only (capped server-side)

@app.post("/debate")
async def debate(req: DebateRequest, request: Request):
    _check_rate(_get_ip(request), "analyze", request)
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY not configured on server")

    client = anthropic.Anthropic(api_key=api_key)

    # ---- Cost & safety guards -------------------------------------------------
    def _env_int(name: str, default: int, lo: int, hi: int) -> int:
        raw = os.environ.get(name, "").strip()
        try:
            val = int(raw) if raw else default
        except Exception:
            val = default
        return max(lo, min(hi, val))

    debate_model = os.environ.get("ANTHROPIC_DEBATE_MODEL", "claude-haiku-4-5").strip() or "claude-haiku-4-5"
    bullbear_max_tokens = _env_int("ANTHROPIC_DEBATE_BULLBEAR_MAX_TOKENS", 140, 80, 220)
    arbiter_max_tokens = _env_int("ANTHROPIC_DEBATE_ARBITER_MAX_TOKENS", 220, 120, 320)
    total_output_token_budget = _env_int("ANTHROPIC_DEBATE_TOTAL_OUTPUT_TOKEN_BUDGET", 1000, 400, 2200)
    max_financial_lines = _env_int("ANTHROPIC_DEBATE_MAX_FINANCIAL_LINES", 12, 6, 24)
    thesis_max_chars = _env_int("ANTHROPIC_DEBATE_MAX_THESIS_CHARS", 700, 220, 1600)
    prompt_tail_chars = _env_int("ANTHROPIC_DEBATE_PROMPT_TAIL_CHARS", 1800, 800, 3200)

    max_rounds = req.max_rounds if isinstance(req.max_rounds, int) else 4
    max_rounds = max(4, min(5, max_rounds))

    thesis = (req.thesis or "").strip()
    if not thesis:
        raise HTTPException(status_code=400, detail="thesis is required")
    if len(thesis) > thesis_max_chars:
        raise HTTPException(
            status_code=400,
            detail=f"thesis is too long (max {thesis_max_chars} characters)",
        )

    entity = f"{req.company_name} ({req.ticker.upper()})"
    sector = req.sector or "General"
    fin_block = ""
    if req.financials:
        lines = []
        for k, v in req.financials.items():
            if v is None:
                continue
            sval = str(v)
            if len(sval) > 120:
                sval = sval[:117] + "..."
            lines.append(f"  {k}: {sval}")
            if len(lines) >= max_financial_lines:
                break
        fin_block = "\nKey financials:\n" + "\n".join(lines)

    context_header = (
        f"Company: {entity}\nSector: {sector}{fin_block}\n"
        f"Investment thesis: {thesis}\n\n"
    )

    # Each agent receives the full conversation so far and responds in 2-3 sentences max.
    BULL_SYSTEM = (
        "You are a bull-side equity analyst in a live investment debate. "
        "Be sharp, specific, and respond directly to what your opponent just said. "
        "Exactly ONE compact argument block, 2-3 sentences max. "
        "No bullet points. No preamble. No sign-off."
    )
    BEAR_SYSTEM = (
        "You are a bear-side risk analyst in a live investment debate. "
        "Be sharp, specific, and respond directly to what your opponent just said. "
        "Exactly ONE compact argument block, 2-3 sentences max. "
        "No bullet points. No preamble. No sign-off."
    )
    ARBITER_SYSTEM = (
        "You are a CFA-level portfolio manager acting as impartial arbiter. "
        "You have read the full debate transcript. Return ONLY valid JSON with keys: "
        "bias (Bullish|Neutral|Bearish), confidence (0-100 int), strongest_bull_point, "
        "key_bear_risk, recommendation, journal_verdict (2-3 sentences suitable for a trading journal). "
        "No markdown, no extra text."
    )

    def _trim_history(history: list[dict]) -> list[dict]:
        # Keep the most recent context to prevent prompt growth and token spikes.
        trimmed = []
        total_chars = 0
        for msg in reversed(history):
            content = str(msg.get("content", ""))
            total_chars += len(content)
            if total_chars > prompt_tail_chars:
                break
            trimmed.append(msg)
        return list(reversed(trimmed))

    def _call(system: str, messages: list, max_tokens: int) -> tuple[str, int]:
        msg = client.messages.create(
            model=debate_model,
            max_tokens=max_tokens,
            temperature=0.2,
            system=system,
            messages=_trim_history(messages),
        )
        text = msg.content[0].text.strip()
        out_toks = int(getattr(getattr(msg, "usage", None), "output_tokens", 0) or 0)
        return text, out_toks

    try:
        rounds = []
        # conversation history for each agent (shared context)
        conversation: list[dict] = []
        output_tokens_used = 0

        opening = context_header + "Open the debate with your strongest bull argument for this investment."
        conversation.append({"role": "user", "content": opening})

        for i in range(max_rounds):
            agent = "bull" if i % 2 == 0 else "bear"
            is_opening = i == 0
            is_last = i == (max_rounds - 1)
            if is_opening:
                prompt = opening
            elif agent == "bull":
                prompt = "Bull analyst, rebut the latest bear point with one high-conviction argument."
            else:
                prompt = "Bear analyst, rebut the latest bull point with one high-conviction risk argument."
            if is_last:
                prompt += " Keep this as your final closing argument."

            if not is_opening:
                conversation.append({"role": "user", "content": prompt})

            if output_tokens_used >= total_output_token_budget:
                break

            text, out_toks = _call(
                BULL_SYSTEM if agent == "bull" else BEAR_SYSTEM,
                conversation,
                bullbear_max_tokens,
            )
            output_tokens_used += out_toks
            conversation.append({"role": "assistant", "content": text})
            rounds.append({"agent": agent, "text": text})

            if output_tokens_used >= total_output_token_budget:
                break

        # Arbiter reads the full transcript and delivers verdict
        transcript = "\n".join(
            f"{'BULL' if r['agent'] == 'bull' else 'BEAR'}: {r['text']}"
            for r in rounds
        )
        arbiter_messages = [{"role": "user", "content": (
            f"{context_header}"
            f"Full debate transcript:\n{transcript}\n\n"
            "Deliver your verdict for direct insertion into a trading journal."
        )}]
        arbiter_raw, arbiter_toks = _call(ARBITER_SYSTEM, arbiter_messages, arbiter_max_tokens)
        output_tokens_used += arbiter_toks

        def _clean_json_text(raw: str) -> str:
            t = (raw or "").strip()
            if t.startswith("```"):
                t = t.strip("`")
                if t.lower().startswith("json"):
                    t = t[4:]
                t = t.strip()
            return t

        try:
            arb = json.loads(_clean_json_text(arbiter_raw))
            bias = str(arb.get("bias", "Neutral")).strip().title()
            if bias not in ("Bullish", "Neutral", "Bearish"):
                bias = "Neutral"
            confidence = arb.get("confidence", 55)
            try:
                confidence = int(confidence)
            except Exception:
                confidence = 55
            confidence = max(0, min(100, confidence))
            strongest_bull_point = str(arb.get("strongest_bull_point", "")).strip()
            key_bear_risk = str(arb.get("key_bear_risk", "")).strip()
            recommendation = str(arb.get("recommendation", "")).strip()
            journal_verdict = str(arb.get("journal_verdict", "")).strip()
        except Exception:
            bias = "Neutral"
            confidence = 55
            strongest_bull_point = ""
            key_bear_risk = ""
            recommendation = ""
            journal_verdict = arbiter_raw.strip()

        if not journal_verdict:
            journal_verdict = (
                f"Bias: {bias}. Bull strength: {strongest_bull_point or 'earnings resilience and upside case.'} "
                f"Main risk: {key_bear_risk or 'downside scenario could compress valuation quickly.'} "
                f"Action: {recommendation or 'size position conservatively and reassess on next result cycle.'}"
            )

        arbiter_structured = {
            "bias": bias,
            "confidence": confidence,
            "strongest_bull_point": strongest_bull_point,
            "key_bear_risk": key_bear_risk,
            "recommendation": recommendation,
            "journal_verdict": journal_verdict,
        }

        return {
            "rounds": rounds,
            "arbiter": journal_verdict,  # back-compat for current UI
            "arbiter_structured": arbiter_structured,
            "meta": {
                "model": debate_model,
                "rounds_requested": max_rounds,
                "rounds_completed": len(rounds),
                "output_tokens_used_estimate": output_tokens_used,
                "output_token_budget": total_output_token_budget,
            },
        }

    except anthropic.APIError as e:
        raise HTTPException(status_code=502, detail=f"Anthropic API error: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# -- Full stock-list autocomplete ----------------------------------------------
# Source: NSE public equity CSV (refreshed every 24 h, cached in memory).
# Covers all ~1800+ NSE-listed equities.

_STOCK_CACHE: dict = {"nse": [], "loaded_at": 0.0}
_STOCK_CACHE_TTL = 24 * 60 * 60

_NSE_CSV_URLS = [
    "https://nsearchives.nseindia.com/content/equities/EQUITY_L.csv",
    "https://archives.nseindia.com/content/equities/EQUITY_L.csv",
]
_NSE_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,*/*",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://www.nseindia.com/",
}

async def _load_nse_stock_list():
    now = time.time()
    if _STOCK_CACHE["nse"] and now - _STOCK_CACHE["loaded_at"] < _STOCK_CACHE_TTL:
        return _STOCK_CACHE["nse"]
    text = ""
    errors = []
    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=20) as client:
            # Prime NSE cookies once; helps avoid 403 on some regions/IPs.
            try:
                await client.get("https://www.nseindia.com/", headers=_NSE_HEADERS)
            except Exception:
                pass
            for csv_url in _NSE_CSV_URLS:
                try:
                    resp = await client.get(csv_url, headers=_NSE_HEADERS)
                    resp.raise_for_status()
                    text = resp.text
                    if text:
                        break
                except Exception as exc:
                    errors.append(f"{csv_url}: {exc}")
    except Exception as exc:
        errors.append(str(exc))

    if not text:
        if _STOCK_CACHE["nse"]:
            return _STOCK_CACHE["nse"]
        raise HTTPException(status_code=503, detail=f"Could not load NSE stock list: {' | '.join(errors)}")

    stocks = []
    reader = csv.DictReader(io.StringIO(text))
    VALID_SERIES = {"EQ","BE","SM","ST","N1","N2","N3","N4","N5","N6","N7","N8","N9",""}
    for row in reader:
        symbol = (row.get("SYMBOL") or "").strip()
        name   = (row.get("NAME OF COMPANY") or "").strip()
        series = (row.get("SERIES") or "").strip()
        if not symbol or not name:
            continue
        if series and series not in VALID_SERIES:
            continue
        stocks.append({"ticker": symbol + ".NS", "name": name, "exchange": "NSE", "sector": ""})
    if stocks:
        _STOCK_CACHE["nse"] = stocks
        _STOCK_CACHE["loaded_at"] = now
    return stocks

def _fallback_search_yahoo(q: str, limit: int) -> list[dict]:
    """
    Fallback autocomplete when NSE CSV is unavailable.
    Uses Yahoo Finance public search endpoint.
    """
    query = q.strip()
    if not query:
        return []
    try:
        resp = requests.get(
            "https://query2.finance.yahoo.com/v1/finance/search",
            params={"q": query, "quotesCount": max(limit * 4, 20), "newsCount": 0},
            headers={"User-Agent": _NSE_HEADERS["User-Agent"], "Referer": "https://finance.yahoo.com/"},
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json() if resp.content else {}
    except Exception:
        return []

    out = []
    seen = set()
    for quote in (data.get("quotes") or []):
        if quote.get("quoteType") != "EQUITY":
            continue
        sym = str(quote.get("symbol") or "").strip().upper()
        name = str(quote.get("shortname") or quote.get("longname") or "").strip()
        exch = str(quote.get("exchangeDisp") or quote.get("exchange") or "").strip().upper()
        if not sym or not name:
            continue

        # Keep India-focused search behavior for dashboard/watchlist flows.
        is_india = sym.endswith(".NS") or sym.endswith(".BO") or "NSE" in exch or "BSE" in exch or "INDIA" in exch
        if not is_india:
            continue

        # Normalize unsuffixed NSE/BSE symbols where possible.
        if not (sym.endswith(".NS") or sym.endswith(".BO")):
            if "BSE" in exch:
                sym = f"{sym}.BO"
            else:
                sym = f"{sym}.NS"

        if sym in seen:
            continue
        seen.add(sym)
        out.append({"ticker": sym, "name": name, "exchange": "NSE" if sym.endswith(".NS") else "BSE", "sector": ""})
        if len(out) >= limit:
            break
    return out

@app.get("/stocks/search")
async def stocks_search(
    request: Request,
    q: str = Query(default="", min_length=1),
    limit: int = Query(default=10, le=20),
):
    """Fuzzy search over all NSE-listed equities."""
    _check_rate(_get_ip(request), "search", request)
    q_lower = q.strip().lower()
    try:
        stocks = await _load_nse_stock_list()
    except HTTPException:
        # Do not break UI if NSE archive is temporarily blocked.
        return _fallback_search_yahoo(q, limit)
    exact_t = []; exact_n = []; starts_t = []; starts_n = []; contains = []
    for s in stocks:
        t = s["ticker"].lower().replace(".ns", "")
        n = s["name"].lower()
        if t == q_lower:          exact_t.append(s)
        elif n == q_lower:        exact_n.append(s)
        elif t.startswith(q_lower): starts_t.append(s)
        elif n.startswith(q_lower): starts_n.append(s)
        elif q_lower in t or q_lower in n: contains.append(s)
    return (exact_t + exact_n + starts_t + starts_n + contains)[:limit]

# -- Lightweight stock metadata (sector + currency only) ----------------------
# Used by TickerAutocomplete to fill sector/currency after a company is selected.
# Much faster than /company/yf/{ticker} - only fetches .info, no financials.

_META_CACHE: dict = {}
_META_TTL = 6 * 60 * 60  # 6 hours

def _fetch_meta(sym: str) -> dict:
    import yfinance as yf
    try:
        tk   = yf.Ticker(sym)
        info = tk.info or {}
        return {
            "sector":   info.get("sector") or info.get("industryDisp") or "",
            "currency": info.get("currency") or info.get("financialCurrency") or "",
            "name":     info.get("longName") or info.get("shortName") or "",
        }
    except Exception:
        return {"sector": "", "currency": "", "name": ""}

@app.get("/stocks/meta/{ticker}")
async def stocks_meta(ticker: str, request: Request):
    """Return sector + currency for a ticker. Lightweight - no financials fetched."""
    sym = ticker.upper().strip()
    cached = _META_CACHE.get(sym)
    if cached and time.time() - cached["ts"] < _META_TTL:
        return cached["data"]
    loop   = asyncio.get_running_loop()
    result = await asyncio.wait_for(
        loop.run_in_executor(_executor, _fetch_meta, sym),
        timeout=8.0,
    )
    _META_CACHE[sym] = {"data": result, "ts": time.time()}
    return result


# -- Live price endpoint -------------------------------------------------------
_PRICE_CACHE: dict = {}
_PRICE_TTL = 55  # seconds - just under 1 minute polling interval

def _is_indian_ticker(sym: str) -> bool:
    return sym.endswith(".NS") or sym.endswith(".BO")

def _fetch_price_bse(sym: str) -> dict | None:
    """Fetch live price via BSE library for Indian tickers."""
    try:
        from bse import BSE
        b = BSE(timeout=6)
        # Strip exchange suffix to get bare symbol
        bare = sym.replace(".NS", "").replace(".BO", "")
        # BSE search returns scrip code
        result = b.getQuote(bare)
        if not result:
            return None
        ltp    = float(result.get("currentValue") or result.get("LTP") or 0)
        prev   = float(result.get("previousClose") or result.get("pClose") or ltp)
        change = ltp - prev
        change_pct = round((change / prev) * 100, 2) if prev else 0.0
        return {
            "price":      round(ltp, 2),
            "change":     round(change, 2),
            "change_pct": change_pct,
            "prev_close": round(prev, 2),
            "volume":     int(result.get("totalTradedVolume") or result.get("volume") or 0),
            "source":     "BSE",
        }
    except Exception:
        return None

def _fetch_price_yf(sym: str) -> dict:
    """Fallback: fetch live price via yfinance fast_info."""
    import yfinance as yf
    try:
        tk   = yf.Ticker(sym)
        fi   = tk.fast_info
        ltp  = float(getattr(fi, "last_price", 0) or 0)
        prev = float(getattr(fi, "previous_close", ltp) or ltp)
        change = ltp - prev
        change_pct = round((change / prev) * 100, 2) if prev else 0.0
        return {
            "price":      round(ltp, 2),
            "change":     round(change, 2),
            "change_pct": change_pct,
            "prev_close": round(prev, 2),
            "volume":     int(getattr(fi, "three_month_average_volume", 0) or 0),
            "source":     "YF",
        }
    except Exception:
        return {"price": 0, "change": 0, "change_pct": 0, "prev_close": 0, "volume": 0, "source": "YF"}

def _fetch_price(sym: str) -> dict:
    """
    Resolve live price with robust symbol fallbacks.
    - If ticker has .NS/.BO, prefer BSE first, then YF.
    - If ticker has no suffix, try as-is, then .NS, then .BO.
    """
    # Exchange-suffixed symbols: keep existing fast path.
    if _is_indian_ticker(sym):
        result = _fetch_price_bse(sym)
        if result and result["price"] > 0:
            return result
        yf_result = _fetch_price_yf(sym)
        if yf_result.get("price", 0) > 0:
            return yf_result
        # Last fallback: strip suffix in case stored ticker is malformed.
        bare = sym.replace(".NS", "").replace(".BO", "")
        return _fetch_price_yf(bare)

    # Unsuffixed symbols: try direct first (works for US/global tickers).
    primary = _fetch_price_yf(sym)
    if primary.get("price", 0) > 0:
        return primary

    # Indian fallback path for unsuffixed symbols.
    for candidate in (f"{sym}.NS", f"{sym}.BO"):
        bse_result = _fetch_price_bse(candidate)
        if bse_result and bse_result.get("price", 0) > 0:
            return bse_result
        yf_result = _fetch_price_yf(candidate)
        if yf_result.get("price", 0) > 0:
            return yf_result

    return primary

@app.get("/stocks/price/{ticker}")
async def stocks_price(ticker: str, request: Request):
    """Live price for a stock. Indian tickers use BSE API, others use yfinance."""
    _check_rate(_get_ip(request), "search", request)
    sym = ticker.upper().strip()
    cached = _PRICE_CACHE.get(sym)
    if cached and time.time() - cached["ts"] < _PRICE_TTL:
        return cached["data"]
    loop   = asyncio.get_running_loop()
    result = await asyncio.wait_for(
        loop.run_in_executor(_executor, _fetch_price, sym),
        timeout=10.0,
    )
    _PRICE_CACHE[sym] = {"data": result, "ts": time.time()}
    return result


# -- News endpoint -------------------------------------------------------------
_NEWS_CACHE: dict = {}
_NEWS_TTL = 10 * 60  # 10 minutes

def _fetch_news(sym: str) -> list:
    import yfinance as yf
    try:
        tk   = yf.Ticker(sym)
        news = tk.news or []
        out  = []
        for item in news[:5]:
            ct = item.get("content") or {}
            title = ct.get("title") or item.get("title", "")
            url   = ct.get("canonicalUrl", {}).get("url") or item.get("link", "")
            pub   = ct.get("provider", {}).get("displayName") or item.get("publisher", "")
            ts    = ct.get("pubDate") or item.get("providerPublishTime")
            if isinstance(ts, int):
                import datetime
                ts = datetime.datetime.utcfromtimestamp(ts).isoformat() + "Z"
            if title:
                out.append({"title": title, "url": url, "publisher": pub, "published_at": ts or ""})
        return out
    except Exception:
        return []

@app.get("/stocks/news/{ticker}")
async def stocks_news(ticker: str, request: Request):
    """Recent news headlines for a ticker. Cached 10 minutes."""
    _check_rate(_get_ip(request), "search", request)
    sym = ticker.upper().strip()
    cached = _NEWS_CACHE.get(sym)
    if cached and time.time() - cached["ts"] < _NEWS_TTL:
        return cached["data"]
    loop   = asyncio.get_running_loop()
    result = await asyncio.wait_for(
        loop.run_in_executor(_executor, _fetch_news, sym),
        timeout=10.0,
    )
    _NEWS_CACHE[sym] = {"data": result, "ts": time.time()}
    return result

