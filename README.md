# F1 Roller

Unofficial fan F1 fantasy team builder and 2026 season simulator. Roll a constructor and decade, assign your era roster to every team slot, simulate the full season, and compare against the theoretical best squad and the real 2026 grid.

**Created by [Xander McKie](https://github.com/xandermckie)**

## Stack

- **Frontend:** React 19 + TypeScript + Vite + React Router
- **Backend:** FastAPI + SQLAlchemy + PostgreSQL (SQLite for local dev)
- **Hosting:** Render (see `render.yaml`)

## Quick Start

### Backend

```bash
cd backend
pip install -r requirements.txt
python ../scripts/seed_mvp_roster.py
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 — API proxied to port 8000.

### Cursor / VS Code

1. **First-time setup:** Run Task `setup: first run` (Terminal → Run Task)
2. **Run without debugging:** Task `run: full stack (no debug)`
3. **Debug full stack:** Launch config **F1 Roller Full Stack** (starts API + Vite + Chrome)
4. **Debug API only:** **F1 Roller API**
5. **Debug frontend only:** Start task `frontend: dev`, then **F1 Roller Frontend (Chrome)**
6. **Debug tests:** **pytest (all)** or **pytest (current file)**

Copy `backend/.env.example` to `backend/.env` if you need custom env vars.

If roster rolls fail with a database error, delete `backend/f1roller.db` and restart the API (migrations run automatically on startup).

### Hero Images

```bash
python scripts/import_hero_images.py
```

### Tests

```bash
cd backend && pytest
cd frontend && npm test
```

## Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `sqlite:///./f1roller.db` | PostgreSQL on Render |
| `VITE_API_URL` | `/api` | Frontend API base |
| `CORS_ORIGINS` | `http://localhost:5173` | Allowed origins |
| `SIM_SEASON_YEAR` | `2026` | Season to simulate |

## License

Non-commercial fan project. See [docs/ATTRIBUTION.md](docs/ATTRIBUTION.md) for data and image credits.
