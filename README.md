[![make.fun · best-cooking-game-20261125-0137](https://make.fun/badge/best-cooking-game-20261125-0137.svg)](https://make.fun/bounty/best-cooking-game-20261125-0137)
[![rank](https://make.fun/badge/best-cooking-game-20261125-0137/huangjun430-ctrl/best-cooking-game-20261125-0137/rank.svg)](https://make.fun/bounty/best-cooking-game-20261125-0137)
[![reward](https://make.fun/badge/best-cooking-game-20261125-0137/huangjun430-ctrl/best-cooking-game-20261125-0137/reward.svg)](https://make.fun/bounty/best-cooking-game-20261125-0137)

# Ember & Oak Kitchen

Entry for the make.fun bounty [**Make the best cooking game**](https://make.fun/bounty/best-cooking-game-20261125-0137) (`best-cooking-game-20261125-0137`).

Ember & Oak Kitchen is a single-screen timed 2D cooking game. Customers' orders appear on the order board with a countdown; click ingredients on the counter to add them to the dish in the order shown, then serve the finished plate before the timer runs out. A wrong ingredient costs time; streaks build a combo and score. The game ends with a final score and a restart.

Everything is drawn in code (canvas, no external assets) and sounds are made with WebAudio (no external files). The game runs offline from static files under `game/` — open `game/index.html` in a desktop browser and play.

## How to run

Open `game/index.html` in desktop Chrome. No build step, no network.

## Entry layout

- `main.ts` — Node 22 entrypoint: mirrors `game/` and `screenshots/` into the output directory and writes `dossier.json` via `vendor/makefun-game.ts`.
- `game/` — the playable game (static files, offline).
- `screenshots/` — 3–4 real renders of the game running in a desktop browser.
- `vendor/makefun-game.ts` — the kit's game library, copied unchanged.
