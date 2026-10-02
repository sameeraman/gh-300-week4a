import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";

import { app } from "../src/app.js";
import { clearTasks } from "../src/stores/taskStore.js";

describe("task management API", () => {
  beforeEach(() => {
    clearTasks();
  });

  it("reports health with a 200 status", async () => {
    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
  });

  it("lists tasks with a 200 status", async () => {
    const response = await request(app).get("/tasks");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: [],
      nextCursor: null,
      hasMore: false,
    });
  });

  it("paginates tasks in createdAt descending order", async () => {
    const createdTasks = await Promise.all(
      ["First task", "Second task", "Third task"].map((title) =>
        request(app).post("/tasks").send({ title }),
      ),
    );
    const expectedTasks = createdTasks
      .map((response) => response.body.task)
      .sort(
        (left, right) =>
          right.createdAt.localeCompare(left.createdAt) ||
          right.id.localeCompare(left.id),
      );

    const firstPage = await request(app).get("/tasks?limit=2");

    expect(firstPage.status).toBe(200);
    expect(firstPage.body.data.map((task: { id: string }) => task.id)).toEqual(
      expectedTasks.slice(0, 2).map((task) => task.id),
    );
    expect(firstPage.body.hasMore).toBe(true);
    expect(firstPage.body.nextCursor).toBe(
      Buffer.from(expectedTasks[1].id).toString("base64"),
    );

    const secondPage = await request(app).get(
      `/tasks?limit=2&cursor=${encodeURIComponent(firstPage.body.nextCursor)}`,
    );

    expect(secondPage.status).toBe(200);
    expect(secondPage.body.data.map((task: { id: string }) => task.id)).toEqual(
      expectedTasks.slice(2).map((task) => task.id),
    );
    expect(secondPage.body).toMatchObject({
      nextCursor: null,
      hasMore: false,
    });
  });

  it("uses a default page size of 20", async () => {
    await Promise.all(
      Array.from({ length: 21 }, (_, index) =>
        request(app).post("/tasks").send({ title: `Task ${index}` }),
      ),
    );

    const response = await request(app).get("/tasks");

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(20);
    expect(response.body.hasMore).toBe(true);
    expect(response.body.nextCursor).toEqual(expect.any(String));
  });

  it.each(["0", "-1", "101", "abc", "1.5"])(
    "rejects invalid task list limit %s",
    async (limit) => {
      const response = await request(app).get(`/tasks?limit=${limit}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toMatchObject({
        code: "INVALID_LIMIT",
        message: "Limit must be an integer between 1 and 100",
      });
    },
  );

  it("rejects invalid task list cursors", async () => {
    const response = await request(app).get("/tasks?cursor=not-base64");

    expect(response.status).toBe(400);
    expect(response.body.error).toMatchObject({
      code: "INVALID_CURSOR",
      message: "Cursor must be a base64-encoded task ID",
    });
  });

  it("rejects cursors that do not identify an existing task", async () => {
    const cursor = Buffer.from("missing-task").toString("base64");
    const response = await request(app).get(
      `/tasks?cursor=${encodeURIComponent(cursor)}`,
    );

    expect(response.status).toBe(400);
    expect(response.body.error).toMatchObject({
      code: "INVALID_CURSOR",
      message: "Cursor does not identify an existing task",
    });
  });

  it("creates a task with a 201 status", async () => {
    const response = await request(app).post("/tasks").send({
      title: "Write tests",
      description: "Cover the task API",
      status: "in-progress",
    });

    expect(response.status).toBe(201);
    expect(response.body.task).toMatchObject({
      title: "Write tests",
      description: "Cover the task API",
      status: "in-progress",
    });
    expect(response.body.task.id).toEqual(expect.any(String));
    expect(response.body.task.createdAt).toEqual(expect.any(String));
    expect(response.body.task.updatedAt).toEqual(expect.any(String));
  });

  it("gets an existing task with a 200 status", async () => {
    const created = await request(app)
      .post("/tasks")
      .send({ title: "Read task" });

    const response = await request(app).get(`/tasks/${created.body.task.id}`);

    expect(response.status).toBe(200);
    expect(response.body.task.id).toBe(created.body.task.id);
  });

  it("returns a 404 status when getting a missing task", async () => {
    const response = await request(app).get("/tasks/missing");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: {
        code: "TASK_NOT_FOUND",
        message: "Task was not found",
      },
    });
  });

  it("updates an existing task with a 200 status", async () => {
    const created = await request(app)
      .post("/tasks")
      .send({ title: "Initial title" });

    const response = await request(app)
      .put(`/tasks/${created.body.task.id}`)
      .send({ title: "Updated title", status: "done" });

    expect(response.status).toBe(200);
    expect(response.body.task).toMatchObject({
      id: created.body.task.id,
      title: "Updated title",
      status: "done",
    });
  });

  it("returns a 404 status when updating a missing task", async () => {
    const response = await request(app)
      .put("/tasks/missing")
      .send({ title: "Updated title" });

    expect(response.status).toBe(404);
  });

  it("deletes an existing task with a 204 status", async () => {
    const created = await request(app)
      .post("/tasks")
      .send({ title: "Delete task" });

    const response = await request(app).delete(
      `/tasks/${created.body.task.id}`,
    );

    expect(response.status).toBe(204);
    expect(response.text).toBe("");
  });

  it("returns a 404 status when deleting a missing task", async () => {
    const response = await request(app).delete("/tasks/missing");

    expect(response.status).toBe(404);
  });

  it("returns a consistent validation error for invalid input", async () => {
    const response = await request(app)
      .post("/tasks")
      .send({ title: "", status: "blocked" });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatchObject({
      code: "VALIDATION_ERROR",
      message: "Request validation failed",
    });
    expect(response.body.error.details).toEqual(expect.any(Array));
  });
});
