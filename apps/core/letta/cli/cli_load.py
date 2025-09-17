"""
This file contains functions for loading data into Letta's archival storage.

Data can be loaded with the following command, once a load function is defined:
```
letta load <data-connector-type> --name <dataset-name> [ADDITIONAL ARGS]
```

"""

import typer

app = typer.Typer()


default_extensions = "txt,md,pdf"
