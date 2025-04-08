/*
  Use alias to override the path  of this package so it points to your app's runtime.ts to define the CURRENT_RUNTIME

  Example:
  ```json
  {
    "compilerOptions": {
      "baseUrl": ".",
      "paths": {
        "libs/runtime": ["apps/desktop-ui/src/runtime.ts"]
      }
    }
  }
  ```
 */

type Runtime = 'letta-desktop' | 'letta-web' | 'please-stub-this-in-your-app';
export const CURRENT_RUNTIME: Runtime = 'please-stub-this-in-your-app';
