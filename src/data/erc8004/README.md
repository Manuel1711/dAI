# ERC8004 Data Bundle

This folder is the canonical data intake point for ERC8004 content used by the web app.

- Source: ERC8004-Specialist exported bundle/artifacts.
- Policy: **no UI hardcoded business/protocol facts** outside this data path.
- Integration: loaders/adapters in `src/lib/erc8004` read and normalize these artifacts.

TODO:
- define manifest filename conventions
- add schema validation step in CI
- wire real bundle ingestion workflow
