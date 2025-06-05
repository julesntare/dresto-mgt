import { ErrorRequestHandler } from "express";

export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  console.error("Error:", err);

  // Prisma errors
  if (err.code === "P2002") {
    res.status(409).json({
      message: "Duplicate entry",
      field: err.meta?.target?.[0] || "unknown",
    });
    return;
  }

  if (err.code === "P2025") {
    res.status(404).json({
      message: "Record not found",
    });
    return;
  }

  // Validation errors
  if (err.name === "ValidationError") {
    res.status(400).json({
      message: "Validation error",
      errors: err.errors,
    });
    return;
  }

  // JWT errors
  if (err.name === "JsonWebTokenError") {
    res.status(401).json({
      message: "Invalid token",
    });
    return;
  }

  if (err.name === "TokenExpiredError") {
    res.status(401).json({
      message: "Token expired",
    });
    return;
  }

  // Default error
  res.status(err.status || 500).json({
    message: err.message || "Internal server error",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
  return;
};
