import importlib.util
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parent
SERVICES = [
    "content-moderation",
    "sentiment-analysis",
    "recommendation-engine",
    "image-analysis",
    "fraud-detection",
]


def load_app(service_path: Path):
    main_path = service_path / "main.py"
    spec = importlib.util.spec_from_file_location(f"{service_path.name}.main", main_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to load {main_path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    app = getattr(module, "app", None)
    if app is None:
        raise RuntimeError(f"{main_path} does not define app")


def run():
    missing = []
    failures = []
    for service in SERVICES:
        path = ROOT / service
        if not path.exists():
            missing.append(service)
            continue
        try:
            load_app(path)
            print(f"[OK] {service} app import ok")
        except Exception as exc:
            failures.append((service, str(exc)))

    if missing:
        print("[WARN] Missing services:", ", ".join(missing))
    if failures:
        print("[FAIL] ML services smoke test failed:")
        for service, error in failures:
            print(f"- {service}: {error}")
        sys.exit(1)

    print("[OK] ML services smoke test passed")


if __name__ == "__main__":
    run()
