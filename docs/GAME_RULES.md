# F1 Roller — Game Rules

Hybrid rules aligned with [16Wins](https://16wins.rdesse.fr/) UX while keeping 12-slot team depth.

## Game modes

| Mode | Draw pool |
|------|-----------|
| **Historical** | Any constructor and decade from the roster master |
| **2026 season** | Current-grid constructors only (2020s roster entries) |

## Core loop

1. **Draw a team** — A random constructor (+ era) is drawn. You receive a **curated draw packet** of ~6–8 cards biased toward slots you still need — not the full roster pool.
2. **Choose one** — Pick any card from the packet and assign it to an **empty slot** it qualifies for.
3. **Draw again** — After each pick, the round clears and the next draw begins automatically.
4. **Repeat** until all 12 slots are filled, then simulate the season.

Your final team is a **mix of picks** from many different team+era draws.

## Rerolls

While a draw is active (packet shown, no pick made yet):

- **1 reroll per draw** — replaces the current packet with a new team+era draw.

## Assignment rules

- Assign to **any empty slot** that matches the entity's role (free order).
- Each entity can only be used once on your team.
- One pick per draw — after assigning, the next draw begins.

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

- **16 Grands Prix** — first 16 races on the calendar.
- **Primary goal:** wins out of 16 (`X / 16`).
- **Secondary:** WDC and WCC standings, plus benchmark comparison.
- Races are simulated **one round at a time** after the team is locked.
- **2026 mode:** your fantasy team races against the real 2026 driver grid.
- **Historical mode:** rivals are generated from top-rated entities across all eras.

## What the UI shows

| UI element | Meaning |
|------------|---------|
| **Available choices** | Curated draw packet for this round |
| **Draw a team / Reroll** | Start or replace the current draw |
| **Team Slots** | Your team being built across all draws |
| **X / 12** | Build progress |
| **X / 16** | Win counter during simulation |
