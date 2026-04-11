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
import anthropic
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

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
