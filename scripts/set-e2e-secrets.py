#!/usr/bin/env python3
"""Set the GitHub Actions secrets the nightly E2E workflow (.github/workflows/e2e.yml) needs.

Reads values from an env file (default: .env.e2e if it exists, else .env.local),
maps them to the E2E_* secret names, and sets each with `gh secret set`. Values
are passed on stdin, never on the command line, and are never printed.

    python scripts/set-e2e-secrets.py               # preview, then confirm
    python scripts/set-e2e-secrets.py --dry-run     # show what would be set, change nothing
    python scripts/set-e2e-secrets.py --env-file .env.e2e --yes
    python scripts/set-e2e-secrets.py --run         # also start the workflow once afterwards

The suite creates and deletes real rows (demo accounts, "E2E "-prefixed pools),
so prefer a separate Supabase project: put its values in .env.e2e. Pointing it at
the project in .env.local means CI writes to that database every night.

Requires the GitHub CLI (`gh`), logged in with access to this repository.
"""

from __future__ import annotations

import argparse
import secrets
import shutil
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent

# secret name -> env var names to try, in order. "generate" means a random value
# is used when none of them is set (fine for CI: the server and tests share it).
SECRETS: list[tuple[str, list[str], bool]] = [
    ("E2E_SUPABASE_URL", ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL"], False),
    ("E2E_SUPABASE_ANON_KEY", ["NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_ANON_KEY"], False),
    ("E2E_SUPABASE_SERVICE_ROLE_KEY",
     ["SUPABASE_SERVICE_ROLE_KEY", "NEXT_PUBLIC_SUPABASE_SERVICE_KEY", "SUPABASE_SECRET_KEY"], False),
    ("E2E_POOL_ACCESS_SECRET", ["POOL_ACCESS_SECRET"], True),
    ("E2E_SESSION_SECRET", ["SESSION_SECRET"], True),
    ("E2E_DEV_MASTER_KEY", ["DEV_MASTER_KEY"], True),
]


def parse_env_file(path: Path) -> dict[str, str]:
    """Minimal dotenv parser: KEY=VALUE, optional quotes, # comments, `export ` prefix."""
    values: dict[str, str] = {}
    for raw in path.read_text(encoding="utf-8-sig").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        if line.startswith("export "):
            line = line[len("export "):]
        key, _, value = line.partition("=")
        key, value = key.strip(), value.strip()
        if value[:1] in ("'", '"') and value.endswith(value[0]) and len(value) >= 2:
            value = value[1:-1]
        else:
            value = value.split(" #", 1)[0].rstrip()  # inline comment on an unquoted value
        values[key] = value
    return values


def redact(value: str) -> str:
    return f"({len(value)} chars)"


def gh(*args: str, stdin: str | None = None) -> subprocess.CompletedProcess[str]:
    return subprocess.run(["gh", *args], input=stdin, text=True, capture_output=True, cwd=REPO_ROOT)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--env-file", type=Path, help="env file to read (default: .env.e2e, else .env.local)")
    parser.add_argument("--dry-run", action="store_true", help="show what would be set, change nothing")
    parser.add_argument("--yes", "-y", action="store_true", help="don't ask for confirmation")
    parser.add_argument("--run", action="store_true", help="start the E2E workflow once after setting secrets")
    args = parser.parse_args()

    if not shutil.which("gh"):
        print("GitHub CLI `gh` not found. Install it from https://cli.github.com and run `gh auth login`.")
        return 1

    env_file = args.env_file
    if env_file is None:
        env_file = REPO_ROOT / ".env.e2e"
        if not env_file.exists():
            env_file = REPO_ROOT / ".env.local"
    elif not env_file.is_absolute():
        env_file = (Path.cwd() / env_file).resolve()
    if not env_file.exists():
        print(f"Env file not found: {env_file}")
        return 1
    env = parse_env_file(env_file)

    repo = gh("repo", "view", "--json", "nameWithOwner", "-q", ".nameWithOwner")
    if repo.returncode != 0:
        print("Could not identify the GitHub repo. Is `gh auth login` done?\n" + repo.stderr.strip())
        return 1

    plan: list[tuple[str, str, str]] = []  # (secret, value, where it came from)
    missing: list[str] = []
    for secret, sources, generate in SECRETS:
        source = next((name for name in sources if env.get(name)), None)
        if source:
            plan.append((secret, env[source], source))
        elif generate:
            plan.append((secret, secrets.token_urlsafe(32), "generated (random)"))
        else:
            missing.append(f"{secret} (needs one of: {', '.join(sources)})")

    print(f"Repo:     {repo.stdout.strip()}")
    print(f"Env file: {env_file}")
    print(f"Supabase: {env.get('NEXT_PUBLIC_SUPABASE_URL') or env.get('SUPABASE_URL') or '(not set)'}")
    print()
    for secret, value, origin in plan:
        print(f"  {secret:<32} <- {origin:<36} {redact(value)}")
    if missing:
        print("\nMissing, nothing will be set:")
        for item in missing:
            print(f"  {item}")
        return 1

    if env_file.name == ".env.local":
        print("\nWARNING: this is your .env.local project. The nightly suite will create and delete")
        print("test rows in that database. Use --env-file .env.e2e with a separate project to avoid it.")

    if args.dry_run:
        print("\nDry run: nothing changed.")
        return 0
    if not args.yes and input("\nSet these secrets? [y/N] ").strip().lower() not in ("y", "yes"):
        print("Cancelled.")
        return 1

    failed = False
    for secret, value, _ in plan:
        result = gh("secret", "set", secret, stdin=value)
        ok = result.returncode == 0
        failed |= not ok
        print(f"  {'set   ' if ok else 'FAILED'} {secret}" + ("" if ok else f": {result.stderr.strip()}"))
    if failed:
        return 1

    if args.run:
        result = gh("workflow", "run", "e2e.yml", "--ref", "main")
        if result.returncode != 0:
            print("Could not start the workflow: " + result.stderr.strip())
            return 1
        print("\nStarted the E2E workflow. Watch it with:  gh run watch")
    else:
        print("\nDone. Start a run with:  gh workflow run e2e.yml --ref main   then:  gh run watch")
    return 0


if __name__ == "__main__":
    sys.exit(main())
