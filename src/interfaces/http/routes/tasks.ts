import { contentJson, OpenAPIRoute } from "chanfana";
import type { Context } from "hono";
import { z } from "zod";
import { CreateTaskUseCase } from "../../../application/tasks/create-task.usecase";
import { GetTaskUseCase } from "../../../application/tasks/get-task.usecase";
import { HardDeleteTaskUseCase } from "../../../application/tasks/hard-delete-task.usecase";
import { ListTasksUseCase } from "../../../application/tasks/list-tasks.usecase";
import { SoftDeleteTaskUseCase } from "../../../application/tasks/soft-delete-task.usecase";
import {
	toTaskDetailDTO,
	toTaskListDTO,
} from "../../../application/tasks/task.dto";
import { UpdateTaskUseCase } from "../../../application/tasks/update-task.usecase";
import type { Bindings, Variables } from "../../../config/bindings";
import { getAuth } from "../../../infrastructure/auth";
import { DatabaseFactory } from "../../../infrastructure/database/client";
import { D1TaskRepository } from "../../../infrastructure/database/repositories/task.repository";
import {
	handleError,
	UnauthorizedError,
	ValidationError,
} from "../middleware/error-handler";
import {
	type CreateTaskInput,
	CreateTaskSchema,
	ListTasksBySubjectSchema,
	type UpdateTaskInput,
	UpdateTaskSchema,
} from "../validators/task.validator";

type HonoContext = { Bindings: Bindings; Variables: Variables };
type TaskContext = Context<HonoContext>;

const ErrorResponseSchema = z.object({ error: z.string() });

const TaskListItemSchema = z.object({
	id: z.string(),
	subject_id: z.string(),
	title: z.string(),
	due_date: z.string().nullable(),
	status: z.enum(["todo", "doing", "done"]),
	grade: z.number().nullable(),
	created_at: z.string(),
	updated_at: z.string(),
});

const TaskResourceSchema = z.object({
	id: z.string(),
	original_filename: z.string(),
	mime_type: z.string(),
	size_bytes: z.number(),
	association_type: z.string(),
});

const TaskDetailSchema = z.object({
	id: z.string(),
	subject_id: z.string(),
	title: z.string(),
	due_date: z.string().nullable(),
	status: z.enum(["todo", "doing", "done"]),
	content: z.string().nullable(),
	grade: z.number().nullable(),
	is_deleted: z.number(),
	deleted_at: z.string().nullable(),
	created_at: z.string(),
	updated_at: z.string(),
	resources: z.array(TaskResourceSchema),
});

const TaskCreateResponseSchema = z.object({
	id: z.string(),
	subject_id: z.string(),
	title: z.string(),
	due_date: z.string().nullable(),
	status: z.enum(["todo", "doing", "done"]),
	content: z.string().nullable(),
	grade: z.number().nullable(),
	created_at: z.string(),
	updated_at: z.string(),
});

const TaskUpdateResponseSchema = z.object({
	id: z.string(),
	subject_id: z.string(),
	title: z.string(),
	due_date: z.string().nullable(),
	status: z.enum(["todo", "doing", "done"]),
	grade: z.number().nullable(),
	updated_at: z.string(),
});

const TaskSoftDeleteSchema = z.object({
	id: z.string(),
	is_deleted: z.number(),
	deleted_at: z.string().nullable(),
});

const SuccessListResponse = z.object({
	success: z.literal(true),
	result: z.array(TaskListItemSchema),
});

const SuccessDetailResponse = z.object({
	success: z.literal(true),
	result: TaskDetailSchema,
});

const SuccessCreateResponse = z.object({
	success: z.literal(true),
	result: TaskCreateResponseSchema,
});

const SuccessUpdateResponse = z.object({
	success: z.literal(true),
	result: TaskUpdateResponseSchema,
});

const SuccessSoftDeleteResponse = z.object({
	success: z.literal(true),
	result: TaskSoftDeleteSchema,
});

const SuccessHardDeleteResponse = z.object({
	success: z.literal(true),
	result: z.object({ id: z.string() }),
});

function ensureAuthenticatedUser(c: TaskContext): string {
	const auth = getAuth(c);
	if (!auth?.userId) {
		throw new UnauthorizedError();
	}
	return auth.userId;
}

function getTaskRepository(c: TaskContext) {
	const db = DatabaseFactory.create(c.env.DB);
	return new D1TaskRepository(db);
}

function validateCreatePayload(body: unknown): CreateTaskInput {
	const result = CreateTaskSchema.safeParse(body);
	if (!result.success) {
		throw new ValidationError(
			result.error.errors
				.map((issue) => `${issue.path.join(".")}: ${issue.message}`)
				.join("; "),
		);
	}
	return {
		title: result.data.title,
		subjectId: result.data.subject_id,
		dueDate: result.data.due_date ?? null,
		status: result.data.status,
		content: result.data.content ?? null,
		grade: result.data.grade ?? null,
	};
}

