import { database } from './database';

describe('database', () => {
  it('should work', () => {
    expect(database()).toEqual('database');
  });
});
