import jwt from "jsonwebtoken";

export function getAllowedAdminEmails(): string[] {
  return (process.env.ADMIN_EMAILS || "swifttings@gmail.com,isaacrobinson087@gmail.com")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isAllowedAdminEmail(email: string): boolean {
  return getAllowedAdminEmails().includes(email.trim().toLowerCase());
}

export function createAdminToken(payload: { id: string; email: string }) {
  return jwt.sign(payload, process.env.JWT_SECRET || "development-only-secret", {
    expiresIn: "8h"
  });
}