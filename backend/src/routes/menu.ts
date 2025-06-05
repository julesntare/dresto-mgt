import express, { RequestHandler } from "express";
import { prisma } from "../lib/prisma";
import { authenticateToken, requireRole } from "../middleware/auth";
import {
  menuItemValidation,
  handleValidationErrors,
} from "../utils/validation";

const router = express.Router();

// Get all menu items with filters
router.get("/", async (req, res) => {
  try {
    const { categoryId, available, search } = req.query;

    const where: any = {};

    if (categoryId) where.categoryId = categoryId as string;
    if (available !== undefined) where.isAvailable = available === "true";
    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: "insensitive" } },
        { description: { contains: search as string, mode: "insensitive" } },
      ];
    }

    const menuItems = await prisma.menuItem.findMany({
      where,
      include: {
        category: {
          select: { id: true, name: true },
        },
      },
      orderBy: [{ category: { name: "asc" } }, { name: "asc" }],
    });

    res.json({ menuItems });
  } catch (error) {
    console.error("Menu items fetch error:", error);
    res.status(500).json({ message: "Failed to fetch menu items" });
  }
});

// Get single menu item
router.get("/:id", (async (req, res) => {
  try {
    const { id } = req.params;

    const menuItem = await prisma.menuItem.findUnique({
      where: { id },
      include: {
        category: {
          select: { id: true, name: true },
        },
      },
    });

    if (!menuItem) {
      return res.status(404).json({ message: "Menu item not found" });
    }

    res.json({ menuItem });
  } catch (error) {
    console.error("Menu item fetch error:", error);
    res.status(500).json({ message: "Failed to fetch menu item" });
  }
}) as RequestHandler);

// Create menu item (Admin/Manager only)
router.post(
  "/",
  authenticateToken,
  requireRole(["ADMIN", "MANAGER"]),
  menuItemValidation,
  handleValidationErrors,
  (async (req, res) => {
    try {
      const {
        name,
        description,
        price,
        categoryId,
        image,
        isAvailable = true,
      } = req.body;

      // Verify category exists
      const category = await prisma.category.findUnique({
        where: { id: categoryId },
      });

      if (!category) {
        return res.status(400).json({ message: "Invalid category ID" });
      }

      const menuItem = await prisma.menuItem.create({
        data: {
          name,
          description,
          price: parseFloat(price),
          categoryId,
          image,
          isAvailable,
        },
        include: {
          category: {
            select: { id: true, name: true },
          },
        },
      });

      res.status(201).json({
        message: "Menu item created successfully",
        menuItem,
      });
    } catch (error) {
      console.error("Menu item creation error:", error);
      res.status(500).json({ message: "Failed to create menu item" });
    }
  }) as RequestHandler
);

// Update menu item (Admin/Manager only)
router.put(
  "/:id",
  authenticateToken,
  requireRole(["ADMIN", "MANAGER"]),
  menuItemValidation,
  handleValidationErrors,
  (async (req, res) => {
    try {
      const { id } = req.params;
      const { name, description, price, categoryId, image, isAvailable } =
        req.body;

      // Verify category exists if provided
      if (categoryId) {
        const category = await prisma.category.findUnique({
          where: { id: categoryId },
        });

        if (!category) {
          return res.status(400).json({ message: "Invalid category ID" });
        }
      }

      const menuItem = await prisma.menuItem.update({
        where: { id },
        data: {
          name,
          description,
          price: price ? parseFloat(price) : undefined,
          categoryId,
          image,
          ...(isAvailable !== undefined && { isAvailable }),
        },
        include: {
          category: {
            select: { id: true, name: true },
          },
        },
      });

      res.json({
        message: "Menu item updated successfully",
        menuItem,
      });
    } catch (error) {
      console.error("Menu item update error:", error);
      res.status(500).json({ message: "Failed to update menu item" });
    }
  }) as RequestHandler
);

// Delete menu item (Admin only)
router.delete("/:id", authenticateToken, requireRole(["ADMIN"]), (async (
  req,
  res
) => {
  try {
    const { id } = req.params;

    // Check if item is in any pending orders
    const orderItemsCount = await prisma.orderItem.count({
      where: {
        menuItemId: id,
        order: {
          status: {
            in: ["PENDING", "CONFIRMED", "PREPARING"],
          },
        },
      },
    });

    if (orderItemsCount > 0) {
      return res.status(400).json({
        message: "Cannot delete menu item with pending orders",
        pendingOrders: orderItemsCount,
      });
    }

    await prisma.menuItem.delete({
      where: { id },
    });

    res.json({ message: "Menu item deleted successfully" });
  } catch (error) {
    console.error("Menu item deletion error:", error);
    res.status(500).json({ message: "Failed to delete menu item" });
  }
}) as RequestHandler);

// Bulk update availability (Staff and above)
router.patch("/bulk-availability", authenticateToken, (async (req, res) => {
  try {
    const { itemIds, isAvailable } = req.body;

    if (!Array.isArray(itemIds) || typeof isAvailable !== "boolean") {
      return res.status(400).json({ message: "Invalid request data" });
    }

    const updatedItems = await prisma.menuItem.updateMany({
      where: {
        id: { in: itemIds },
      },
      data: { isAvailable },
    });

    res.json({
      message: `${updatedItems.count} items updated successfully`,
      updatedCount: updatedItems.count,
    });
  } catch (error) {
    console.error("Bulk availability update error:", error);
    res.status(500).json({ message: "Failed to update items" });
  }
}) as RequestHandler);

export default router;
