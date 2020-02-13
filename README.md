<h1 align=center>Chip-Viz</h1>

Visualize Quadkey based Chip inferences on a slippy map

### Quick Start Example

```
./index.js input.csv \
    --tiles output.mbtiles \
    --inferences "baseball,soccer,pool"
```

### Inference Format

The inference data should be input as a CSV with the following format.

Notes:
- The header names are not important, solely the order.
- The array length of both the `threshold_pred` and `raw_pred` must equal the number of `--inferences` names that are specified

```
id,tile_id,threshold_pred,raw_pred
```

| Header | Example | Note |
| ------ | ------- | ---- |
| `id`   | `1`     | A unique number/string for each inference in the file |
| `tile-id` | `159598-136035-18` | x-y-z tile for the given inference |
| `threshold_pred` | `[0, 1]` | An Array of `1` or `0` values representing thresholded predictions |
| `raw_pred` | `[ 0.095, 0.34 ]` | An Array of `0->1` values representing raw predictions |
