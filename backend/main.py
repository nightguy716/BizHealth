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
