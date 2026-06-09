from fastapi import APIRouter

from app.api.routes import benchmark, calendar, entities, health, real_grid, roll, roster, simulate, sources

api_router = APIRouter(prefix="/api")
api_router.include_router(health.router, tags=["health"])
api_router.include_router(calendar.router, tags=["calendar"])
api_router.include_router(roll.router, tags=["roll"])
api_router.include_router(roster.router, tags=["roster"])
api_router.include_router(simulate.router, tags=["simulate"])
api_router.include_router(benchmark.router, tags=["benchmark"])
api_router.include_router(entities.router, tags=["entities"])
api_router.include_router(sources.router, tags=["sources"])
api_router.include_router(real_grid.router, tags=["real-grid"])
