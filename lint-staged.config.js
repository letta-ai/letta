module.exports = {
  // Run type-check and Oxlint for TypeScript files
  '{apps,libs,tools}/**/*.{ts,tsx}': [
    (files) => `nx affected --target=type-check --uncommitted`,
    (files) => `npx oxlint --react-plugin --import-plugin ${files.join(' ')}`, // Fast linting with Oxlint
  ],
  // Format JS/JSON files (no linting needed since TS files handle it)
  '{apps,libs,tools}/**/*.{js,jsx,json}': [
    (files) => `nx format:write --files=${files.join(',')}`,
  ],
  'apps/core/**/*.py': () => 'cd apps/core && poetry run pre-commit run --all-files',
};
