from app.services.synergy import EntityRef, compute_synergy, lookup_pair_bonus, ENGINE_CONSTRUCTOR_PAIRS


def test_engine_constructor_pairing_bonus():
    bonus = lookup_pair_bonus(ENGINE_CONSTRUCTOR_PAIRS, "honda", "mclaren")
    assert bonus == 0.06


def test_era_gap_penalty():
    d1 = EntityRef("ayrton-senna", "Ayrton Senna", 1988, ["mclaren"])
    d2 = EntityRef("max-verstappen", "Max Verstappen", 2023, ["red-bull"])
    reserve = EntityRef("lando-norris", "Lando Norris", 2024, ["mclaren"])
    total, details = compute_synergy(
        d1, d2, reserve, "mclaren", "honda", "ron-dennis", "adrian-newey"
    )
    labels = [d["label"] for d in details]
    assert "Era gap penalty" in labels
    assert total < 0.1


def test_honda_mclaren_synergy_positive():
    d1 = EntityRef("ayrton-senna", "Ayrton Senna", 1988, ["mclaren"])
    d2 = EntityRef("alain-prost", "Alain Prost", 1988, ["mclaren"])
    reserve = EntityRef("ayrton-senna", "Ayrton Senna", 1988, ["mclaren"])
    total, _ = compute_synergy(
        d1, d2, reserve, "mclaren", "honda", "ron-dennis", "adrian-newey"
    )
    assert total > 0.05
