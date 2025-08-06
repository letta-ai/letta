import asyncio
import os

from jinja2 import Environment, FileSystemLoader, StrictUndefined, Template

from letta.otel.tracing import trace_method

TEMPLATE_DIR = os.path.dirname(__file__)

# Synchronous environment (for backward compatibility)
jinja_env = Environment(
    loader=FileSystemLoader(TEMPLATE_DIR),
    undefined=StrictUndefined,
    trim_blocks=True,
    lstrip_blocks=True,
)

# Async-enabled environment
jinja_async_env = Environment(
    loader=FileSystemLoader(TEMPLATE_DIR),
    undefined=StrictUndefined,
    trim_blocks=True,
    lstrip_blocks=True,
    enable_async=True,  # Enable async support
)


@trace_method
def render_template(template_name: str, **kwargs):
    """Synchronous template rendering function (kept for backward compatibility)"""
    template = jinja_env.get_template(template_name)
    return template.render(**kwargs)


@trace_method
async def render_template_async(template_name: str, **kwargs):
    """Asynchronous template rendering function that doesn't block the event loop"""
    template = jinja_async_env.get_template(template_name)
    return await template.render_async(**kwargs)


@trace_method
async def render_template_in_thread(template_name: str, **kwargs):
    """Asynchronously render a template from a string"""
    template = jinja_env.get_template(template_name)
    return await asyncio.to_thread(template.render, **kwargs)


@trace_method
async def render_string_async(template_string: str, **kwargs):
    """Asynchronously render a template from a string"""
    template = Template(template_string, enable_async=True)
    return await template.render_async(**kwargs)
