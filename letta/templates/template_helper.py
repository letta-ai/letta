import os

from jinja2 import Environment, FileSystemLoader, StrictUndefined, Template

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


def render_template(template_name: str, **kwargs):
    """Synchronous template rendering function (kept for backward compatibility)"""
    template = jinja_env.get_template(template_name)
    return template.render(**kwargs)


async def render_template_async(template_name: str, **kwargs):
    """Asynchronous template rendering function that doesn't block the event loop"""
    template = jinja_async_env.get_template(template_name)
    return await template.render_async(**kwargs)


async def render_string_async(template_string: str, **kwargs):
    """Asynchronously render a template from a string"""
    template = Template(template_string, enable_async=True)
    return await template.render_async(**kwargs)
