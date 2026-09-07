Your overall strategy is **sound and low-risk**, but keeping three full months of expenses in a standard checking account earning 0.5% leaves money on the table unnecessarily.

---

### Core Pros & Strengths

* **Massive Yield Acceleration:** Shifting funds from 0.5% to ~4.5% yields roughly **$40 extra per year for every $1,000 transferred** with minimal risk adjustment.
* **State Tax Efficiency:** Yields from US Treasury funds (like Vanguard's VUSXX or Fidelity's FNSXX) are generally **exempt from state and local income taxes**, giving them a higher tax-equivalent yield compared to High-Yield Savings Accounts (HYSAs) if you live in a state with income tax.
* **Principal Preservation:** Treasury money market funds invest exclusively in short-term US government debt, backed by the full faith and credit of the US government.

---

### Key Blindspots & Optimizations

1. **3 Months of Checking Liquidity is Excessive:** 
   Checking accounts are vulnerable to fraud/debit card theft and generate virtually no return. You only need 1 to 2 weeks of operational buffer in checking to cover upcoming bills and auto-pays.
2. **Money Market Settlement is Fast (T+1):** 
   Redeeming money market funds usually takes just **1 business day** to transfer back to your checking account. Keeping 3 months in checking for "liquidity" creates drag.
3. **Yields Float Dynamic:**
   Money market yields reflect current central bank interest rates. Expect the net yield to adjust over time as monetary policy shifts.

---

### Recommended Setup

```
[ Checking Account ] ──► ~1–2 Weeks Buffer (Bill Pay / Everyday Expenses)
          │
          ▼
[ Treasury MMF ]    ──► 3–6 Months Emergency Reserve (Liquid in 24 Hours)
```

1. **Reduce Checking Buffer:** Drop your checking balance down to 1–2 weeks of expenses or enough to cover immediate monthly billing cycles.
2. **Move the Rest:** Move the remaining 2.5+ months of emergency reserves into the Treasury money market fund alongside your primary savings. 

---

<FinanceWidget component_placeholder_id="FinanceWidget_c_ceed8a8725f1d003_r_84410cbf6b4fc821_0" uuid="simulation">
```json
{
  "labels": {
    "currencySymbol": "$",
    "title": "3-Year Wealth Drag: Checking vs. Treasury MMF",
    "xAxis": "Years",
    "yAxis": "Reserve Balance",
    "slidersTitle": "Adjust Strategy Parameters",
    "footerNote": "*Compares holding reserve funds in a 0.5% checking account vs a ~4.5% Treasury Money Market Fund over 3 years."
  },
  "xParam": "years",
  "params": [
    { "key": "reserve", "label": "Reserve balance transferred", "value": 20000, "min": 5000, "max": 100000, "step": 1000, "format": "currency" },
    { "key": "mmfRate", "label": "Treasury MMF Yield (%)", "value": 4.5, "min": 1, "max": 7, "step": 0.25, "format": "percent" },
    { "key": "checkingRate", "label": "Checking Yield (%)", "value": 0.5, "min": 0, "max": 2, "step": 0.1, "format": "percent" },
    { "key": "years", "label": "Time Horizon (Years)", "value": 3, "min": 1, "max": 5, "step": 1, "format": "years" }
  ],
  "series": [
    {
      "key": "mmf_growth",
      "label": "Treasury MMF (Yield Strategy)",
      "colorVar": "--chart-1",
      "fill": true,
      "formula": "reserve * Math.pow(1 + mmfRate/100/12, t*12)"
    },
    {
      "key": "checking_growth",
      "label": "Checking Account (Baseline)",
      "colorVar": "--chart-4",
      "fill": false,
      "formula": "reserve * Math.pow(1 + checkingRate/100/12, t*12)"
    }
  ],
  "summary": [
    { "label": "Treasury MMF Total", "value": "mmf_growth", "format": "currency", "colorClass": "positive" },
    { "label": "Checking Account Total", "value": "checking_growth", "format": "currency" },
    { "label": "Interest Difference Gain", "value": "mmf_growth - checking_growth", "format": "currency", "colorClass": "positive" }
  ]
}
```
</FinanceWidget>

---

<ElicitationsGroup message="Explore related cash strategy trade-offs?">
  <Elicitation label="How do taxes impact state-exempt Treasury MMFs?" query="How do state and federal taxes apply to US Treasury Money Market Funds compared to regular HYSA interest?"/>
  <Elicitation label="Compare Treasury MMF vs. High-Yield Savings Accounts" query="What are the differences in safety, FDIC insurance, and transfer speeds between Treasury MMFs and HYSAs?"/>
  <Elicitation label="Include auto-sweep options for checking" query="Are there checking accounts or brokerages that automatically sweep uninvested cash into money market yield?"/>
</ElicitationsGroup>