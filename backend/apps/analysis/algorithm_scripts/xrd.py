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


def _extract_scan_points_block(file_path):
    with open(file_path, "r", encoding="utf-8-sig", errors="ignore", newline="") as f:
        lines = f.readlines()

    in_block = False
    header_found = False
    rows = []
    header = None

    for line in lines:
        stripped = line.strip()
        if not stripped:
            if in_block and header_found and rows:
                break
            continue

        if stripped == "[Scan points]":
            in_block = True
            continue

        if not in_block:
            continue

        parts = [item.strip() for item in stripped.split(",")]
        if not header_found:
            if len(parts) >= 2:
                header = parts[:2]
                header_found = True
            continue

        if len(parts) < 2:
            break
        rows.append(parts[:2])

    if header_found and rows:
        return rows, header
    return None, None


def _read_table(file_path):
    scan_rows, scan_header = _extract_scan_points_block(file_path)
    if scan_rows:
        return scan_rows, scan_header

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


def _find_xy(header):
    if not header:
        return 0, 1
    normalized = [str(h).strip().lower() for h in header]
    x_idx = 0
    y_idx = 1 if len(header) > 1 else 0
    for i, name in enumerate(normalized):
        if any(key in name for key in ["2theta", "2θ", "theta", "角度", "衍射角", "scan", "x"]):
            x_idx = i
            break
    for i, name in enumerate(normalized):
        if any(key in name for key in ["intensity", "counts", "强度", "计数", "count", "y"]):
            y_idx = i
            break
    if x_idx == y_idx:
        y_idx = 1 if x_idx == 0 and len(header) > 1 else 0
    return x_idx, y_idx


def main(file_path):
    rows, header = _read_table(file_path)
    x_idx, y_idx = _find_xy(header)
    series_data = []
    for row in rows:
        if len(row) <= max(x_idx, y_idx):
            continue
        x = _to_float(row[x_idx])
        y = _to_float(row[y_idx])
        if x is None or y is None:
            continue
        series_data.append([x, y])

    result = {
        "dimensions": 2,
        "x_column": header[x_idx] if header and len(header) > x_idx else "2θ",
        "x_unit": "°",
        "y_column": header[y_idx] if header and len(header) > y_idx else "强度",
        "y_unit": "a.u.",
        "series": [
            {
                "name": "XRD",
                "data": series_data,
            }
        ],
    }
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    import sys

    main(sys.argv[1])
