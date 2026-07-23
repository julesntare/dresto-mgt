// src/routes/floorPlan.ts
import express, { RequestHandler } from "express";
import { prisma } from "../lib/prisma";
import { authenticateToken, requireRole } from "../middleware/auth";

/**
 * @swagger
 * tags:
 *   name: FloorPlan
 *   description: Multi-floor table map (positions of tables + landmarks)
 */

const router = express.Router();

/**
 * GET /floor-plan  (public)
 * Returns the venue layout: floors in display order, each with its landmarks
 * and the placements of tables that live on it. Live table *status* still
 * comes from GET /tables — this endpoint is only positions/structure.
 */
router.get("/", async (_req, res) => {
  try {
    const floors = await prisma.floor.findMany({
      orderBy: { order: "asc" },
      include: {
        landmarks: true,
        tables: {
          where: { posX: { not: null }, posY: { not: null } },
          select: { id: true, posX: true, posY: true },
        },
      },
    });

    res.json({
      floors: floors.map((f) => ({
        id: f.id,
        name: f.name,
        order: f.order,
        landmarks: f.landmarks.map((l) => ({
          id: l.id,
          type: l.type,
          label: l.label,
          posX: l.posX,
          posY: l.posY,
        })),
        tables: f.tables.map((t) => ({
          tableId: t.id,
          posX: t.posX,
          posY: t.posY,
        })),
      })),
    });
  } catch (error) {
    console.error("Floor plan fetch error:", error);
    res.status(500).json({ message: "Failed to fetch floor plan" });
  }
});

/**
 * PUT /floor-plan  (Admin + Manager)
 * Full replace of the layout. Body:
 * { floors: [ { name, order, landmarks: [{type,label,posX,posY}],
 *              tables: [{tableId, posX, posY}] } ] }
 * The whole plan is rebuilt in one transaction: floors + landmarks are
 * recreated from scratch and every table's floor/position is reset then
 * reassigned from the payload. Table rows themselves are never deleted.
 */
router.put(
  "/",
  authenticateToken,
  requireRole(["ADMIN", "MANAGER"]),
  (async (req, res) => {
    try {
      const floors = req.body?.floors;
      if (!Array.isArray(floors)) {
        return res
          .status(400)
          .json({ message: "Body must include a 'floors' array" });
      }

      // Validate shape up front so the transaction is all-or-nothing.
      for (const [i, f] of floors.entries()) {
        if (!f || typeof f.name !== "string" || !f.name.trim()) {
          return res
            .status(400)
            .json({ message: `Floor ${i + 1} needs a name` });
        }
        for (const t of f.tables ?? []) {
          if (!t?.tableId || !isUnit(t.posX) || !isUnit(t.posY)) {
            return res.status(400).json({
              message: `Invalid table placement on floor "${f.name}"`,
            });
          }
        }
        for (const l of f.landmarks ?? []) {
          if (!l?.type || !isUnit(l.posX) || !isUnit(l.posY)) {
            return res.status(400).json({
              message: `Invalid landmark on floor "${f.name}"`,
            });
          }
        }
      }

      await prisma.$transaction(async (tx) => {
        // 1. Detach every table from the plan.
        await tx.table.updateMany({
          data: { floorId: null, posX: null, posY: null },
        });
        // 2. Wipe the old structure (landmarks cascade with their floor).
        await tx.floor.deleteMany({});

        // 3. Rebuild floor by floor.
        for (const [i, f] of floors.entries()) {
          const floor = await tx.floor.create({
            data: {
              name: f.name.trim(),
              order: Number.isFinite(f.order) ? Number(f.order) : i,
              landmarks: {
                create: (f.landmarks ?? []).map((l: any) => ({
                  type: String(l.type),
                  label: l.label ? String(l.label) : null,
                  posX: Number(l.posX),
                  posY: Number(l.posY),
                })),
              },
            },
          });

          // Reassign this floor's tables. Skip ids that no longer exist so a
          // stale placement can't abort the whole save.
          for (const t of f.tables ?? []) {
            await tx.table.updateMany({
              where: { id: String(t.tableId) },
              data: {
                floorId: floor.id,
                posX: Number(t.posX),
                posY: Number(t.posY),
              },
            });
          }
        }
      });

      res.json({ message: "Floor plan saved" });
    } catch (error) {
      console.error("Floor plan save error:", error);
      res.status(500).json({ message: "Failed to save floor plan" });
    }
  }) as RequestHandler
);

// A normalised coordinate must be a finite number in [0, 1].
function isUnit(v: unknown): boolean {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1;
}

export default router;
