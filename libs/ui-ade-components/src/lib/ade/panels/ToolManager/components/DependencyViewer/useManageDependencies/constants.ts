export const CLOUD_INCLUDED_DEPENDENCIES = [
  {
    name: 'numpy',
    description: 'Fundamental package for array computing in Python',
    version: '1.26.4',
    source: 'https://pypi.org/project/numpy/',
  },
  {
    name: 'pandas',
    description: 'Data analysis and manipulation tool, built on top of NumPy',
    version: '1.5.3',
    source: 'https://pypi.org/project/pandas/',
  },
  {
    name: 'Pillow',
    description:
      'Python Imaging Library, adds image processing capabilities to your Python interpreter',
    version: '9.4.0',
    source: 'https://pypi.org/project/Pillow/',
  },
  {
    name: 'requests',
    description: 'Simple, yet elegant HTTP library for Python',
    version: '2.31.0',
    source: 'https://pypi.org/project/requests/',
  },
  {
    name: 'scikit-learn',
    description: 'Machine learning in Python',
    version: '1.3.0',
    source: 'https://pypi.org/project/scikit-learn/',
  },
  {
    name: 'scipy',
    description: 'Scientific library for Python',
    version: '1.11.3',
    source: 'https://pypi.org/project/scipy/',
  },
  {
    name: 'urllib3',
    description:
      'HTTP library with thread-safe connection pooling, file post, and more',
    version: '1.26.17',
    source: 'https://pypi.org/project/urllib3/',
  },
  {
    name: 'letta-nightly',
    description: 'Letta Cloud SDK',
    version: 'latest',
    source: 'https://pypi.org/project/letta-nightly/',
  },
];

export const CLOUD_INCLUDED_NPM_DEPENDENCIES = [
  {
    name: '@letta-cloud/sdk',
    description: 'Letta Cloud SDK for JavaScript/TypeScript',
    version: 'latest',
    source: 'https://www.npmjs.com/package/@letta-cloud/sdk',
  },
  {
    name: 'axios',
    description: 'Promise based HTTP client for the browser and node.js',
    version: '1.7.9',
    source: 'https://www.npmjs.com/package/axios',
  },
  {
    name: 'node-fetch',
    description: 'A light-weight module that brings window.fetch to Node.js',
    version: '3.3.2',
    source: 'https://www.npmjs.com/package/node-fetch',
  },
  {
    name: 'dotenv',
    description: 'Loads environment variables from a .env file',
    version: '16.4.7',
    source: 'https://www.npmjs.com/package/dotenv',
  },
  {
    name: 'zod',
    description: 'TypeScript-first schema validation with static type inference',
    version: '3.24.1',
    source: 'https://www.npmjs.com/package/zod',
  },
  {
    name: 'joi',
    description: 'Object schema validation',
    version: '17.13.3',
    source: 'https://www.npmjs.com/package/joi',
  },
  {
    name: 'lodash',
    description: 'Utility library delivering consistency, customization, performance, and extras',
    version: '4.17.21',
    source: 'https://www.npmjs.com/package/lodash',
  },
  {
    name: 'moment',
    description: 'Parse, validate, manipulate, and display dates in JavaScript',
    version: '2.30.1',
    source: 'https://www.npmjs.com/package/moment',
  },
];
