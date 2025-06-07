import express, { Request, Response, RequestHandler } from "express";
import { prisma } from "../lib/prisma";
import { authenticateToken, requireRole } from "../middleware/auth";
import { handleValidationErrors } from "../utils/validation";
import { body } from "express-validator";

/**
 * @swagger
 * tags:
 *   name: Categories
 *   description: Menu categories management
 */

/**
 * @swagger
 * /categories:
 *   get:
 *     summary: Get all categories
 *     tags: [Categories]
 *     parameters:
 *       - in: query
 *         name: includeInactive
 *         schema:
 *           type: boolean
 *         description: Include inactive categories in response
 *     responses:
 *       200:
 *         description: List of categories
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 categories:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Category'
 *   post:
 *     summary: Create a new category
 *     tags: [Categories]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       201:
 *         description: Category created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 category:
 *                   $ref: '#/components/schemas/Category'
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Insufficient permissions
 */

/**
 * @swagger
 * /categories/{id}:
 *   get:
 *     summary: Get a category by ID
 *     tags: [Categories]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Category details with menu items
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 category:
 *                   $ref: '#/components/schemas/Category'
 *       404:
 *         description: Category not found
 *   put:
 *     summary: Update a category
 *     tags: [Categories]
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
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Category updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 category:
 *                   $ref: '#/components/schemas/Category'
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Insufficient permissions
 *       404:
 *         description: Category not found
 *   delete:
 *     summary: Delete a category
 *     tags: [Categories]
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
 *         description: Category deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       400:
 *         description: Cannot delete category with existing menu items
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Insufficient permissions
 *       404:
 *         description: Category not found
 */

const router = express.Router();

// Category validation
const categoryValidation = [
  body("name").trim().isLength({ min: 1 }).withMessage("Name is required"),
  body("description").optional().trim(),
];

// Get all categories
router.get("/", (async (req, res) => {
  try {
    const { includeInactive } = req.query;

    const categories = await prisma.category.findMany({
      where: includeInactive === "true" ? {} : { isActive: true },
      include: {
        _count: {
          select: { menuItems: true },
        },
      },
      orderBy: { name: "asc" },
    });

    res.json({ categories });
  } catch (error) {
    console.error("Categories fetch error:", error);
    res.status(500).json({ message: "Failed to fetch categories" });
  }
}) as RequestHandler);

// Get single category
router.get("/:id", (async (req, res) => {
  try {
    const { id } = req.params;

    const category = await prisma.category.findUnique({
      where: { id },
      include: {
        menuItems: {
          where: { isAvailable: true },
          orderBy: { name: "asc" },
        },
      },
    });

    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }

    res.json({ category });
  } catch (error) {
    console.error("Category fetch error:", error);
    res.status(500).json({ message: "Failed to fetch category" });
  }
}) as RequestHandler);

// Create category (Admin/Manager only)
router.post(
  "/",
  authenticateToken,
  requireRole(["ADMIN", "MANAGER"]),
  categoryValidation,
  handleValidationErrors,
  (async (req, res) => {
    try {
      const { name, description } = req.body;

      const category = await prisma.category.create({
        data: { name, description },
      });

      res.status(201).json({
        message: "Category created successfully",
        category,
      });
    } catch (error) {
      console.error("Category creation error:", error);
      res.status(500).json({ message: "Failed to create category" });
    }
  }) as RequestHandler
);

// Update category (Admin/Manager only)
router.put(
  "/:id",
  authenticateToken,
  requireRole(["ADMIN", "MANAGER"]),
  categoryValidation,
  handleValidationErrors,
  (async (req, res) => {
    try {
      const { id } = req.params;
      const { name, description, isActive } = req.body;

      const category = await prisma.category.update({
        where: { id },
        data: {
          name,
          description,
          ...(isActive !== undefined && { isActive }),
        },
      });

      res.json({
        message: "Category updated successfully",
        category,
      });
    } catch (error) {
      console.error("Category update error:", error);
      res.status(500).json({ message: "Failed to update category" });
    }
  }) as RequestHandler
);

// Delete category (Admin only)
router.delete("/:id", authenticateToken, requireRole(["ADMIN"]), (async (
  req,
  res
) => {
  try {
    const { id } = req.params;

    // Check if category has menu items
    const menuItemsCount = await prisma.menuItem.count({
      where: { categoryId: id },
    });

    if (menuItemsCount > 0) {
      return res.status(400).json({
        message: "Cannot delete category with existing menu items",
        menuItemsCount,
      });
    }

    await prisma.category.delete({
      where: { id },
    });

    res.json({ message: "Category deleted successfully" });
  } catch (error) {
    console.error("Category deletion error:", error);
    res.status(500).json({ message: "Failed to delete category" });
  }
}) as RequestHandler);

export default router;
