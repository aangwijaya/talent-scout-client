#!/usr/bin/env python3
"""Check that contract files match contract.lock and the server commit it pins."""
import hashlib
import json
import sys
import urllib.request

SOURCE = {"docs/API.md": "docs/API.md", "docs/EVENTS.md": "docs/EVENTS.md", "docs/PRD.md": "docs/PRD.md",
          "src/lib/server/api/openapi.yaml": "api/openapi.yaml"}
BASE = "https://raw.githubusercontent.com/aangwijaya/talent-scout-server"


def digest(data):
    return hashlib.sha256(data).hexdigest()


lock = json.load(open("contract.lock"))
failed = False
for local, remote in SOURCE.items():
    expected = lock["files"][local]
    if digest(open(local, "rb").read()) != expected:
        print(f"::error file={local}::differs from contract.lock; sync it with ops/contract-sync")
        failed = True
    pinned = urllib.request.urlopen(f"{BASE}/{lock['server_commit']}/{remote}").read()
    if digest(pinned) != expected:
        print(f"::error file=contract.lock::{local} doesn't match server {lock['server_commit'][:8]}")
        failed = True
sys.exit(1 if failed else 0)
