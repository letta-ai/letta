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
just start-temporal
```

2. Start the worker (in a different terminal)
```bash
just lettuce
```

## Contributing
This app is just a shell, all the code associated with the worker processes are located in lettuce-client. 
