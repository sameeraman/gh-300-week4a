import { Router } from "express";

import { HttpError } from "../errors/httpError.js";
import {
  validateCreateTask,
  validateUpdateTask,
} from "../middleware/validation.js";
import type {
  CreateTaskInput,
  UpdateTaskInput,
} from "../models/task.js";
import {
  createTask,
  deleteTask,
  findTask,
  listTasks,
  updateTask,
} from "../stores/taskStore.js";

export const taskRouter = Router();

const DEFAULT_TASK_LIMIT = 20;
const MAX_TASK_LIMIT = 100;

function getTaskId(value: string | string[] | undefined): string {
  if (typeof value !== "string") {
    throw new HttpError(400, "INVALID_TASK_ID", "Task ID is invalid");
  }

  return value;
}

function getTaskLimit(value: unknown): number {
  if (value === undefined) {
    return DEFAULT_TASK_LIMIT;
  }

  if (
    typeof value !== "string" ||
    !/^[1-9]\d*$/.test(value) ||
    Number(value) > MAX_TASK_LIMIT
  ) {
    throw new HttpError(
      400,
      "INVALID_LIMIT",
      `Limit must be an integer between 1 and ${MAX_TASK_LIMIT}`,
    );
  }

  return Number(value);
}

function getCursorTaskId(value: unknown): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (
    typeof value !== "string" ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
      value,
    ) ||
    value.length === 0
  ) {
    throw new HttpError(
      400,
      "INVALID_CURSOR",
      "Cursor must be a base64-encoded task ID",
    );
  }

  const taskId = Buffer.from(value, "base64").toString("utf8");
  if (!taskId || Buffer.from(taskId, "utf8").toString("base64") !== value) {
    throw new HttpError(
      400,
      "INVALID_CURSOR",
      "Cursor must be a base64-encoded task ID",
    );
  }

  return taskId;
}

taskRouter.get("/", (request, response) => {
  const limit = getTaskLimit(request.query.limit);
  const cursorTaskId = getCursorTaskId(request.query.cursor);
  const tasks = listTasks();
  const cursorIndex =
    cursorTaskId === undefined
      ? -1
      : tasks.findIndex((task) => task.id === cursorTaskId);

  if (cursorTaskId !== undefined && cursorIndex === -1) {
    throw new HttpError(
      400,
      "INVALID_CURSOR",
      "Cursor does not identify an existing task",
    );
  }

  const page = tasks.slice(cursorIndex + 1, cursorIndex + limit + 2);
  const hasMore = page.length > limit;
  const data = page.slice(0, limit);
  const lastTask = data[data.length - 1];

  response.status(200).json({
    data,
    nextCursor:
      hasMore && lastTask
        ? Buffer.from(lastTask.id, "utf8").toString("base64")
        : null,
    hasMore,
  });
});

taskRouter.get("/:id", (request, response, next) => {
  const task = findTask(getTaskId(request.params.id));
  if (!task) {
    next(new HttpError(404, "TASK_NOT_FOUND", "Task was not found"));
    return;
  }

  response.status(200).json({ task });
});

taskRouter.post("/", validateCreateTask, (request, response) => {
  const task = createTask(request.body as CreateTaskInput);
  response.status(201).json({ task });
});

taskRouter.put("/:id", validateUpdateTask, (request, response, next) => {
  const task = updateTask(
    getTaskId(request.params.id),
    request.body as UpdateTaskInput,
  );
  if (!task) {
    next(new HttpError(404, "TASK_NOT_FOUND", "Task was not found"));
    return;
  }

  response.status(200).json({ task });
});

taskRouter.delete("/:id", (request, response, next) => {
  if (!deleteTask(getTaskId(request.params.id))) {
    next(new HttpError(404, "TASK_NOT_FOUND", "Task was not found"));
    return;
  }

  response.status(204).send();
});
