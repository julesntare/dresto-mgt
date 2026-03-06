// src/routes/orders.ts
import express, { RequestHandler } from "express";
import { prisma } from "../lib/prisma";
import { authenticateToken, optionalAuthenticateToken, requireRole } from "../middleware/auth";
import { orderValidation, handleValidationErrors } from "../utils/validation";
import { generateOrderNumber, calculateOrderTotal } from "../utils/helpers";

/**
 * @swagger
 * tags:
 *   name: Orders
 *   description: Order management and statistics
 */

/**
 * @swagger
 * /orders:
 *   get:
 *     summary: Get all orders with filters
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, CONFIRMED, PREPARING, READY, DELIVERED, CANCELLED]
 *       - in: query
 *         name: orderType
 *         schema:
 *           type: string
 *           enum: [DINE_IN, TAKEAWAY, DELIVERY]
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: List of orders with pagination
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 orders:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Order'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                     pages:
 *                       type: integer
 *   post:
 *     summary: Create a new order
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - orderType
 *               - items
 *             properties:
 *               customerName:
 *                 type: string
 *               customerPhone:
 *                 type: string
 *               orderType:
 *                 type: string
 *                 enum: [DINE_IN, TAKEAWAY, DELIVERY]
 *               tableNumber:
 *                 type: string
 *               notes:
 *                 type: string
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - menuItemId
 *                     - quantity
 *                   properties:
 *                     menuItemId:
 *                       type: string
 *                     quantity:
 *                       type: integer
 *                       minimum: 1
 *     responses:
 *       201:
 *         description: Order created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 order:
 *                   $ref: '#/components/schemas/Order'
 */

/**
 * @swagger
 * /orders/{id}:
 *   get:
 *     summary: Get an order by ID
 *     tags: [Orders]
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
 *         description: Order details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 order:
 *                   $ref: '#/components/schemas/Order'
 *       404:
 *         description: Order not found
 *   put:
 *     summary: Update order details
 *     tags: [Orders]
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
 *               customerName:
 *                 type: string
 *               customerPhone:
 *                 type: string
 *               orderType:
 *                 type: string
 *                 enum: [DINE_IN, TAKEAWAY, DELIVERY]
 *               tableNumber:
 *                 type: string
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Order updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 order:
 *                   $ref: '#/components/schemas/Order'
 */

/**
 * @swagger
 * /orders/{id}/status:
 *   patch:
 *     summary: Update order status
 *     tags: [Orders]
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
 *                 enum: [PENDING, CONFIRMED, PREPARING, READY, DELIVERED, CANCELLED]
 *     responses:
 *       200:
 *         description: Order status updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 order:
 *                   $ref: '#/components/schemas/Order'
 */

/**
 * @swagger
 * /orders/{id}/cancel:
 *   patch:
 *     summary: Cancel an order
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Order cancelled successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 order:
 *                   $ref: '#/components/schemas/Order'
 */

/**
 * @swagger
 * /orders/stats/overview:
 *   get:
 *     summary: Get order statistics overview
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Order statistics overview
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 stats:
 *                   type: object
 *                   properties:
 *                     totalOrders:
 *                       type: integer
 *                     completedOrders:
 *                       type: integer
 *                     cancelledOrders:
 *                       type: integer
 *                     pendingOrders:
 *                       type: integer
 *                     totalRevenue:
 *                       type: number
 *                     completionRate:
 *                       type: string
 *                     popularItems:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           menuItemId:
 *                             type: string
 *                           _sum:
 *                             type: object
 *                             properties:
 *                               quantity:
 *                                 type: integer
 *                           menuItem:
 *                             type: object
 *                             properties:
 *                               name:
 *                                 type: string
 *                               price:
 *                                 type: number
 */

