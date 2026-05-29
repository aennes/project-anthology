# Cloudinary-Ready Visual Asset System — Design Spec
**Date:** 2026-05-29  
**Status:** Approved  
**Approach:** B — API-driven discovery (Jolpica + Wikimedia), no dependency on existing curated source files

---

## 1. Overview

A deterministic, idempotent pipeline that discovers F1 visual assets (driver portraits, team logos, circuit aerials, radio team covers) from open-licensed sources, scores and ranks candidates, normalizes them into a local staging area, and produces an approved manifest ready for Cloudinary upload — **without performing any upload** at this stage.

The system replaces all existing per-type manifests (`public/data/circuit-images.json`, etc.) with a single canonical manifest.

---

## 2. Architecture

```
scripts/asset-pipeline.ts          ← single entrypoint, subcommand dispatch
scripts/data/
    asset-manifest.json            ← canonical manifest (build-time, committed)
    staging/
        driver/ver.webp
        team/ferrari.webp
        circuit/monaco.webp
        radio/red_bull.webp

public/data/
    asset-manifest.json            ← runtime copy (approved entries only)

utils/assetManifest.ts             ← runtime helper (React app reads manifest)
utils/assetPipeline.ts             ← UNTOUCHED — legacy Cloudinary fallback preserved
```

### Pipeline flow

```
Jolpica API  →  discover  →  rank  →  stage  →  approve (manual)  →  plan-upload  →  verify
               (candidates)  (score)  (local)   (human-in-loop)     (plan only)     (integrity)
```

### Radio asset note
Radio entries are editorial content with no standard API. The existing `RADIO_ID_TO_CONSTRUCTOR` mapping from `scripts/seed-assets.ts` is ingested as hardcoded config inside the pipeline.

---

## 3. Data Model

### Canonical Manifest (`scripts/data/asset-manifest.json`)

```jsonc
{
  "version": 2,
  "generated_at": "2026-05-29T10:00:00Z",
  "assets": [
    {
      // Identity
      "asset_type": "driver",            // "driver" | "team" | "circuit" | "radio"
      "entity_id": "ver",                // driver: lowercase 3-letter code (ver, ham…)
                                         // team: constructorId (ferrari, red_bull…)
                                         // circuit: circuitId (monaco, spa…)
                                         // radio: constructorId or editorial key

      // Display
      "display_name": "Max Verstappen",

      // Source (best candidate after ranking)
      "source_url": "https://upload.wikimedia.org/…",
      "source_page": "https://commons.wikimedia.org/wiki/File:…",
      "license": "CC BY-SA 4.0",
      "attribution": "Author Name / Wikimedia Commons",

      // All discovered candidates
      "candidates": [
        {
          "url": "https://upload.wikimedia.org/…",
          "license": "CC BY-SA 4.0",
          "width": 1800,
          "height": 1200,
          "score": 87.5,
          "score_breakdown": {
            "license_trust": 30,
            "resolution": 25,
            "aspect_ratio": 20,
            "has_author": 5,
            "recency_bonus": 7.5
          },
          "author": "Photographer Name",
          "source_page": "https://commons.wikimedia.org/wiki/File:…"
        }
      ],
      "candidate_score": 87.5,

      // Staging
      "local_staged_path": "scripts/data/staging/driver/ver.webp",
      "checksum_sha256": "abc123…",
      "staged_at": "2026-05-29T10:05:00Z",

      // Cloudinary plan
      "planned_cloudinary_public_id": "f1-anthology/driver/ver",
      "planned_cloudinary_folder": "f1-anthology",

      // Approval
      "approved": false,
      "approved_at": null,
      "approved_by": null,

      // Lifecycle
      "status": "staged",               // discovered | ranked | staged | approved | uploaded
      "discovered_at": "2026-05-29T10:00:00Z",
      "ranked_at": "2026-05-29T10:01:00Z",
      "staged_at": "2026-05-29T10:05:00Z",
      "uploaded_at": null,
      "error": null
    }
  ]
}
```

### ID Standards

