# Subjects Use Cases

This directory contains the application layer (use cases) for subject management.

## Structure

- **list-subjects.usecase.ts** - Lists all non-deleted subjects for a term
- **create-subject.usecase.ts** - Creates a new subject
- **update-subject.usecase.ts** - Updates an existing subject
- **soft-delete-subject.usecase.ts** - Soft deletes a subject and cascades to tasks and classes
- **hard-delete-subject.usecase.ts** - Permanently deletes a subject and all related data
- **subject.dto.ts** - Data Transfer Objects for HTTP responses
- **subjects.usecase.test.ts** - Test suite for all use cases

## Key Principles

1. **Single Responsibility**: Each use case handles one operation
2. **Dependency Injection**: All use cases receive a repository interface, not implementations
3. **Business Logic**: Contains validation rules that are specific to the business domain
4. **Error Handling**: Throws domain errors (NotFoundError, ValidationError) for handling by the HTTP layer
5. **Cascading Operations**: Soft delete cascades to related tasks and classes; hard delete cascades via foreign keys

## Use Case Pattern

Each use case follows this pattern:

```typescript
export class [Action]SubjectUseCase {
  constructor(private subjectRepository: SubjectRepository) {}

  async execute(userId: string, ...args): Promise<Subject | Subject[]> {
    // 1. Validate inputs
    // 2. Perform business logic
    // 3. Call repository methods
    // 4. Return result or throw domain error
  }
}
```

## Testing

When testing use cases:

1. Mock the `SubjectRepository` interface
2. Create a use case instance with the mocked repository
3. Test that the use case:
   - Calls the repository with correct parameters
   - Returns the expected result
   - Throws appropriate domain errors

Example:

```typescript
import { ListSubjectsUseCase } from './list-subjects.usecase'

describe('ListSubjectsUseCase', () => {
  it('should list all non-deleted subjects for a term', async () => {
    const mockRepo: SubjectRepository = {
      findByTermIdAndUserId: vi.fn().mockResolvedValue([mockSubject])
    }
    
    const useCase = new ListSubjectsUseCase(mockRepo)
    const result = await useCase.execute('user123', 'term123')
    
    expect(result).toEqual([mockSubject])
    expect(mockRepo.findByTermIdAndUserId).toHaveBeenCalledWith('user123', 'term123')
  })
})
```
