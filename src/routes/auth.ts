import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { createAdminToken, isAllowedAdminEmail } from "../lib/auth";

const router = Router();

const emailSchema = z.object({
  email: z.string().email()
});

const passwordSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string().optional()
});

/*
  STEP 1:
  The frontend calls this endpoint after the user enters an email.
  It checks authorization and whether a password has already been created.

  It NEVER authenticates a user at this stage.
  It NEVER asks for an existing password when passwordHash is null.
*/
router.post("/check-email", async (req, res) => {
  const parsed = emailSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: "Please enter a valid email address." });
  }

  const email = parsed.data.email.trim().toLowerCase();

  if (!isAllowedAdminEmail(email)) {
    return res.status(403).json({
      authorized: false,
      error: "This email is not authorized to access the Admin Dashboard."
    });
  }

  const admin = await prisma.adminUser.findUnique({ where: { email } });

  if (!admin) {
    return res.status(403).json({
      authorized: false,
      error: "This email is not authorized to access the Admin Dashboard."
    });
  }

  return res.json({
    authorized: true,
    requiresPasswordSetup: !admin.passwordHash
  });
});

/*
  STEP 2A:
  First-time password creation.
  No email verification is involved.
*/
router.post("/setup-password", async (req, res) => {
  const parsed = passwordSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid password details." });
  }

  const email = parsed.data.email.trim().toLowerCase();

  if (!isAllowedAdminEmail(email)) {
    return res.status(403).json({ error: "Unauthorized email." });
  }

  if (parsed.data.password !== parsed.data.confirmPassword) {
    return res.status(400).json({ error: "Passwords do not match." });
  }

  const admin = await prisma.adminUser.findUnique({ where: { email } });

  if (!admin) {
    return res.status(403).json({ error: "Unauthorized email." });
  }

  if (admin.passwordHash) {
    return res.status(409).json({
      error: "A password has already been created. Please use normal login."
    });
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);

  const updated = await prisma.adminUser.update({
    where: { email },
    data: {
      passwordHash,
      lastLoginAt: new Date()
    }
  });

  const token = createAdminToken({
    id: updated.id,
    email: updated.email
  });

  return res.status(201).json({
    success: true,
    token,
    admin: {
      id: updated.id,
      email: updated.email
    }
  });
});

/*
  STEP 2B:
  Returning login with the password previously created.
*/
router.post("/login", async (req, res) => {
  const parsed = z.object({
    email: z.string().email(),
    password: z.string().min(1)
  }).safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: "Email and password are required." });
  }

  const email = parsed.data.email.trim().toLowerCase();

  if (!isAllowedAdminEmail(email)) {
    return res.status(403).json({
      error: "This email is not authorized to access the Admin Dashboard."
    });
  }

  const admin = await prisma.adminUser.findUnique({ where: { email } });

  if (!admin) {
    return res.status(403).json({ error: "Unauthorized email." });
  }

  if (!admin.passwordHash) {
    return res.status(409).json({
      error: "Password setup is required for this account.",
      requiresPasswordSetup: true
    });
  }

  const valid = await bcrypt.compare(parsed.data.password, admin.passwordHash);

  if (!valid) {
    return res.status(401).json({ error: "Incorrect password." });
  }

  await prisma.adminUser.update({
    where: { id: admin.id },
    data: { lastLoginAt: new Date() }
  });

  const token = createAdminToken({
    id: admin.id,
    email: admin.email
  });

  return res.json({
    success: true,
    token,
    admin: {
      id: admin.id,
      email: admin.email
    }
  });
});

router.post("/logout", (_req, res) => {
  /*
    JWTs are stateless. The frontend must remove its stored token.
    If stronger server-side revocation is required later, add refresh-token
    rotation and a token revocation table.
  */
  res.json({ success: true });
});

export default router;