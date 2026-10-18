"""Print the OpenAPI schema (used to generate the frontend's typed client)."""

from __future__ import annotations

import json
import sys

from quarry.api.app import create_app


def main() -> None:
    json.dump(create_app().openapi(), sys.stdout, indent=2, sort_keys=True)
    sys.stdout.write("\n")


if __name__ == "__main__":
    main()
