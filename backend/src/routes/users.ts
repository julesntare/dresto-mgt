import express from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { prisma } from "../lib/prisma";
import { authenticateToken, requireRole } from "../middleware/auth";
import { RequestHandler } from "express";

const router = express.Router();

// All users routes require authentication and ADMIN role
router.use(authenticateToken, requireRole(["ADMIN"]));

// GET /users - List all users
router.get("/", (async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        phone: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { orders: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({ users });
  } catch (error) {
    console.error("Users fetch error:", error);
    res.status(500).json({ message: "Failed to fetch users" });
  }
}) as RequestHandler);

// POST /users - Create a new user
router.post("/", (async (req, res) => {
  try {
    const { email, phone, password, name, role = "STAFF" } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Name is required" });
    }

    // If email is provided, password is required
    if (email && !password) {
      return res.status(400).json({ message: "Password is required when email is provided" });
    }

    if (password && password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const validRoles = ["ADMIN", "MANAGER", "STAFF"];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    if (email) {
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        return res.status(409).json({ message: "A user with this email already exists" });
      }
    }

    // Use provided password, or generate a random one for non-login accounts
    const rawPassword = password || crypto.randomBytes(32).toString("hex");
    const hashedPassword = await bcrypt.hash(rawPassword, 12);

    const user = await prisma.user.create({
      data: {
        email: email || null,
        phone: phone || null,
        password: hashedPassword,
        name: name.trim(),
        role,
      },
      select: {
        id: true,
        email: true,
        phone: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    res.status(201).json({ message: "User created successfully", user });
  } catch (error) {
    console.error("User create error:", error);
    res.status(500).json({ message: "Failed to create user" });
  }
}) as RequestHandler);

// PUT /users/:id - Update user
router.put("/:id", (async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, role, isActive } = req.body;

    if (req.user!.id === id && isActive === false) {
      return res.status(400).json({ message: "You cannot deactivate your own account" });
    }

    const validRoles = ["ADMIN", "MANAGER", "STAFF"];
    if (role && !validRoles.includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    const user = await prisma.user.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(phone !== undefined && { phone: phone || null }),
        ...(role !== undefined && { role }),
        ...(isActive !== undefined && { isActive }),
      },
      select: {
        id: true,
        email: true,
        phone: true,
        name: true,
        role: true,
        isActive: true,
        updatedAt: true,
      },
    });

    res.json({ message: "User updated successfully", user });
  } catch (error) {
    console.error("User update error:", error);
    res.status(500).json({ message: "Failed to update user" });
  }
}) as RequestHandler);

// DELETE /users/:id - Delete a user
router.delete("/:id", (async (req, res) => {
  try {
    const { id } = req.params;

    if (req.user!.id === id) {
      return res.status(400).json({ message: "You cannot delete your own account" });
    }

    await prisma.user.delete({ where: { id } });

    res.json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("User delete error:", error);
    res.status(500).json({ message: "Failed to delete user" });
  }
}) as RequestHandler);

export default router;
