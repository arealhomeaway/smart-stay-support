/** Checks the scheduler's x-cron-secret against the database-held backup token. */
export async function backupCallerAllowed(
  given: string | null | undefined,
  verify: (token: string) => Promise<boolean>,
): Promise<boolean> {
  const token = given ?? "";
  if (token.length < 32) return false;
  try {
    return (await verify(token)) === true;
  } catch {
    return false;
  }
}
