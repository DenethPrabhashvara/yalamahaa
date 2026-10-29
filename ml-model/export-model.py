"""Export tank_model.pkl (RandomForestRegressor or HistGradientBoostingRegressor bundle)
into files server.js can load.

A random forest pkl is too big for GitHub (over 100 MB), so the trees are written as compact
binary arrays, gzipped and split into parts:

  model/meta.json             model type, features, horizon_days, tanks, list of parts
  model/trees-<n>.bin.gz      a group of trees

Each tree in a part: uint32 node count, then per-node arrays
  left int32 | right int32 | feature int16 | missing_left uint8 | threshold float64 | value float64
(left == -1 marks a leaf). A random forest predicts the mean of its trees; gradient boosting
predicts meta.baseline plus the sum of its trees. Either way the parts give exactly the same
prediction as the .pkl.

Needs scikit-learn 1.6.1 (the version the model was saved with):
  py -3.13 -m venv .venv
  .venv\\Scripts\\python -m pip install scikit-learn==1.6.1 joblib
  .venv\\Scripts\\python export-model.py [path\\to\\tank_model.pkl]
"""
import gzip
import json
import struct
import sys
from pathlib import Path

import joblib
import numpy as np

HERE = Path(__file__).parent
OUT = HERE / "model"
TREES_PER_PART = 50

bundle = joblib.load(sys.argv[1] if len(sys.argv) > 1 else HERE / "tank_model.pkl")
model = bundle["model"]
features = list(bundle["features"])
assert list(model.feature_names_in_) == features, "feature order in the bundle differs from the model"
is_boosting = type(model).__name__ == "HistGradientBoostingRegressor"
if is_boosting:
    # Categorical splits and the categorical preprocessor are not supported by server.js
    assert model._preprocessor is None and not np.any(model.is_categorical_ or False), "categorical features are not supported"
    assert model.loss == "squared_error", "server.js only applies the identity link of squared_error"

OUT.mkdir(exist_ok=True)
for old in OUT.glob("trees-*.bin.gz"):
    old.unlink()


def tree_bytes(estimator):
    t = estimator.tree_
    n = t.node_count
    missing_left = getattr(t, "missing_go_to_left", np.zeros(n, dtype=np.uint8))
    return b"".join([
        struct.pack("<I", n),
        t.children_left.astype("<i4").tobytes(),
        t.children_right.astype("<i4").tobytes(),
        t.feature.astype("<i2").tobytes(),
        np.asarray(missing_left).astype("u1").tobytes(),
        t.threshold.astype("<f8").tobytes(),
        t.value[:, 0, 0].astype("<f8").tobytes(),
    ])


def predictor_bytes(predictor):
    # HistGradientBoosting TreePredictor nodes: leaves have is_leaf set and left == right == 0
    nodes = predictor.nodes
    leaf = nodes["is_leaf"].astype(bool)
    assert not nodes["is_categorical"].any(), "categorical splits are not supported"
    return b"".join([
        struct.pack("<I", len(nodes)),
        np.where(leaf, -1, nodes["left"]).astype("<i4").tobytes(),
        np.where(leaf, -1, nodes["right"]).astype("<i4").tobytes(),
        nodes["feature_idx"].astype("<i2").tobytes(),
        nodes["missing_go_to_left"].astype("u1").tobytes(),
        nodes["num_threshold"].astype("<f8").tobytes(),
        nodes["value"].astype("<f8").tobytes(),
    ])


parts = []
if is_boosting:
    trees = [iteration[0] for iteration in model._predictors]
    tree_bytes = predictor_bytes
else:
    trees = model.estimators_
for start in range(0, len(trees), TREES_PER_PART):
    group = trees[start:start + TREES_PER_PART]
    name = f"trees-{len(parts) + 1}.bin.gz"
    with gzip.open(OUT / name, "wb", compresslevel=9) as f:
        f.write(struct.pack("<I", len(group)))
        for est in group:
            f.write(tree_bytes(est))
    parts.append(name)
    print(f"{name}: {len(group)} trees, {(OUT / name).stat().st_size / 1e6:.1f} MB")

meta = {
    "model": type(model).__name__,
    "features": features,
    "horizon_days": int(bundle["horizon_days"]),
    "tanks": bundle["tanks"],
    "n_trees": len(trees),
    "parts": parts,
}
if is_boosting:
    meta["baseline"] = float(np.ravel(model._baseline_prediction)[0])
(OUT / "meta.json").write_text(json.dumps(meta, indent=1), encoding="utf-8")
print(f"Exported {len(trees)} trees and {len(meta['tanks'])} tanks to {OUT.name}/")
