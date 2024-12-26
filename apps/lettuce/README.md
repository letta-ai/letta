# Lettuce
Lettuce is a typescript based [temporal](https://temporal.io/) worker service.

## Setup
### Prerequisites
1. Please follow the setup instructions on the root readme
1. Install Temporal CLI
```bash
brew install temporal
```

### Running the service
1. Start the temporal server
```bash
temporal server start
```

2. Start the worker
```bash
just lettuce
```
