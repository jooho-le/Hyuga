# Hyuga Demo (Recovery Windows & ROI)

Full‑stack demo implementing fatigue prediction, recovery windows, ROI report, routines, overtraining guard, and calm‑first UX.

## Stack
- Frontend: React + TypeScript + Vite (`frontend/`)
- Backend: FastAPI + Uvicorn (`backend/`)

## Features
- Fatigue score + 3‑stage Recovery Window with ROI
- Weekly Recovery Efficiency + simple bar chart
- Personalized micro‑routines with recovery gauge
- Overtraining Guard calendar
- Smart Coach alerts + lightweight chat stub
- Calm‑first visuals + breathing animation

## Run locally
1) Backend
- Python 3.10+
- From `backend/`:
  - `python -m venv .venv && source .venv/bin/activate` (Windows: `.venv\Scripts\activate`)
  - `pip install -r requirements.txt`
  - `uvicorn app:app --reload --port 8000`

2) Frontend
- Node 18+
- From `frontend/`:
  - `npm install`
  - `npm run dev`

Open http://localhost:5173 and ensure backend is running on http://localhost:8000. The Vite proxy forwards `/api/*` to the backend.

## Notes
- All models are heuristic for demo only, not medical/coach advice.
- No external chart libs used; simple SVG bars keep it light.
- Replace heuristics in `backend/app.py` with your preferred model later.

