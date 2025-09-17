import logging
import os
import tempfile

from markitdown import MarkItDown
from mistralai import OCRPageObject, OCRResponse, OCRUsageInfo

from letta.log import get_logger
from letta.otel.tracing import trace_method
from letta.services.file_processor.file_types import is_simple_text_mime_type
from letta.services.file_processor.parser.base_parser import FileParser

logger = get_logger(__name__)

# Suppress pdfminer warnings that occur during PDF processing
logging.getLogger("pdfminer.pdffont").setLevel(logging.ERROR)
logging.getLogger("pdfminer.pdfinterp").setLevel(logging.ERROR)
logging.getLogger("pdfminer.pdfpage").setLevel(logging.ERROR)
logging.getLogger("pdfminer.converter").setLevel(logging.ERROR)


class MarkitdownFileParser(FileParser):
    """Markitdown-based file parsing for documents"""

    def __init__(self, model: str = "markitdown"):
        self.model = model

    @trace_method
    async def extract_text(self, content: bytes, mime_type: str) -> OCRResponse:
        """Extract text using markitdown."""
        try:
            # Handle simple text files directly
            if is_simple_text_mime_type(mime_type):
                logger.info(f"Extracting text directly (no processing needed): {self.model}")
                text = content.decode("utf-8", errors="replace")
                return OCRResponse(
                    model=self.model,
                    pages=[
                        OCRPageObject(
                            index=0,
                            markdown=text,
                            images=[],
                            dimensions=None,
                        )
                    ],
                    usage_info=OCRUsageInfo(pages_processed=1),
                    document_annotation=None,
                )

            logger.info(f"Extracting text using markitdown: {self.model}")

            # Create temporary file to pass to markitdown
            with tempfile.NamedTemporaryFile(delete=False, suffix=self._get_file_extension(mime_type)) as temp_file:
                temp_file.write(content)
                temp_file_path = temp_file.name

            try:
                md = MarkItDown(enable_plugins=False)
                result = md.convert(temp_file_path)

                return OCRResponse(
                    model=self.model,
                    pages=[
                        OCRPageObject(
                            index=0,
                            markdown=result.text_content,
                            images=[],
                            dimensions=None,
                        )
                    ],
                    usage_info=OCRUsageInfo(pages_processed=1),
                    document_annotation=None,
                )
            finally:
                # Clean up temporary file
                os.unlink(temp_file_path)

        except Exception as e:
            logger.error(f"Markitdown text extraction failed: {str(e)}")
            raise

    def _get_file_extension(self, mime_type: str) -> str:
        """Get file extension based on MIME type for markitdown processing."""
        mime_to_ext = {
            "application/pdf": ".pdf",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
            "application/vnd.openxmlformats-officedocument.presentationml.presentation": ".pptx",
            "application/vnd.ms-excel": ".xls",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
            "text/csv": ".csv",
            "application/json": ".json",
            "text/xml": ".xml",
            "application/xml": ".xml",
        }
        return mime_to_ext.get(mime_type, ".txt")
