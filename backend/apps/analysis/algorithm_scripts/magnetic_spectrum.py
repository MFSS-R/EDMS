import csv
import json
import os

try:
    import pandas as pd
except Exception:
    pd = None


def _to_float(value):
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    try:
        return float(text)
    except Exception:
        return None


def _read_table(file_path):
    ext = os.path.splitext(file_path)[1].lower()
    if ext in {".xlsx", ".xls"} and pd is not None:
        df = pd.read_excel(file_path)
        return df.astype(str).values.tolist(), list(df.columns)

    if ext == ".csv" and pd is not None:
        df = pd.read_csv(file_path)
        return df.astype(str).values.tolist(), list(df.columns)

    rows = []
    header = None
    with open(file_path, "r", encoding="utf-8-sig", errors="ignore", newline="") as f:
        sample = f.read(4096)
        f.seek(0)
        delimiter = "\t" if sample.count("\t") >= sample.count(",") else ","
        reader = csv.reader(f, delimiter=delimiter)
        for row in reader:
            if not row:
                continue
            if header is None:
                header = [c.strip() for c in row]
                if len(header) < 2:
                    header = None
                continue
            rows.append([cell.strip() for cell in row])
    return rows, header


def _find_columns(header):
    if not header:
        return 0, 1, 2
    normalized = [str(h).strip().lower() for h in header]
    x_idx = 0
    y_idx = 1 if len(header) > 1 else 0
    z_idx = 2 if len(header) > 2 else y_idx
    for i, name in enumerate(normalized):
        if any(key in name for key in ["field", "h", "磁场", "b"]):
            x_idx = i
            break
    for i, name in enumerate(normalized):
        if any(key in name for key in ["signal", "intensity", "magnetization", "response", "吸收", "强度", "信号", "磁化"]):
            y_idx = i
            break
    for i, name in enumerate(normalized):
        if any(key in name for key in ["phase", "derivative", "absorption", "d", "差分", "导数", "二次", "锁相"]):
            z_idx = i
            break
    if len({x_idx, y_idx, z_idx}) < 3:
        candidates = [i for i in range(len(header))]
        for idx in [x_idx, y_idx, z_idx]:
            if idx in candidates:
                candidates.remove(idx)
        if x_idx == y_idx:
            y_idx = candidates[0] if candidates else y_idx
        if z_idx in {x_idx, y_idx}:
            z_idx = candidates[1] if len(candidates) > 1 else z_idx
    return x_idx, y_idx, z_idx


def main(file_path):
    rows, header = _read_table(file_path)
    x_idx, y_idx, z_idx = _find_columns(header)
    series_data = []
    for row in rows:
        if len(row) <= max(x_idx, y_idx, z_idx):
            continue
        x = _to_float(row[x_idx])
        y = _to_float(row[y_idx])
        z = _to_float(row[z_idx])
        if x is None or y is None or z is None:
            continue
        series_data.append([x, y, z])

    result = {
        "dimensions": 3,
        "x_column": header[x_idx] if header and len(header) > x_idx else "磁场",
        "x_unit": "Oe",
        "y_column": header[y_idx] if header and len(header) > y_idx else "信号",
        "y_unit": "a.u.",
        "series": [
            {
                "name": "磁谱",
                "data": series_data,
            }
        ],
    }
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    import sys

    main(sys.argv[1])
