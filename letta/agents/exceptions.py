class IncompatibleAgentType(ValueError):
    def __init__(self, expected_type: str, actual_type: str):
        message = f"Incompatible agent type: expected '{expected_type}', but got '{actual_type}'."
        super().__init__(message)
        self.expected_type = expected_type
        self.actual_type = actual_type
