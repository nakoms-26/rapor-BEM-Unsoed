export function hashPassword(password: string) {
  return password;
}

export function verifyPassword(password: string, storedHash: string) {
  return password === storedHash;
}