/**
 * @swagger
 * /orders/stats/daily-sales:
 *   get:
 *     summary: Get daily sales data
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           default: 7
 *         description: Number of days to fetch data for
 *     responses:
 *       200:
 *         description: Daily sales data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 dailySales:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       date:
 *                         type: string
 *                         format: date
 *                       order_count:
 *                         type: integer
 *                       total_revenue:
 *                         type: number
 */

const router = express.Router();

// Get all orders with filters
router.get("/", authenticateToken, async (req, res) => {
  try {
    const {
      status,
      orderType,
      startDate,
      endDate,
      page = "1",
      limit = "10",
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};

    // Customers can only see their own orders
    if (req.user!.role === "CUSTOMER") {
      where.userId = req.user!.id;
    }

    if (status) where.status = status;
    if (orderType) where.orderType = orderType;
    if (startDate && endDate) {
      where.createdAt = {
        gte: new Date(startDate as string),
        lte: new Date(endDate as string),
      };
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          orderItems: {
            include: {
              menuItem: {
                select: { id: true, name: true, price: true, category: { select: { name: true } } },
              },
            },
          },
          user: {
            select: { id: true, name: true, email: true },
          },
          table: {
            select: { id: true, number: true, location: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limitNum,
      }),
      prisma.order.count({ where }),
    ]);

    res.json({
      orders,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error("Orders fetch error:", error);
    res.status(500).json({ message: "Failed to fetch orders" });
  }
});

/**
 * @swagger
 * /orders/session/{sessionToken}:
 *   get:
 *     summary: Get all orders for a guest session (public, no auth required)
 *     tags: [Orders]
 *     parameters:
 *       - in: path
 *         name: sessionToken
 *         required: true
 *         schema:
 *           type: string
 *         description: UUID generated by the mobile app per customer session
 *     responses:
 *       200:
 *         description: List of orders for this guest session
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 orders:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Order'
 */

// Get all orders for a guest session (mobile app passes its own UUID)
router.get("/session/:sessionToken", (async (req, res) => {
  try {
    const { sessionToken } = req.params;

    const orders = await prisma.order.findMany({
      where: { guestSessionToken: sessionToken },
      include: {
        orderItems: {
          include: {
            menuItem: {
              select: { id: true, name: true, price: true, image: true, category: { select: { name: true } } },
            },
          },
        },
        table: {
          select: { id: true, number: true, location: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({ orders });
  } catch (error) {
    console.error("Guest session orders error:", error);
    res.status(500).json({ message: "Failed to fetch orders" });
  }
}) as RequestHandler);

/**
 * @swagger
 * /orders/mine:
 *   get:
 *     summary: Get orders belonging to the authenticated user
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, CONFIRMED, PREPARING, READY, DELIVERED, CANCELLED]
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: Paginated list of the user's orders
 */

/**
 * @swagger
 * /orders/track/{token}:
 *   get:
 *     summary: Track an order by its access token (public, no auth required)
 *     tags: [Orders]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: The accessToken returned when the order was created
 *     responses:
 *       200:
 *         description: Order details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 order:
 *                   $ref: '#/components/schemas/Order'
 *       404:
 *         description: Order not found
 */

// Get orders for the currently authenticated user
router.get("/mine", authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { status, page = "1", limit = "10" } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const where: any = { userId };
    if (status) where.status = status;

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          orderItems: {
            include: {
              menuItem: {
                select: { id: true, name: true, price: true },
              },
            },
          },
          table: {
            select: { id: true, number: true, location: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limitNum,
      }),
      prisma.order.count({ where }),
    ]);

    res.json({
      orders,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error("My orders fetch error:", error);
    res.status(500).json({ message: "Failed to fetch orders" });
  }
});

// Track an order by access token OR order id (public — no auth required)
router.get("/track/:token", (async (req, res) => {
  try {
    const { token } = req.params;

    const include = {
      orderItems: {
        include: {
          menuItem: {
            select: { id: true, name: true, price: true, image: true, category: { select: { name: true } } },
          },
        },
      },
      table: {
        select: { id: true, number: true, location: true },
      },
    };

    // Try accessToken first, fall back to order id
    const order =
      (await prisma.order.findUnique({ where: { accessToken: token }, include })) ??
      (await prisma.order.findUnique({ where: { id: token }, include }));

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    res.json({ order });
  } catch (error) {
    console.error("Order tracking error:", error);
    res.status(500).json({ message: "Failed to track order" });
  }
}) as RequestHandler);

// Get single order
router.get("/:id", authenticateToken, (async (req, res) => {
  try {
    const { id } = req.params;

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        orderItems: {
          include: {
            menuItem: {
              select: { id: true, name: true, price: true, image: true, category: { select: { name: true } } },
            },
          },
        },
        user: {
          select: { id: true, name: true, email: true },
        },
        table: {
          select: { id: true, number: true, location: true },
        },
      },
    });

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Customers can only view their own orders
    if (req.user!.role === "CUSTOMER" && order.userId !== req.user!.id) {
      return res.status(403).json({ message: "Forbidden" });
    }

    res.json({ order });
  } catch (error) {
    console.error("Order fetch error:", error);
    res.status(500).json({ message: "Failed to fetch order" });
  }
}) as RequestHandler);

// Create new order (guests allowed — userId will be null for unauthenticated requests)
router.post(
  "/",
  optionalAuthenticateToken,
  orderValidation,
  handleValidationErrors,
  (async (req, res) => {
    try {
      const {
        customerName,
        customerPhone,
        orderType,
        tableId,
        notes,
        items,
        guestSessionToken,
      } = req.body;
      const userId = req.user?.id || null;

      // Validate table for DINE_IN orders
      if (orderType === "DINE_IN" && tableId) {
        const table = await prisma.table.findUnique({ where: { id: tableId } });
        if (!table) {
          return res.status(400).json({ message: "Table not found" });
        }
        if (table.status === "RESERVED") {
          return res.status(400).json({ message: "Table is reserved" });
        }
        if (!table.isActive) {
          return res.status(400).json({ message: "Table is not active" });
        }
      }

      // Validate menu items and calculate total
      const menuItemIds = items.map((item: any) => item.menuItemId);
      const menuItems = await prisma.menuItem.findMany({
        where: {
          id: { in: menuItemIds },
          isAvailable: true,
        },
      });

      if (menuItems.length !== menuItemIds.length) {
        return res
          .status(400)
          .json({ message: "Some menu items are not available" });
      }

      // Calculate order total
      let totalAmount = 0;
      const orderItemsData = items.map((item: any) => {
        const menuItem = menuItems.find((mi: any) => mi.id === item.menuItemId);
        if (!menuItem) throw new Error("Menu item not found");

        const itemTotal = parseFloat(menuItem.price.toString()) * item.quantity;
        totalAmount += itemTotal;

        return {
          menuItemId: item.menuItemId,
          quantity: item.quantity,
          price: menuItem.price,
        };
      });

      // Generate order number
      const orderNumber = generateOrderNumber();

      // Create order with items
      const order = await prisma.order.create({
        data: {
          orderNumber,
          customerName,
          customerPhone,
          totalAmount,
          orderType,
          tableId: orderType === "DINE_IN" ? tableId || null : null,
          notes,
          userId,
          guestSessionToken: guestSessionToken || null,
          orderItems: {
            create: orderItemsData,
          },
        },
        include: {
          orderItems: {
            include: {
              menuItem: {
                select: { id: true, name: true, price: true },
              },
            },
          },
          user: {
            select: { id: true, name: true },
          },
          table: {
            select: { id: true, number: true, location: true },
          },
        },
      });

      // Mark table as OCCUPIED only if currently AVAILABLE (multiple customers can share a table)
      if (orderType === "DINE_IN" && tableId) {
        await prisma.table.updateMany({
          where: { id: tableId, status: "AVAILABLE" },
          data: { status: "OCCUPIED" },
        });
      }

      res.status(201).json({
        message: "Order created successfully",
        order,
      });
    } catch (error) {
      console.error("Order creation error:", error);
      res.status(500).json({ message: "Failed to create order" });
    }
  }) as RequestHandler
);

// Update order status (staff/manager/admin only — customers cannot change status)
router.patch("/:id/status", authenticateToken, requireRole(["ADMIN", "MANAGER", "STAFF"]), (async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = [
      "PENDING",
      "CONFIRMED",
      "PREPARING",
      "READY",
      "DELIVERED",
      "CANCELLED",
    ];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const existingOrder = await prisma.order.findUnique({ where: { id } });
    if (!existingOrder) {
      return res.status(404).json({ message: "Order not found" });
    }

    const order = await prisma.order.update({
      where: { id },
      data: { status },
      include: {
        orderItems: {
          include: {
            menuItem: {
              select: { id: true, name: true },
            },
          },
        },
        table: {
          select: { id: true, number: true, location: true },
        },
      },
    });

    // Free the table when order is completed or cancelled
    if (
      ["DELIVERED", "CANCELLED"].includes(status) &&
      existingOrder.tableId
    ) {
      await prisma.table.update({
        where: { id: existingOrder.tableId },
        data: { status: "AVAILABLE" },
      });
    }

    res.json({
      message: "Order status updated successfully",
      order,
    });
  } catch (error) {
    console.error("Order status update error:", error);
    res.status(500).json({ message: "Failed to update order status" });
  }
}) as RequestHandler);

