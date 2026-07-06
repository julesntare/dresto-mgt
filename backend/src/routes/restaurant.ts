// src/routes/restaurant.ts
import express, { RequestHandler } from "express";
import { prisma } from "../lib/prisma";
import { authenticateToken, requireRole } from "../middleware/auth";
import { RESTAURANT_SINGLETON_ID } from "../utils/helpers";

/**
 * @swagger
 * tags:
 *   name: Restaurant
 *   description: Single-row restaurant configuration (branding, channels, hours)
 */

const router = express.Router();

const SINGLETON_ID = RESTAURANT_SINGLETON_ID;

const DEFAULT_RESTAURANT = {
  id: SINGLETON_ID,
  name: "D'Resto",
};

/**
 * @swagger
 * /restaurant:
 *   get:
 *     summary: Get restaurant configuration (public — branding, channels, hours)
 *     tags: [Restaurant]
 *     responses:
 *       200:
 *         description: Restaurant configuration
 *   put:
 *     summary: Update restaurant configuration (Admin only)
 *     tags: [Restaurant]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Restaurant configuration updated
 *       403:
 *         description: Insufficient permissions
 */

// Get restaurant config (public — creates the default row on first read)
router.get("/", (async (_req, res) => {
  try {
    const restaurant = await prisma.restaurant.upsert({
      where: { id: SINGLETON_ID },
      update: {},
      create: DEFAULT_RESTAURANT,
    });

    res.json({ restaurant });
  } catch (error) {
    console.error("Restaurant fetch error:", error);
    res.status(500).json({ message: "Failed to fetch restaurant configuration" });
  }
}) as RequestHandler);

// Update restaurant config (Admin only)
router.put(
  "/",
  authenticateToken,
  requireRole(["ADMIN"]),
  (async (req, res) => {
    try {
      const {
        name,
        logoUrl,
        themeColor,
        currency,
        languages,
        dineInEnabled,
        takeawayEnabled,
        deliveryEnabled,
        serviceChargePct,
        vatEnabled,
        vatPct,
        deliveryFee,
        deliveryMinOrder,
        momoEnabled,
        airtelEnabled,
        cardEnabled,
        cashEnabled,
        openingHours,
        orderingBaseUrl,
      } = req.body;

      if (name !== undefined && !name.toString().trim()) {
        return res.status(400).json({ message: "Restaurant name cannot be empty" });
      }

      const data = {
        ...(name !== undefined && { name: name.toString().trim() }),
        ...(logoUrl !== undefined && { logoUrl: logoUrl?.toString().trim() || null }),
        ...(themeColor !== undefined && { themeColor: themeColor?.toString().trim() || null }),
        ...(currency !== undefined && { currency: currency.toString().trim() }),
        ...(languages !== undefined && { languages }),
        ...(dineInEnabled !== undefined && { dineInEnabled: Boolean(dineInEnabled) }),
        ...(takeawayEnabled !== undefined && { takeawayEnabled: Boolean(takeawayEnabled) }),
        ...(deliveryEnabled !== undefined && { deliveryEnabled: Boolean(deliveryEnabled) }),
        ...(serviceChargePct !== undefined && { serviceChargePct: serviceChargePct === null ? null : Number(serviceChargePct) }),
        ...(vatEnabled !== undefined && { vatEnabled: Boolean(vatEnabled) }),
        ...(vatPct !== undefined && { vatPct: vatPct === null ? null : Number(vatPct) }),
        ...(deliveryFee !== undefined && { deliveryFee: deliveryFee === null ? null : Number(deliveryFee) }),
        ...(deliveryMinOrder !== undefined && { deliveryMinOrder: deliveryMinOrder === null ? null : Number(deliveryMinOrder) }),
        ...(momoEnabled !== undefined && { momoEnabled: Boolean(momoEnabled) }),
        ...(airtelEnabled !== undefined && { airtelEnabled: Boolean(airtelEnabled) }),
        ...(cardEnabled !== undefined && { cardEnabled: Boolean(cardEnabled) }),
        ...(cashEnabled !== undefined && { cashEnabled: Boolean(cashEnabled) }),
        ...(openingHours !== undefined && { openingHours }),
        ...(orderingBaseUrl !== undefined && { orderingBaseUrl: orderingBaseUrl?.toString().trim() || null }),
      };

      const restaurant = await prisma.restaurant.upsert({
        where: { id: SINGLETON_ID },
        update: data,
        create: { ...DEFAULT_RESTAURANT, ...data },
      });

      res.json({ message: "Restaurant configuration updated successfully", restaurant });
    } catch (error) {
      console.error("Restaurant update error:", error);
      res.status(500).json({ message: "Failed to update restaurant configuration" });
    }
  }) as RequestHandler
);

export default router;
