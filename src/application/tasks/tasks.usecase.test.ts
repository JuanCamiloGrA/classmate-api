import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
	Task,
	TaskListItem,
	TaskWithResources,
} from "../../domain/entities/task";
import type { TaskRepository } from "../../domain/repositories/task.repository";
import { ValidationError } from "../../interfaces/http/middleware/error-handler";
import { CreateTaskUseCase } from "./create-task.usecase";
import { GetTaskUseCase } from "./get-task.usecase";
import { HardDeleteTaskUseCase } from "./hard-delete-task.usecase";
import { ListTasksUseCase } from "./list-tasks.usecase";
import { SoftDeleteTaskUseCase } from "./soft-delete-task.usecase";
import { UpdateTaskUseCase } from "./update-task.usecase";

// Mock task data
const mockTask: Task = {
	id: "task-550e8400-e29b-41d4-a716-446655440000",
	userId: "user-123",
	subjectId: "subject-123",
	title: "Math Homework Chapter 5",
	dueDate: "2024-10-25T23:59:59Z",
	status: "todo",
	content: "Complete exercises 1-10 on page 42",
	grade: null,
	isDeleted: 0,
	deletedAt: null,
	createdAt: "2024-10-16T10:00:00.000Z",
	updatedAt: "2024-10-16T10:00:00.000Z",
};

const mockTaskListItem: TaskListItem = {
	id: "task-550e8400-e29b-41d4-a716-446655440000",
	subjectId: "subject-123",
	title: "Math Homework Chapter 5",
	dueDate: "2024-10-25T23:59:59Z",
	status: "todo",
	grade: null,
	createdAt: "2024-10-16T10:00:00.000Z",
	updatedAt: "2024-10-16T10:00:00.000Z",
};

const mockTaskWithResources: TaskWithResources = {
	...mockTask,
	resources: [
		{
			id: "file-1",
			originalFilename: "homework-guide.pdf",
			mimeType: "application/pdf",
			sizeBytes: 2048000,
			associationType: "resource",
		},
	],
};

const mockTaskDeleted: Task = {
	...mockTask,
	isDeleted: 1,
	deletedAt: "2024-10-16T10:05:00.000Z",
	updatedAt: "2024-10-16T10:05:00.000Z",
};

