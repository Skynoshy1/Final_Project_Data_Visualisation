# RoadSafe Insights Australia

Interactive data visualisation project about Australian traffic offenders, developed as a multi-dashboard web experience.

## Project Overview

The project explores offender patterns across three major topics:

1. Drug offenders
2. Speeding offenders
3. Alcohol (breath test) offenders

Each dashboard is designed for comparative analysis across:

- Time (year-by-year trends)
- Geography (jurisdictions / locations)
- Outcome indicators (rates, counts, severity, variation)

## Dashboards

### 1. Drug Dashboard

- Entry: `Drug/drug_dashboard.html`
- Focus: positive test rate trends, jurisdiction comparison, and demographic breakdowns.
- Visuals: trend chart, geo map, ranking/variation chart, age-related insights.

### 2. Speeding Dashboard

- Entry: `Speeding/speeding_dashboard.html`
- Focus: fines over time, detection methods, location risk concentration, and jurisdiction severity.
- Visuals: area/line trend, geo map with interaction, annual combo chart, treemap.

### 3. Alcohol Dashboard

- Entry: `breath/index.html`
- Focus: breath test volume vs positive rate, state risk view, ranking, and location comparison (recent years).
- Visuals: scenario-based charts, map, ranking bars, and comparison chart.

## Tech Stack

- HTML5
- CSS3
- JavaScript (ES6+)
- D3.js
- Tailwind CSS (Alcohol dashboard)
- XLSX parsing for source workbook integration (Alcohol dashboard)

## Repository Structure

```text
Final_Project_Data_Visualisation/
├─ index.html                      # Project home page
├─ README.md
├─ shared/                         # Shared constants/utilities
├─ images/                         # Home page preview images
├─ Drug/
│  ├─ drug_dashboard.html
│  ├─ css/
│  ├─ data/
│  └─ js/
├─ Speeding/
│  ├─ speeding_dashboard.html
│  ├─ css/
│  ├─ data/
│  └─ js/
└─ breath/
   ├─ index.html
   ├─ breath_test_FIXED.xlsx
   ├─ script.js
   └─ js/
```

## How To Run

### Option 1: Open directly

Open `index.html` in a browser.

### Option 2: Use a local server (recommended)

From the project root, start a local static server (for example, VS Code Live Server) and open:

- `http://localhost/.../index.html` Or use the following link [RoadSafe Insights Australia](https://skynoshy1.github.io/Final_Project_Data_Visualisation/)

Using a local server helps avoid browser restrictions with local file loading.

## Design Goals

- Keep a consistent visual language across all dashboards.
- Support exploratory analysis with clear filtering and interaction.
- Present high-value insights with readable, decision-friendly charts.

## AI Declaration

This project used AI tools as development support. AI assistance is fully disclosed below.

### AI Tools Used

- OpenAI ChatGPT/Codex (coding assistant)
- Google Gemini (language support and content drafting support)

### Scope of AI Assistance

AI was used for:

- Refactoring and code organization
- UI/CSS consistency improvements across dashboards
- Minor debugging and implementation troubleshooting
- Rewording and drafting non-analytical text sections

### Human Contribution and Control

All core academic decisions remained human-led:

- Data interpretation and insight framing
- Visualisation design decisions and trade-offs
- Final logic validation and behavior checks
- Final review and approval of all submitted content

### Verification and Integrity

To maintain academic integrity:

- AI-generated suggestions were manually reviewed before adoption
- Dashboard behavior and visuals were tested by the team
- Text was edited for accuracy and project context
- No fabricated data sources or references were intentionally used

### Extent of AI Influence

AI acted as a support tool for productivity and editing, not as an autonomous author of the final work.
The final submission reflects substantial human judgment and ownership.

## Notes

- COS30045 - Data Visualization - Final Project
- Team member names and student IDs
  + Nguyen Huu Thien Khang – 105543416
  + Do Duc Duy – 105550034
  + Nguyen Hoang Long – 105556692
- Submission date: 5/4/2026 - Swinburne Canvas
