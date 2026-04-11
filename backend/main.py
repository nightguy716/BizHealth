"""
BizHealth FastAPI Backend
-------------------------
Single endpoint: POST /analyze
Takes the 14 ratio values, statuses, industry, and health score.
Calls OpenAI GPT-4o-mini and returns a structured financial analysis.

Deploy to Render:
1. Push this repo to GitHub (already done)
2. Go to render.com → New Web Service → connect your repo
3. Set Root Directory: backend
4. Build Command:  pip install -r requirements.txt
5. Start Command:  uvicorn main:app --host 0.0.0.0 --port $PORT
6. Add environment variable: OPENAI_API_KEY = sk-...
7. Copy the Render URL → set VITE_BACKEND_URL in Vercel dashboard
"""

import os
import json
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from openai import OpenAI

app = FastAPI(title="BizHealth API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict to your Vercel domain
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)

SYSTEM_PROMPT = """You are a senior financial analyst specializing in Indian SME financial health assessment.
You have deep expertise in reading financial ratios and translating them into clear, actionable business advice.
Your audience is business owners — not accountants — so use plain language.

You will receive a set of financial ratios with their health statuses and must return a JSON object with EXACTLY these keys:

{
  "executive_summary": "2–3 sentence overview of overall financial health",
  "health_verdict": "one of: Strong | Moderate | Below Average | Critical",
  "top_risks": [
    { "title": "short title", "description": "2 sentence explanation", "urgency": "High | Medium | Low" }
  ],
  "top_opportunities": [
    { "title": "short title", "description": "2 sentence explanation", "impact": "High | Medium | Low" }
  ],
  "priority_actions": [
    { "action": "specific action to take", "timeline": "timeframe", "expected_impact": "what will improve" }
  ],
  "industry_context": "one paragraph on how this compares to industry norms"
}

top_risks: exactly 3 items. top_opportunities: exactly 3 items. priority_actions: exactly 5 items.
Be specific — mention actual ratio values in your descriptions. Be direct — this is a business owner who needs to act."""


class AnalysisRequest(BaseModel):
    ratios:   dict
    statuses: dict
    industry: str
    score:    int


@app.get("/")
def root():
    return {"status": "BizHealth API is running", "version": "1.0.0"}


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/analyze")
async def analyze(req: AnalysisRequest):
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY not configured")

    client = OpenAI(api_key=api_key)

    # Build human-readable ratio summary
    ratio_lines = []
    for key, val in req.ratios.items():
        status = req.statuses.get(key, "na")
        if val is not None:
            ratio_lines.append(f"  - {key}: {val:.2f} (Status: {status})")
        else:
            ratio_lines.append(f"  - {key}: N/A (Status: na)")

    user_prompt = f"""
Industry: {req.industry}
Overall Health Score: {req.score}% ({req.score >= 80 and 'Strong' or req.score >= 60 and 'Moderate' or req.score >= 40 and 'Below Average' or 'Critical'})

Financial Ratios:
{chr(10).join(ratio_lines)}

Please analyse this business's financial health and return your structured JSON response.
"""

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user",   "content": user_prompt},
            ],
            response_format={"type": "json_object"},
            temperature=0.4,
            max_tokens=2000,
        )
        result = json.loads(response.choices[0].message.content)
        return result
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="AI returned invalid JSON")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
