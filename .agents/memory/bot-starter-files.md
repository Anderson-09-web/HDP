---
name: Bot starter files
description: Keep the one-click R2 starter-file set aligned with the repository's Python bot.
---

The initial bot files uploaded to R2 should be sourced from the repository's `bot/` directory and bundled into the API at build time, not maintained as a second hand-copied template. The upload must skip existing objects so retries never replace user edits.

**Why:** Render runs from a built API artifact, while the default runtime files need to match the bot source and must be available even when R2 starts empty.

**How to apply:** When changing the default R2 setup flow, keep its build input aligned with `bot/` and preserve the non-overwrite behavior.