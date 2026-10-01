import type { NextFunction, Request, Response } from "express";

import { HttpError } from "../errors/httpError.js";
import { taskStatuses, type TaskStatus } from "../models/task.js";

type RequestBody = Record<string, unknown>;

function isRequestBody(value: unknown): value is RequestBody {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateFields(body: RequestBody, isUpdate: boolean): string[] {
  const errors: string[] = [];
  const allowedFields = new Set(["title", "description", "status"]);
  const unknownFields = Object.keys(body).filter(
    (field) => !allowedFields.has(field),
  );

  if (unknownFields.length > 0) {
    errors.push(`Unknown fields: ${unknownFields.join(", ")}`);
  }

  if (!isUpdate && !Object.hasOwn(body, "title")) {
    errors.push("title is required");
  }

  if (
    Object.hasOwn(body, "title") &&
    (typeof body.title !== "string" || body.title.trim().length === 0)
  ) {
    errors.push("title must be a non-empty string");
  }

  if (
    Object.hasOwn(body, "description") &&
    typeof body.description !== "string"
  ) {
    errors.push("description must be a string");
  }

  if (
    Object.hasOwn(body, "status") &&
    (typeof body.status !== "string" ||
      !taskStatuses.includes(body.status as TaskStatus))
  ) {
    errors.push(`status must be one of: ${taskStatuses.join(", ")}`);
  }

  if (isUpdate && Object.keys(body).length === 0) {
    errors.push("At least one task field is required");
  }

  return errors;
}

function validateTaskBody(isUpdate: boolean) {
  return (request: Request, _response: Response, next: NextFunction): void => {
    if (!isRequestBody(request.body)) {
      next(
        new HttpError(
          400,
          "VALIDATION_ERROR",
          "Request body is invalid",
          ["body must be a JSON object"],
        ),
      );
      return;
    }

    const errors = validateFields(request.body, isUpdate);
    if (errors.length > 0) {
      next(
        new HttpError(
          400,
          "VALIDATION_ERROR",
          "Request validation failed",
          errors,
        ),
      );
      return;
    }

    if (typeof request.body.title === "string") {
      request.body.title = request.body.title.trim();
    }

    next();
  };
}

export const validateCreateTask = validateTaskBody(false);
export const validateUpdateTask = validateTaskBody(true);
