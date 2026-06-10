from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.routes import api_router
from app.config import settings
from app.db import SessionLocal, engine, init_db
from app.db_migrate import upgrade_schema
from app.services.benchmark import compute_benchmark, save_benchmark
from app.services.openf1 import sync_real_grid
from app.services.roster_import import ensure_roster_imported


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    upgrade_schema(engine)
    db = SessionLocal()
    try:
        imported = ensure_roster_imported(db)
        if imported:
            sync_real_grid(db)
            payload, pace, _ = compute_benchmark(db)
            save_benchmark(db, payload, pace)
    finally:
        db.close()
    yield


app = FastAPI(title="F1 Roller API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)

frontend_dist = Path(__file__).resolve().parents[2] / "frontend" / "dist"
if frontend_dist.exists():
    app.mount("/", StaticFiles(directory=str(frontend_dist), html=True), name="frontend")
