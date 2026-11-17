# Nightwatch

An offline token launch radar built from the sealed token-radar-01 snapshot. It ranks every watchlist entry and a broad set of below-floor protocols whose snapshot records no market cap. Tokenized records appear only as reference comparables.

Run with Node 22 or newer:

```sh
MAKEFUN_OUTPUT_DIR=/tmp/radar_out node main.ts --input /input/snapshot.json
```

`lib/model.ts` derives category peer multiples and adjusts them for TVL, seven-day change, tracked age, chain breadth, and category token adoption. `main.ts` writes the board and dashboard data, copies the offline page and screenshots, and builds the dossier. Replace local screenshot placeholders with real captures before submission.
