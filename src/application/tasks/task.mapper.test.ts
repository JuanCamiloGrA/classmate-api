import { describe, expect, it } from "vitest";
import type {
	TaskListItem,
	TaskWithResources,
} from "../../domain/entities/task";
import { toTaskDetailDTO, toTaskListDTO } from "./task.dto";

describe("Task DTO Mappers", () => {
	const mockTaskListItem: TaskListItem = {
		id: "task-1",
		subjectId: "subject-123",
		title: "Math Homework",
		dueDate: "2024-10-25T23:59:59Z",
		status: "todo",
		priority: "medium",
		grade: null,
		createdAt: "2024-10-16T10:00:00.000Z",
		updatedAt: "2024-10-16T10:00:00.000Z",
	};

	const mockTaskWithResources: TaskWithResources = {
		id: "task-1",
		userId: "user-123",
		subjectId: "subject-123",
		title: "Math Homework",
		dueDate: "2024-10-25T23:59:59Z",
		status: "doing",
		priority: "high",
		content: "Complete homework",
		grade: 8.5,
		isDeleted: 0,
		deletedAt: null,
		createdAt: "2024-10-16T10:00:00.000Z",
		updatedAt: "2024-10-16T10:00:00.000Z",
		resources: [
			{
				id: "file-1",
				originalFilename: "homework.pdf",
				mimeType: "application/pdf",
				sizeBytes: 2048000,
				associationType: "resource",
			},
			{
				id: "file-2",
				originalFilename: "guide.pdf",
				mimeType: "application/pdf",
				sizeBytes: 1024000,
				associationType: "embedded_content",
			},
		],
	};

	describe("toTaskListDTO", () => {
		it("should convert TaskListItem to snake_case DTO", () => {
			const dto = toTaskListDTO(mockTaskListItem);

			expect(dto).toEqual({
				id: "task-1",
				subject_id: "subject-123",
				title: "Math Homework",
				due_date: "2024-10-25T23:59:59Z",
				status: "todo",
				priority: "medium",
				grade: null,
				created_at: "2024-10-16T10:00:00.000Z",
				updated_at: "2024-10-16T10:00:00.000Z",
			});
		});

		it("should preserve all field values", () => {
			const dto = toTaskListDTO(mockTaskListItem);

			expect(dto.id).toBe(mockTaskListItem.id);
			expect(dto.subject_id).toBe(mockTaskListItem.subjectId);
			expect(dto.title).toBe(mockTaskListItem.title);
			expect(dto.status).toBe(mockTaskListItem.status);
		});

		it("should handle null due_date", () => {
			const itemWithoutDueDate = { ...mockTaskListItem, dueDate: null };
			const dto = toTaskListDTO(itemWithoutDueDate);

			expect(dto.due_date).toBeNull();
		});

		it("should handle null grade", () => {
			const dto = toTaskListDTO(mockTaskListItem);

			expect(dto.grade).toBeNull();
		});

		it("should have correct key naming convention", () => {
			const dto = toTaskListDTO(mockTaskListItem);

			const keys = Object.keys(dto);
			expect(keys).toContain("subject_id");
			expect(keys).toContain("due_date");
			expect(keys).toContain("created_at");
			expect(keys).toContain("updated_at");
			expect(keys).not.toContain("subjectId");
			expect(keys).not.toContain("dueDate");
		});
	});

	describe("toTaskDetailDTO", () => {
		it("should convert TaskWithResources to snake_case DTO", () => {
			const dto = toTaskDetailDTO(mockTaskWithResources);

			expect(dto).toEqual({
				id: "task-1",
				subject_id: "subject-123",
				title: "Math Homework",
				due_date: "2024-10-25T23:59:59Z",
				status: "doing",
				priority: "high",
				content: "Complete homework",
				grade: 8.5,
				is_deleted: 0,
				deleted_at: null,
				created_at: "2024-10-16T10:00:00.000Z",
				updated_at: "2024-10-16T10:00:00.000Z",
				resources: [
					{
						id: "file-1",
						original_filename: "homework.pdf",
						mime_type: "application/pdf",
						size_bytes: 2048000,
						association_type: "resource",
					},
					{
						id: "file-2",
						original_filename: "guide.pdf",
						mime_type: "application/pdf",
						size_bytes: 1024000,
						association_type: "embedded_content",
					},
				],
			});
		});

		it("should convert resources to snake_case", () => {
			const dto = toTaskDetailDTO(mockTaskWithResources);

			expect(dto.resources).toHaveLength(2);
			expect(dto.resources[0]).toEqual({
				id: "file-1",
				original_filename: "homework.pdf",
				mime_type: "application/pdf",
				size_bytes: 2048000,
				association_type: "resource",
			});
		});

		it("should handle empty resources array", () => {
			const taskNoResources: TaskWithResources = {
				...mockTaskWithResources,
				resources: [],
			};
			const dto = toTaskDetailDTO(taskNoResources);

			expect(dto.resources).toEqual([]);
			expect(dto.resources).toHaveLength(0);
		});

		it("should handle deleted task", () => {
			const deletedTask: TaskWithResources = {
				...mockTaskWithResources,
				isDeleted: 1,
				deletedAt: "2024-10-16T10:05:00.000Z",
			};
			const dto = toTaskDetailDTO(deletedTask);

			expect(dto.is_deleted).toBe(1);
			expect(dto.deleted_at).toBe("2024-10-16T10:05:00.000Z");
		});

		it("should handle null content", () => {
			const taskNoContent: TaskWithResources = {
				...mockTaskWithResources,
				content: null,
			};
			const dto = toTaskDetailDTO(taskNoContent);

			expect(dto.content).toBeNull();
		});

		it("should have correct key naming convention", () => {
			const dto = toTaskDetailDTO(mockTaskWithResources);

			const keys = Object.keys(dto);
			expect(keys).toContain("subject_id");
			expect(keys).toContain("due_date");
			expect(keys).toContain("is_deleted");
			expect(keys).toContain("deleted_at");
			expect(keys).toContain("created_at");
			expect(keys).toContain("updated_at");
			expect(keys).not.toContain("subjectId");
			expect(keys).not.toContain("dueDate");
			expect(keys).not.toContain("isDeleted");
			expect(keys).not.toContain("deletedAt");
		});

		it("should preserve all numeric values", () => {
			const dto = toTaskDetailDTO(mockTaskWithResources);

			expect(dto.grade).toBe(8.5);
			expect(dto.is_deleted).toBe(0);
			expect(dto.resources[0].size_bytes).toBe(2048000);
		});
	});

	describe("Edge cases", () => {
		it("toTaskListDTO should handle task with status done", () => {
			const taskDone = { ...mockTaskListItem, status: "done" as const };
			const dto = toTaskListDTO(taskDone);

			expect(dto.status).toBe("done");
		});

		it("toTaskDetailDTO should handle task with status doing", () => {
			const dto = toTaskDetailDTO(mockTaskWithResources);

			expect(dto.status).toBe("doing");
		});

		it("toTaskDetailDTO should handle high decimal grades", () => {
			const taskHighGrade: TaskWithResources = {
				...mockTaskWithResources,
				grade: 9.999,
			};
			const dto = toTaskDetailDTO(taskHighGrade);

			expect(dto.grade).toBe(9.999);
		});

		it("toTaskDetailDTO should handle zero grade", () => {
			const taskZeroGrade: TaskWithResources = {
				...mockTaskWithResources,
				grade: 0,
			};
			const dto = toTaskDetailDTO(taskZeroGrade);

			expect(dto.grade).toBe(0);
		});
	});
});
