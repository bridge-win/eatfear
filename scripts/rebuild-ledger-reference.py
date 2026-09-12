"""Independent cash/quantity reference for the retained historical candle fixture."""
import json
from pathlib import Path

path = Path(__file__).resolve().parents[1] / "lib/research/__fixtures__/golden-faber200.json"
data = json.loads(path.read_text())
cash, shares, previous_target = 1.0, 0.0, 0.0
equity, fills = [], []
for i, bar in enumerate(data["bars"]):
    target = data["targets"][i - 1] if i else 0
    if target != previous_target:
        price = bar["open"]
        before = cash + shares * price
        desired_notional = target * before
        side = 1 if desired_notional > shares * price else -1
        new_shares = (desired_notional / price + target * data["fee"] * side * shares) / (1 + target * data["fee"] * side)
        quantity = new_shares - shares
        commission = abs(quantity) * price * data["fee"]
        cash -= quantity * price + commission
        shares = new_shares
        fills.append({"i": i, "delta": target - previous_target, "price": price, "fee": commission})
        previous_target = target
    equity.append(cash + shares * bar["close"])
data["note"] = "2026-09-12 independent Python cash/quantity reference; next-open fills, actual held units, post-fee exposure. Replaces the legacy close-to-close accounting reference."
data["expected"] = {"equity": equity, "fills": fills, "final": equity[-1], "nFills": len(fills)}
path.write_text(json.dumps(data, separators=(",", ":")) + "\n")
print(json.dumps({"final": equity[-1], "fills": len(fills)}))