// Update order details (Admin/Manager only)
router.put(
  "/:id",
  authenticateToken,
  requireRole(["ADMIN", "MANAGER"]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { customerName, customerPhone, orderType, tableId, notes } =
        req.body;

      const order = await prisma.order.update({
        where: { id },
        data: {
          customerName,
          customerPhone,
          orderType,
          tableId: tableId ?? undefined,
          notes,
        },
        include: {
          orderItems: {
            include: {
              menuItem: {
                select: { id: true, name: true, price: true },
              },
            },
          },
          table: {
            select: { id: true, number: true, location: true },
          },
        },
      });

      res.json({
        message: "Order updated successfully",
        order,
      });
    } catch (error) {
      console.error("Order update error:", error);
      res.status(500).json({ message: "Failed to update order" });
    }
  }
);

// Cancel order
router.patch("/:id/cancel", authenticateToken, (async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const order = await prisma.order.findUnique({
      where: { id },
    });

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Customers can only cancel their own orders
    if (req.user!.role === "CUSTOMER" && order.userId !== req.user!.id) {
      return res.status(403).json({ message: "Forbidden" });
    }

    if (["DELIVERED", "CANCELLED"].includes(order.status)) {
      return res.status(400).json({ message: "Cannot cancel this order" });
    }

    const updatedOrder = await prisma.order.update({
      where: { id },
      data: {
        status: "CANCELLED",
        notes: reason
          ? `${order.notes || ""}\nCancellation reason: ${reason}`.trim()
          : order.notes,
      },
    });

    // Free the table
    if (order.tableId) {
      await prisma.table.update({
        where: { id: order.tableId },
        data: { status: "AVAILABLE" },
      });
    }

    res.json({
      message: "Order cancelled successfully",
      order: updatedOrder,
    });
  } catch (error) {
    console.error("Order cancellation error:", error);
    res.status(500).json({ message: "Failed to cancel order" });
  }
}) as RequestHandler);

