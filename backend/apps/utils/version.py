from pathlib import Path


def get_app_version():
    version_file = Path(__file__).resolve().parents[3] / 'VERSION'
    if not version_file.exists():
        return '0.0.0'
    return version_file.read_text(encoding='utf-8').strip() or '0.0.0'