describe("Tasks Use Cases", () => {
	let mockRepository: TaskRepository;

	beforeEach(() => {
		mockRepository = {
			findBySubjectIdAndUserId: vi.fn(),
			findByIdAndUserId: vi.fn(),
			create: vi.fn(),
			update: vi.fn(),
			softDelete: vi.fn(),
			hardDelete: vi.fn(),
		} as unknown as TaskRepository;
	});

	describe("ListTasksUseCase", () => {
		it("should list all non-deleted tasks for a subject", async () => {
			const tasks = [mockTaskListItem];
			(
				mockRepository.findBySubjectIdAndUserId as ReturnType<typeof vi.fn>
			).mockResolvedValue(tasks);

			const useCase = new ListTasksUseCase(mockRepository);
			const result = await useCase.execute("user-123", "subject-123");

			expect(result).toEqual(tasks);
			expect(mockRepository.findBySubjectIdAndUserId).toHaveBeenCalledWith(
				"user-123",
				"subject-123",
			);
		});

		it("should return empty array if subject has no tasks", async () => {
			(
				mockRepository.findBySubjectIdAndUserId as ReturnType<typeof vi.fn>
			).mockResolvedValue([]);

			const useCase = new ListTasksUseCase(mockRepository);
			const result = await useCase.execute("user-123", "subject-456");

			expect(result).toEqual([]);
		});

		it("should return multiple tasks for a subject", async () => {
			const tasks = [
				mockTaskListItem,
				{
					...mockTaskListItem,
					id: "task-2",
					title: "Physics Project",
					status: "doing" as const,
				},
			];
			(
				mockRepository.findBySubjectIdAndUserId as ReturnType<typeof vi.fn>
			).mockResolvedValue(tasks);

			const useCase = new ListTasksUseCase(mockRepository);
			const result = await useCase.execute("user-123", "subject-123");

			expect(result).toHaveLength(2);
			expect(result[0].title).toBe("Math Homework Chapter 5");
			expect(result[1].title).toBe("Physics Project");
		});
	});

	describe("GetTaskUseCase", () => {
		it("should get a task with resources by ID", async () => {
			(
				mockRepository.findByIdAndUserId as ReturnType<typeof vi.fn>
			).mockResolvedValue(mockTaskWithResources);

			const useCase = new GetTaskUseCase(mockRepository);
			const result = await useCase.execute(
				"user-123",
				"task-550e8400-e29b-41d4-a716-446655440000",
			);

			expect(result).toEqual(mockTaskWithResources);
			expect(result.resources).toHaveLength(1);
			expect(result.resources[0].originalFilename).toBe("homework-guide.pdf");
			expect(mockRepository.findByIdAndUserId).toHaveBeenCalledWith(
				"user-123",
				"task-550e8400-e29b-41d4-a716-446655440000",
			);
		});

		it("should get a task with empty resources", async () => {
			const taskNoResources: TaskWithResources = { ...mockTask, resources: [] };
			(
				mockRepository.findByIdAndUserId as ReturnType<typeof vi.fn>
			).mockResolvedValue(taskNoResources);

			const useCase = new GetTaskUseCase(mockRepository);
			const result = await useCase.execute(
				"user-123",
				"task-550e8400-e29b-41d4-a716-446655440000",
			);

			expect(result.resources).toEqual([]);
		});

		it("should throw NotFoundError if task does not exist", async () => {
			(
				mockRepository.findByIdAndUserId as ReturnType<typeof vi.fn>
			).mockResolvedValue(null);

			const useCase = new GetTaskUseCase(mockRepository);

			await expect(
				useCase.execute("user-123", "non-existent-id"),
			).rejects.toThrow("Task not found");
		});

		it("should throw NotFoundError if task does not belong to user", async () => {
			(
				mockRepository.findByIdAndUserId as ReturnType<typeof vi.fn>
			).mockResolvedValue(null);

			const useCase = new GetTaskUseCase(mockRepository);

			await expect(
				useCase.execute(
					"wrong-user",
					"task-550e8400-e29b-41d4-a716-446655440000",
				),
			).rejects.toThrow("Task not found");
		});
	});

	describe("CreateTaskUseCase", () => {
		it("should create a task with required fields only", async () => {
			(mockRepository.create as ReturnType<typeof vi.fn>).mockResolvedValue(
				mockTask,
			);

			const useCase = new CreateTaskUseCase(mockRepository);
			const result = await useCase.execute("user-123", {
				title: "Math Homework Chapter 5",
				subjectId: "subject-123",
			});

			expect(result).toEqual(mockTask);
			expect(mockRepository.create).toHaveBeenCalledWith("user-123", {
				title: "Math Homework Chapter 5",
				subjectId: "subject-123",
				dueDate: null,
				status: "todo",
				content: null,
				grade: null,
			});
		});

		it("should create a task with all fields", async () => {
			(mockRepository.create as ReturnType<typeof vi.fn>).mockResolvedValue(
				mockTask,
			);

			const useCase = new CreateTaskUseCase(mockRepository);
			const result = await useCase.execute("user-123", {
				title: "Math Homework Chapter 5",
				subjectId: "subject-123",
				dueDate: "2024-10-25T23:59:59Z",
				status: "todo",
				content: "Complete exercises 1-10 on page 42",
				grade: null,
			});

			expect(result).toEqual(mockTask);
		});

		it("should throw ValidationError for empty title", async () => {
			const useCase = new CreateTaskUseCase(mockRepository);

			await expect(
				useCase.execute("user-123", {
					title: "",
					subjectId: "subject-123",
				}),
			).rejects.toThrow(ValidationError);
		});

		it("should throw ValidationError for empty subject ID", async () => {
			const useCase = new CreateTaskUseCase(mockRepository);

			await expect(
				useCase.execute("user-123", {
					title: "Math Homework",
					subjectId: "",
				}),
			).rejects.toThrow(ValidationError);
		});

		it("should throw ValidationError for invalid status", async () => {
			const useCase = new CreateTaskUseCase(mockRepository);

			await expect(
				useCase.execute("user-123", {
					title: "Math Homework",
					subjectId: "subject-123",
					status: "invalid" as unknown as "todo" | "doing" | "done",
				}),
			).rejects.toThrow(ValidationError);
		});

		it("should throw ValidationError for negative grade", async () => {
			const useCase = new CreateTaskUseCase(mockRepository);

			await expect(
				useCase.execute("user-123", {
					title: "Math Homework",
					subjectId: "subject-123",
					grade: -5,
				}),
			).rejects.toThrow(ValidationError);
		});

		it("should throw ValidationError for non-numeric grade", async () => {
			const useCase = new CreateTaskUseCase(mockRepository);

			await expect(
				useCase.execute("user-123", {
					title: "Math Homework",
					subjectId: "subject-123",
					grade: "invalid" as unknown as number,
				}),
			).rejects.toThrow(ValidationError);
		});

		it("should trim title whitespace", async () => {
			(mockRepository.create as ReturnType<typeof vi.fn>).mockResolvedValue(
				mockTask,
			);

			const useCase = new CreateTaskUseCase(mockRepository);
			await useCase.execute("user-123", {
				title: "  Math Homework  ",
				subjectId: "subject-123",
			});

			expect(mockRepository.create).toHaveBeenCalledWith(
				"user-123",
				expect.objectContaining({
					title: "Math Homework",
				}),
			);
		});
	});

	describe("UpdateTaskUseCase", () => {
		it("should update task title only", async () => {
			const updated = { ...mockTask, title: "Updated Title" };
			(mockRepository.update as ReturnType<typeof vi.fn>).mockResolvedValue(
				updated,
			);

			const useCase = new UpdateTaskUseCase(mockRepository);
			const result = await useCase.execute("user-123", mockTask.id, {
				title: "Updated Title",
			});

			expect(result.title).toBe("Updated Title");
			expect(mockRepository.update).toHaveBeenCalledWith(
				"user-123",
				mockTask.id,
				{ title: "Updated Title" },
			);
		});

		it("should update task status", async () => {
			const updated = { ...mockTask, status: "done" as const };
			(mockRepository.update as ReturnType<typeof vi.fn>).mockResolvedValue(
				updated,
			);

			const useCase = new UpdateTaskUseCase(mockRepository);
			const result = await useCase.execute("user-123", mockTask.id, {
				status: "done",
			});

			expect(result.status).toBe("done");
		});

		it("should update multiple fields", async () => {
			const updated = {
				...mockTask,
				status: "done" as const,
				grade: 9.5,
				content: "Updated content",
			};
			(mockRepository.update as ReturnType<typeof vi.fn>).mockResolvedValue(
				updated,
			);

			const useCase = new UpdateTaskUseCase(mockRepository);
			const result = await useCase.execute("user-123", mockTask.id, {
				status: "done",
				grade: 9.5,
				content: "Updated content",
			});

			expect(result.status).toBe("done");
			expect(result.grade).toBe(9.5);
			expect(result.content).toBe("Updated content");
		});

		it("should throw ValidationError if no fields provided", async () => {
			const useCase = new UpdateTaskUseCase(mockRepository);

			await expect(
				useCase.execute("user-123", mockTask.id, {}),
			).rejects.toThrow("At least one field must be provided for update");
		});

		it("should throw ValidationError for invalid status", async () => {
			const useCase = new UpdateTaskUseCase(mockRepository);

			await expect(
				useCase.execute("user-123", mockTask.id, {
					status: "invalid" as unknown as "todo" | "doing" | "done",
				}),
			).rejects.toThrow(ValidationError);
		});

		it("should throw ValidationError for negative grade", async () => {
			const useCase = new UpdateTaskUseCase(mockRepository);

			await expect(
				useCase.execute("user-123", mockTask.id, {
					grade: -10,
				}),
			).rejects.toThrow(ValidationError);
		});

		it("should throw ValidationError for empty title", async () => {
			const useCase = new UpdateTaskUseCase(mockRepository);

			await expect(
				useCase.execute("user-123", mockTask.id, {
					title: "",
				}),
			).rejects.toThrow(ValidationError);
		});

		it("should throw NotFoundError if task not found", async () => {
			const notFoundError = new Error("Task not found");
			(mockRepository.update as ReturnType<typeof vi.fn>).mockRejectedValue(
				notFoundError,
			);

			const useCase = new UpdateTaskUseCase(mockRepository);

			await expect(
				useCase.execute("user-123", "non-existent-id", { title: "New" }),
			).rejects.toThrow("Task not found");
		});

		it("should allow setting dueDate to null", async () => {
			const updated = { ...mockTask, dueDate: null };
			(mockRepository.update as ReturnType<typeof vi.fn>).mockResolvedValue(
				updated,
			);

			const useCase = new UpdateTaskUseCase(mockRepository);
			await useCase.execute("user-123", mockTask.id, {
				dueDate: null,
			});

			expect(mockRepository.update).toHaveBeenCalledWith(
				"user-123",
				mockTask.id,
				{ dueDate: null },
			);
		});
	});

	describe("SoftDeleteTaskUseCase", () => {
		it("should soft delete a task", async () => {
			(mockRepository.softDelete as ReturnType<typeof vi.fn>).mockResolvedValue(
				mockTaskDeleted,
			);

			const useCase = new SoftDeleteTaskUseCase(mockRepository);
			const result = await useCase.execute("user-123", mockTask.id);

			expect(result.isDeleted).toBe(1);
			expect(result.deletedAt).toBeTruthy();
			expect(mockRepository.softDelete).toHaveBeenCalledWith(
				"user-123",
				mockTask.id,
			);
		});

		it("should throw NotFoundError if task not found", async () => {
			const error = new Error("Task not found");
			(mockRepository.softDelete as ReturnType<typeof vi.fn>).mockRejectedValue(
				error,
			);

			const useCase = new SoftDeleteTaskUseCase(mockRepository);

			await expect(
				useCase.execute("user-123", "non-existent-id"),
			).rejects.toThrow("Task not found");
		});

		it("should preserve task data after soft delete", async () => {
			(mockRepository.softDelete as ReturnType<typeof vi.fn>).mockResolvedValue(
				mockTaskDeleted,
			);

			const useCase = new SoftDeleteTaskUseCase(mockRepository);
			const result = await useCase.execute("user-123", mockTask.id);

			// Verify original data is preserved
			expect(result.title).toBe(mockTask.title);
			expect(result.content).toBe(mockTask.content);
			expect(result.grade).toBe(mockTask.grade);
			expect(result.subjectId).toBe(mockTask.subjectId);
		});
	});

	describe("HardDeleteTaskUseCase", () => {
		it("should hard delete a task", async () => {
			(mockRepository.hardDelete as ReturnType<typeof vi.fn>).mockResolvedValue(
				mockTask,
			);

			const useCase = new HardDeleteTaskUseCase(mockRepository);
			const result = await useCase.execute("user-123", mockTask.id);

			expect(result.id).toEqual(mockTask.id);
			expect(mockRepository.hardDelete).toHaveBeenCalledWith(
				"user-123",
				mockTask.id,
			);
		});

		it("should throw NotFoundError if task not found", async () => {
			const error = new Error("Task not found");
			(mockRepository.hardDelete as ReturnType<typeof vi.fn>).mockRejectedValue(
				error,
			);

			const useCase = new HardDeleteTaskUseCase(mockRepository);

			await expect(
				useCase.execute("user-123", "non-existent-id"),
			).rejects.toThrow("Task not found");
		});

		it("should throw NotFoundError if task belongs to different user", async () => {
			const error = new Error("Task not found");
			(mockRepository.hardDelete as ReturnType<typeof vi.fn>).mockRejectedValue(
				error,
			);

			const useCase = new HardDeleteTaskUseCase(mockRepository);

			await expect(useCase.execute("wrong-user", mockTask.id)).rejects.toThrow(
				"Task not found",
			);
		});
	});
});
