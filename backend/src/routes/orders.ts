// src/routes/orders.ts
import express, { RequestHandler } from 'express';
import { prisma } from '../lib/prisma';
import { authenticateToken, requireRole } from '../middleware/auth';
import { orderValidation, handleValidationErrors } from '../utils/validation';
import { generateOrderNumber, calculateOrderTotal } from '../utils/helpers';

const router = express.Router();

// Get all orders with filters
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { status, orderType, startDate, endDate, page = '1', limit = '10' } = req.query;
    
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};
    
    if (status) where.status = status;
    if (orderType) where.orderType = orderType;
    if (startDate && endDate) {
      where.createdAt = {
        gte: new Date(startDate as string),
        lte: new Date(endDate as string)
      };
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          orderItems: {
            include: {
              menuItem: {
                select: { id: true, name: true, price: true }
              }
            }
          },
          user: {
            select: { id: true, name: true, email: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum
      }),
      prisma.order.count({ where })
    ]);

    res.json({
      orders,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Orders fetch error:', error);
    res.status(500).json({ message: 'Failed to fetch orders' });
  }
});

// Get single order
router.get('/:id', authenticateToken, (async (req, res) => {
  try {
    const { id } = req.params;
    
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        orderItems: {
          include: {
            menuItem: {
              select: { id: true, name: true, price: true, image: true }
            }
          }
        },
        user: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    res.json({ order });
  } catch (error) {
    console.error('Order fetch error:', error);
    res.status(500).json({ message: 'Failed to fetch order' });
  }
}) as RequestHandler);

// Create new order
router.post('/', authenticateToken, orderValidation, handleValidationErrors, (async (req, res) => {
  try {
    const { customerName, customerPhone, orderType, tableNumber, notes, items } = req.body;
    const userId = req.user!.id;

    // Validate menu items and calculate total
    const menuItemIds = items.map((item: any) => item.menuItemId);
    const menuItems = await prisma.menuItem.findMany({
      where: {
        id: { in: menuItemIds },
        isAvailable: true
      }
    });

    if (menuItems.length !== menuItemIds.length) {
      return res.status(400).json({ message: 'Some menu items are not available' });
    }

    // Calculate order total
    let totalAmount = 0;
    const orderItemsData = items.map((item: any) => {
      const menuItem = menuItems.find(mi => mi.id === item.menuItemId);
      if (!menuItem) throw new Error('Menu item not found');
      
      const itemTotal = parseFloat(menuItem.price.toString()) * item.quantity;
      totalAmount += itemTotal;
      
      return {
        menuItemId: item.menuItemId,
        quantity: item.quantity,
        price: menuItem.price
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
        tableNumber,
        notes,
        userId,
        orderItems: {
          create: orderItemsData
        }
      },
      include: {
        orderItems: {
          include: {
            menuItem: {
              select: { id: true, name: true, price: true }
            }
          }
        },
        user: {
          select: { id: true, name: true }
        }
      }
    });

    res.status(201).json({
      message: 'Order created successfully',
      order
    });
  } catch (error) {
    console.error('Order creation error:', error);
    res.status(500).json({ message: 'Failed to create order' });
  }
}) as RequestHandler);

// Update order status
router.patch('/:id/status', authenticateToken, (async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'DELIVERED', 'CANCELLED'];
    
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const order = await prisma.order.update({
      where: { id },
      data: { status },
      include: {
        orderItems: {
          include: {
            menuItem: {
              select: { id: true, name: true }
            }
          }
        }
      }
    });

    res.json({
      message: 'Order status updated successfully',
      order
    });
  } catch (error) {
    console.error('Order status update error:', error);
    res.status(500).json({ message: 'Failed to update order status' });
  }
}) as RequestHandler);

// Update order details (Admin/Manager only)
router.put('/:id', authenticateToken, requireRole(['ADMIN', 'MANAGER']), async (req, res) => {
  try {
    const { id } = req.params;
    const { customerName, customerPhone, orderType, tableNumber, notes } = req.body;

    const order = await prisma.order.update({
      where: { id },
      data: {
        customerName,
        customerPhone,
        orderType,
        tableNumber,
        notes
      },
      include: {
        orderItems: {
          include: {
            menuItem: {
              select: { id: true, name: true, price: true }
            }
          }
        }
      }
    });

    res.json({
      message: 'Order updated successfully',
      order
    });
  } catch (error) {
    console.error('Order update error:', error);
    res.status(500).json({ message: 'Failed to update order' });
  }
});

