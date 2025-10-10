import uuid
from datetime import datetime
from enum import Enum
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from letta.orm.mixins import OrganizationMixin, UserMixin
from letta.orm.sqlalchemy_base import SqlalchemyBase


class OAuthSessionStatus(str, Enum):
    """OAuth session status enumeration."""

    PENDING = "pending"
    AUTHORIZED = "authorized"
    ERROR = "error"


class MCPOAuth(SqlalchemyBase, OrganizationMixin, UserMixin):
    """OAuth session model for MCP server authentication."""

    __tablename__ = "mcp_oauth"

    # Override the id field to match database UUID generation
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: f"{uuid.uuid4()}")

    # Core session information
    state: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, doc="OAuth state parameter")
    server_id: Mapped[str] = mapped_column(String(255), ForeignKey("mcp_server.id", ondelete="CASCADE"), nullable=True, doc="MCP server ID")
    server_url: Mapped[str] = mapped_column(Text, nullable=False, doc="MCP server URL")
    server_name: Mapped[str] = mapped_column(Text, nullable=False, doc="MCP server display name")

    # OAuth flow data
    authorization_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True, doc="OAuth authorization URL")
    authorization_code: Mapped[Optional[str]] = mapped_column(Text, nullable=True, doc="OAuth authorization code")
    authorization_code_enc: Mapped[Optional[str]] = mapped_column(Text, nullable=True, doc="Encrypted OAuth authorization code")

    # Token data
    access_token: Mapped[Optional[str]] = mapped_column(Text, nullable=True, doc="OAuth access token")
    access_token_enc: Mapped[Optional[str]] = mapped_column(Text, nullable=True, doc="Encrypted OAuth access token")

    refresh_token: Mapped[Optional[str]] = mapped_column(Text, nullable=True, doc="OAuth refresh token")
    refresh_token_enc: Mapped[Optional[str]] = mapped_column(Text, nullable=True, doc="Encrypted OAuth refresh token")

    token_type: Mapped[str] = mapped_column(String(50), default="Bearer", doc="Token type")
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True, doc="Token expiry time")
    scope: Mapped[Optional[str]] = mapped_column(Text, nullable=True, doc="OAuth scope")

    # Client configuration
    client_id: Mapped[Optional[str]] = mapped_column(Text, nullable=True, doc="OAuth client ID")
    client_secret: Mapped[Optional[str]] = mapped_column(Text, nullable=True, doc="OAuth client secret")
    client_secret_enc: Mapped[Optional[str]] = mapped_column(Text, nullable=True, doc="Encrypted OAuth client secret")

    redirect_uri: Mapped[Optional[str]] = mapped_column(Text, nullable=True, doc="OAuth redirect URI")

    # Session state
    status: Mapped[OAuthSessionStatus] = mapped_column(String(20), default=OAuthSessionStatus.PENDING, doc="Session status")

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(), doc="Session creation time")
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(), onupdate=lambda: datetime.now(), doc="Last update time"
    )

    # Relationships (if needed in the future)
    # user: Mapped[Optional["User"]] = relationship("User", back_populates="oauth_sessions")
    # organization: Mapped["Organization"] = relationship("Organization", back_populates="oauth_sessions")
