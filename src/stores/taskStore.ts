import { randomUUID } from "node:crypto";

import type {
  CreateTaskInput,
  Task,
  UpdateTaskInput,
} from "../models/task.js";

const tasks: Task[] = [];

export function listTasks(): Task[] {
  return tasks.map((task) => ({ ...task }));
}

export function findTask(id: string): Task | undefined {
  const task = tasks.find((candidate) => candidate.id === id);
  return task ? { ...task } : undefined;
}

export function createTask(input: CreateTaskInput): Task {
  const now = new Date().toISOString();
  const task: Task = {
    id: randomUUID(),
    title: input.title,
    description: input.description ?? "",
    status: input.status ?? "todo",
    createdAt: now,
    updatedAt: now,
  };

  tasks.push(task);
  return { ...task };
}

export function updateTask(
  id: string,
  input: UpdateTaskInput,
): Task | undefined {
  const index = tasks.findIndex((task) => task.id === id);
  const existingTask = tasks[index];

  if (index === -1 || existingTask === undefined) {
    return undefined;
  }

  const updatedTask: Task = {
    ...existingTask,
    ...input,
    updatedAt: new Date().toISOString(),
  };
  tasks[index] = updatedTask;

  return { ...updatedTask };
}

export function deleteTask(id: string): boolean {
  const index = tasks.findIndex((task) => task.id === id);

  if (index === -1) {
    return false;
  }

  tasks.splice(index, 1);
  return true;
}

export function clearTasks(): void {
  tasks.length = 0;
}
