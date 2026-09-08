export function allowDevAuthCodes(): boolean {
  return process.env.NODE_ENV === 'development' && process.env.ALLOW_DEV_AUTH_CODES === 'true';
}
