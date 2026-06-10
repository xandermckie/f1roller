import time

import pytest

from app.services.benchmark import compute_benchmark
from app.services.roster_import import import_roster_master


@pytest.fixture
def csv_roster(db_session):
    import_roster_master(db_session)
    return db_session


def test_benchmark_completes_quickly(csv_roster):
    start = time.perf_counter()
    _, pace, _ = compute_benchmark(csv_roster)
    elapsed = time.perf_counter() - start
    assert pace > 0
    assert elapsed < 2.0
