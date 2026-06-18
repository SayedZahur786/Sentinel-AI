# Sentinel AI

Sentinel AI is a full-stack, explainable **content moderation pipeline**. A single structured AI
call classifies content across a harm taxonomy; deterministic backend policy code applies the final
enforcement action. The platform includes context-aware analysis, confidence-based routing, a human
review queue, per-platform policy configuration, confidence calibration, analytics, an immutable
audit log, and labelled-dataset evaluation.

> **Design principle:** the model *classifies*, deterministic code *decides*. Every action is
> traceable to the scores, the policy snapshot, and the offending content segment — so decisions are
> auditable by users and legal teams, and behaviour is tunable per platform.

## Harm taxonomy

Seven categories, scored 0.0–1.0 each. The model never chooses an enforcement action.

| Category | Definition |
| --- | --- |
| `hate_speech` | Attacks based on protected identity |
| `harassment` | Targeted bullying, threats, intimidation |
| `spam` | Scams, bulk promotion, deceptive links |
| `misinformation` | False or misleading factual claims |
| `graphic_violence` | Gore or promotion of real-world violence |
| `adult_content` | Sexually explicit material |
| `self_harm` | Suicide or self-injury content |

## Architecture

```text
React/Vite UI
    |
    v
FastAPI routers -> services -> repositories -> Supabase PostgreSQL
                      |
                      +-> AI JSON classification (one call/request, Gemini)
                      +-> confidence calibration (per-category feedback accuracy)
                      +-> deterministic policy engine (thresholds, toggles, multipliers)
```

```text
.
├── backend
│   ├── app
│   │   ├── core           # settings and database session
│   │   ├── models         # SQLAlchemy entities
│   │   ├── repositories   # database access
│   │   ├── routers        # typed FastAPI endpoints
│   │   ├── schemas        # Pydantic request/response contracts
│   │   └── services       # gemini, policy, moderation, evaluation
│   ├── scripts            # CSV dataset importer
│   ├── tests
│   ├── Dockerfile
│   └── render.yaml
├── frontend
│   └── src
│       ├── components
│       ├── hooks
│       ├── lib            # shared category taxonomy + helpers
│       ├── pages          # Dashboard, Analyzer, Context Lab, Reviews, Policies, Evaluation, Audit
│       └── services
└── supabase
    └── migrations
```

## Core capabilities

- **Multi-category classification** — every request returns calibrated confidence for all seven
  categories.
- **Context-aware analysis** — the same statement is judged differently depending on the platform,
  the **conversation thread**, the situation, and the user's history. Intent-independent harms (spam,
  misinformation, self-harm) are scored on their face; context-dependent ones (harassment, graphic
  violence, adult content, hate speech) are discounted for fiction, quoting, reporting, and gaming.
- **Confidence-based routing** — `AUTO_APPROVE` / `HUMAN_REVIEW` / `AUTO_REJECT` from two
  per-platform thresholds.
- **Explainable decisions** — the exact offending segment, the harm category, and plain-language
  reasoning are attached to every decision and persisted forever.
- **Human review queue** — moderators see the full context, AI reasoning, and scores, then approve
  or reject with an optional category override. Outcomes feed back into per-category calibration.
- **Per-platform policy configuration** — thresholds, **category on/off toggles**, sensitivity
  multipliers, and **custom rules** injected into the prompt. Four seeded platforms show how
  definitions differ:

  | Platform | Stance | Notable rule |
  | --- | --- | --- |
  | Kids | Strictest | Everything moderated; nothing mature tolerated |
  | Social | Balanced | Allows debate; acts on real harm |
  | Gaming | Moderate | Fictional combat / trash talk discounted |
  | Adult (18+) | Permissive | `adult_content` toggled **off**; real harm still blocked |

- **Context Lab** — send identical content through two contexts side by side and watch the decision
  diverge. Built for demonstrating context-awareness.
- **Progress/operations dashboard, audit log, and dataset evaluation** with a confusion matrix over a
  100-sample labelled set.

## Prerequisites

- Python 3.11+
- Node.js 20+
- A Supabase project
- A Gemini API key for real classifications (optional)

The backend defaults to `AI_MOCK_MODE=true`, which uses a **deterministic, context-aware** mock
classifier. The mock is good enough to demonstrate and grade the entire product — including the
"same statement, two contexts" behaviour — without sending any content to a third party. Set
`AI_MOCK_MODE=false` with a `GEMINI_API_KEY` to use the real model.

