import os

from jinja2 import Environment, FileSystemLoader, StrictUndefined

TEMPLATE_DIR = os.path.dirname(__file__)
jinja_env = Environment(
    loader=FileSystemLoader(TEMPLATE_DIR),
    undefined=StrictUndefined,
    trim_blocks=True,
    lstrip_blocks=True,
)


def render_template(template_name: str, **kwargs):
    template = jinja_env.get_template(template_name)
    return template.render(**kwargs)