// Get order statistics
router.get(
  "/stats/overview",
  authenticateToken,
  requireRole(["ADMIN", "MANAGER"]),
  async (req, res) => {
    try {
      const { startDate, endDate } = req.query;

      let dateFilter = {};
      if (startDate && endDate) {
        const end = new Date(endDate as string);
        end.setUTCHours(23, 59, 59, 999);
        dateFilter = {
          createdAt: {
            gte: new Date(startDate as string),
            lte: end,
          },
        };
      }

      const [
        totalOrders,
        completedOrders,
        cancelledOrders,
        pendingOrders,
        totalRevenue,
        ordersByType,
      ] = await Promise.all([
        prisma.order.count({ where: dateFilter }),
        prisma.order.count({ where: { ...dateFilter, status: "DELIVERED" } }),
        prisma.order.count({ where: { ...dateFilter, status: "CANCELLED" } }),
        prisma.order.count({
          where: {
            ...dateFilter,
            status: { in: ["PENDING", "CONFIRMED", "PREPARING", "READY"] },
          },
        }),
        prisma.order.aggregate({
          where: { ...dateFilter, status: "DELIVERED" },
          _sum: { totalAmount: true },
        }),
        prisma.order.groupBy({
          by: ["orderType"],
          where: dateFilter,
          _count: { id: true },
          _sum: { totalAmount: true },
        }),
      ]);

      const revenue = Number(totalRevenue._sum.totalAmount || 0);
      const averageOrderValue = completedOrders > 0 ? revenue / completedOrders : 0;

      // Get popular items
      const popularItems = await prisma.orderItem.groupBy({
        by: ["menuItemId"],
        where: {
          order: {
            ...dateFilter,
            status: "DELIVERED",
          },
        },
        _sum: { quantity: true, price: true },
        _count: { menuItemId: true },
        orderBy: { _sum: { quantity: "desc" } },
        take: 10,
      });

      const popularItemsWithDetails = await Promise.all(
        popularItems.map(async (item: any) => {
          const menuItem = await prisma.menuItem.findUnique({
            where: { id: item.menuItemId },
            select: { name: true, price: true },
          });
          return {
            ...item,
            menuItem,
          };
        })
      );

      res.json({
        stats: {
          totalOrders,
          completedOrders,
          cancelledOrders,
          pendingOrders,
          totalRevenue: revenue,
          averageOrderValue,
          completionRate:
            totalOrders > 0
              ? ((completedOrders / totalOrders) * 100).toFixed(2)
              : 0,
          ordersByType: ordersByType.map((t) => ({
            type: t.orderType,
            count: t._count.id,
            revenue: Number(t._sum.totalAmount || 0),
          })),
          popularItems: popularItemsWithDetails,
        },
      });
    } catch (error) {
      console.error("Order stats error:", error);
      res.status(500).json({ message: "Failed to fetch order statistics" });
    }
  }
);

