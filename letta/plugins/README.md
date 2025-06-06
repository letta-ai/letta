### Plugins

Plugins enable plug and play for various components.

Plugin configurations can be set in `letta.settings.settings`.

The plugins will take a delimited list of consisting of individual plugin configs:

`<plugin_name>.<config_name>=<class_or_function>`

joined by `;`

In the default configuration, the top level keys have values `plugin_name`,
the `config_name` is nested under and the `class_or_function` is defined
after in format `<module_path>:<name>`.

```
DEFAULT_PLUGINS = {
    "experimental_check": {
        "default": "letta.plugins.defaults:is_experimental_enabled",
        ...
```
