import express, { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma";
import { authenticateToken, requireRole } from "../middleware/auth";
import { sseManager } from "../lib/sseManager";
import { vapidPublicKey, saveSubscription, removeSubscription } from "../lib/webPush";

const router = express.Router();

const STAFF_ROLES = ["ADMIN", "MANAGER", "STAFF"];

// GET /notifications/vapid-key — return public VAPID key (auth required)
router.get("/vapid-key", authenticateToken, (req, res) => {
  res.json({ publicKey: vapidPublicKey });
});

// GET /notifications/stream — open SSE connection
// Auth via ?token= query param because EventSource cannot set custom headers
router.get("/stream", async (req, res) => {
  const token = req.query.token as string | undefined;
  if (!token) {
    res.status(401).json({ message: "Access token required" });
    return;
  }

  let staffUser: { id: string; role: string } | null = null;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
      userId: string;
      role: string;
    };
    const dbUser = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, role: true, isActive: true },
    });
    if (dbUser && dbUser.isActive && STAFF_ROLES.includes(dbUser.role)) {
      staffUser = dbUser;
    }
  } catch {
    // invalid or expired token
  }

  if (!staffUser) {
    res.status(403).json({ message: "Insufficient permissions" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  // Disable Nagle's algorithm so small SSE writes are sent immediately
  req.socket?.setNoDelay(true);

  res.flushHeaders();

  // Heartbeat every 30s to keep the connection alive through proxies
  const heartbeat = setInterval(() => {
    try {
      res.write(": heartbeat\n\n");
      (res as any).flush?.();
    } catch {
      clearInterval(heartbeat);
    }
  }, 30_000);

  const clientId = sseManager.addClient(res, staffUser.id, staffUser.role);
  console.log(`[SSE] Client connected: ${staffUser.id} (${staffUser.role}), total clients: ${sseManager.clientCount}`);
  res.write(`event: connected\ndata: ${JSON.stringify({ clientId })}\n\n`);
  (res as any).flush?.();

  req.on("close", () => {
    clearInterval(heartbeat);
    sseManager.removeClient(clientId);
    console.log(`[SSE] Client disconnected: ${staffUser.id}, total clients: ${sseManager.clientCount}`);
  });
});

// POST /notifications/subscribe — save Web Push subscription
router.post(
  "/subscribe",
  authenticateToken,
  requireRole(STAFF_ROLES),
  ((req, res) => {
    const { subscription } = req.body;
    if (!subscription?.endpoint) {
      return res.status(400).json({ message: "Invalid subscription object" });
    }
    saveSubscription(req.user!.id, req.user!.role, subscription);
    res.json({ message: "Subscribed successfully" });
  }) as RequestHandler
);

// DELETE /notifications/subscribe — remove Web Push subscription
router.delete(
  "/subscribe",
  authenticateToken,
  requireRole(STAFF_ROLES),
  ((req, res) => {
    removeSubscription(req.user!.id);
    res.json({ message: "Unsubscribed successfully" });
  }) as RequestHandler
);

// POST /notifications/devices — register an FCM token for mobile push.
// Any authenticated role, since customers are the main audience here.
router.post(
  "/devices",
  authenticateToken,
  (async (req, res) => {
    const { token, platform } = req.body;
    if (typeof token !== "string" || token.trim() === "") {
      return res.status(400).json({ message: "token is required" });
    }
    if (platform && !["android", "ios"].includes(platform)) {
      return res.status(400).json({ message: "platform must be 'android' or 'ios'" });
    }

    // A device can change hands between accounts (logout/login), so reassign
    // an existing token rather than rejecting it.
    await prisma.deviceToken.upsert({
      where: { token },
      create: { token, platform: platform ?? "android", userId: req.user!.id },
      update: { userId: req.user!.id, platform: platform ?? "android" },
    });

    res.json({ message: "Device registered" });
  }) as RequestHandler
);

// DELETE /notifications/devices — unregister an FCM token (called on logout)
router.delete(
  "/devices",
  authenticateToken,
  (async (req, res) => {
    const { token } = req.body;
    if (typeof token !== "string" || token.trim() === "") {
      return res.status(400).json({ message: "token is required" });
    }
    await prisma.deviceToken.deleteMany({
      where: { token, userId: req.user!.id },
    });
    res.json({ message: "Device unregistered" });
  }) as RequestHandler
);

export default router;
