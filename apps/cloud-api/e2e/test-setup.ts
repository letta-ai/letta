jest.mock('nanoid', () => ({
  nanoid: () => `test-nanoid-${Math.random().toString(36).substring(2, 15)}`,
}))
