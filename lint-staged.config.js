module.exports = {
  // Run type-check and Oxlint for TypeScript files
  '{apps,libs,tools}/**/*.{ts,tsx}': [
    (files) => {
      // Extract affected folders from changed files
      const affectedFolders = new Set()
      files.forEach(file => {
        const pathParts = file.split('/')
        if (pathParts[0] === 'apps' || pathParts[0] === 'libs') {
          affectedFolders.add(`${pathParts[0]}/${pathParts[1]}`)
        }
      })

      if (affectedFolders.size === 0) {
        return 'echo "No apps or libs affected, skipping type-check"'
      }

      // Run type-check only for affected projects
      const projects = Array.from(affectedFolders).map(folder => {
        const projectName = folder.split('/')[1]
        return projectName
      }).join(',')

      return `nx run-many --projects=${projects} --target=type-check --parallel=3`
    },
    (files) => `npx oxlint --react-plugin --import-plugin ${files.join(' ')}`, // Fast linting with Oxlint
  ],
  // Format JS/JSON files (no linting needed since TS files handle it)
  '{apps,libs,tools}/**/*.{js,jsx,json}': [
    (files) => `nx format:write --files=${files.join(',')}`,
  ],
  'apps/core/**/*.py': () => 'cd apps/core && poetry run pre-commit run --all-files',
};
