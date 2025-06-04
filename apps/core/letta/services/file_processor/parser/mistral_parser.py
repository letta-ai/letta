import base64

from mistralai import Mistral, OCRPageObject, OCRResponse, OCRUsageInfo

from letta.log import get_logger
from letta.services.file_processor.parser.base_parser import FileParser
from letta.settings import settings

logger = get_logger(__name__)


SIMPLE_TEXT_MIME_TYPES = {
    "text/plain",
    "text/markdown",
    "text/x-markdown",
    "application/json",
    "application/jsonl",
    "application/x-jsonlines",
}


class MistralFileParser(FileParser):
    """Mistral-based OCR extraction"""

    def __init__(self, model: str = "mistral-ocr-latest"):
        self.model = model

    # TODO: Make this return something general if we add more file parsers
    async def extract_text(self, content: bytes, mime_type: str) -> OCRResponse:
        """Extract text using Mistral OCR or shortcut for plain text."""
        try:
            logger.info(f"Extracting text using Mistral OCR model: {self.model}")

            # TODO: Kind of hacky...we try to exit early here?
            # TODO: Create our internal file parser representation we return instead of OCRResponse
            if mime_type in SIMPLE_TEXT_MIME_TYPES or mime_type.startswith("text/"):
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
                    usage_info=OCRUsageInfo(pages_processed=1),  # You might need to construct this properly
                    document_annotation=None,
                )

            base64_encoded_content = base64.b64encode(content).decode("utf-8")
            document_url = f"data:{mime_type};base64,{base64_encoded_content}"

            async with Mistral(api_key=settings.mistral_api_key) as mistral:
                ocr_response = await mistral.ocr.process_async(
                    model="mistral-ocr-latest", document={"type": "document_url", "document_url": document_url}, include_image_base64=False
                )

            return ocr_response

        except Exception as e:
            logger.error(f"OCR extraction failed: {str(e)}")
            raise
