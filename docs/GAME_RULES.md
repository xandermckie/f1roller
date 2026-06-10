# F1 Roller — Game Rules

This document defines how team building works. **The rolled constructor and decade are not your final team** — they only determine which roster menu you browse for that round.

## Core loop

1. **Roll Team & Era** — A random constructor is rolled, then a random decade for that constructor.
2. **Browse the pool** — Every entity from that team+decade combo appears (drivers, chassis, engine, staff, sponsors, livery, motto).
3. **Choose one** — Pick any entity from the pool and assign it to an **empty slot** it qualifies for.
4. **Roll again** — After each pick, the round clears. Roll a new team+era for your next pick.
5. **Repeat** until all 12 slots are filled, then simulate the season.

Your final team is a **mix of picks** from many different team+era rolls. You are never stuck with whatever constructor or decade was rolled — the roll only opens your choices for that round.

## Rerolls

While a round is active (team+era rolled, no pick made yet):

- **1 team reroll** per game — roll a different constructor.
- **1 decade reroll** per game — roll a different decade for the current constructor.

Rerolls do not carry over between rounds.

## Assignment rules

- Assign to **any empty slot** that matches the entity's role (free order — no forced slot sequence).
- Each entity can only be used once on your team.
- One pick per round — after assigning, roll again for the next slot.

## Required slots (12)

| Slot | Role |
|------|------|
| Driver 1 | Race driver |
| Driver 2 | Race driver |
| Reserve Driver | Reserve driver |
| Chassis | Constructor / chassis |
| Engine Supplier | Engine |
| Team Principal | Personnel |
| Technical Director | Personnel |
| Lead Engineer | Personnel |
| Title Sponsor | Sponsor |
| Secondary Sponsor | Sponsor |
| Livery Style | Livery |
| Team Motto | Motto |

## Simulation

When all 12 slots are filled, lock the team and simulate the full 2026 season. Rivals are generated globally (mixed eras); your roll history only constrained **your** assignment pool.

## What the UI shows

| UI element | Meaning |
|------------|---------|
| **Rolled Constructor** / **Rolled Era** cards | Temporary pool source for this round — not your locked team |
| **Roster Pool** | Choices available from the current roll |
| **Team Slots** | Your team being built across all rolls |
