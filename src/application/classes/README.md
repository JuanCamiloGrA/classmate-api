# Classes Application Layer

This directory contains all application-layer use cases related to class management.

## Use Cases

- **ListClassesUseCase**: List all non-deleted classes for a specific subject
- **GetClassUseCase**: Retrieve a single class with all details and associated resources
- **CreateClassUseCase**: Create a new class
- **UpdateClassUseCase**: Update an existing class
- **SoftDeleteClassUseCase**: Soft delete a class (mark as deleted, preserve data)
- **HardDeleteClassUseCase**: Hard delete a class (permanently remove data)

## DTOs

- **ClassListDTO**: Optimized DTO for list responses with essential fields
- **ClassDetailDTO**: Full DTO for detail responses with resources

## Architecture

Each use case:
1. Depends on the `ClassRepository` interface (from `domain/repositories`)
2. Receives domain entities and returns DTOs via mappers
3. Is independently testable with mocked repositories
4. Contains no HTTP or database logic
