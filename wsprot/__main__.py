"""Allow running wsprot as a module: python -m wsprot"""
from .cli import main

if __name__ == "__main__":
    raise SystemExit(main())

