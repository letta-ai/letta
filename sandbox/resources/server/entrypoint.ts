import * as userModule from "./user-function.js";

/**
 * Entrypoint for the user function.
 * Dynamically finds and executes the exported TypeScript function.
 * 
 * @param encoded_input - JSON encoded input
 */
export function runUserFunction(encoded_input: string): { result: any; error?: string } {
  try {
    const input = JSON.parse(encoded_input);
    
    // Find the first exported function from the user module
    const functionNames = Object.keys(userModule).filter(
      key => typeof userModule[key] === 'function'
    );
    
    if (functionNames.length === 0) {
      return { 
        result: null, 
        error: "No exported function found in user-function.ts" 
      };
    }
    
    // Use the first exported function (TypeScript tools should only export one)
    const functionName = functionNames[0];
    const userFunction = userModule[functionName];
    
    // Call the function with the provided arguments
    // The arguments are passed as an object, so we need to extract them
    // in the order expected by the function
    const result = userFunction(...Object.values(input));
    
    return { result };
  } catch (error) {
    // Return error information for debugging
    return { 
      result: null, 
      error: error instanceof Error ? error.message : String(error) 
    };
  }
}