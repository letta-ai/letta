import os
import subprocess
from pathlib import Path

STARTUP_SCRIPT = Path(__file__).parents[1] / "letta" / "server" / "startup.sh"


def _write_stub(bin_dir: Path, name: str, body: str) -> None:
    path = bin_dir / name
    path.write_text(f"#!/bin/sh\n{body}\n")
    path.chmod(0o755)


def _run_startup(tmp_path: Path, **overrides: str) -> subprocess.CompletedProcess[str]:
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    _write_stub(bin_dir, "alembic", "exit 0")
    _write_stub(bin_dir, "otelcol-contrib", "exit 0")
    _write_stub(bin_dir, "letta", "printf 'LETTA_COMMAND=%s\\n' \"$*\"")

    env = {
        **os.environ,
        "PATH": f"{bin_dir}:{os.environ['PATH']}",
        "LETTA_PG_URI": "postgresql://external/test",
        "LETTA_REDIS_HOST": "external-redis",
    }
    env.pop("LETTA_ALLOW_INSECURE_HTTP", None)
    env.pop("LETTA_DOCKER_EOL", None)
    env.pop("LETTA_SERVER_SECURE", None)
    env.pop("SECURE", None)
    env.update(overrides)
    return subprocess.run(
        [str(STARTUP_SCRIPT)],
        env=env,
        text=True,
        capture_output=True,
        check=True,
    )


def test_eol_docker_startup_is_secure_by_default(tmp_path: Path) -> None:
    result = _run_startup(tmp_path, LETTA_DOCKER_EOL="true")
    output = result.stdout + result.stderr

    assert "Docker distribution is end-of-life and unsupported" in output
    assert "LETTA_COMMAND=server --host 0.0.0.0 --port 8283 --secure" in output


def test_eol_docker_startup_requires_explicit_unsafe_opt_out(tmp_path: Path) -> None:
    result = _run_startup(tmp_path, LETTA_DOCKER_EOL="true", LETTA_ALLOW_INSECURE_HTTP="true")
    output = result.stdout + result.stderr

    assert "LETTA_ALLOW_INSECURE_HTTP=true disables authentication" in output
    assert "LETTA_COMMAND=server --host 0.0.0.0 --port 8283" in output
    assert "--secure" not in output


def test_non_eol_startup_is_unchanged(tmp_path: Path) -> None:
    result = _run_startup(tmp_path)
    output = result.stdout + result.stderr

    assert "Docker distribution is end-of-life" not in output
    assert "LETTA_COMMAND=server --host 0.0.0.0 --port 8283" in output
    assert "--secure" not in output


def test_existing_secure_flag_still_enables_authentication(tmp_path: Path) -> None:
    result = _run_startup(tmp_path, SECURE="true")
    output = result.stdout + result.stderr

    assert "Docker distribution is end-of-life" not in output
    assert "LETTA_COMMAND=server --host 0.0.0.0 --port 8283 --secure" in output