function validateUpdatePayload(body: unknown): UpdateTaskInput {
	const result = UpdateTaskSchema.safeParse(body);
	if (!result.success) {
		throw new ValidationError(
			result.error.errors
				.map((issue) => `${issue.path.join(".")}: ${issue.message}`)
				.join("; "),
		);
	}
	return {
		title: result.data.title,
		dueDate: result.data.due_date,
		status: result.data.status,
		content: result.data.content,
		grade: result.data.grade,
	};
}

function extractTaskId(c: TaskContext): string {
	const taskId = c.req.param("id");
	if (!taskId) {
		throw new ValidationError("Task ID is required");
	}
	return taskId;
}

function validateSubjectIdQuery(query: Record<string, string>): string {
	const result = ListTasksBySubjectSchema.safeParse(query);
	if (!result.success) {
		throw new ValidationError(
			result.error.errors
				.map((issue) => `${issue.path.join(".")}: ${issue.message}`)
				.join("; "),
		);
	}
	return result.data.subject_id;
}

async function listTasks(c: TaskContext) {
	try {
		const userId = ensureAuthenticatedUser(c);
		const query = c.req.query();
		const subjectId = validateSubjectIdQuery(query);
		const taskRepository = getTaskRepository(c);
		const listTasksUseCase = new ListTasksUseCase(taskRepository);
		const tasks = await listTasksUseCase.execute(userId, subjectId);

		return c.json(
			{
				success: true,
				result: tasks.map((task) => toTaskListDTO(task)),
			},
			200,
		);
	} catch (error) {
		return handleError(error, c);
	}
}

async function getTask(c: TaskContext) {
	try {
		const userId = ensureAuthenticatedUser(c);
		const taskId = extractTaskId(c);
		const taskRepository = getTaskRepository(c);
		const useCase = new GetTaskUseCase(taskRepository);
		const task = await useCase.execute(userId, taskId);

		return c.json(
			{
				success: true,
				result: toTaskDetailDTO(task),
			},
			200,
		);
	} catch (error) {
		return handleError(error, c);
	}
}

async function createTask(c: TaskContext) {
	try {
		const userId = ensureAuthenticatedUser(c);
		const payload = validateCreatePayload(await c.req.json());
		const taskRepository = getTaskRepository(c);
		const useCase = new CreateTaskUseCase(taskRepository);
		const task = await useCase.execute(userId, payload);

		return c.json(
			{
				success: true,
				result: {
					id: task.id,
					subject_id: task.subjectId,
					title: task.title,
					due_date: task.dueDate,
					status: task.status,
					content: task.content,
					grade: task.grade,
					created_at: task.createdAt,
					updated_at: task.updatedAt,
				},
			},
			201,
		);
	} catch (error) {
		return handleError(error, c);
	}
}

async function updateTask(c: TaskContext) {
	try {
		const userId = ensureAuthenticatedUser(c);
		const taskId = extractTaskId(c);
		const payload = validateUpdatePayload(await c.req.json());
		const taskRepository = getTaskRepository(c);
		const useCase = new UpdateTaskUseCase(taskRepository);
		const task = await useCase.execute(userId, taskId, payload);

		return c.json(
			{
				success: true,
				result: {
					id: task.id,
					subject_id: task.subjectId,
					title: task.title,
					due_date: task.dueDate,
					status: task.status,
					grade: task.grade,
					updated_at: task.updatedAt,
				},
			},
			200,
		);
	} catch (error) {
		return handleError(error, c);
	}
}

async function softDeleteTask(c: TaskContext) {
	try {
		const userId = ensureAuthenticatedUser(c);
		const taskId = extractTaskId(c);
		const taskRepository = getTaskRepository(c);
		const useCase = new SoftDeleteTaskUseCase(taskRepository);
		const task = await useCase.execute(userId, taskId);

		return c.json(
			{
				success: true,
				result: {
					id: task.id,
					is_deleted: task.isDeleted,
					deleted_at: task.deletedAt ?? null,
				},
			},
			200,
		);
	} catch (error) {
		return handleError(error, c);
	}
}

async function hardDeleteTask(c: TaskContext) {
	try {
		const userId = ensureAuthenticatedUser(c);
		const taskId = extractTaskId(c);
		const taskRepository = getTaskRepository(c);
		const useCase = new HardDeleteTaskUseCase(taskRepository);
		const task = await useCase.execute(userId, taskId);

		return c.json(
			{
				success: true,
				result: {
					id: task.id,
				},
			},
			200,
		);
	} catch (error) {
		return handleError(error, c);
	}
}

