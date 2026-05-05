import json
import os
def _to_float(value):
    text = str(value).strip()
    if not text:
        return None
    try:
        return float(text)
    except Exception:
        return None


def _extract_data_lines(file_path):
    start_markers = ("@@Final Manipulated Data",)
    end_markers = ("@@END Data.", "@Measurement parameters")

    with open(file_path, "r", encoding="utf-8-sig", errors="ignore") as f:
        lines = f.readlines()

    in_block = False
    data_lines = []
    for line in lines:
        stripped = line.strip()
        if not in_block and any(stripped.startswith(marker) for marker in start_markers):
            in_block = True
            continue
        if in_block and any(stripped.startswith(marker) for marker in end_markers):
            break
        if not in_block:
            continue
        if not stripped:
            continue
        if stripped.startswith("New Section:"):
            continue
        data_lines.append(stripped)
    return data_lines


def main(file_path):
    data_lines = _extract_data_lines(file_path)
    series_data = []

    for line in data_lines:
        parts = line.split()
        if len(parts) < 3:
            continue
        x = _to_float(parts[-3])
        y = _to_float(parts[-1])
        if x is None or y is None:
            continue
        series_data.append([x, y])

    result = {
        "dimensions": 2,
        "x_column": "外加场",
        "x_unit": "Oe",
        "y_column": "磁化强度",
        "y_unit": "emu",
        "series": [
            {
                "name": "VSM",
                "data": series_data,
            }
        ],
    }
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    import sys

    main(sys.argv[1])
