module.exports = {
  '{apps,libs,tools}/**/*.{ts,tsx}': (files) => {
    return `nx affected --target=type-check --files=${files.join(',')}`;
  },
  '{apps,libs,tools}/**/*.{js,ts,jsx,tsx,json}': [
    (files) => `nx affected:lint  --files=${files.join(',')}`,
    (files) => `nx format:write --files=${files.join(',')}`,
  ],
  'apps/core/**/*.py': () => 'cd apps/core && poetry run pre-commit run --all-files',
};
