# Versus Archive — VS Battles Wiki Matchup Demo

A client-side, static matchup and roster prototype. It starts with two manually structured profiles taken from the downloaded VS Battles Wiki snapshots:

- Adam — Assassin's Creed
- Kyogai — Demon Slayer: Kimetsu No Yaiba

## Run locally

Open the folder using a local static web server (for example, VS Code's Live Server extension), then visit its local URL. The app reads the local `data/character-manifest.json` and each profile JSON listed there; opening `index.html` directly as a `file://` URL may be blocked by browser fetch security.

## Publish with GitHub Pages

Push the project to a GitHub repository. In the repository, open **Settings → Pages**, select **Deploy from a branch**, choose the branch and the repository root (`/`), and save. The app is a static site and does not need a build step or API key.

## Included features

- Two fighter selectors, swap control, arena selection, and an optional preparation toggle.
- Local searchable roster with two profile cards, quick fighter selection, full stat/ability details, weakness notes, and source links.
- Manually imported character profiles stored as separate JSON files in their character folders.
- Matchup scorecard with weighted attributes, contextual matchup notes, a model verdict, and an explicit uncertainty disclaimer.
- Match archive saved in the current browser, with JSON export for adding the results to version control.
- Responsive desktop and mobile layouts.

Character profiles are manually imported; the app performs no live wiki lookup, category request, or profile scraping. The two starter JSON profiles are stored in their respective character folders and referenced by the local manifest. Character portraits use the image assets already downloaded alongside the source HTML. Source profile URLs remain in each JSON file for manual reference and attribution. VS Battles Wiki/Fandom content and artwork remain their respective owners' property; this app is an independent fan-made prototype and is not affiliated with them.

## Scoring model

The matchup score is a weighted sum of manually assigned 0–10 comparison ratings, rescaled to 100:

| Attribute | Weight |
| --- | ---: |
| Attack potency | 20% |
| Striking strength | 10% |
| Lifting strength | 5% |
| Combat speed | 20% |
| Durability / survival | 15% |
| Opponent-relevant abilities / hax | 18% |
| Range / battlefield control | 5% |
| Stamina | 3% |
| Intelligence / skill | 4% |

The profile's wiki tier and quoted stat wording are kept separately from the comparison ratings. Context options only apply explicit profile adjustments: Kyogai gets mansion-dependent ability/range adjustments on his home arena, and Adam gets listed preparation adjustments only when preparation is enabled. An elemental bonus applies only when one fighter's tagged attack matches a documented opponent weakness or resistance. Unknown interactions stay neutral.

The displayed edge percentage is a visual mapping of score margin; it is **not a calibrated win probability**. Cross-verse scaling is interpretive, and this model cannot guarantee accurate canon outcomes. Review the profile evidence and update ratings when adding better-sourced feats, resistances, or ability interactions.

## Match history and GitHub

Recorded matches are saved in this browser's `localStorage`; they are not shared across devices or visitors. **Export JSON** downloads a versioned archive snapshot that can be committed as `data/match-archive.json` (or merged into an existing archive). Export does not change repository files by itself.

GitHub Pages serves static files and cannot write commits back to the repository. For automatic writes, add a small authenticated server endpoint using a narrowly scoped GitHub App installation token. The browser should authenticate a user and submit the recorded match to that endpoint; the server validates the payload and appends it through GitHub's Contents API (or triggers a protected Actions workflow). Never embed a personal access token, App private key, or other write credential in `app.js`, `index.html`, or public repository settings. A server-side implementation should handle simultaneous writes and duplicate submissions to avoid overwriting history.

## Adding profiles from a future profile-builder app

Create a `character.json` file inside the character's folder, following the same field names and structure used by the two starter files. Include the source URL and snapshot path, manually reviewed stat descriptions, abilities/weaknesses, `ratings` from 0 to 10, and only evidence-backed `adjustments`/elemental tags. Then append that relative file path to `data/character-manifest.json`. The app loads only the files explicitly listed in that manifest.

A separate profile-builder app can later write individual files and update the manifest. No wiki retrieval or sync service is part of this app.
