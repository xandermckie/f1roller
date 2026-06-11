from fastapi import APIRouter

from app.api.routes import benchmark, calendar, entities, health, ratings, real_grid, roll, roster, simulate, sources, transfer

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
api_router.include_router(transfer.router, tags=["transfer"])
api_router.include_router(ratings.router, tags=["ratings"])
