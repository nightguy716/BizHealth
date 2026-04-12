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
import json
import math
import asyncio
import requests
from concurrent.futures import ThreadPoolExecutor
import anthropic
import httpx
import yfinance as yf
import pandas as pd
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

_executor = ThreadPoolExecutor(max_workers=4)

app = FastAPI(title="BizHealth API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)

SYSTEM_PROMPT = """You are a senior financial analyst specialising in Indian SME financial health assessment. You have deep expertise in reading financial ratios and translating them into clear, actionable business advice for business owners — not accountants.

You must respond with ONLY a valid JSON object — no markdown, no explanation outside the JSON — with exactly these keys:

{
  "executive_summary": "2-3 sentence overview of overall financial health, mentioning specific ratio values",
  "health_verdict": "exactly one of: Strong | Moderate | Below Average | Critical",
  "top_risks": [
    { "title": "short title max 6 words", "description": "2 sentences mentioning actual ratio values", "urgency": "High | Medium | Low" }
  ],
  "top_opportunities": [
    { "title": "short title max 6 words", "description": "2 sentences with specific, actionable insight", "impact": "High | Medium | Low" }
  ],
  "priority_actions": [
    { "action": "specific action to take, mentioning numbers", "timeline": "e.g. This week | Next 30 days | Next quarter", "expected_impact": "what metric will improve and by roughly how much" }
  ],
  "industry_context": "one paragraph comparing to Indian industry norms, mentioning the selected industry"
}

Rules:
- top_risks: exactly 3 items
- top_opportunities: exactly 3 items  
- priority_actions: exactly 5 items
- Be specific — always mention actual ratio values in descriptions
- Be direct — this owner needs to act, not just understand
- Avoid jargon — plain English throughout"""


class AnalysisRequest(BaseModel):
    ratios:   dict
    statuses: dict
    industry: str
    score:    int


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


def _yf_session() -> requests.Session:
    """Browser-like session so Yahoo Finance doesn't block Railway's server IP."""
    s = requests.Session()
    s.headers.update({
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/124.0.0.0 Safari/537.36"
        ),
        "Accept":          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
    })
    return s


def _fetch_ticker_blocking(ticker_str: str):
    """
    All yfinance calls are synchronous blocking I/O.
    This runs inside a ThreadPoolExecutor so the async event loop stays free.
    """
    session = _yf_session()
    t = yf.Ticker(ticker_str, session=session)

    # --- meta info (optional — graceful fallback) ---
    name = ticker_str
    currency = "USD"
    sector = ""
    try:
        fi = t.fast_info
        currency = getattr(fi, "currency", "USD") or "USD"
    except Exception:
        pass
    try:
        info = t.info or {}
        name     = info.get("longName") or info.get("shortName") or ticker_str
        sector   = info.get("sector", "")
        currency = info.get("currency", currency)
    except Exception:
        pass

    # --- income statement ---
    inc = None
    for attr in ("income_stmt", "financials"):
        try:
            df = getattr(t, attr, None)
            if df is not None and not df.empty:
                inc = df
                break
        except Exception:
            pass

    # --- balance sheet ---
    bal = None
    try:
        df = t.balance_sheet
        if df is not None and not df.empty:
            bal = df
    except Exception:
        pass

    # --- cash flow (for interest fallback) ---
    cf = None
    for attr in ("cashflow", "cash_flow"):
        try:
            df = getattr(t, attr, None)
            if df is not None and not df.empty:
                cf = df
                break
        except Exception:
            pass

    return name, currency, sector, inc, bal, cf


@app.get("/company/{ticker}")
async def get_company(ticker: str):
    loop = asyncio.get_event_loop()
    try:
        name, currency, sector, inc, bal, cf = await asyncio.wait_for(
            loop.run_in_executor(_executor, _fetch_ticker_blocking, ticker.upper()),
            timeout=35.0,
        )
    except asyncio.TimeoutError:
        raise HTTPException(status_code=504, detail="Yahoo Finance timed out — try again in a moment")
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

    if inc is None or inc.empty:
        raise HTTPException(status_code=404, detail=f"No financial data found for {ticker.upper()}")

    gross_profit     = _safe(inc, ["Gross Profit"])
    operating_income = _safe(inc, ["Operating Income", "EBIT", "Operating Income Loss"])
    revenue          = _safe(inc, ["Total Revenue", "Revenue"])
    net_income       = _safe(inc, ["Net Income", "Net Income Common Stockholders",
                                   "Net Income Including Noncontrolling Interests"])
    cogs_raw         = _safe(inc, ["Cost Of Revenue", "Reconciled Cost Of Revenue",
                                   "Cost Of Goods Sold"])

    if gross_profit is None and revenue and cogs_raw:
        gross_profit = revenue - cogs_raw
    if cogs_raw is None and revenue and gross_profit:
        cogs_raw = revenue - gross_profit

    op_expenses = None
    if gross_profit is not None and operating_income is not None:
        op_expenses = abs(gross_profit - operating_income)

    interest_raw = _safe(inc, ["Interest Expense", "Interest Expense Non Operating",
                                "Net Interest Income"])
    if interest_raw is None and cf is not None:
        interest_raw = _safe(cf, ["Interest Paid Cff", "Interest Paid", "Interest Expense Paid"])
    interest = abs(interest_raw) if interest_raw is not None else None

    cash = _safe(bal, [
        "Cash And Cash Equivalents",
        "Cash Cash Equivalents And Short Term Investments",
        "Cash And Short Term Investments",
        "Cash Financial",
    ])
    equity = _safe(bal, [
        "Stockholders Equity", "Common Stock Equity",
        "Total Stockholder Equity", "Total Equity Gross Minority Interest",
        "Tangible Book Value",
    ])
    receivables = _safe(bal, [
        "Net Receivables", "Accounts Receivable",
        "Receivables", "Gross Accounts Receivable",
    ])

    raw = {
        "currentAssets":      _safe(bal, ["Current Assets", "Total Current Assets"]),
        "currentLiabilities": _safe(bal, ["Current Liabilities", "Total Current Liabilities"]),
        "inventory":          _safe(bal, ["Inventory", "Inventories"]),
        "cash":               cash,
        "totalAssets":        _safe(bal, ["Total Assets"]),
        "equity":             equity,
        "totalDebt":          _safe(bal, ["Total Debt", "Long Term Debt And Capital Lease Obligation",
                                          "Long Term Debt"]),
        "revenue":            revenue,
        "grossProfit":        gross_profit,
        "operatingExpenses":  op_expenses,
        "netProfit":          net_income,
        "interestExpense":    interest,
        "receivables":        receivables,
        "cogs":               cogs_raw,
    }

    mapped = {}
    for k, v in raw.items():
        if v is not None and not (isinstance(v, float) and math.isnan(v)):
            mapped[k] = str(int(abs(round(v))))

    industry = SECTOR_MAP.get(sector, "general")
    total    = len(raw)
    filled   = len(mapped)
    coverage = round((filled / total) * 100)

    return {
        "ticker":   ticker.upper(),
        "name":     name,
        "sector":   sector,
        "industry": industry,
        "currency": currency,
        "coverage": coverage,
        "filled":   filled,
        "total":    total,
        "data":     mapped,
    }


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

    user_message = f"""Please analyse this SME's financial health and return your JSON response.

Industry:      {req.industry}
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
