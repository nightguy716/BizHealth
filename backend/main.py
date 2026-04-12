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
    "Origin":          "https://finance.yahoo.com",
    "Referer":         "https://finance.yahoo.com/",
}


async def _get_crumb(client: httpx.AsyncClient) -> str:
    """Fetch Yahoo Finance session cookie + crumb (required since 2023)."""
    await client.get("https://finance.yahoo.com", headers=YF_HEADERS)
    r = await client.get(
        "https://query2.finance.yahoo.com/v1/test/getcrumb",
        headers=YF_HEADERS,
    )
    return r.text.strip()


def _pick(d: dict, *keys):
    """Return first non-None value from a nested dict by key path."""
    for k in keys:
        v = d.get(k)
        if v is not None and v != "N/A":
            try:
                f = float(v)
                if not math.isnan(f):
                    return f
            except (TypeError, ValueError):
                pass
    return None


def _annual(stmt_list: list, *keys):
    """Most-recent annual figure from a Yahoo Finance statement list."""
    if not stmt_list:
        return None
    row = stmt_list[0]
    for k in keys:
        item = row.get(k, {})
        raw  = item.get("raw") if isinstance(item, dict) else None
        if raw is not None:
            try:
                f = float(raw)
                if not math.isnan(f):
                    return f
            except (TypeError, ValueError):
                pass
    return None


@app.get("/company/{ticker}")
async def get_company(ticker: str):
    """
    Calls Yahoo Finance's quoteSummary v10 API directly — bypasses the
    yfinance library which gets IP-blocked on cloud servers.
    """
    sym = ticker.upper()
    modules = "incomeStatementHistory,balanceSheetHistory,cashflowStatementHistory,assetProfile,price"
    url = f"https://query2.finance.yahoo.com/v10/finance/quoteSummary/{sym}?modules={modules}"

    try:
        async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
            # Step 1 — get session cookie + crumb
            crumb = await _get_crumb(client)
            # Step 2 — fetch financial data
            r = await client.get(
                url + f"&crumb={crumb}",
                headers=YF_HEADERS,
            )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Yahoo Finance request failed: {e}")

    if r.status_code != 200:
        raise HTTPException(status_code=r.status_code,
                            detail=f"Yahoo Finance returned {r.status_code}")

    body = r.json()
    result = body.get("quoteSummary", {}).get("result")
    if not result:
        err = body.get("quoteSummary", {}).get("error", {})
        raise HTTPException(status_code=404,
                            detail=err.get("description", f"No data for {sym}"))

    data   = result[0]
    inc_h  = data.get("incomeStatementHistory",  {}).get("incomeStatementHistory",  [])
    bal_h  = data.get("balanceSheetHistory",     {}).get("balanceSheetHistory",     [])
    cf_h   = data.get("cashflowStatementHistory",{}).get("cashflowStatementHistory",[])
    profile= data.get("assetProfile", {})
    price  = data.get("price", {})

    sector   = profile.get("sector", "")
    name     = price.get("longName") or price.get("shortName") or sym
    currency = price.get("currency") or price.get("currencySymbol") or "USD"

    # ── income statement (most-recent annual = index 0) ──────────
    revenue     = _annual(inc_h, "totalRevenue")
    gross_p     = _annual(inc_h, "grossProfit")
    cogs_raw    = _annual(inc_h, "costOfRevenue")
    op_income   = _annual(inc_h, "operatingIncome", "ebit")
    net_income  = _annual(inc_h, "netIncome")
    int_exp_raw = _annual(inc_h, "interestExpense")

    # ── cash flow (interest paid fallback) ───────────────────────
    int_paid = _annual(cf_h, "interestPaid") if int_exp_raw is None else None

    # ── balance sheet ─────────────────────────────────────────────
    cur_assets = _annual(bal_h, "totalCurrentAssets")
    cur_liab   = _annual(bal_h, "totalCurrentLiabilities")
    inventory  = _annual(bal_h, "inventory")
    cash       = _annual(bal_h, "cash", "cashAndCashEquivalents",
                         "cashAndShortTermInvestments")
    total_assets = _annual(bal_h, "totalAssets")
    equity     = _annual(bal_h, "totalStockholderEquity", "stockholdersEquity")
    total_debt = _annual(bal_h, "totalDebt", "longTermDebt",
                         "longTermDebtAndCapitalLeaseObligation")
    receivables= _annual(bal_h, "netReceivables", "accountsReceivable")

    # ── derived values ────────────────────────────────────────────
    if gross_p is None and revenue and cogs_raw:
        gross_p = revenue - cogs_raw
    if cogs_raw is None and revenue and gross_p:
        cogs_raw = revenue - gross_p

    op_expenses = None
    if gross_p is not None and op_income is not None:
        op_expenses = abs(gross_p - op_income)

    interest = abs(int_exp_raw or int_paid or 0) or None

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
        "operatingExpenses":  op_expenses,
        "netProfit":          net_income,
        "interestExpense":    interest,
        "receivables":        receivables,
        "cogs":               cogs_raw,
    }

    mapped = {}
    for k, v in raw.items():
        if v is not None and not (isinstance(v, float) and math.isnan(v)) and v != 0:
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
