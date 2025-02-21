import crypto from 'crypto';

const ITERATIONS = 10000;

export function hashPassword(password: string) {
  const salt = crypto.randomBytes(128).toString('base64');

  const hash = crypto
    .pbkdf2Sync(password, salt, ITERATIONS, 64, 'sha512')
    .toString('base64');

  return {
    hash,
    salt,
  };
}

export function verifyPassword(password: string, salt: string, hash: string) {
  const newHash = crypto
    .pbkdf2Sync(password, salt, ITERATIONS, 64, 'sha512')
    .toString('base64');

  return newHash === hash;
}
