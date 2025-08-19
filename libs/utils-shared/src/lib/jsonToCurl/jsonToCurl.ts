interface JsonToCurlArgs {
  url: string;
  headers: Record<string, string>;
  body?: Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any -- Body can contain any JSON-serializable values
  method?: string;
}

export function jsonToCurl(args: JsonToCurlArgs) {
  const { url, headers, method, body } = args;

  const curlArr: string[] = [];

  const lineSplit = ' \\\n    ';

  curlArr.push(`curl ${method ? `-X ${method}` : ''}`);
  curlArr.push(
    ...Object.entries(headers).map(([key, value]) => `-H '${key}: ${value}'`),
  );
  curlArr.push(body ? `-d '${JSON.stringify(body, null, 2)}'` : '');
  curlArr.push(url);

  return curlArr.join(lineSplit);
}
