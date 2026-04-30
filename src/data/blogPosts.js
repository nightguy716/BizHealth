/**
 * Blog post data. Each post is fully self-contained.
 * slug       – URL-safe identifier, used in /blog/:slug
 * title      – Page <title> and H1
 * seoTitle   – Optional override for <title> tag (can be longer)
 * description– Meta description, ~155 chars
 * category   – Display tag
 * readTime   – Estimated read time in minutes
 * date       – ISO date string
 * author     – Display name
 * content    – Array of section objects { type, ... }
 *   types: 'lead', 'h2', 'p', 'formula', 'table', 'callout', 'list', 'cta'
 */

export const POSTS = [
  /* ── 1 ──────────────────────────────────────────────────── */
  {
    slug: 'current-ratio-explained',
    title: 'Current Ratio: The #1 Liquidity Test Every Analyst Runs First',
    description: 'Learn how to calculate the current ratio, what a good number looks like across industries, and why it is the first ratio any analyst checks when evaluating financial health.',
    category: 'Liquidity',
    readTime: 6,
    date: '2026-03-18',
    author: 'Valoreva Team',
    content: [
      { type: 'lead', text: 'Before a bank approves a loan, before an investor writes a cheque, before a consultant walks into a boardroom — they check one number first. The current ratio.' },
      { type: 'h2', text: 'What Is the Current Ratio?' },
      { type: 'p', text: 'The current ratio measures a company\'s ability to pay short-term obligations using only its short-term assets. It answers the question: if every creditor called their loan tomorrow, could we pay them without selling the factory?' },
      { type: 'formula', label: 'Current Ratio', formula: 'Current Assets ÷ Current Liabilities', example: 'e.g. $4.5M ÷ $2.8M = 1.61×' },
      { type: 'h2', text: 'What Is a Good Current Ratio?' },
      { type: 'p', text: 'The classic benchmark is 2.0× — meaning the company has twice as many current assets as current liabilities. But context matters enormously.' },
      { type: 'table', headers: ['Industry', 'Typical Range', 'Why'], rows: [
        ['Retail / FMCG', '0.8 – 1.2×', 'High inventory turnover, short cash cycles'],
        ['Manufacturing', '1.5 – 2.5×', 'Longer production cycles, higher WIP'],
        ['Technology (SaaS)', '2.0 – 4.0×', 'Low physical inventory, strong cash position'],
        ['Construction', '1.2 – 2.0×', 'Project-based cash flows create natural volatility'],
        ['Financial Services', '0.5 – 1.0×', 'Different liquidity model; ratio less meaningful'],
      ]},
      { type: 'callout', variant: 'warning', text: 'A very high current ratio (above 4–5×) is not always good. It may signal idle cash, bloated receivables, or excess inventory that management has failed to deploy productively.' },
      { type: 'h2', text: 'Current Ratio vs Quick Ratio: Which Matters More?' },
      { type: 'p', text: 'The current ratio includes inventory in current assets. If inventory is slow-moving or illiquid (think: half-built houses or bespoke industrial parts), the current ratio overstates true liquidity. The quick ratio strips inventory out and is a more conservative test.' },
      { type: 'p', text: 'Best practice: run both. If the current ratio is fine but the quick ratio is weak, you have a potential inventory quality problem.' },
      { type: 'h2', text: 'Common Red Flags to Watch' },
      { type: 'list', items: [
        'Current ratio below 1.0× — the company technically cannot cover short-term obligations without selling long-term assets or borrowing.',
        'Rapid decline over 3+ years — even a ratio of 1.8× is concerning if it was 3.2× three years ago.',
        'Very high receivables driving the ratio up — receivables that are 90+ days overdue are not really liquid.',
        'Seasonal spikes — always compare to the same quarter in prior years for seasonal businesses.',
      ]},
      { type: 'cta', text: 'Calculate the current ratio — and 22 other financial ratios — for any listed company instantly.', link: '/dashboard', label: 'Try It Free →' },
    ],
  },

  /* ── 2 ──────────────────────────────────────────────────── */
  {
    slug: 'dupont-analysis-roe-decomposition',
    title: 'DuPont Analysis: How to Decompose ROE Like a CFA Analyst',
    description: 'DuPont analysis breaks ROE into Net Margin, Asset Turnover, and Equity Multiplier. Learn the 3-factor and 5-factor models and how to use them in due diligence.',
    category: 'Profitability',
    readTime: 8,
    date: '2026-03-22',
    author: 'Valoreva Team',
    content: [
      { type: 'lead', text: 'ROE is a single number. DuPont analysis reveals the story behind it. Two companies can post identical 20% ROE for completely different reasons — and one of them is about to collapse.' },
      { type: 'h2', text: 'The Three-Factor DuPont Formula' },
      { type: 'p', text: 'The 3-factor model was developed by DuPont Corporation in the 1920s and is still the most widely used framework for decomposing return on equity.' },
      { type: 'formula', label: 'DuPont (3-Factor)', formula: 'ROE = Net Margin × Asset Turnover × Equity Multiplier', example: '20% = 10% × 1.2× × 1.67×' },
      { type: 'p', text: 'Each factor isolates a different dimension of performance: profitability (what you keep from each dollar of revenue), efficiency (how hard your assets are working), and leverage (how much of the business is financed by equity vs debt).' },
      { type: 'h2', text: 'What Each Factor Tells You' },
      { type: 'table', headers: ['Factor', 'Formula', 'Diagnoses'], rows: [
        ['Net Profit Margin', 'Net Profit ÷ Revenue', 'Pricing power, cost control, tax efficiency'],
        ['Asset Turnover', 'Revenue ÷ Total Assets', 'Operational efficiency, asset utilisation'],
        ['Equity Multiplier', 'Total Assets ÷ Equity', 'Financial leverage; higher = more debt'],
      ]},
      { type: 'h2', text: 'Two Companies. Same ROE. Very Different Risk Profiles.' },
      { type: 'p', text: 'Apple (FY2023) and a typical retail bank might both show ~20% ROE. Apple achieves it through exceptional margins (25%+ net margin) and asset-light business model. The bank achieves it through a very high equity multiplier — 8–12× leverage. Same headline number, completely different risk.' },
      { type: 'callout', variant: 'info', text: 'The equity multiplier is the "hidden amplifier" in ROE. When a company improves ROE by increasing leverage, it is not creating value — it is borrowing against future earnings. Always check whether ROE improvement came from margin or leverage.' },
      { type: 'h2', text: 'The Five-Factor Extension' },
      { type: 'p', text: 'The 5-factor model further splits net margin into tax burden (Net Income ÷ Pre-tax Income) and interest burden (Pre-tax Income ÷ EBIT), and splits asset turnover into EBIT margin (EBIT ÷ Revenue) and asset turnover. This level of decomposition is used in full equity research reports.' },
      { type: 'formula', label: 'DuPont (5-Factor)', formula: 'ROE = Tax Burden × Interest Burden × EBIT Margin × Asset Turnover × Equity Multiplier', example: '' },
      { type: 'h2', text: 'How to Use DuPont in Practice' },
      { type: 'list', items: [
        'Compare to sector peers: if your ROE is better but only because of higher leverage, that\'s a risk premium, not an operational advantage.',
        'Track changes year-over-year: a declining net margin offset by rising leverage is a red flag.',
        'Use in M&A: acquirers use DuPont to identify whether target ROE is margin-driven (stickier) or leverage-driven (riskier post-acquisition).',
        'CFA exam context: CFA Level 1 and 2 both test DuPont in detail. Understand it conceptually, not just formulaically.',
      ]},
      { type: 'cta', text: 'Run live DuPont decomposition on any listed company — both 3-factor and 5-factor — on Valoreva.', link: '/dashboard', label: 'Analyse ROE →' },
    ],
  },

  /* ── 3 ──────────────────────────────────────────────────── */
  {
    slug: 'altman-z-score-bankruptcy-predictor',
    title: "Altman Z-Score: The Bankruptcy Predictor Wall Street Still Uses",
    description: "The Altman Z-Score is a quantitative model that predicts corporate bankruptcy with 72–80% accuracy up to two years out. Here's how to calculate and interpret it.",
    category: 'Credit Analysis',
    readTime: 7,
    date: '2026-03-29',
    author: 'Valoreva Team',
    content: [
      { type: 'lead', text: 'In 1968, NYU professor Edward Altman published a formula that predicted 72% of corporate bankruptcies two years before they happened. Half a century later, credit analysts still use it.' },
      { type: 'h2', text: 'The Formula' },
      { type: 'p', text: 'The original Z-Score model was built for publicly traded manufacturing firms. It uses five weighted financial ratios:' },
      { type: 'formula', label: 'Altman Z-Score', formula: 'Z = 1.2X₁ + 1.4X₂ + 3.3X₃ + 0.6X₄ + 1.0X₅', example: 'X₁ = Working Capital/Total Assets · X₂ = Retained Earnings/Total Assets · X₃ = EBIT/Total Assets · X₄ = Market Cap/Total Liabilities · X₅ = Revenue/Total Assets' },
      { type: 'h2', text: 'Interpreting the Score' },
      { type: 'table', headers: ['Score Range', 'Zone', 'Interpretation'], rows: [
        ['> 2.99', 'Safe Zone', 'Low bankruptcy probability. Company is financially sound.'],
        ['1.81 – 2.99', 'Grey Zone', 'Unclear. Warrants deeper investigation of individual components.'],
        ['< 1.81', 'Distress Zone', 'High bankruptcy risk. Credit analysis should be elevated.'],
      ]},
      { type: 'callout', variant: 'warning', text: 'The Z-Score is not a crystal ball. Enron scored well until it didn\'t — because their fraud inflated the EBIT and asset numbers that feed the model. Always use it alongside qualitative analysis and the Beneish M-Score for earnings quality checks.' },
      { type: 'h2', text: 'Variants for Different Business Types' },
      { type: 'p', text: 'Altman later developed Z\'-Score (private firms, replacing market cap with book value of equity) and Z\'\'-Score (non-manufacturing, service firms). These remove the revenue/assets factor which is less meaningful in service businesses.' },
      { type: 'h2', text: 'What Drove the Famous Predictions' },
      { type: 'p', text: 'The X₃ factor (EBIT/Total Assets) has the highest weight at 3.3× because it captures core operating profitability independent of financing and tax. When this collapses, the entire Z-Score deteriorates rapidly — which is why companies in financial trouble often show declining Z-Scores 18–24 months before filing.' },
      { type: 'list', items: [
        'Enron (2001): Z-Score dropped into distress zone a full year before collapse.',
        'Lehman Brothers (2008): Grey zone for two years before bankruptcy.',
        'Toys R Us (2017): Persistent distress zone masked by private ownership until too late.',
        'General Electric (2018–2019): Sharp decline from safe to grey zone triggered credit downgrades.',
      ]},
      { type: 'cta', text: 'Valoreva calculates the Altman Z-Score automatically from company financials — along with 22 other CFA-level ratios.', link: '/dashboard', label: 'Check Z-Score →' },
    ],
  },

  /* ── 4 ──────────────────────────────────────────────────── */
  {
    slug: 'ebitda-margin-why-it-matters',
    title: 'EBITDA Margin: Why Investment Bankers Live and Die by This Number',
    description: 'EBITDA margin is the universal language of corporate finance. Understand what it measures, its limitations, and why every leveraged buyout starts with this metric.',
    category: 'Profitability',
    readTime: 6,
    date: '2026-04-02',
    author: 'Valoreva Team',
    content: [
      { type: 'lead', text: 'Walk into any M&A deal room, any LBO model, any credit committee meeting — and EBITDA margin is the first profitability number on the whiteboard. Here\'s why.' },
      { type: 'h2', text: 'What EBITDA Margin Measures' },
      { type: 'p', text: 'EBITDA (Earnings Before Interest, Tax, Depreciation, and Amortisation) strips out capital structure effects (interest), government policy (tax), and accounting conventions (D&A). What remains is a proxy for operating cash generation before reinvestment.' },
      { type: 'formula', label: 'EBITDA Margin', formula: 'EBITDA Margin = EBITDA ÷ Revenue × 100', example: 'EBITDA = Gross Profit − Operating Expenses + D&A' },
      { type: 'h2', text: 'Industry Benchmarks' },
      { type: 'table', headers: ['Sector', 'Typical EBITDA Margin', 'Notes'], rows: [
        ['Software / SaaS', '25 – 45%', 'High margins; scale with little incremental cost'],
        ['Technology Hardware', '15 – 25%', 'Lower than pure software; manufacturing costs'],
        ['Consumer Goods', '10 – 20%', 'Brand-dependent; marketing-heavy'],
        ['Retail', '4 – 10%', 'Low margins, high volume business model'],
        ['Healthcare', '15 – 30%', 'Wide range by sub-sector (pharma vs hospitals)'],
        ['Airlines', '10 – 18%', 'Cyclical; high fixed costs, fuel-sensitive'],
        ['Telecom', '30 – 45%', 'High D&A makes EBITDA look better than net income'],
      ]},
      { type: 'h2', text: 'Why LBO Models Start with EBITDA' },
      { type: 'p', text: 'In a leveraged buyout, the acquirer loads the target company with debt. That debt must be repaid from operating cash flow. EBITDA is used as a proxy for the cash available for debt service — which is why every LBO model begins with: "Target EBITDA: $X. Entry multiple: Xev." The price paid is literally expressed as a multiple of EBITDA.' },
      { type: 'callout', variant: 'warning', text: '"EBITDA is not cash." — Warren Buffett. High EBITDA companies with large capex requirements (utilities, telcos, cable operators) look better on EBITDA than free cash flow. Always cross-check with FCF yield for capital-intensive businesses.' },
      { type: 'h2', text: 'EBITDA vs Operating Margin: When to Use Each' },
      { type: 'p', text: 'Use operating margin for companies with modest capex. Use EBITDA margin for: capital-intensive businesses (where D&A distorts operating income), cross-border comparisons (tax rates differ), and M&A valuation (where you\'re buying the business regardless of capital structure).' },
      { type: 'cta', text: 'Valoreva calculates EBITDA margin alongside 22 other ratios for any listed company — with colour-coded health benchmarks.', link: '/dashboard', label: 'Check EBITDA Margin →' },
    ],
  },

  /* ── 5 ──────────────────────────────────────────────────── */
  {
    slug: 'cash-conversion-cycle-working-capital',
    title: 'Cash Conversion Cycle: Why Fast-Growing Companies Run Out of Cash',
    description: 'The cash conversion cycle (CCC) reveals how long a company\'s cash is locked up in operations. A negative CCC is a superpower. A long CCC can kill a growing business.',
    category: 'Efficiency',
    readTime: 7,
    date: '2026-04-05',
    author: 'Valoreva Team',
    content: [
      { type: 'lead', text: 'A company can be profitable on paper and bankrupt in reality. The cash conversion cycle explains why — and it\'s one of the most underused metrics in financial analysis.' },
      { type: 'h2', text: 'The Formula' },
      { type: 'formula', label: 'Cash Conversion Cycle', formula: 'CCC = DSO + DIO − DPO', example: 'DSO = Days Sales Outstanding · DIO = Days Inventory Outstanding · DPO = Days Payable Outstanding' },
      { type: 'p', text: 'Each component measures how many days cash is tied up (or freed up) in a specific part of the operating cycle. DSO measures how long customers take to pay. DIO measures how long inventory sits before being sold. DPO measures how long the company takes to pay its suppliers (a source of free financing).' },
      { type: 'h2', text: 'The Amazon Effect: Negative CCC as a Competitive Weapon' },
      { type: 'p', text: 'Amazon\'s retail business famously operated with a negative CCC for most of its history. Customers pay at checkout (DSO ≈ 0). Inventory turns fast (DIO is low). But Amazon takes 45–60 days to pay suppliers. The result: suppliers are financing Amazon\'s growth. This is the business model equivalent of getting paid to borrow money.' },
      { type: 'callout', variant: 'info', text: 'Negative CCC companies include Walmart, Amazon, and most large supermarket chains. They are essentially running an interest-free working capital facility funded by their suppliers.' },
      { type: 'h2', text: 'Why Growth Can Kill a Business with a Long CCC' },
      { type: 'p', text: 'A manufacturer with a 90-day CCC must fund 90 days of working capital for every unit sold. If revenue doubles, working capital requirements double. If the company cannot fund that with cash or credit, it runs into a liquidity crisis — even while reporting record profits. This is why "profitable but cash-poor" businesses fail: they grow into insolvency.' },
      { type: 'table', headers: ['Company Type', 'Typical CCC', 'Implication'], rows: [
        ['Large grocery retail', '−20 to −5 days', 'Suppliers fund operations; cash-generative'],
        ['Consumer electronics', '60 – 100 days', 'Significant WC needed to fund inventory'],
        ['Construction / project', '90 – 180 days', 'Long cycle; financing critical'],
        ['SaaS / subscription', '−30 to 0 days', 'Customers prepay; excellent WC dynamics'],
        ['Pharma / biotech', '150 – 250 days', 'R&D and clinical cycles tie up large capital'],
      ]},
      { type: 'h2', text: 'How to Improve CCC' },
      { type: 'list', items: [
        'Reduce DSO: offer early payment discounts (e.g. 2/10 net 30), tighten credit terms, automate invoicing and collections.',
        'Reduce DIO: implement demand-forecasting, reduce SKU count, clear slow-moving inventory with promotions.',
        'Increase DPO: renegotiate supplier payment terms to 45–60 days where possible — but don\'t stretch to the point of damaging relationships.',
      ]},
      { type: 'cta', text: 'Valoreva calculates DSO, DIO, DPO, and the full Cash Conversion Cycle automatically from your financial inputs.', link: '/dashboard', label: 'Analyse Working Capital →' },
    ],
  },

  /* ── 6 ──────────────────────────────────────────────────── */
  {
    slug: 'beneish-m-score-earnings-manipulation',
    title: 'Beneish M-Score: The Earnings Manipulation Detector That Called Enron',
    description: 'The Beneish M-Score is a statistical model for detecting earnings manipulation. It scored Enron as a manipulator a full year before the scandal broke. Here\'s how it works.',
    category: 'Earnings Quality',
    readTime: 8,
    date: '2026-04-08',
    author: 'Valoreva Team',
    content: [
      { type: 'lead', text: 'In 1999, a Cornell University finance professor published a model for detecting earnings manipulation. One of the examples in his paper: Enron. Two years before the company collapsed.' },
      { type: 'h2', text: 'What the M-Score Measures' },
      { type: 'p', text: 'The Beneish M-Score uses eight financial ratios derived from the income statement and balance sheet to detect patterns consistent with earnings manipulation — inflating revenues, hiding expenses, or building unsustainable accruals.' },
      { type: 'formula', label: 'Beneish M-Score', formula: 'M = −4.84 + 0.92×DSRI + 0.528×GMI + 0.404×AQI + 0.892×SGI + 0.115×DEPI − 0.172×SGAI + 4.679×TATA − 0.327×LVGI', example: 'M > −1.78 suggests possible manipulation' },
      { type: 'h2', text: 'The Eight Index Variables Explained' },
      { type: 'table', headers: ['Variable', 'Measures', 'Manipulation Signal'], rows: [
        ['DSRI – Days Sales Receivables Index', 'Receivables relative to sales YoY', 'Rising: may indicate inflated revenue'],
        ['GMI – Gross Margin Index', 'Gross margin deterioration YoY', 'Falling: pressure to manipulate'],
        ['AQI – Asset Quality Index', 'Non-current assets vs total assets', 'Rising: capitalising expenses improperly'],
        ['SGI – Sales Growth Index', 'Revenue growth YoY', 'High growth + poor quality = risk'],
        ['DEPI – Depreciation Index', 'Depreciation rate vs prior year', 'Falling rate: extending useful lives'],
        ['SGAI – SGA Expense Index', 'SG&A costs vs sales', 'Rising: operational inefficiency'],
        ['TATA – Total Accruals to Assets', 'Non-cash earnings relative to assets', 'High: earnings outpacing cash generation'],
        ['LVGI – Leverage Index', 'Debt ratio YoY change', 'Rising: covenant pressure to manipulate'],
      ]},
      { type: 'callout', variant: 'danger', text: 'The most powerful single indicator is TATA (Total Accruals to Total Assets). When earnings significantly outpace operating cash flow, it suggests revenues or expenses are being manipulated through non-cash accounting entries.' },
      { type: 'h2', text: 'How to Interpret the Score' },
      { type: 'p', text: 'An M-Score above −1.78 indicates a company is likely a manipulator. Enron\'s score was −0.88 in 2000 — well into manipulation territory. WorldCom, Xerox, and HealthSouth also scored poorly before their frauds came to light.' },
      { type: 'h2', text: 'Limitations to Know' },
      { type: 'list', items: [
        'The M-Score has a high false positive rate (~30%). Not every company with M > −1.78 is committing fraud.',
        'It requires two years of financial data for the year-over-year comparisons.',
        'It works less well for financial companies and early-stage businesses with high growth.',
        'It is a screening tool, not a verdict. Use it to prioritise where to look harder, not to make accusations.',
      ]},
      { type: 'cta', text: 'Valoreva automatically calculates the Beneish M-Score alongside accruals ratio and CFO/Net Income quality flags.', link: '/dashboard', label: 'Check Earnings Quality →' },
    ],
  },

  /* ── 7 ──────────────────────────────────────────────────── */
  {
    slug: 'roic-vs-wacc-value-creation',
    title: 'ROIC vs WACC: The Only Measure of Whether a Company Is Actually Creating Value',
    description: 'A company creates value only when its return on invested capital exceeds its cost of capital. This is the most important relationship in corporate finance, and most people miss it.',
    category: 'Valuation',
    readTime: 7,
    date: '2026-04-10',
    author: 'Valoreva Team',
    content: [
      { type: 'lead', text: 'A company that earns 12% on capital but pays 15% to access that capital is destroying wealth — even if it reports profit every year. ROIC vs WACC is the lens that exposes this.' },
      { type: 'h2', text: 'What Is ROIC?' },
      { type: 'p', text: 'Return on Invested Capital measures how efficiently a company deploys its total capital base — equity and debt — to generate after-tax operating profit.' },
      { type: 'formula', label: 'ROIC', formula: 'ROIC = NOPAT ÷ Invested Capital', example: 'NOPAT = EBIT × (1 − Tax Rate) · Invested Capital = Equity + Net Debt' },
      { type: 'h2', text: 'What Is WACC?' },
      { type: 'p', text: 'Weighted Average Cost of Capital is the blended cost of all capital a company uses. It is what investors — both equity holders and debt holders — require as a return for the risk they are taking.' },
      { type: 'formula', label: 'WACC', formula: 'WACC = (E/V × Ke) + (D/V × Kd × (1−T))', example: 'E = equity, D = debt, V = E+D, Ke = cost of equity, Kd = cost of debt, T = tax rate' },
      { type: 'h2', text: 'The Spread: ROIC − WACC' },
      { type: 'p', text: 'This single number — the ROIC/WACC spread — tells you whether a company is creating or destroying economic value. A positive spread (ROIC > WACC) means the business is generating returns above its cost of capital, creating genuine wealth. A negative spread means it is destroying value with every dollar deployed.' },
      { type: 'callout', variant: 'info', text: 'McKinsey research found that ROIC/WACC spread explains more than 70% of the variance in corporate valuations across sectors. It is the single best predictor of long-term equity returns.' },
      { type: 'table', headers: ['ROIC vs WACC', 'What It Means', 'What to Do'], rows: [
        ['ROIC >> WACC (>5% spread)', 'Significant value creation; strong moat', 'Invest aggressively in growth'],
        ['ROIC slightly > WACC (1–5%)', 'Modest value creation', 'Grow, but review capital allocation'],
        ['ROIC ≈ WACC', 'Capital-neutral; neither creating nor destroying', 'Focus on margins and efficiency'],
        ['ROIC < WACC', 'Value destruction', 'Divest, restructure, or return capital to shareholders'],
      ]},
      { type: 'h2', text: 'Why ROE Can Be Misleading Without ROIC' },
      { type: 'p', text: 'ROE can be inflated by leverage. A company with 40% leverage can boost ROE without creating any additional value — it is just taking on more risk. ROIC strips out the capital structure effect and measures the underlying economics of the business.' },
      { type: 'cta', text: 'Valoreva calculates ROIC alongside EBITDA margin, WACC sensitivity, and all 22 other CFA-level ratios.', link: '/dashboard', label: 'Analyse ROIC →' },
    ],
  },

  /* ── 8 ──────────────────────────────────────────────────── */
  {
    slug: 'debt-to-ebitda-leverage-ratio',
    title: 'Net Debt / EBITDA: The Most Important Leverage Metric in Leveraged Finance',
    description: 'Net Debt/EBITDA is the single most cited leverage metric in leveraged finance, credit agreements, and LBO models. Learn what the thresholds mean and when to worry.',
    category: 'Credit Analysis',
    readTime: 6,
    date: '2026-04-11',
    author: 'Valoreva Team',
    content: [
      { type: 'lead', text: 'Almost every leveraged loan covenant, high-yield bond indenture, and LBO model has one metric at its centre: Net Debt / EBITDA. Understanding it is non-negotiable for anyone working in credit or corporate finance.' },
      { type: 'h2', text: 'The Formula' },
      { type: 'formula', label: 'Net Debt / EBITDA', formula: 'Net Debt / EBITDA = (Total Debt − Cash) ÷ EBITDA', example: 'e.g. ($500M − $80M) ÷ $120M = 3.5×' },
      { type: 'p', text: 'The ratio answers: how many years would it take to pay off net debt using only EBITDA? Lower is better, but the acceptable range varies significantly by industry.' },
      { type: 'h2', text: 'Industry Thresholds' },
      { type: 'table', headers: ['Level', 'Market Interpretation'], rows: [
        ['0 – 1×', 'Minimal leverage. Very comfortable; significant debt capacity remaining.'],
        ['1 – 2×', 'Conservative. Investment grade territory for most sectors.'],
        ['2 – 3×', 'Moderate. Common for investment-grade industrial companies.'],
        ['3 – 4×', 'Elevated. Acceptable for stable, cash-generative businesses.'],
        ['4 – 5×', 'High. Below investment grade; restricted in many bond indentures.'],
        ['5 – 6×', 'Very high. Typical maximum in leveraged buyouts at close.'],
        ['> 6×', 'Distressed territory. Covenant breaches likely; refinancing risk.'],
      ]},
      { type: 'callout', variant: 'warning', text: 'The 3× threshold is the most common maintenance covenant in investment-grade credit agreements. Breaching it triggers a technical default, even if the company is still paying interest on time.' },
      { type: 'h2', text: 'Why EBITDA Rather Than Net Income?' },
      { type: 'p', text: 'Debt holders care about cash generation, not accounting profit. EBITDA approximates operating cash flow before capex. It ignores D&A (a non-cash charge), interest (which the debt itself causes), and tax (which varies by jurisdiction). This makes it a cleaner measure of cash available for debt service.' },
      { type: 'h2', text: 'The LBO Connection' },
      { type: 'p', text: 'When a private equity firm buys a company in an LBO, they typically lever up to 4–6× EBITDA at close. The investment thesis requires EBITDA growth to delever organically. If the company exits at 3–4× in 5 years with the same EBITDA, the debt paydown alone has created equity value.' },
      { type: 'h2', text: 'What Moves the Ratio' },
      { type: 'list', items: [
        'EBITDA expansion: growing revenue or cutting costs — both reduce the ratio.',
        'Debt reduction: using FCF to pay down debt (preferred over revenue growth for covenant purposes).',
        'M&A: acquisitions funded with debt immediately spike the ratio; synergies must materialise to re-delever.',
        'EBITDA add-backs: management often "adjusts" EBITDA upward, inflating apparent coverage. Always verify what\'s in the add-backs.',
      ]},
      { type: 'cta', text: 'Valoreva calculates Net Debt/EBITDA with a full leverage health check — including Interest Coverage Ratio and Debt/Capital.', link: '/dashboard', label: 'Check Leverage →' },
    ],
  },

  /* ── 9 ──────────────────────────────────────────────────── */
  {
    slug: 'how-to-read-company-financial-health',
    title: 'How to Read a Company\'s Financial Health in Under 10 Minutes',
    description: 'A step-by-step framework for quickly assessing any company\'s financial health using the key ratios. The exact workflow used by analysts and consultants in due diligence.',
    category: 'How-To',
    readTime: 9,
    date: '2026-04-11',
    author: 'Valoreva Team',
    content: [
      { type: 'lead', text: 'You have 10 minutes before a meeting. You need to understand the target company\'s financial health. Here is the exact sequence a trained analyst follows.' },
      { type: 'h2', text: 'Step 1: Solvency Check (60 seconds)' },
      { type: 'p', text: 'Before anything else, verify the company can survive. Check Altman Z-Score (< 1.81 = danger), Net Debt/EBITDA (> 5× = distressed), and Interest Coverage (< 1.5× = alarm). If any of these fail, everything else becomes a restructuring conversation.' },
      { type: 'h2', text: 'Step 2: Liquidity (90 seconds)' },
      { type: 'p', text: 'Check Current Ratio (target: > 1.5×) and Quick Ratio (target: > 1.0×). If the current ratio is fine but the quick ratio is weak, investigate inventory quality. A rapidly declining ratio over 3 years is more important than the absolute level.' },
      { type: 'h2', text: 'Step 3: Profitability (2 minutes)' },
      { type: 'p', text: 'Read the margin stack top to bottom: Gross Margin → Operating Margin → EBITDA Margin → Net Margin. Shrinking margins year-over-year are the most reliable early warning of a business under pressure. Compare to sector benchmarks — a 12% gross margin in technology is disastrous; in grocery retail it\'s above average.' },
      { type: 'h2', text: 'Step 4: Efficiency (90 seconds)' },
      { type: 'p', text: 'Check Asset Turnover and the full Cash Conversion Cycle (DSO + DIO − DPO). Rising DSO means customers are paying slower — either a receivables quality issue or a sign that revenue is being pulled forward. Rising DIO means inventory is building.' },
      { type: 'h2', text: 'Step 5: Capital Efficiency (2 minutes)' },
      { type: 'p', text: 'Calculate ROIC and compare to the company\'s WACC (or use sector-average WACC as a proxy). A ROIC/WACC spread above 3% is a strong signal of competitive advantage. Check ROE using DuPont — is return driven by margin or leverage?' },
      { type: 'h2', text: 'Step 6: Earnings Quality (90 seconds)' },
      { type: 'p', text: 'Compare Operating Cash Flow to Net Income. The ratio should be above 0.8×. If OCF is substantially below net income, the company is reporting earnings it is not collecting in cash — a potential quality problem or early sign of manipulation. Cross-check with Beneish M-Score if time allows.' },
      { type: 'callout', variant: 'info', text: 'The order matters. Solvency → Liquidity → Profitability → Efficiency → Capital Efficiency → Earnings Quality. You are filtering from "can this company survive" to "how well is it being managed."' },
      { type: 'h2', text: 'What to Document' },
      { type: 'list', items: [
        '3-year trend for every ratio (single-year ratios mislead more than they reveal).',
        'Sector benchmark comparison for each metric.',
        'The 2–3 ratios that are most divergent from peers — these become your diligence priorities.',
        'Whether weakness is structural (sector-wide) or company-specific (operational problem).',
      ]},
      { type: 'cta', text: 'Valoreva runs this entire framework in under 10 seconds — 23 ratios, AI commentary, sector benchmarks, and trend charts in one click.', link: '/dashboard', label: 'Run Analysis →' },
    ],
  },

  /* ── 10 ─────────────────────────────────────────────────── */
  {
    slug: 'interest-coverage-ratio-financial-distress',
    title: 'Interest Coverage Ratio: The Earliest Signal of Financial Distress',
    description: 'The interest coverage ratio shows how easily a company can pay its interest. Below 1.5× the alarm bells ring. Below 1× the company is insolvent on an operating basis.',
    category: 'Credit Analysis',
    readTime: 5,
    date: '2026-04-11',
    author: 'Valoreva Team',
    content: [
      { type: 'lead', text: 'Credit analysts half-joke that they care about one number above all others: interest coverage. If a company cannot service its debt from operations, everything else is academic.' },
      { type: 'h2', text: 'The Formula' },
      { type: 'formula', label: 'Interest Coverage Ratio', formula: 'Interest Coverage = EBIT ÷ Interest Expense', example: 'e.g. $18M EBIT ÷ $4M interest = 4.5×' },
      { type: 'p', text: 'The ratio answers: for every £1 of interest owed, how much EBIT does the company generate? A ratio of 1× means EBIT exactly covers interest. Below 1× means the company is burning through capital to make interest payments.' },
      { type: 'h2', text: 'Thresholds and What They Mean' },
      { type: 'table', headers: ['Coverage', 'Interpretation', 'Credit Risk'], rows: [
        ['> 5×', 'Comfortable. Strong debt service capacity.', 'Low'],
        ['3 – 5×', 'Adequate. Standard for investment-grade credits.', 'Low–Moderate'],
        ['1.5 – 3×', 'Thin. Vulnerable to earnings decline.', 'Moderate–High'],
        ['1.0 – 1.5×', 'Danger zone. Minor EBIT decline = default.', 'High'],
        ['< 1.0×', 'Insolvent on operating basis. Burning capital.', 'Critical'],
      ]},
      { type: 'callout', variant: 'warning', text: 'The 1.5× threshold is frequently embedded in credit agreements as a maintenance covenant. Breaching it does not trigger immediate default — but it gives lenders the right to accelerate the loan, which can force a crisis even for otherwise viable businesses.' },
      { type: 'h2', text: 'EBITDA Coverage vs EBIT Coverage' },
      { type: 'p', text: 'Some analysts prefer EBITDA / Interest to get a cleaner cash-based metric (since D&A is non-cash). This gives a higher — more flattering — coverage number. Both have merit: EBIT coverage is more conservative and appropriate for assessing headline credit quality; EBITDA coverage is what most bond indentures actually test.' },
      { type: 'h2', text: 'Trends Matter More Than Levels' },
      { type: 'p', text: 'A coverage of 3.5× falling from 6.0× over two years is more concerning than a stable 2.8×. Trend analysis of interest coverage over 3–5 years is standard practice in credit due diligence. Valoreva shows historical trend charts to support this analysis.' },
      { type: 'cta', text: 'Valoreva calculates Interest Coverage Ratio and 22 other credit and financial health metrics automatically for any company.', link: '/dashboard', label: 'Check Coverage →' },
    ],
  },

  /* ── 11 ─────────────────────────────────────────────────── */
  {
    slug: 'risk-copilot-trader-playbook',
    title: 'Risk Copilot Trader Playbook: How to Plan Better Trades Step by Step',
    description: 'A detailed guide to using every Risk Copilot feature: pre-trade impact, stress tests, correlation scans, hedge ideas, snapshot comparison, AI interpretation, and manual toolkit calculators.',
    category: 'Risk Management',
    readTime: 12,
    date: '2026-05-01',
    author: 'Valoreva Team',
    content: [
      { type: 'lead', text: 'Most traders focus on entry first and risk second. Risk Copilot flips that workflow: define risk, test exposure, and only then promote the trade. This guide shows exactly how to use each feature and what decisions to take from it.' },
      { type: 'h2', text: 'The 7-Minute Workflow (High Level)' },
      { type: 'list', items: [
        'Load your portfolio/watchlist positions so your baseline risk is real.',
        'Define the candidate trade (ticker, side, weight delta) and fetch live price.',
        'Run pre-trade impact, stress, correlation, and hedge modules.',
        'Check the readiness banner and fix-actions before execution.',
        'Use snapshot comparison to test alternative trade setups.',
        'Use manual toolkit calculators for slippage-aware sizing and expectancy.',
        'Export IC note / review audit trail for execution discipline.',
      ]},
      { type: 'h2', text: '1) Candidate Trade Panel: Build the Trade Skeleton' },
      { type: 'p', text: 'This is where you set ticker, buy/sell side, and weight delta. The panel auto-fetches current price so sizing can be done on current market context, not stale assumptions.' },
      { type: 'table', headers: ['Field', 'What It Does', 'How Traders Use It'], rows: [
        ['Ticker search', 'Finds and normalizes symbol', 'Avoid symbol mismatch before execution'],
        ['Buy/Sell side', 'Sets trade direction', 'Ensures stop/target logic is side-aware'],
        ['Weight delta', 'Defines exposure change', 'Quickly test +2%, +5%, +8% alternatives'],
        ['Current price', 'Live quote with move %', 'Adjust aggression on volatile days'],
        ['Portfolio value', 'Base notional for sizing', 'Converts % ideas into actual capital'],
      ]},
      { type: 'callout', variant: 'info', text: 'Use the objective-based sizing button first (Conservative/Moderate/Aggressive), then refine manually. This avoids emotional oversizing.' },
      { type: 'h2', text: '2) Trader Plan: Entry, Stop, Target, and Multi-Exit Design' },
      { type: 'p', text: 'Trader Plan converts your setup into risk budget, quantity, implied weight, and blended-R outcomes. It supports T1/T2 allocation and trailing runner logic to make exits systematic.' },
      { type: 'formula', label: 'Core Position Sizing Logic', formula: 'Qty = Risk Budget ÷ Risk per Unit', example: 'Risk Budget = Portfolio × Max Risk % · Risk per Unit = |Entry - Stop|' },
      { type: 'list', items: [
        'Use strategy presets (Scalp/Intraday/Swing/Positional) to start from tested defaults.',
        'Check direction validity: BUY requires stop < entry < target; SELL requires target < entry < stop.',
        'If T1% + T2% > 100%, reduce allocations before placing orders.',
        'Use "Apply implied weight" only when plan R:R and structure are valid.',
      ]},
      { type: 'h2', text: '3) Pre-Trade Impact: What Changes If You Execute Now?' },
      { type: 'p', text: 'Pre-Trade Impact compares your portfolio before vs after this candidate trade. It quantifies the marginal effect of your decision on risk concentration and variance proxies.' },
      { type: 'table', headers: ['Metric', 'Why It Matters', 'Typical Action'], rows: [
        ['Portfolio VaR (proxy)', 'Short-horizon risk load', 'Reduce size if jump is too large'],
        ['Expected volatility', 'Portfolio stability', 'Avoid stacking high-beta names'],
        ['Max sector weight', 'Concentration risk', 'Trim sector-heavy adds'],
        ['Beta proxy', 'Market sensitivity', 'Hedge if portfolio beta drifts up'],
      ]},
      { type: 'h2', text: '4) Scenario Stress: Survive the Move You Did Not Expect' },
      { type: 'p', text: 'Scenario stress applies predefined market shocks (e.g., Nifty down moves, risk-off) to estimate drawdown and identify the top position contributors to pain.' },
      { type: 'list', items: [
        'Run stress before every major add or leverage increase.',
        'If one name dominates scenario loss contribution, lower that weight first.',
        'Use stress deltas to compare alternatives, not to predict exact P&L.',
      ]},
      { type: 'h2', text: '5) Correlation Hotspots + Hedge Suggestions: Remove Hidden Duplicate Bets' },
      { type: 'p', text: 'Correlation scan identifies pairs that move together, even if they are in different sectors. Hedge suggestions then propose adds/trims to lower concentration and improve stability.' },
      { type: 'callout', variant: 'warning', text: 'Many traders think they hold 8 positions but actually have 2-3 correlated bets. Correlation hotspots reveal this illusion quickly.' },
      { type: 'h2', text: '6) Risk Readiness Banner: PASS, WATCH, or BLOCK' },
      { type: 'p', text: 'Readiness condenses multiple risk checks into a fast decision signal. It is not a black box: reasons are visible and fix-actions are one-click.' },
      { type: 'table', headers: ['Verdict', 'Meaning', 'Execution Rule'], rows: [
        ['PASS', 'Risk shape is acceptable', 'Execution allowed with standard discipline'],
        ['WATCH', 'Risk rising but manageable', 'Reduce size / tighten stop / re-check'],
        ['BLOCK', 'Risk profile is unacceptable', 'Do not execute until fixes are applied'],
      ]},
      { type: 'h2', text: '7) Snapshots and Comparison: Decision by Evidence, Not Memory' },
      { type: 'p', text: 'Save setup variants as snapshots, then compare baseline vs candidate across concentration, beta, scenario impact, and diversification. Promote only when candidate quality is better.' },
      { type: 'list', items: [
        'Create one baseline and 2-3 candidate variants before final selection.',
        'Use the comparison verdict strip to quickly spot risk improvement or deterioration.',
        'Promote candidate only after full risk re-run confirms no hidden regressions.',
      ]},
      { type: 'h2', text: '8) Manual Trader Toolkit: Advanced Hands-On Risk Math' },
      { type: 'p', text: 'The Manual Toolkit is for traders who want full control over assumptions. It includes slippage-aware R:R, expectancy math, breakeven win rate, and custom shock sandboxing.' },
      { type: 'table', headers: ['Tool', 'Output', 'How It Helps Planning'], rows: [
        ['Position sizing calculator', 'Risk budget, qty, suggested weight', 'Keeps size consistent with account risk limits'],
        ['Execution cost model', 'Net R:R after slippage + fees', 'Prevents overestimating setup quality'],
        ['Expectancy planner', 'Expectancy R, breakeven WR, projected P&L', 'Evaluates strategy edge over a trade series'],
        ['Custom scenario sandbox', 'Shock impact + top contributors', 'Tests resilience against user-defined market moves'],
      ]},
      { type: 'h2', text: '9) AI Risk Analyst, Audit Trail, and IC Note: From Analysis to Process' },
      { type: 'p', text: 'AI Risk Analyst turns quant outputs into plain-language action points. Audit Trail records what changed and why. IC Note export packages the final thesis for review or team process.' },
      { type: 'list', items: [
        'Use AI output to explain trade rationale in simple language.',
        'Use audit trail to review behavioral drift (size creep, scenario hopping).',
        'Use IC note export as a pre-trade checklist artifact.',
      ]},
      { type: 'h2', text: 'Practical Rulebook Before You Click Execute' },
      { type: 'list', items: [
        'Never execute on BLOCK.',
        'If WATCH, reduce delta or switch to conservative objective.',
        'Require net R:R >= 2.0 after costs for A-tier setups.',
        'Avoid adding when custom stress impact breaches your max daily loss tolerance.',
        'Log final decision in audit trail notes for post-trade review.',
      ]},
      { type: 'cta', text: 'Open Risk Copilot and run this playbook on your next trade setup.', link: '/risk-copilot', label: 'Launch Risk Copilot →' },
    ],
  },
];

export function getPost(slug) {
  return POSTS.find(p => p.slug === slug) || null;
}

export function getRelatedPosts(slug, count = 3) {
  const post = getPost(slug);
  if (!post) return [];
  return POSTS
    .filter(p => p.slug !== slug)
    .sort(() => Math.random() - 0.5)
    .slice(0, count);
}
