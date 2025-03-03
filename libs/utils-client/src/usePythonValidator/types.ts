export interface PythonValidatorWorkerPayload {
  code: string;
}

export interface PythonValidatorError {
  line: number;
  message: string;
}

export interface PythonValidatorWorkerResponse {
  errors?: PythonValidatorError[];
}