## 1. Create the database

1. Create a Supabase project.
2. Open the Supabase SQL editor and run
   [`supabase/migrations/202606180001_moderation_schema.sql`](supabase/migrations/202606180001_moderation_schema.sql).
3. In **Project Settings > Database**, copy a connection string and convert the prefix to
   `postgresql+psycopg://` for SQLAlchemy.

> **Connection note (important):** Supabase's *direct* host `db.<ref>.supabase.co` is **IPv6-only**.
> On an IPv4-only network it will not resolve. Use the **Session Pooler** connection string instead,
> which is IPv4 and uses host `aws-<n>-<region>.pooler.supabase.com` with username
> `postgres.<project_ref>`:
>
> ```dotenv
> DATABASE_URL=postgresql+psycopg://postgres.<ref>:<password>@aws-1-<region>.pooler.supabase.com:5432/postgres?sslmode=require
> ```

The migration is idempotent and creates all tables, indexes, constraints, four platform policies,
calibration rows, and exactly 100 labelled evaluation samples across the seven categories. RLS is
enabled without public browser policies, because all access is intentionally mediated by FastAPI.

## 2. Run the backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt
cp .env.example .env               # then edit DATABASE_URL
uvicorn app.main:app --reload
```

Open `http://localhost:8000/docs` for generated API docs. Health is at `http://localhost:8000/health`.

## 3. Run the frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

The UI is available at `http://localhost:5173`.

## Dataset import

CSV files must contain `text`, `context`, and `ground_truth_category` columns (categories from the
taxonomy above).

```bash
cd backend
python scripts/import_dataset.py scripts/sample_dataset.csv
```

## Moderation lifecycle

1. The API loads the selected platform policy, conversation thread, context, and user history.
2. It issues one JSON-only model request scoring all seven categories.
3. Pydantic validates score bounds, required keys, the explanation, and the top category.
4. Confidence is calibrated as `raw_confidence * category_accuracy`.
5. Routing uses the highest-scoring **enabled** category; disabled categories are never actioned.
6. A category multiplier is applied, then the policy engine returns the decision.
7. Inputs, thread, prompt, raw response, scores, calibration, policy snapshot, and decision are
   persisted to the audit log.
8. Human approvals of flagged content and category overrides update per-category accuracy.

## API summary

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `POST` | `/api/moderations` | Classify (with thread/context/history), calibrate, route, and audit |
| `GET` | `/api/moderations` | Audit history |
| `GET` | `/api/reviews` | Filterable review queue |
| `POST` | `/api/reviews/{id}/decision` | Human decision and feedback |
| `GET` | `/api/policies` | Platform policies |
| `PUT` | `/api/policies/{slug}` | Update thresholds, toggles, multipliers, custom rules |
| `POST` | `/api/policies/preview` | Preview routing for a confidence value |
| `GET` | `/api/analytics/dashboard` | Dashboard aggregates |
| `GET` | `/api/evaluation/samples` | Labelled dataset |
| `POST` | `/api/evaluation/run` | Accuracy, macro precision/recall, confusion matrix |

## Verification

```bash
cd backend
python -m compileall app
pytest

cd ../frontend
npm run lint
npm run build
```

Against the seeded dataset the mock classifier scores 100% accuracy/precision/recall, and the
"same statement, two contexts" demo routes the identical sentence to `AUTO_APPROVE` on the gaming
platform and `AUTO_REJECT` in a hostile DM on the social platform.

## Deploy

- **Backend → Render:** use `backend/render.yaml` (or a Python web service rooted at `backend`). Set
  `DATABASE_URL`, `GEMINI_API_KEY`, `FRONTEND_ORIGINS`, and `AI_MOCK_MODE=false`.
- **Frontend → Vercel:** root directory `frontend`, framework preset **Vite**, set
  `VITE_API_URL=https://your-backend/api`. `frontend/vercel.json` provides SPA rewrites.

## Production notes

- Protect moderator, policy, and audit endpoints with your organisation's authentication before
  exposing the app publicly.
- Treat moderation content as sensitive data; define retention and deletion policies.
- Keep the Gemini key only on the backend.
- For self-harm, route to crisis resources in production rather than a generic rejection.
- Evaluation can make up to 100 sequential model calls in non-mock mode and may incur cost.
