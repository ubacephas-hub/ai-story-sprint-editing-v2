export interface DocumentAccessInput {
  role: string | null | undefined;
  accountStatus: string | null | undefined;
  courseAccessStatus: string | null | undefined;
}

/**
 * Keep the private-document policy explicit and independent from the storage
 * client. The route still resolves courseAccess server-side; this helper makes
 * it impossible for pending, suspended, or removed accounts to be treated as
 * active by a future route change.
 */
export function canDownloadDocument({
  role,
  accountStatus,
  courseAccessStatus,
}: DocumentAccessInput): boolean {
  if (accountStatus !== "active") return false;
  if (role === "admin") return true;
  return role === "student" && courseAccessStatus === "active";
}
