from typing import Dict, Iterator, List, Tuple

import typer

from letta.constants import EMBEDDING_BATCH_SIZE
from letta.data_sources.connectors_helper import assert_all_files_exist_locally, extract_metadata_from_files, get_filenames_in_dir
from letta.embeddings import embedding_model
from letta.schemas.file import FileMetadata
from letta.schemas.passage import Passage
from letta.schemas.source import Source
from letta.services.file_manager import FileManager
from letta.services.passage_manager import PassageManager


class DataConnector:
    """
    Base class for data connectors that can be extended to generate files and passages from a custom data source.
    """

    def find_files(self, source: Source) -> Iterator[FileMetadata]:
        """
        Generate file metadata from a data source.

        Returns:
            files (Iterator[FileMetadata]): Generate file metadata for each file found.
        """

    def generate_passages(self, file: FileMetadata, chunk_size: int = 1024) -> Iterator[Tuple[str, Dict]]:  # -> Iterator[Passage]:
        """
        Generate passage text and metadata from a list of files.

        Args:
            file (FileMetadata): The document to generate passages from.
            chunk_size (int, optional): Chunk size for splitting passages. Defaults to 1024.

        Returns:
            passages (Iterator[Tuple[str, Dict]]): Generate a tuple of string text and metadata dictionary for each passage.
        """


async def load_data(connector: DataConnector, source: Source, passage_manager: PassageManager, file_manager: FileManager, actor: "User"):
    from letta.llm_api.llm_client import LLMClient
    from letta.schemas.embedding_config import EmbeddingConfig

    """Load data from a connector (generates file and passages) into a specified source_id, associated with a user_id."""
    embedding_config = source.embedding_config

    # insert passages/file
    texts = []
    embedding_to_document_name = {}
    passage_count = 0
    file_count = 0

    async def generate_embeddings(texts: List[str], embedding_config: EmbeddingConfig) -> List[Passage]:
        passages = []
        if embedding_config.embedding_endpoint_type == "openai":
            texts.append(passage_text)

            client = LLMClient.create(
                provider_type=embedding_config.embedding_endpoint_type,
                actor=actor,
            )
            embeddings = await client.request_embeddings(texts, embedding_config)

        else:
            embed_model = embedding_model(embedding_config)
            embeddings = [embed_model.get_text_embedding(text) for text in texts]

        # collate passage and embedding
        for text, embedding in zip(texts, embeddings):
            passage = Passage(
                text=text,
                file_id=file_metadata.id,
                source_id=source.id,
                metadata=passage_metadata,
                organization_id=source.organization_id,
                embedding_config=source.embedding_config,
                embedding=embedding,
            )
            hashable_embedding = tuple(passage.embedding)
            file_name = file_metadata.file_name
            if hashable_embedding in embedding_to_document_name:
                typer.secho(
                    f"Warning: Duplicate embedding found for passage in {file_name} (already exists in {embedding_to_document_name[hashable_embedding]}), skipping insert into VectorDB.",
                    fg=typer.colors.YELLOW,
                )
                continue

            passages.append(passage)
            embedding_to_document_name[hashable_embedding] = file_name
        return passages

    for file_metadata in connector.find_files(source):
        file_count += 1
        await file_manager.create_file(file_metadata, actor)

        # generate passages
        for passage_text, passage_metadata in connector.generate_passages(file_metadata, chunk_size=embedding_config.embedding_chunk_size):
            # for some reason, llama index parsers sometimes return empty strings
            if len(passage_text) == 0:
                typer.secho(
                    f"Warning: Llama index parser returned empty string, skipping insert of passage with metadata '{passage_metadata}' into VectorDB. You can usually ignore this warning.",
                    fg=typer.colors.YELLOW,
                )
                continue

            # get embedding
            texts.append(passage_text)
            if len(texts) >= EMBEDDING_BATCH_SIZE:
                passages = await generate_embeddings(texts, embedding_config)
                texts = []
            else:
                continue

            # insert passages into passage store
            await passage_manager.create_many_passages_async(passages, actor)
            passage_count += len(passages)

    # final remaining
    if len(texts) > 0:
        passages = await generate_embeddings(texts, embedding_config)
        await passage_manager.create_many_passages_async(passages, actor)
        passage_count += len(passages)

    return passage_count, file_count


class DirectoryConnector(DataConnector):
    def __init__(self, input_files: List[str] = None, input_directory: str = None, recursive: bool = False, extensions: List[str] = None):
        """
        Connector for reading text data from a directory of files.

        Args:
            input_files (List[str], optional): List of file paths to read. Defaults to None.
            input_directory (str, optional): Directory to read files from. Defaults to None.
            recursive (bool, optional): Whether to read files recursively from the input directory. Defaults to False.
            extensions (List[str], optional): List of file extensions to read. Defaults to None.
        """
        self.connector_type = "directory"
        self.input_files = input_files
        self.input_directory = input_directory
        self.recursive = recursive
        self.extensions = extensions

        if self.recursive:
            assert self.input_directory is not None, "Must provide input directory if recursive is True."

    def find_files(self, source: Source) -> Iterator[FileMetadata]:
        if self.input_directory is not None:
            files = get_filenames_in_dir(
                input_dir=self.input_directory,
                recursive=self.recursive,
                required_exts=[ext.strip() for ext in str(self.extensions).split(",")],
                exclude=["*png", "*jpg", "*jpeg"],
            )
        else:
            files = self.input_files

        # Check that file paths are valid
        assert_all_files_exist_locally(files)

        for metadata in extract_metadata_from_files(files):
            yield FileMetadata(
                source_id=source.id,
                file_name=metadata.get("file_name"),
                file_path=metadata.get("file_path"),
                file_type=metadata.get("file_type"),
                file_size=metadata.get("file_size"),
                file_creation_date=metadata.get("file_creation_date"),
                file_last_modified_date=metadata.get("file_last_modified_date"),
            )

    def generate_passages(self, file: FileMetadata, chunk_size: int = 1024) -> Iterator[Tuple[str, Dict]]:
        from llama_index.core import SimpleDirectoryReader
        from llama_index.core.node_parser import TokenTextSplitter

        parser = TokenTextSplitter(chunk_size=chunk_size)
        if file.file_type == "application/pdf":
            from llama_index.readers.file import PDFReader

            reader = PDFReader()
            documents = reader.load_data(file=file.file_path)
        else:
            documents = SimpleDirectoryReader(input_files=[file.file_path]).load_data()
        nodes = parser.get_nodes_from_documents(documents)
        for node in nodes:
            yield node.text, None
