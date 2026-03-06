import { body, validationResult } from "express-validator";
import { Request, Response, NextFunction } from "express";

export const handleValidationErrors = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({
      message: "Validation failed",
      errors: errors.array(),
    });
    return;
  }
  next();
};

// Auth validation rules
export const registerValidation = [
  body("email").isEmail().normalizeEmail(),
  body("password")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters"),
  body("name")
    .trim()
    .isLength({ min: 2 })
    .withMessage("Name must be at least 2 characters"),
  body("phone").optional().trim(),
];

export const loginValidation = [
  body("email").optional().isEmail().normalizeEmail(),
  body("phone").optional().trim(),
  body("password").notEmpty().withMessage("Password is required"),
  body().custom((_, { req }) => {
    if (!req.body.email && !req.body.phone) {
      throw new Error("Email or phone number is required");
    }
    return true;
  }),
];

// Menu item validation
export const menuItemValidation = [
  body("name").trim().isLength({ min: 1 }).withMessage("Name is required"),
  body("price")
    .isDecimal({ decimal_digits: "0,2" })
    .withMessage("Price must be a valid decimal"),
  body("categoryId").isString().withMessage("Category ID is required"),
  body("description").optional().trim(),
  body("isAvailable").optional().isBoolean(),
];

// Order validation
export const orderValidation = [
  body("customerName").optional().trim(),
  body("customerPhone").optional().trim(),
  body("orderType").isIn(["DINE_IN", "TAKEAWAY", "DELIVERY"]),
  body("tableNumber").optional().trim(),
  body("items")
    .isArray({ min: 1 })
    .withMessage("Order must contain at least one item"),
  body("items.*.menuItemId").isString().withMessage("Menu item ID is required"),
  body("items.*.quantity")
    .isInt({ min: 1 })
    .withMessage("Quantity must be at least 1"),
];
