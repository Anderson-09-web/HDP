import type { NextFunction, Request, Response } from "express";
import { verifyToken } from "@clerk/backend";

export async function requireClerkAuth(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (req.path === "/healthz") {
    next();
    return;
  }
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    if (process.env.NODE_ENV !== "production") {
      next();
      return;
    }
    res.status(503).json({ error: "Clerk authentication is not configured" });
    return;
  }
  const header = req.header("authorization");
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  try {
    await verifyToken(header.slice("Bearer ".length), { secretKey });
    next();
  } catch {
    res.status(401).json({ error: "Invalid authentication token" });
  }
}