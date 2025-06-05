import { Request, Response, NextFunction } from "express";

export const errorHandler = (
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error("Error:", error);

  // Prisma errors
  if (error.code === "P2002") {
    return res.status(409).json({
      message: "Duplicate entry",
      field: error.meta?.target?.[0] || "unknown",
    });
  }

  if (error.code === "P2025") {
    return res.status(404).json({
      message: "Record not found",
    });
  }

  // Validation errors
  if (error.name === "ValidationError") {
    return res.status(400).json({
      message: "Validation error",
      errors: error.errors,
    });
  }

  // JWT errors
  if (error.name === "JsonWebTokenError") {
    return res.status(401).json({
      message: "Invalid token",
    });
  }

  if (error.name === "TokenExpiredError") {
    return res.status(401).json({
      message: "Token expired",
    });
  }

  // Default error
  res.status(error.status || 500).json({
    message: error.message || "Internal server error",
    ...(process.env.NODE_ENV === "development" && { stack: error.stack }),
  });
};