export class ListTasksEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Tasks"],
		summary: "List tasks for a subject",
		description:
			"List all non-deleted tasks for a specific subject. Requires subject_id query parameter.",
		request: {
			query: ListTasksBySubjectSchema,
		},
		responses: {
			"200": {
				description: "List of tasks returned",
				...contentJson(SuccessListResponse),
			},
			"400": {
				description: "Missing or invalid query parameters",
				...contentJson(ErrorResponseSchema),
			},
			"401": {
				description: "Missing or invalid authentication",
				...contentJson(ErrorResponseSchema),
			},
			"500": {
				description: "Internal server error",
				...contentJson(ErrorResponseSchema),
			},
		},
	};

	async handle(c: TaskContext) {
		return listTasks(c);
	}
}

export class GetTaskEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Tasks"],
		summary: "Get a task by ID",
		description:
			"Retrieve a single task with all details and associated files.",
		request: {
			params: z.object({ id: z.string().min(1, "Task ID is required") }),
		},
		responses: {
			"200": {
				description: "Task returned with details and resources",
				...contentJson(SuccessDetailResponse),
			},
			"400": {
				description: "Invalid request parameters",
				...contentJson(ErrorResponseSchema),
			},
			"401": {
				description: "Missing or invalid authentication",
				...contentJson(ErrorResponseSchema),
			},
			"404": {
				description: "Task not found",
				...contentJson(ErrorResponseSchema),
			},
			"500": {
				description: "Internal server error",
				...contentJson(ErrorResponseSchema),
			},
		},
	};

	async handle(c: TaskContext) {
		return getTask(c);
	}
}

export class CreateTaskEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Tasks"],
		summary: "Create a new task",
		description:
			"Create a new task within a subject for the authenticated user.",
		request: {
			body: contentJson(CreateTaskSchema),
		},
		responses: {
			"201": {
				description: "Task created successfully",
				...contentJson(SuccessCreateResponse),
			},
			"400": {
				description: "Invalid request body",
				...contentJson(ErrorResponseSchema),
			},
			"401": {
				description: "Missing or invalid authentication",
				...contentJson(ErrorResponseSchema),
			},
			"500": {
				description: "Internal server error",
				...contentJson(ErrorResponseSchema),
			},
		},
	};

	async handle(c: TaskContext) {
		return createTask(c);
	}
}

export class UpdateTaskEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Tasks"],
		summary: "Update an existing task",
		description: "Update an existing task belonging to the authenticated user.",
		request: {
			params: z.object({ id: z.string().min(1, "Task ID is required") }),
			body: contentJson(UpdateTaskSchema),
		},
		responses: {
			"200": {
				description: "Task updated successfully",
				...contentJson(SuccessUpdateResponse),
			},
			"400": {
				description: "Invalid request parameters or body",
				...contentJson(ErrorResponseSchema),
			},
			"401": {
				description: "Missing or invalid authentication",
				...contentJson(ErrorResponseSchema),
			},
			"404": {
				description: "Task not found",
				...contentJson(ErrorResponseSchema),
			},
			"500": {
				description: "Internal server error",
				...contentJson(ErrorResponseSchema),
			},
		},
	};

	async handle(c: TaskContext) {
		return updateTask(c);
	}
}

export class SoftDeleteTaskEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Tasks"],
		summary: "Soft delete a task",
		description: "Soft delete a task without permanently removing data.",
		request: {
			params: z.object({ id: z.string().min(1, "Task ID is required") }),
		},
		responses: {
			"200": {
				description: "Task soft deleted successfully",
				...contentJson(SuccessSoftDeleteResponse),
			},
			"400": {
				description: "Invalid request parameters",
				...contentJson(ErrorResponseSchema),
			},
			"401": {
				description: "Missing or invalid authentication",
				...contentJson(ErrorResponseSchema),
			},
			"404": {
				description: "Task not found",
				...contentJson(ErrorResponseSchema),
			},
			"500": {
				description: "Internal server error",
				...contentJson(ErrorResponseSchema),
			},
		},
	};

	async handle(c: TaskContext) {
		return softDeleteTask(c);
	}
}

export class HardDeleteTaskEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Tasks"],
		summary: "Hard delete a task",
		description:
			"Irreversibly delete a task and cascade the removal to all related resources.",
		request: {
			params: z.object({ id: z.string().min(1, "Task ID is required") }),
		},
		responses: {
			"200": {
				description: "Task hard deleted successfully",
				...contentJson(SuccessHardDeleteResponse),
			},
			"400": {
				description: "Invalid request parameters",
				...contentJson(ErrorResponseSchema),
			},
			"401": {
				description: "Missing or invalid authentication",
				...contentJson(ErrorResponseSchema),
			},
			"404": {
				description: "Task not found",
				...contentJson(ErrorResponseSchema),
			},
			"500": {
				description: "Internal server error",
				...contentJson(ErrorResponseSchema),
			},
		},
	};

	async handle(c: TaskContext) {
		return hardDeleteTask(c);
	}
}
