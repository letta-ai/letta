"""Git operations for memory repositories using git CLI.

This module provides high-level operations for working with git repos
stored in object storage (GCS/S3), using the git command-line tool
instead of dulwich for better compatibility and maintenance.
"""

import asyncio
import os
import shutil
import subprocess
import tempfile
import time
import uuid
from datetime import datetime, timezone
from typing import Dict, List, Optional

from letta.data_sources.redis_client import get_redis_client
from letta.log import get_logger
from letta.schemas.memory_repo import FileChange, MemoryCommit
from letta.services.memory_repo.storage.base import StorageBackend

logger = get_logger(__name__)


def _run_git(args: List[str], cwd: str, check: bool = True) -> subprocess.CompletedProcess:
    """Run a git command and return the result.

    Args:
        args: Git command arguments (without 'git' prefix)
        cwd: Working directory
        check: Whether to raise on non-zero exit

    Returns:
        CompletedProcess with stdout/stderr
    """
    result = subprocess.run(
        ["git", *args],
        cwd=cwd,
        capture_output=True,
        text=True,
        check=False,
    )
    if check and result.returncode != 0:
        raise subprocess.CalledProcessError(result.returncode, ["git", *args], result.stdout, result.stderr)
    return result


class GitOperations:
    """High-level git operations for memory repositories.

    This class provides git operations that work with repositories
    stored in object storage. It downloads the repo to a temp directory,
    performs operations, and uploads the changes back.

    For efficiency with small repos (100s of files), we use a full
    checkout model. For larger repos, we could optimize to work with
    packfiles directly.

    Requirements:
        git CLI must be installed and available in PATH
    """

    def __init__(self, storage: StorageBackend):
        """Initialize git operations.

        Args:
            storage: Storage backend for repo persistence
        """
        self.storage = storage
        self._git_available = None

    def _check_git(self) -> None:
        """Check that git is available."""
        if self._git_available is None:
            try:
                result = subprocess.run(
                    ["git", "--version"],
                    capture_output=True,
                    text=True,
                    check=True,
                )
                self._git_available = True
                logger.debug(f"Git available: {result.stdout.strip()}")
            except (subprocess.CalledProcessError, FileNotFoundError):
                self._git_available = False
                raise RuntimeError("git CLI is required for git operations but was not found in PATH")
        elif not self._git_available:
            raise RuntimeError("git CLI is required for git operations but was not found in PATH")

    def _repo_path(self, agent_id: str, org_id: str) -> str:
        """Get the storage path for an agent's repo."""
        return f"{org_id}/{agent_id}/repo.git"

    async def create_repo(
        self,
        agent_id: str,
        org_id: str,
        initial_files: Optional[Dict[str, str]] = None,
        author_name: str = "Letta System",
        author_email: str = "system@letta.ai",
    ) -> str:
        """Create a new git repository for an agent.

        Args:
            agent_id: Agent ID
            org_id: Organization ID
            initial_files: Optional initial files to commit
            author_name: Author name for initial commit
            author_email: Author email for initial commit

        Returns:
            Initial commit SHA
        """
        self._check_git()

        def _create():
            temp_dir = tempfile.mkdtemp(prefix="letta-memrepo-")
            try:
                repo_path = os.path.join(temp_dir, "repo")
                os.makedirs(repo_path)

                # Initialize a new repository with main as default branch
                _run_git(["init", "-b", "main"], cwd=repo_path)

                # Configure user for this repo
                _run_git(["config", "user.name", author_name], cwd=repo_path)
                _run_git(["config", "user.email", author_email], cwd=repo_path)

                # Add initial files if provided
                if initial_files:
                    for file_path, content in initial_files.items():
                        full_path = os.path.join(repo_path, file_path)
                        os.makedirs(os.path.dirname(full_path), exist_ok=True)
                        with open(full_path, "w", encoding="utf-8") as f:
                            f.write(content)
                        _run_git(["add", file_path], cwd=repo_path)
                else:
                    # Create an empty .letta directory to initialize
                    letta_dir = os.path.join(repo_path, ".letta")
                    os.makedirs(letta_dir, exist_ok=True)
                    config_path = os.path.join(letta_dir, "config.json")
                    with open(config_path, "w") as f:
                        f.write('{"version": 1}')
                    _run_git(["add", ".letta/config.json"], cwd=repo_path)

                # Create initial commit
                _run_git(["commit", "-m", "Initial commit"], cwd=repo_path)

                # Get commit SHA
                result = _run_git(["rev-parse", "HEAD"], cwd=repo_path)
                commit_sha = result.stdout.strip()

                return repo_path, commit_sha
            except Exception:
                shutil.rmtree(temp_dir, ignore_errors=True)
                raise

        repo_path, commit_sha = await asyncio.to_thread(_create)

        try:
            await self._upload_repo(repo_path, agent_id, org_id)
            return commit_sha
        finally:
            shutil.rmtree(os.path.dirname(repo_path), ignore_errors=True)

    async def _upload_repo(self, local_repo_path: str, agent_id: str, org_id: str) -> None:
        """Upload a local repo to storage (full upload)."""
        t_start = time.perf_counter()
        storage_prefix = self._repo_path(agent_id, org_id)

        git_dir = os.path.join(local_repo_path, ".git")
        upload_tasks = []
        total_bytes = 0

        t0 = time.perf_counter()
        for root, dirs, files in os.walk(git_dir):
            for filename in files:
                local_path = os.path.join(root, filename)
                rel_path = os.path.relpath(local_path, git_dir)
                storage_path = f"{storage_prefix}/{rel_path}"

                with open(local_path, "rb") as f:
                    content = f.read()

                total_bytes += len(content)
                upload_tasks.append((storage_path, content))
        read_time = (time.perf_counter() - t0) * 1000
        logger.info(f"[GIT_PERF] _upload_repo read files took {read_time:.2f}ms files={len(upload_tasks)}")

        t0 = time.perf_counter()
        await asyncio.gather(*[self.storage.upload_bytes(path, content) for path, content in upload_tasks])
        upload_time = (time.perf_counter() - t0) * 1000

        total_time = (time.perf_counter() - t_start) * 1000
        logger.info(
            f"[GIT_PERF] _upload_repo TOTAL {total_time:.2f}ms "
            f"files={len(upload_tasks)} bytes={total_bytes} "
            f"upload_time={upload_time:.2f}ms"
        )

    @staticmethod
    def _snapshot_git_files(git_dir: str) -> Dict[str, float]:
        """Snapshot mtime of all files under .git/ for delta detection."""
        snapshot = {}
        for root, _dirs, files in os.walk(git_dir):
            for filename in files:
                path = os.path.join(root, filename)
                snapshot[path] = os.path.getmtime(path)
        return snapshot

    async def _upload_delta(
        self,
        local_repo_path: str,
        agent_id: str,
        org_id: str,
        before_snapshot: Dict[str, float],
    ) -> None:
        """Upload only new/modified files since before_snapshot."""
        t_start = time.perf_counter()
        storage_prefix = self._repo_path(agent_id, org_id)
        git_dir = os.path.join(local_repo_path, ".git")

        upload_tasks = []
        total_bytes = 0

        for root, _dirs, files in os.walk(git_dir):
            for filename in files:
                local_path = os.path.join(root, filename)
                old_mtime = before_snapshot.get(local_path)
                if old_mtime is None or os.path.getmtime(local_path) != old_mtime:
                    rel_path = os.path.relpath(local_path, git_dir)
                    storage_path = f"{storage_prefix}/{rel_path}"
                    with open(local_path, "rb") as f:
                        content = f.read()
                    total_bytes += len(content)
                    upload_tasks.append((storage_path, content))

        t0 = time.perf_counter()
        await asyncio.gather(*[self.storage.upload_bytes(path, content) for path, content in upload_tasks])
        upload_time = (time.perf_counter() - t0) * 1000

        total_time = (time.perf_counter() - t_start) * 1000
        logger.info(
            f"[GIT_PERF] _upload_delta TOTAL {total_time:.2f}ms "
            f"files={len(upload_tasks)} bytes={total_bytes} "
            f"upload_time={upload_time:.2f}ms"
        )

    async def _download_repo(self, agent_id: str, org_id: str) -> str:
        """Download a repo from storage to a temp directory.

        Returns:
            Path to the temporary repo directory
        """
        t_start = time.perf_counter()
        storage_prefix = self._repo_path(agent_id, org_id)

        t0 = time.perf_counter()
        files = await self.storage.list_files(storage_prefix)
        list_time = (time.perf_counter() - t0) * 1000
        logger.info(f"[GIT_PERF] _download_repo storage.list_files took {list_time:.2f}ms files_count={len(files)}")

        if not files:
            raise FileNotFoundError(f"No repository found for agent {agent_id}")

        t0 = time.perf_counter()
        temp_dir = tempfile.mkdtemp(prefix="letta-memrepo-")
        repo_path = os.path.join(temp_dir, "repo")
        git_dir = os.path.join(repo_path, ".git")
        os.makedirs(git_dir)
        mkdir_time = (time.perf_counter() - t0) * 1000
        logger.info(f"[GIT_PERF] _download_repo tempdir creation took {mkdir_time:.2f}ms path={temp_dir}")

        file_info = []
        for file_path in files:
            if file_path.startswith(storage_prefix):
                rel_path = file_path[len(storage_prefix) + 1 :]
            else:
                rel_path = file_path.split("/")[-1] if "/" in file_path else file_path

            local_path = os.path.join(git_dir, rel_path)
            os.makedirs(os.path.dirname(local_path), exist_ok=True)
            file_info.append((file_path, local_path))

        t0 = time.perf_counter()
        download_tasks = [self.storage.download_bytes(fp) for fp, _ in file_info]
        contents = await asyncio.gather(*download_tasks)
        download_time = (time.perf_counter() - t0) * 1000
        total_bytes = sum(len(c) for c in contents)
        logger.info(f"[GIT_PERF] _download_repo parallel download took {download_time:.2f}ms files={len(files)} bytes={total_bytes}")

        t0 = time.perf_counter()
        for (_, local_path), content in zip(file_info, contents):
            with open(local_path, "wb") as f:
                f.write(content)
        write_time = (time.perf_counter() - t0) * 1000

        total_time = (time.perf_counter() - t_start) * 1000
        logger.info(
            f"[GIT_PERF] _download_repo TOTAL {total_time:.2f}ms "
            f"files={len(files)} bytes={total_bytes} "
            f"download_time={download_time:.2f}ms write_time={write_time:.2f}ms"
        )

        return repo_path

    async def get_files(
        self,
        agent_id: str,
        org_id: str,
        ref: str = "HEAD",
    ) -> Dict[str, str]:
        """Get all files at a specific ref.

        Args:
            agent_id: Agent ID
            org_id: Organization ID
            ref: Git ref (commit SHA, branch name, or 'HEAD')

        Returns:
            Dict mapping file paths to content
        """
        self._check_git()
        repo_path = await self._download_repo(agent_id, org_id)

        try:

            def _get_files():
                # List all files tracked by git at the given ref
                result = _run_git(["ls-tree", "-r", "--name-only", ref], cwd=repo_path)
                file_paths = result.stdout.strip().split("\n") if result.stdout.strip() else []

                files = {}
                for file_path in file_paths:
                    if not file_path:
                        continue
                    # Get file content at ref
                    try:
                        content_result = _run_git(["show", f"{ref}:{file_path}"], cwd=repo_path)
                        files[file_path] = content_result.stdout
                    except subprocess.CalledProcessError:
                        pass  # Skip files that can't be read

                return files

            return await asyncio.to_thread(_get_files)
        finally:
            shutil.rmtree(os.path.dirname(repo_path), ignore_errors=True)

    async def commit(
        self,
        agent_id: str,
        org_id: str,
        changes: List[FileChange],
        message: str,
        author_name: str = "Letta Agent",
        author_email: str = "agent@letta.ai",
        branch: str = "main",
    ) -> MemoryCommit:
        """Commit changes to the repository.

        Uses a Redis lock to prevent concurrent modifications.

        Args:
            agent_id: Agent ID
            org_id: Organization ID
            changes: List of file changes
            message: Commit message
            author_name: Author name
            author_email: Author email
            branch: Branch to commit to

        Returns:
            MemoryCommit with commit details

        Raises:
            MemoryRepoBusyError: If another operation is in progress
        """
        t_start = time.perf_counter()
        logger.info(f"[GIT_PERF] GitOperations.commit START agent={agent_id} changes={len(changes)}")

        t0 = time.perf_counter()
        redis_client = await get_redis_client()
        lock_token = f"commit:{uuid.uuid4().hex}"
        lock = await redis_client.acquire_memory_repo_lock(agent_id, lock_token)
        logger.info(f"[GIT_PERF] acquire_memory_repo_lock took {(time.perf_counter() - t0) * 1000:.2f}ms")

        try:
            t0 = time.perf_counter()
            result = await self._commit_with_lock(
                agent_id=agent_id,
                org_id=org_id,
                changes=changes,
                message=message,
                author_name=author_name,
                author_email=author_email,
                branch=branch,
            )
            logger.info(f"[GIT_PERF] _commit_with_lock took {(time.perf_counter() - t0) * 1000:.2f}ms")

            total_time = (time.perf_counter() - t_start) * 1000
            logger.info(f"[GIT_PERF] GitOperations.commit TOTAL {total_time:.2f}ms")
            return result
        finally:
            t0 = time.perf_counter()
            if lock:
                try:
                    await lock.release()
                except Exception as e:
                    logger.warning(f"Failed to release lock for agent {agent_id}: {e}")
                    await redis_client.release_memory_repo_lock(agent_id)
            logger.info(f"[GIT_PERF] lock release took {(time.perf_counter() - t0) * 1000:.2f}ms")

    async def _commit_with_lock(
        self,
        agent_id: str,
        org_id: str,
        changes: List[FileChange],
        message: str,
        author_name: str = "Letta Agent",
        author_email: str = "agent@letta.ai",
        branch: str = "main",
    ) -> MemoryCommit:
        """Internal commit implementation (called while holding lock)."""
        t_start = time.perf_counter()
        self._check_git()

        t0 = time.perf_counter()
        repo_path = await self._download_repo(agent_id, org_id)
        download_time = (time.perf_counter() - t0) * 1000
        logger.info(f"[GIT_PERF] _commit_with_lock download phase took {download_time:.2f}ms")

        try:
            git_dir = os.path.join(repo_path, ".git")
            before_snapshot = self._snapshot_git_files(git_dir)

            def _commit():
                t_git_start = time.perf_counter()

                # Configure user for this repo
                _run_git(["config", "user.name", author_name], cwd=repo_path)
                _run_git(["config", "user.email", author_email], cwd=repo_path)

                # Reset to clean state
                t0_reset = time.perf_counter()
                _run_git(["reset", "--hard"], cwd=repo_path)
                reset_time = (time.perf_counter() - t0_reset) * 1000

                # Get parent SHA before making changes
                try:
                    parent_result = _run_git(["rev-parse", "HEAD"], cwd=repo_path, check=False)
                    parent_sha = parent_result.stdout.strip() if parent_result.returncode == 0 else None
                except Exception:
                    parent_sha = None

                # Apply changes
                files_changed = []
                additions = 0
                deletions = 0
                apply_time = 0

                for change in changes:
                    t0_apply = time.perf_counter()
                    file_path = change.path.lstrip("/")
                    full_path = os.path.join(repo_path, file_path)

                    if change.change_type == "delete" or change.content is None:
                        if os.path.exists(full_path):
                            with open(full_path, "r") as f:
                                deletions += len(f.read())
                            os.remove(full_path)
                            _run_git(["rm", "-f", file_path], cwd=repo_path, check=False)
                    else:
                        os.makedirs(os.path.dirname(full_path), exist_ok=True)

                        if os.path.exists(full_path):
                            with open(full_path, "r") as f:
                                old_content = f.read()
                            deletions += len(old_content)
                        additions += len(change.content)

                        with open(full_path, "w", encoding="utf-8") as f:
                            f.write(change.content)
                        _run_git(["add", file_path], cwd=repo_path)

                    files_changed.append(file_path)
                    apply_time += (time.perf_counter() - t0_apply) * 1000

                # Create commit
                t0_commit = time.perf_counter()
                _run_git(["commit", "-m", message], cwd=repo_path)
                commit_time = (time.perf_counter() - t0_commit) * 1000

                # Get new commit SHA
                result = _run_git(["rev-parse", "HEAD"], cwd=repo_path)
                sha_str = result.stdout.strip()

                git_total = (time.perf_counter() - t_git_start) * 1000
                logger.info(
                    f"[GIT_PERF] _commit git operations: reset={reset_time:.2f}ms "
                    f"apply_changes={apply_time:.2f}ms commit={commit_time:.2f}ms total={git_total:.2f}ms"
                )

                return MemoryCommit(
                    sha=sha_str,
                    parent_sha=parent_sha,
                    message=message,
                    author_type="agent" if "agent" in author_email.lower() else "user",
                    author_id=agent_id,
                    author_name=author_name,
                    timestamp=datetime.now(timezone.utc),
                    files_changed=files_changed,
                    additions=additions,
                    deletions=deletions,
                )

            t0 = time.perf_counter()
            commit = await asyncio.to_thread(_commit)
            git_thread_time = (time.perf_counter() - t0) * 1000
            logger.info(f"[GIT_PERF] _commit_with_lock git thread took {git_thread_time:.2f}ms")

            t0 = time.perf_counter()
            await self._upload_delta(repo_path, agent_id, org_id, before_snapshot)
            upload_time = (time.perf_counter() - t0) * 1000
            logger.info(f"[GIT_PERF] _commit_with_lock upload phase (delta) took {upload_time:.2f}ms")

            total_time = (time.perf_counter() - t_start) * 1000
            logger.info(
                f"[GIT_PERF] _commit_with_lock TOTAL {total_time:.2f}ms "
                f"(download={download_time:.2f}ms git={git_thread_time:.2f}ms upload={upload_time:.2f}ms)"
            )

            return commit
        finally:
            t0 = time.perf_counter()
            shutil.rmtree(os.path.dirname(repo_path), ignore_errors=True)
            logger.info(f"[GIT_PERF] cleanup temp dir took {(time.perf_counter() - t0) * 1000:.2f}ms")

    async def get_history(
        self,
        agent_id: str,
        org_id: str,
        path: Optional[str] = None,
        limit: int = 50,
    ) -> List[MemoryCommit]:
        """Get commit history.

        Args:
            agent_id: Agent ID
            org_id: Organization ID
            path: Optional file path to filter by
            limit: Maximum number of commits to return

        Returns:
            List of commits, newest first
        """
        self._check_git()
        repo_path = await self._download_repo(agent_id, org_id)

        try:

            def _get_history():
                # Use git log with custom format for easy parsing
                # Format: SHA|parent_sha|author_name|timestamp|message
                format_str = "%H|%P|%an|%at|%s"
                args = ["log", f"--format={format_str}", f"-n{limit}"]
                if path:
                    args.extend(["--", path])

                result = _run_git(args, cwd=repo_path)
                lines = result.stdout.strip().split("\n") if result.stdout.strip() else []

                commits = []
                for line in lines:
                    if not line:
                        continue
                    parts = line.split("|", 4)
                    if len(parts) < 5:
                        continue

                    sha, parents, author_name, timestamp_str, message = parts
                    parent_sha = parents.split()[0] if parents else None

                    commits.append(
                        MemoryCommit(
                            sha=sha,
                            parent_sha=parent_sha,
                            message=message,
                            author_type="system",
                            author_id="",
                            author_name=author_name,
                            timestamp=datetime.fromtimestamp(int(timestamp_str), tz=timezone.utc),
                            files_changed=[],
                            additions=0,
                            deletions=0,
                        )
                    )

                return commits

            return await asyncio.to_thread(_get_history)
        finally:
            shutil.rmtree(os.path.dirname(repo_path), ignore_errors=True)

    async def get_head_sha(self, agent_id: str, org_id: str) -> str:
        """Get the current HEAD commit SHA.

        Args:
            agent_id: Agent ID
            org_id: Organization ID

        Returns:
            HEAD commit SHA
        """
        self._check_git()
        repo_path = await self._download_repo(agent_id, org_id)

        try:

            def _get_head():
                result = _run_git(["rev-parse", "HEAD"], cwd=repo_path)
                return result.stdout.strip()

            return await asyncio.to_thread(_get_head)
        finally:
            shutil.rmtree(os.path.dirname(repo_path), ignore_errors=True)

    async def delete_repo(self, agent_id: str, org_id: str) -> None:
        """Delete an agent's repository from storage.

        Args:
            agent_id: Agent ID
            org_id: Organization ID
        """
        storage_prefix = self._repo_path(agent_id, org_id)
        await self.storage.delete_prefix(storage_prefix)
        logger.info(f"Deleted repository for agent {agent_id}")