| Asset type | ID format | Source | Example |
|-----------|-----------|--------|---------|
| driver | 3-letter code, **lowercase** | Jolpica API `Driver.code` | `ver`, `ham`, `nor` |
| team | constructorId, lowercase | Jolpica API `Constructor.constructorId` | `ferrari`, `red_bull`, `rb` |
| circuit | circuitId, lowercase | Jolpica API `Circuit.circuitId` | `monaco`, `spa`, `albert_park` |
| radio | constructorId or editorial key | hardcoded config | `red_bull`, `multi-21-malaysia-2013` |

### Scoring Function (0–100, tunable constants)

```
license_trust:   CC0 / PD = 30,  CC BY = 25,  CC BY-SA = 22,  other licensed = 0
resolution:      width ≥ 1800 = 25,  ≥ 1200 = 18,  ≥ 800 = 10,  < 800 = 0
aspect_ratio:    per-type target — driver: 1:1, team: 2:1, circuit: 16:9, radio: 16:9
                 score = 20 × (1 − min(|ratio_diff|, 1))
has_author:      metadata has author field = 5,  else 0
recency_bonus:   0–10 (currently 0, date-based scoring future work)
max total:       100
```

Constants are declared at the top of `scripts/asset-pipeline.ts` with clear names so they can be tuned without touching logic.

---

## 4. CLI Commands

All via: `npx tsx scripts/asset-pipeline.ts <command> [options]`

| Command | Action | Output |
|---------|--------|--------|
| `discover` | Fetch entity list from Jolpica, search Wikimedia candidates | manifest entries at `status: discovered` |
| `rank` | Score all candidates, pick best | manifest entries at `status: ranked` |
| `stage` | Download best candidate to `scripts/data/staging/`, compute sha256 | manifest entries at `status: staged` |
| `approve` | Set `approved: true` on listed entities | manifest entries at `status: approved` |
| `plan-upload` | Write Cloudinary upload plan JSON (no upload) | `scripts/data/upload-plan.json` |
| `verify` | Check manifest integrity, ID consistency, file hashes, license fields | exit 0 / 1 |

**Common flags:**
- `--dry-run` — required on destructive commands; logs what would happen, writes nothing
- `--type driver|team|circuit|radio` — filter to one asset type
- `--entity-id <id>` — run for a single entity
- `--force` — re-stage even if file exists and hash matches

### Network safety
- `fetchWithRetry(url, { attempts: 4, baseDelay: 2000, maxDelay: 30000 })` — exponential backoff
- 1–2 s sleep between Wikimedia API calls to respect rate limits
- SSRF protection: only `https://upload.wikimedia.org`, `https://commons.wikimedia.org`, `https://en.wikipedia.org`, `https://api.jolpi.ca` are allowed source domains
- Path traversal: `entity_id` validated against `/^[a-z0-9_-]{1,64}$/` before used in file paths
- Hash deduplication: if `checksum_sha256` matches existing staged file, skip download

### Exit codes
- `0` — success
- `1` — partial failure (some entities failed, others succeeded)
- `2` — fatal / unrecoverable (manifest corrupt, env missing)

---

## 5. Runtime Integration (`utils/assetManifest.ts`)

New file, ~80 lines. Does **not** modify `utils/assetPipeline.ts`.

```ts
// Priority chain:
// 1. approved manifest entry (public/data/asset-manifest.json)
// 2. legacy Cloudinary (assetPipeline.checkAssetExists)
// 3. placeholder SVG

export function getAssetUrl(type: AssetType, entityId: string): string
export function getAssetAttribution(type: AssetType, entityId: string): Attribution | null
export function isManifestReady(): boolean
```

The runtime manifest is the approved-only subset copied to `public/data/asset-manifest.json` by `plan-upload` command.

**`public/data/circuit-images.json`** — deprecated. The app will read `asset-manifest.json` instead. The old file is kept for one release cycle then removed.

---

## 6. Files Changed

