/**
 * README for application/tasks
 *
 * This directory contains all use cases related to task management.
 *
 * ## Use Cases
 *
 * - **ListTasksUseCase**: Get all tasks for a subject
 * - **GetTaskUseCase**: Get a single task with details and resources
 * - **CreateTaskUseCase**: Create a new task
 * - **UpdateTaskUseCase**: Update an existing task
 * - **SoftDeleteTaskUseCase**: Soft delete a task
 * - **HardDeleteTaskUseCase**: Hard delete a task
 *
 * ## DTOs
 *
 * - **task.dto.ts**: Data transfer objects for request/response mapping
 *
 * ## Architecture
 *
 * Each use case:
 * - Depends only on domain repositories (inversion of control)
 * - Validates input data
 * - Delegates persistence to repositories
 * - Returns domain entities
 *
 * This ensures:
 * - Easy to test (mock repositories)
 * - Independent of infrastructure
 * - Reusable across different interfaces (HTTP, GraphQL, etc)
 */
