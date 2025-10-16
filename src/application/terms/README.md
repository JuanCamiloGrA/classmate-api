# Terms Use Cases

This directory contains the application layer (use cases) for term management.

## Structure

- **list-terms.usecase.ts** - Lists all non-deleted terms for a user
- **create-term.usecase.ts** - Creates a new term
- **update-term.usecase.ts** - Updates an existing term
- **soft-delete-term.usecase.ts** - Soft deletes a term and cascades to subjects
- **hard-delete-term.usecase.ts** - Permanently deletes a term and all related data
- **term.dto.ts** - Data Transfer Objects for HTTP responses

## Key Principles

1. **Single Responsibility**: Each use case handles one operation
2. **Dependency Injection**: All use cases receive a repository interface, not implementations
3. **Business Logic**: Contains validation rules that are specific to the business domain
4. **Error Handling**: Throws domain errors (NotFoundError, ValidationError) for handling by the HTTP layer

## Use Case Pattern

Each use case follows this pattern:

```typescript
export class [Action]TermUseCase {
  constructor(private termRepository: TermRepository) {}

  async execute(userId: string, ...args): Promise<Term | Term[]> {
    // 1. Validate inputs
    // 2. Perform business logic
    // 3. Call repository methods
    // 4. Return result or throw domain error
  }
}
```

## Testing

When testing use cases:

1. Mock the `TermRepository` interface
2. Create a use case instance with the mocked repository
3. Test that the use case:
   - Calls the repository with correct parameters
   - Returns the expected result
   - Throws appropriate domain errors

Example:

```typescript
import { ListTermsUseCase } from './list-terms.usecase'

describe('ListTermsUseCase', () => {
  it('should list all non-deleted terms for a user', async () => {
    const mockRepo: TermRepository = {
      findByUserId: vi.fn().mockResolvedValue([mockTerm])
    }
    
    const useCase = new ListTermsUseCase(mockRepo)
    const result = await useCase.execute('user123')
    
    expect(result).toEqual([mockTerm])
    expect(mockRepo.findByUserId).toHaveBeenCalledWith('user123')
  })
})
```
