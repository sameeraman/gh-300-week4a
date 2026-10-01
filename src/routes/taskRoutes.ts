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

function getTaskId(value: string | string[] | undefined): string {
  if (typeof value !== "string") {
    throw new HttpError(400, "INVALID_TASK_ID", "Task ID is invalid");
  }

  return value;
}

taskRouter.get("/", (_request, response) => {
  response.status(200).json({ tasks: listTasks() });
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