| File | Change |
|------|--------|
| `scripts/asset-pipeline.ts` | NEW — ~700 lines, full pipeline |
| `utils/assetManifest.ts` | NEW — ~80 lines, runtime helper |
| `scripts/data/asset-manifest.json` | NEW — generated, committed |
| `public/data/asset-manifest.json` | NEW — generated, runtime copy |
| `package.json` | ADD 6 `pipeline:*` scripts |
| `tests/asset-pipeline/id-mapping.test.ts` | NEW |
| `tests/asset-pipeline/manifest-schema.test.ts` | NEW |
| `tests/asset-pipeline/ranking.test.ts` | NEW |
| `tests/asset-pipeline/fallback.test.ts` | NEW |
| `tests/asset-pipeline/verify.test.ts` | NEW |
| `utils/assetPipeline.ts` | UNTOUCHED |
| `utils/imageCDN.ts` | UNTOUCHED |
| `public/data/circuit-images.json` | DEPRECATED (not deleted yet) |

---

## 7. Test Plan

All tests run with `npm run test:run`. All network calls mocked.

| File | What is tested |
|------|----------------|
| `id-mapping.test.ts` | Jolpica API response → normalized entity_id (VER→ver, red_bull→red_bull, missing code fallback) |
| `manifest-schema.test.ts` | Schema validation — required fields, allowed status values, score range, timestamp format |
| `ranking.test.ts` | Score function determinism (same input → same output), license tier ordering, aspect ratio penalty |
| `fallback.test.ts` | getAssetUrl: manifest empty → legacy → placeholder; approved=false → skip; staged file missing → placeholder |
| `verify.test.ts` | Success: valid manifest; fail: missing checksum, unknown status, empty license, entity_id path traversal attempt |

---

## 8. Operational Playbook

### Race week update routine
```
npm run pipeline:discover -- --type circuit
npm run pipeline:rank
npm run pipeline:stage
npm run pipeline:verify
# review staging/ visually
npm run pipeline:approve -- --all
npm run pipeline:plan  # produces upload-plan.json
```

### Adding a new driver / team / circuit
1. Run `npm run pipeline:discover -- --entity-id <new-id> --type <type>`
2. Run `rank`, `stage`, `verify`
3. Visually approve: `npm run pipeline:approve -- --entity-id <new-id>`
4. Run `plan-upload`

### Rollback plan
- `scripts/data/asset-manifest.json` is committed to git → `git revert` restores any prior state
- `public/data/asset-manifest.json` is regenerated from `scripts/data/` on every build
- `scripts/data/staging/` files are gitignored; re-run `stage` to recreate

---

## 9. Enabling Real Cloudinary Upload (Future)

When ready to activate actual uploads, the only changes needed are:

1. Set `CLOUDINARY_URL` in `.env.local`
2. Add an `upload` command to `asset-pipeline.ts`:
   - reads approved entries from manifest
   - calls `cloudinary.uploader.upload(staged_path, { public_id })`
   - sets `status: uploaded`, `uploaded_at` in manifest
3. Add `pipeline:upload` script to `package.json`
4. Remove the `--dry-run` guard from `plan-upload`

No other files need to change.

---

## 10. Security

| Threat | Mitigation |
|--------|-----------|
| SSRF | Allowlist of source domains enforced before any fetch |
| Path traversal | entity_id validated against `/^[a-z0-9_-]{1,64}$/`; path constructed with `path.join` |
| Large files | File size capped at 15 MB before saving |
| Malicious manifest | Schema validation on load; unknown fields ignored |
| Rate limiting | Exponential backoff + per-domain sleep cadence |
| License risk | Only CC0, CC BY, CC BY-SA, Public Domain accepted; `licenseAllowed()` checked before download |

---

## 11. Remaining Risks

| Risk | Severity | Mitigation |
|------|----------|-----------|
| Wikimedia search quality for some entities (e.g., new drivers) | Medium | Score threshold — entities below 40 points flagged for manual review |
| `public/data/circuit-images.json` still consumed by legacy code | Low | Deprecation comment added; removed in next release |
| Radio assets have no standard API — rely on hardcoded config | Low | Config is small, manually maintained, covered by schema test |
| SHA256 mismatch after Wikimedia CDN re-encode | Low | `--force` re-stages; verify catches stale hashes |
