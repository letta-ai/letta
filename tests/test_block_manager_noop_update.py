from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock, patch

import pytest

from letta.schemas.block import Block as PydanticBlock, BlockUpdate
from letta.schemas.user import User as PydanticUser
from letta.services.block_manager import BlockManager


def _mock_session_ctx(mock_session: AsyncMock) -> AsyncMock:
    ctx = AsyncMock()
    ctx.__aenter__.return_value = mock_session
    ctx.__aexit__.return_value = None
    return ctx


def _mock_block(block_id: str, value: str, organization_id: str) -> SimpleNamespace:
    block = SimpleNamespace(
        id=block_id,
        label="persona",
        value=value,
        description="Original Description",
        limit=10_000,
        read_only=False,
        metadata_={},
        project_id=None,
        organization_id=organization_id,
    )
    block.update_async = AsyncMock()
    block.to_pydantic = Mock(side_effect=lambda: PydanticBlock(id=block.id, label=block.label, value=block.value))
    return block


@pytest.mark.asyncio
async def test_update_block_skips_rebuild_for_noop_update():
    actor = PydanticUser(id="user-00000000-0000-4000-8000-000000000001", name="test-user", organization_id="org-1")
    block_manager = BlockManager()
    block = _mock_block("block-00000000-0000-4000-8000-000000000001", "Original Content", actor.organization_id)

    mock_result = Mock()
    mock_result.fetchall.return_value = [("existing-tag",)]

    mock_session = AsyncMock()
    mock_session.execute = AsyncMock(return_value=mock_result)

    with patch("letta.services.block_manager.db_registry.async_session", return_value=_mock_session_ctx(mock_session)), patch(
        "letta.services.block_manager.BlockModel.read_async",
        new=AsyncMock(return_value=block),
    ), patch.object(BlockManager, "_rebuild_system_prompts_for_connected_agents", new_callable=AsyncMock) as mock_rebuild:
        updated_block = await block_manager.update_block_async(
            block_id=block.id,
            block_update=BlockUpdate(value="Original Content"),
            actor=actor,
        )

    block.update_async.assert_not_awaited()
    mock_rebuild.assert_not_awaited()
    assert updated_block.value == "Original Content"
    assert updated_block.tags == ["existing-tag"]


@pytest.mark.asyncio
async def test_update_block_rebuilds_for_real_update():
    actor = PydanticUser(id="user-00000000-0000-4000-8000-000000000002", name="test-user", organization_id="org-1")
    block_manager = BlockManager()
    block = _mock_block("block-00000000-0000-4000-8000-000000000002", "Original Content", actor.organization_id)

    mock_result = Mock()
    mock_result.fetchall.return_value = [("existing-tag",)]

    mock_session = AsyncMock()
    mock_session.execute = AsyncMock(return_value=mock_result)

    with patch("letta.services.block_manager.db_registry.async_session", return_value=_mock_session_ctx(mock_session)), patch(
        "letta.services.block_manager.BlockModel.read_async",
        new=AsyncMock(return_value=block),
    ), patch.object(BlockManager, "_rebuild_system_prompts_for_connected_agents", new_callable=AsyncMock) as mock_rebuild:
        updated_block = await block_manager.update_block_async(
            block_id=block.id,
            block_update=BlockUpdate(value="Updated Content"),
            actor=actor,
        )

    block.update_async.assert_awaited_once()
    mock_rebuild.assert_awaited_once_with(block.id, actor)
    assert updated_block.value == "Updated Content"


@pytest.mark.asyncio
async def test_update_block_tags_only_skips_rebuild():
    actor = PydanticUser(id="user-00000000-0000-4000-8000-000000000003", name="test-user", organization_id="org-1")
    block_manager = BlockManager()
    block = _mock_block("block-00000000-0000-4000-8000-000000000003", "Original Content", actor.organization_id)

    mock_result = Mock()
    mock_result.fetchall.return_value = [("existing-tag",)]

    mock_session = AsyncMock()
    mock_session.execute = AsyncMock(return_value=mock_result)

    with patch("letta.services.block_manager.db_registry.async_session", return_value=_mock_session_ctx(mock_session)), patch(
        "letta.services.block_manager.BlockModel.read_async",
        new=AsyncMock(return_value=block),
    ), patch.object(BlockManager, "_replace_block_pivot_rows_async", new_callable=AsyncMock) as mock_replace_tags, patch.object(
        BlockManager, "_rebuild_system_prompts_for_connected_agents", new_callable=AsyncMock
    ) as mock_rebuild:
        updated_block = await block_manager.update_block_async(
            block_id=block.id,
            block_update=BlockUpdate(tags=["new-tag"]),
            actor=actor,
        )

    block.update_async.assert_not_awaited()
    mock_replace_tags.assert_awaited_once()
    mock_rebuild.assert_not_awaited()
    assert updated_block.value == "Original Content"
    assert updated_block.tags == ["new-tag"]


@pytest.mark.asyncio
async def test_update_block_metadata_only_skips_rebuild():
    actor = PydanticUser(id="user-00000000-0000-4000-8000-000000000004", name="test-user", organization_id="org-1")
    block_manager = BlockManager()
    block = _mock_block("block-00000000-0000-4000-8000-000000000004", "Original Content", actor.organization_id)

    mock_result = Mock()
    mock_result.fetchall.return_value = [("existing-tag",)]

    mock_session = AsyncMock()
    mock_session.execute = AsyncMock(return_value=mock_result)

    with patch("letta.services.block_manager.db_registry.async_session", return_value=_mock_session_ctx(mock_session)), patch(
        "letta.services.block_manager.BlockModel.read_async",
        new=AsyncMock(return_value=block),
    ), patch.object(BlockManager, "_rebuild_system_prompts_for_connected_agents", new_callable=AsyncMock) as mock_rebuild:
        updated_block = await block_manager.update_block_async(
            block_id=block.id,
            block_update=BlockUpdate(metadata={"foo": "bar"}),
            actor=actor,
        )

    block.update_async.assert_awaited_once()
    mock_rebuild.assert_not_awaited()
    assert block.metadata_ == {"foo": "bar"}
    assert updated_block.tags == ["existing-tag"]
