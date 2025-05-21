import datetime
import gzip
import json
import logging
import re
from typing import Dict, List, Optional, Tuple, Union

import numpy as np
try:
    import lz4.frame
    LZ4_AVAILABLE = True
except ImportError:
    LZ4_AVAILABLE = False

try:
    import zstandard as zstd
    ZSTD_AVAILABLE = True
except ImportError:
    ZSTD_AVAILABLE = False

from letta.log import get_logger
from letta.schemas.memory import Memory, Passage
from letta.schemas.memory_management import (
    CompressionAlgorithm,
    MemoryCompressionConfig,
    MemoryManagementConfig,
    MemoryPruningConfig,
    MemoryPruningStrategy,
    MemorySummarizationConfig,
)
from letta.schemas.message import Message, MessageCreate, MessageRole
from letta.schemas.user import User
from letta.services.agent_manager import AgentManager
from letta.services.llm_manager import LLMManager
from letta.services.message_manager import MessageManager
from letta.services.passage_manager import PassageManager
from letta.server.db import db_context
from letta.orm.memory_management import MemoryManagementConfig as ORMMemoryManagementConfig
from letta.utils import enforce_types

logger = get_logger(__name__)


class MemoryManagementService:
    """Service for managing agent memory through summarization, compression, and pruning"""

    def __init__(self):
        # Database session maker
        self.session_maker = db_context
        # Related services
        self.agent_manager = AgentManager()
        self.message_manager = MessageManager()
        self.passage_manager = PassageManager()
        self.llm_manager = LLMManager()
    
    @enforce_types
    def get_config(self, agent_id: str, actor: User) -> MemoryManagementConfig:
        """Get the memory management configuration for an agent"""
        with self.session_maker() as session:
            try:
                config = ORMMemoryManagementConfig.query.filter(
                    ORMMemoryManagementConfig.agent_id == agent_id,
                    ORMMemoryManagementConfig.organization_id == actor.organization_id
                ).one_or_none()
                
                if config:
                    return config.to_pydantic()
                else:
                    # Create default config
                    agent = self.agent_manager.get_agent_by_id(agent_id, actor)
                    new_config = MemoryManagementConfig(
                        agent_id=agent_id,
                        organization_id=actor.organization_id
                    )
                    return self.create_config(new_config, actor)
            except Exception as e:
                logger.error(f"Error getting memory management config for agent {agent_id}: {e}")
                raise
    
    @enforce_types
    def create_config(self, config: MemoryManagementConfig, actor: User) -> MemoryManagementConfig:
        """Create a new memory management configuration"""
        with self.session_maker() as session:
            orm_config = ORMMemoryManagementConfig(**config.model_dump(to_orm=True))
            orm_config.create(session, actor=actor)
            return orm_config.to_pydantic()
    
    @enforce_types
    def update_config(self, agent_id: str, config_update: Dict, actor: User) -> MemoryManagementConfig:
        """Update the memory management configuration for an agent"""
        with self.session_maker() as session:
            current_config = self.get_config(agent_id, actor)
            # Apply updates
            for key, value in config_update.items():
                if hasattr(current_config, key):
                    setattr(current_config, key, value)
            
            orm_config = ORMMemoryManagementConfig.read(session, current_config.id, actor=actor)
            # Update with new values
            for key, value in current_config.model_dump(to_orm=True, exclude={"id"}).items():
                setattr(orm_config, key, value)
            
            session.commit()
            return orm_config.to_pydantic()
    
    @enforce_types
    def summarize_messages(self, agent_id: str, messages: List[Message], actor: User) -> str:
        """Generate a summary of a batch of messages"""
        config = self.get_config(agent_id, actor)
        
        if not config.summarization.enabled or len(messages) < config.summarization.min_messages_for_summary:
            # Return empty string if summarization is not enabled or not enough messages
            return ""
        
        # Prepare the context for summarization
        message_text = "\n".join([f"{msg.role}: {msg.content}" for msg in messages])
        
        # Prepare prompt for the LLM
        prompt = f"""Below is a conversation between a user and an AI assistant. 
        Please provide a concise summary of the key points, decisions, and information shared.
        
        Conversation:
        {message_text}
        
        Summary:"""
        
        # Get the agent's LLM config
        agent = self.agent_manager.get_agent_by_id(agent_id, actor)
        llm_config = agent.llm_config
        
        # Generate summary using the agent's LLM
        summary = self.llm_manager.generate_text(prompt, llm_config, max_tokens=500)
        
        return summary
    
    @enforce_types
    def process_memory_summarization(self, agent_id: str, actor: User) -> Optional[str]:
        """Process memory summarization for an agent"""
        config = self.get_config(agent_id, actor)
        
        if not config.summarization.enabled:
            return None
        
        # Get recent messages
        recent_messages = self.message_manager.list_agent_messages(
            agent_id=agent_id, 
            actor=actor,
            limit=config.summarization.summary_interval
        )
        
        if len(recent_messages) < config.summarization.min_messages_for_summary:
            return None
        
        # Generate summary
        summary = self.summarize_messages(agent_id, recent_messages, actor)
        
        # If we have a summary, store it as a passage in archival memory
        if summary:
            time_range = f"{recent_messages[0].created_at} to {recent_messages[-1].created_at}"
            passage = Passage(
                content=summary,
                metadata={"type": "summary", "time_range": time_range, "message_count": len(recent_messages)}
            )
            
            self.passage_manager.create_passage(
                agent_id=agent_id,
                content=summary,
                metadata={"type": "summary", "time_range": time_range, "message_count": len(recent_messages)},
                actor=actor
            )
            
            return summary
        
        return None
    
    @enforce_types
    def compress_memory_data(self, data: str, config: MemoryCompressionConfig) -> Tuple[bytes, CompressionAlgorithm]:
        """Compress memory data using the specified algorithm"""
        if not config.enabled or config.algorithm == CompressionAlgorithm.NONE:
            return data.encode('utf-8'), CompressionAlgorithm.NONE
        
        try:
            if config.algorithm == CompressionAlgorithm.GZIP:
                compressed = gzip.compress(
                    data.encode('utf-8'), 
                    compresslevel=min(9, max(1, config.compression_level))
                )
                return compressed, CompressionAlgorithm.GZIP
            
            elif config.algorithm == CompressionAlgorithm.ZSTD and ZSTD_AVAILABLE:
                cctx = zstd.ZstdCompressor(level=min(22, max(1, config.compression_level)))
                compressed = cctx.compress(data.encode('utf-8'))
                return compressed, CompressionAlgorithm.ZSTD
            
            elif config.algorithm == CompressionAlgorithm.LZ4 and LZ4_AVAILABLE:
                compressed = lz4.frame.compress(
                    data.encode('utf-8'),
                    compression_level=min(16, max(0, config.compression_level))
                )
                return compressed, CompressionAlgorithm.LZ4
            
            # Fallback to GZIP if the requested algorithm isn't available
            logger.warning(f"Requested compression algorithm {config.algorithm} not available, falling back to GZIP")
            compressed = gzip.compress(
                data.encode('utf-8'), 
                compresslevel=min(9, max(1, config.compression_level))
            )
            return compressed, CompressionAlgorithm.GZIP
        
        except Exception as e:
            logger.error(f"Compression error: {e}")
            # Return uncompressed data in case of error
            return data.encode('utf-8'), CompressionAlgorithm.NONE
    
    @enforce_types
    def decompress_memory_data(self, data: bytes, algorithm: CompressionAlgorithm) -> str:
        """Decompress memory data using the specified algorithm"""
        if algorithm == CompressionAlgorithm.NONE:
            return data.decode('utf-8')
        
        try:
            if algorithm == CompressionAlgorithm.GZIP:
                decompressed = gzip.decompress(data)
                return decompressed.decode('utf-8')
            
            elif algorithm == CompressionAlgorithm.ZSTD and ZSTD_AVAILABLE:
                dctx = zstd.ZstdDecompressor()
                decompressed = dctx.decompress(data)
                return decompressed.decode('utf-8')
            
            elif algorithm == CompressionAlgorithm.LZ4 and LZ4_AVAILABLE:
                decompressed = lz4.frame.decompress(data)
                return decompressed.decode('utf-8')
            
            # If we don't recognize the algorithm or it's not available, raise an error
            raise ValueError(f"Unsupported or unavailable compression algorithm: {algorithm}")
        
        except Exception as e:
            logger.error(f"Decompression error: {e}")
            # Return empty string in case of error (caller should handle this)
            return ""
    
    @enforce_types
    def process_memory_compression(self, agent_id: str, actor: User) -> int:
        """Process memory compression for an agent
        
        Returns:
            int: Number of passages compressed
        """
        config = self.get_config(agent_id, actor)
        
        if not config.compression.enabled:
            return 0
        
        # Calculate the cutoff date for compression
        cutoff_date = datetime.datetime.now() - datetime.timedelta(days=config.compression.compression_threshold_days)
        
        # Get uncompressed passages older than the cutoff date
        old_passages = self.passage_manager.list_passages(
            agent_id=agent_id,
            actor=actor,
            # Add criteria to filter for uncompressed passages older than cutoff
            metadata_filter={"compressed": {"$ne": True}},
            before=cutoff_date.isoformat()
        )
        
        compressed_count = 0
        for passage in old_passages:
            # Skip already compressed passages
            if passage.metadata and passage.metadata.get("compressed"):
                continue
                
            # Compress the passage content
            content_str = json.dumps(passage.content)
            compressed_data, algorithm = self.compress_memory_data(content_str, config.compression)
            
            # Skip if no compression was performed
            if algorithm == CompressionAlgorithm.NONE:
                continue
            
            # Encode compressed data as base64 for storage
            import base64
            encoded_data = base64.b64encode(compressed_data).decode('ascii')
            
            # Update the passage with compressed data
            updated_metadata = passage.metadata or {}
            updated_metadata.update({
                "compressed": True,
                "compression_algorithm": algorithm,
                "original_size": len(content_str),
                "compressed_size": len(compressed_data),
                "compression_ratio": len(content_str) / len(compressed_data) if len(compressed_data) > 0 else 1.0
            })
            
            # Store compressed data and updated metadata
            self.passage_manager.update_passage(
                passage_id=passage.id,
                content=encoded_data,  # Store encoded compressed data
                metadata=updated_metadata,
                actor=actor
            )
            
            compressed_count += 1
        
        return compressed_count
    
    @enforce_types
    def process_memory_pruning(self, agent_id: str, actor: User) -> int:
        """Process memory pruning for an agent
        
        Returns:
            int: Number of passages pruned
        """
        config = self.get_config(agent_id, actor)
        
        if not config.pruning.enabled:
            return 0
        
        pruned_count = 0
        
        if config.pruning.strategy == MemoryPruningStrategy.TIME_BASED:
            # Time-based pruning
            if not config.pruning.max_age_days:
                logger.warning("Time-based pruning enabled but max_age_days not set")
                return 0
                
            cutoff_date = datetime.datetime.now() - datetime.timedelta(days=config.pruning.max_age_days)
            
            # Find passages to prune
            old_passages = self.passage_manager.list_passages(
                agent_id=agent_id,
                actor=actor,
                before=cutoff_date.isoformat()
            )
            
            for passage in old_passages:
                # Skip starred/protected passages if configured
                if config.pruning.protect_starred and passage.metadata and passage.metadata.get("starred"):
                    continue
                    
                # Delete the passage
                self.passage_manager.delete_passage(passage.id, actor)
                pruned_count += 1
                
        elif config.pruning.strategy == MemoryPruningStrategy.COUNT_BASED:
            # Count-based pruning
            if not config.pruning.max_count:
                logger.warning("Count-based pruning enabled but max_count not set")
                return 0
                
            # Get all passages sorted by creation date (oldest first)
            all_passages = self.passage_manager.list_passages(
                agent_id=agent_id,
                actor=actor,
                limit=None,  # No limit to get all passages
                ascending=True  # Oldest first
            )
            
            # If we have more passages than our limit, prune the oldest ones
            if len(all_passages) > config.pruning.max_count:
                passages_to_prune = all_passages[:-config.pruning.max_count]  # Keep the newest max_count passages
                
                for passage in passages_to_prune:
                    # Skip starred/protected passages if configured
                    if config.pruning.protect_starred and passage.metadata and passage.metadata.get("starred"):
                        continue
                        
                    # Delete the passage
                    self.passage_manager.delete_passage(passage.id, actor)
                    pruned_count += 1
        
        elif config.pruning.strategy == MemoryPruningStrategy.RELEVANCE_BASED:
            # Relevance-based pruning
            if not config.pruning.min_relevance_score:
                logger.warning("Relevance-based pruning enabled but min_relevance_score not set")
                return 0
                
            # Get all passages
            all_passages = self.passage_manager.list_passages(
                agent_id=agent_id,
                actor=actor,
                limit=None  # No limit to get all passages
            )
            
            # Filter passages with low relevance scores
            for passage in all_passages:
                relevance_score = passage.metadata.get("relevance_score", 0.0) if passage.metadata else 0.0
                
                # Skip starred/protected passages if configured
                if config.pruning.protect_starred and passage.metadata and passage.metadata.get("starred"):
                    continue
                    
                # If relevance score is below threshold, delete the passage
                if relevance_score < config.pruning.min_relevance_score:
                    self.passage_manager.delete_passage(passage.id, actor)
                    pruned_count += 1
        
        elif config.pruning.strategy == MemoryPruningStrategy.HYBRID:
            # Hybrid strategy combines time-based and relevance-based approaches
            # First apply time-based pruning for very old memories
            if config.pruning.max_age_days:
                cutoff_date = datetime.datetime.now() - datetime.timedelta(days=config.pruning.max_age_days)
                
                old_passages = self.passage_manager.list_passages(
                    agent_id=agent_id,
                    actor=actor,
                    before=cutoff_date.isoformat()
                )
                
                for passage in old_passages:
                    # Skip starred/protected passages
                    if config.pruning.protect_starred and passage.metadata and passage.metadata.get("starred"):
                        continue
                        
                    # For hybrid, consider both age and relevance
                    relevance_score = passage.metadata.get("relevance_score", 0.0) if passage.metadata else 0.0
                    age_factor = (datetime.datetime.now() - passage.created_at).days / config.pruning.max_age_days
                    
                    # Adjust relevance threshold based on age (older passages need higher relevance to be kept)
                    adjusted_threshold = config.pruning.min_relevance_score * (1.0 + age_factor)
                    
                    if relevance_score < adjusted_threshold:
                        self.passage_manager.delete_passage(passage.id, actor)
                        pruned_count += 1
            
            # Then ensure we don't exceed max count
            if config.pruning.max_count:
                # Get remaining passages after time-based pruning
                remaining_passages = self.passage_manager.list_passages(
                    agent_id=agent_id,
                    actor=actor,
                    limit=None
                )
                
                if len(remaining_passages) > config.pruning.max_count:
                    # Sort by a combination of age and relevance
                    def passage_priority(p):
                        relevance = p.metadata.get("relevance_score", 0.0) if p.metadata else 0.0
                        # For hybrid strategy, we calculate a priority score that considers both age and relevance
                        age_days = (datetime.datetime.now() - p.created_at).days
                        age_factor = age_days / max(1, config.pruning.max_age_days) if config.pruning.max_age_days else 0
                        return relevance - age_factor  # Higher relevance and lower age = higher priority
                    
                    # Sort passages by priority (lowest first)
                    sorted_passages = sorted(remaining_passages, key=passage_priority)
                    
                    # Prune lowest priority passages to meet max_count
                    passages_to_prune = sorted_passages[:-config.pruning.max_count]  # Keep the highest priority max_count passages
                    
                    for passage in passages_to_prune:
                        # Skip starred/protected passages
                        if config.pruning.protect_starred and passage.metadata and passage.metadata.get("starred"):
                            continue
                            
                        self.passage_manager.delete_passage(passage.id, actor)
                        pruned_count += 1
        
        return pruned_count
    
    @enforce_types
    def run_memory_management(self, agent_id: str, actor: User) -> Dict:
        """Run all memory management processes for an agent
        
        Returns:
            Dict: Summary of actions performed
        """
        result = {
            "summarized": False,
            "compressed_count": 0,
            "pruned_count": 0
        }
        
        # Run summarization
        summary = self.process_memory_summarization(agent_id, actor)
        result["summarized"] = bool(summary)
        
        # Run compression
        compressed_count = self.process_memory_compression(agent_id, actor)
        result["compressed_count"] = compressed_count
        
        # Run pruning
        pruned_count = self.process_memory_pruning(agent_id, actor)
        result["pruned_count"] = pruned_count
        
        return result
