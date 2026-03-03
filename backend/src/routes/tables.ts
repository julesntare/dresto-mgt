// src/routes/tables.ts
import express, { RequestHandler } from "express";
import { prisma } from "../lib/prisma";
import { authenticateToken, requireRole } from "../middleware/auth";

/**
 * @swagger
 * tags:
 *   name: Tables
 *   description: Restaurant table management
 */

/**
 * @swagger
 * /tables:
 *   get:
 *     summary: Get all tables
 *     tags: [Tables]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *         description: Filter by active status
 *     responses:
 *       200:
 *         description: List of tables
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 tables:
 *                   type: array
 *                   items:
 *                     allOf:
 *                       - $ref: '#/components/schemas/Table'
 *                       - type: object
 *                         properties:
 *                           _count:
 *                             type: object
 *                             properties:
 *                               orders:
 *                                 type: integer
 *   post:
 *     summary: Create a new table (Admin only)
 *     tags: [Tables]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - number
 *               - capacity
 *             properties:
 *               number:
 *                 type: string
 *                 example: T1
 *               capacity:
 *                 type: integer
 *                 minimum: 1
 *                 example: 4
 *               location:
 *                 type: string
 *                 example: Main Hall
 *     responses:
 *       201:
 *         description: Table created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 table:
 *                   $ref: '#/components/schemas/Table'
 *       400:
 *         description: Validation error or duplicate table number
 *       403:
 *         description: Insufficient permissions
 */

/**
 * @swagger
 * /tables/{id}:
 *   put:
 *     summary: Update a table (Admin only)
 *     tags: [Tables]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               number:
 *                 type: string
 *               capacity:
 *                 type: integer
 *                 minimum: 1
 *               location:
 *                 type: string
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Table updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 table:
 *                   $ref: '#/components/schemas/Table'
 *       404:
 *         description: Table not found
 *   delete:
 *     summary: Delete a table (Admin only)
 *     tags: [Tables]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Table deleted successfully
 *       400:
 *         description: Cannot delete table with active orders
 *       404:
 *         description: Table not found
 */

/**
 * @swagger
 * /tables/{id}/status:
 *   patch:
 *     summary: Update table status (Admin or Manager)
 *     tags: [Tables]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [AVAILABLE, OCCUPIED, RESERVED]
 *     responses:
 *       200:
 *         description: Table status updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 table:
 *                   $ref: '#/components/schemas/Table'
 *       400:
 *         description: Invalid status
 *       404:
 *         description: Table not found
 */

const router = express.Router();

// Get all tables (all authenticated staff)
router.get("/", authenticateToken, async (req, res) => {
  try {
    const { isActive } = req.query;

    const where: any = {};
    if (isActive !== undefined) {
      where.isActive = isActive === "true";
    }

    const tables = await prisma.table.findMany({
      where,
      include: {
        _count: { select: { orders: true } },
      },
      orderBy: { number: "asc" },
    });

    res.json({ tables });
  } catch (error) {
    console.error("Tables fetch error:", error);
    res.status(500).json({ message: "Failed to fetch tables" });
  }
});

// Create table (Admin only)
router.post(
  "/",
  authenticateToken,
  requireRole(["ADMIN"]),
  (async (req, res) => {
    try {
      const { number, capacity, location } = req.body;

      if (!number || !number.toString().trim()) {
        return res.status(400).json({ message: "Table number is required" });
      }
      if (!capacity || isNaN(Number(capacity)) || Number(capacity) < 1) {
        return res
          .status(400)
          .json({ message: "Capacity must be a positive number" });
      }

      const existing = await prisma.table.findUnique({
        where: { number: number.toString().trim() },
      });
      if (existing) {
        return res
          .status(400)
          .json({ message: "A table with this number already exists" });
      }

      const table = await prisma.table.create({
        data: {
          number: number.toString().trim(),
          capacity: Number(capacity),
          location: location?.toString().trim() || null,
        },
      });

      res.status(201).json({ message: "Table created successfully", table });
    } catch (error) {
      console.error("Table creation error:", error);
      res.status(500).json({ message: "Failed to create table" });
    }
  }) as RequestHandler
);

// Update table (Admin only)
router.put(
  "/:id",
  authenticateToken,
  requireRole(["ADMIN"]),
  (async (req, res) => {
    try {
      const { id } = req.params;
      const { number, capacity, location, isActive } = req.body;

      const existing = await prisma.table.findUnique({ where: { id } });
      if (!existing) {
        return res.status(404).json({ message: "Table not found" });
      }

      if (number && number.toString().trim() !== existing.number) {
        const conflict = await prisma.table.findUnique({
          where: { number: number.toString().trim() },
        });
        if (conflict) {
          return res
            .status(400)
            .json({ message: "A table with this number already exists" });
        }
      }

      if (capacity !== undefined && (isNaN(Number(capacity)) || Number(capacity) < 1)) {
        return res
          .status(400)
          .json({ message: "Capacity must be a positive number" });
      }

      const table = await prisma.table.update({
        where: { id },
        data: {
          ...(number !== undefined && { number: number.toString().trim() }),
          ...(capacity !== undefined && { capacity: Number(capacity) }),
          ...(location !== undefined && {
            location: location?.toString().trim() || null,
          }),
          ...(isActive !== undefined && { isActive: Boolean(isActive) }),
        },
      });

      res.json({ message: "Table updated successfully", table });
    } catch (error) {
      console.error("Table update error:", error);
      res.status(500).json({ message: "Failed to update table" });
    }
  }) as RequestHandler
);

// Update table status (Admin + Manager)
router.patch(
  "/:id/status",
  authenticateToken,
  requireRole(["ADMIN", "MANAGER"]),
  (async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      const validStatuses = ["AVAILABLE", "OCCUPIED", "RESERVED"];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }

      const table = await prisma.table.update({
        where: { id },
        data: { status },
      });

      res.json({ message: "Table status updated successfully", table });
    } catch (error) {
      console.error("Table status update error:", error);
      res.status(500).json({ message: "Failed to update table status" });
    }
  }) as RequestHandler
);

// Delete table (Admin only)
router.delete(
  "/:id",
  authenticateToken,
  requireRole(["ADMIN"]),
  (async (req, res) => {
    try {
      const { id } = req.params;

      const existing = await prisma.table.findUnique({
        where: { id },
        include: {
          _count: {
            select: {
              orders: {
                where: {
                  status: {
                    notIn: ["DELIVERED", "CANCELLED"],
                  },
                },
              },
            },
          },
        },
      });

      if (!existing) {
        return res.status(404).json({ message: "Table not found" });
      }

      if (existing._count.orders > 0) {
        return res.status(400).json({
          message: "Cannot delete table with active orders",
        });
      }

      await prisma.table.delete({ where: { id } });

      res.json({ message: "Table deleted successfully" });
    } catch (error) {
      console.error("Table deletion error:", error);
      res.status(500).json({ message: "Failed to delete table" });
    }
  }) as RequestHandler
);

export default router;