// Cancel order
router.patch('/:id/cancel', authenticateToken, (async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const order = await prisma.order.findUnique({
      where: { id }
    });

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (['DELIVERED', 'CANCELLED'].includes(order.status)) {
      return res.status(400).json({ message: 'Cannot cancel this order' });
    }

    const updatedOrder = await prisma.order.update({
      where: { id },
      data: { 
        status: 'CANCELLED',
        notes: reason ? `${order.notes || ''}\nCancellation reason: ${reason}`.trim() : order.notes
      }
    });

    res.json({
      message: 'Order cancelled successfully',
      order: updatedOrder
    });
  } catch (error) {
    console.error('Order cancellation error:', error);
    res.status(500).json({ message: 'Failed to cancel order' });
  }
}) as RequestHandler);

// Get order statistics
router.get('/stats/overview', authenticateToken, requireRole(['ADMIN', 'MANAGER']), async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const dateFilter = startDate && endDate ? {
      createdAt: {
        gte: new Date(startDate as string),
        lte: new Date(endDate as string)
      }
    } : {};

    const [
      totalOrders,
      completedOrders,
      cancelledOrders,
      pendingOrders,
      totalRevenue
    ] = await Promise.all([
      prisma.order.count({ where: dateFilter }),
      prisma.order.count({ where: { ...dateFilter, status: 'DELIVERED' } }),
      prisma.order.count({ where: { ...dateFilter, status: 'CANCELLED' } }),
      prisma.order.count({ where: { ...dateFilter, status: { in: ['PENDING', 'CONFIRMED', 'PREPARING', 'READY'] } } }),
      prisma.order.aggregate({
        where: { ...dateFilter, status: 'DELIVERED' },
        _sum: { totalAmount: true }
      })
    ]);

    // Get popular items
    const popularItems = await prisma.orderItem.groupBy({
      by: ['menuItemId'],
      where: {
        order: {
          ...dateFilter,
          status: 'DELIVERED'
        }
      },
      _sum: { quantity: true },
      _count: { menuItemId: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 10
    });

    const popularItemsWithDetails = await Promise.all(
      popularItems.map(async (item) => {
        const menuItem = await prisma.menuItem.findUnique({
          where: { id: item.menuItemId },
          select: { name: true, price: true }
        });
        return {
          ...item,
          menuItem
        };
      })
    );

    res.json({
      stats: {
        totalOrders,
        completedOrders,
        cancelledOrders,
        pendingOrders,
        totalRevenue: totalRevenue._sum.totalAmount || 0,
        completionRate: totalOrders > 0 ? (completedOrders / totalOrders * 100).toFixed(2) : 0
      },
      popularItems: popularItemsWithDetails
    });
  } catch (error) {
    console.error('Order stats error:', error);
    res.status(500).json({ message: 'Failed to fetch order statistics' });
  }
});

// Get daily sales data
router.get('/stats/daily-sales', authenticateToken, requireRole(['ADMIN', 'MANAGER']), async (req, res) => {
  try {
    const { days = '7' } = req.query;
    const daysCount = parseInt(days as string);
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysCount);
    startDate.setHours(0, 0, 0, 0);

    const dailySales = await prisma.$queryRaw`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as order_count,
        SUM(total_amount) as total_revenue
      FROM orders 
      WHERE created_at >= ${startDate} 
        AND status = 'DELIVERED'
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `;

    res.json({ dailySales });
  } catch (error) {
    console.error('Daily sales error:', error);
    res.status(500).json({ message: 'Failed to fetch daily sales data' });
  }
});

// Delete order (Admin only - for cleanup purposes)
router.delete('/:id', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.order.delete({
      where: { id }
    });

    res.json({ message: 'Order deleted successfully' });
  } catch (error) {
    console.error('Order deletion error:', error);
    res.status(500).json({ message: 'Failed to delete order' });
  }
});

export default router;