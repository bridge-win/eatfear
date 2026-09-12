"""Download unmodified official spot klines; save outside git and record provenance."""
import argparse
import concurrent.futures
import hashlib
import json
from pathlib import Path
import time
import urllib.parse
import urllib.request

parser = argparse.ArgumentParser()
parser.add_argument("--output", required=True)
args = parser.parse_args()
out = Path(args.output)
out.mkdir(parents=True, exist_ok=True)
end = int(time.time() * 1000)
specs = {"2d": ("1h", 3600000, 180 * 24 + 250), "2w": ("4h", 14400000, 730 * 6 + 250), "2m": ("1d", 86400000, 365 * 5 + 250)}

def collect(item):
    key, (interval, step, wanted) = item
    start = end - wanted * step
    rows, urls = {}, []
    cursor = start
    while cursor < end:
        url = "https://data-api.binance.vision/api/v3/klines?" + urllib.parse.urlencode({"symbol": "BTCUSDT", "interval": interval, "startTime": cursor, "endTime": end, "limit": 1000})
        req = urllib.request.Request(url, headers={"User-Agent": "eatfear-research/1", "Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=45) as response:
            page = json.load(response)
        if not isinstance(page, list) or not page:
            break
        for row in page:
            if int(row[6]) < end:
                rows[int(row[0])] = row
        urls.append(url)
        next_cursor = max(int(row[0]) for row in page) + step
        if next_cursor <= cursor:
            raise RuntimeError("pagination failed to advance")
        cursor = next_cursor
    raw = json.dumps([rows[t] for t in sorted(rows)], separators=(",", ":")).encode()
    (out / f"{key}.json").write_bytes(raw)
    meta = {"horizon": key, "market": "Binance BTCUSDT spot", "interval": interval, "requestedStart": start, "asOf": end, "count": len(rows), "first": min(rows) if rows else None, "last": max(rows) if rows else None, "sha256": hashlib.sha256(raw).hexdigest(), "urls": urls}
    (out / f"{key}.meta.json").write_text(json.dumps(meta, indent=2))
    return {k: v for k, v in meta.items() if k != "urls"}

with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
    for result in pool.map(collect, specs.items()):
        print(json.dumps(result), flush=True)