// Get daily sales data
router.get(
  "/stats/daily-sales",
  authenticateToken,
  requireRole(["ADMIN", "MANAGER"]),
  async (req, res) => {
    try {
      const { days = "7" } = req.query;
      const daysCount = parseInt(days as string);

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysCount);
      startDate.setHours(0, 0, 0, 0);
      const dailySales = await prisma.$queryRaw`
        SELECT
          DATE("createdAt") as date,
          COUNT(*)::int as order_count,
          COALESCE(SUM("totalAmount"), 0)::float as total_revenue
        FROM "orders"
        WHERE "createdAt" >= ${startDate}
          AND status = 'DELIVERED'
        GROUP BY DATE("createdAt")
        ORDER BY date DESC
      `;

      res.json({ dailySales });
    } catch (error) {
      console.error("Daily sales error:", error);
      res.status(500).json({ message: "Failed to fetch daily sales data" });
    }
  }
);

// Delete order (Admin only - for cleanup purposes)
router.delete(
  "/:id",
  authenticateToken,
  requireRole(["ADMIN"]),
  async (req, res) => {
    try {
      const { id } = req.params;

      await prisma.order.delete({
        where: { id },
      });

      res.json({ message: "Order deleted successfully" });
    } catch (error) {
      console.error("Order deletion error:", error);
      res.status(500).json({ message: "Failed to delete order" });
    }
  }
);

export default router;
