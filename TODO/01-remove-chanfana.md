# TODO: Remove Chanfana from Codebase

## Status
🔴 **Pending**

## Priority
**Medium** - Technical debt that impacts our iteration speed

## Context

Chanfana is considered by the team to be a dead repository with no trustable updates or community support. The update and release cycle is very slow compared to other solutions in the ecosystem, which is unacceptable for a product like ours that requires fast iteration speed.

## Why Remove?

1. **Slow Development Cycle**: Updates and releases are significantly slower compared to alternatives
2. **Limited Community Support**: Minimal community engagement and contributions
3. **Trustability Concerns**: Lack of consistent maintenance raises concerns about long-term viability
4. **Blocks Fast Iteration**: Our product requires rapid iteration and deployment cycles
5. **Better Alternatives Available**: Modern OpenAPI tooling with active communities exists

## Current Usage

Chanfana is currently used for:
- OpenAPI route definitions (`OpenAPIRoute` class)
- Automatic Swagger UI generation
- Request/response validation with Zod schemas
- OpenAPI JSON schema generation

## Migration Path

### Option 1: Hono + @hono/zod-openapi (Recommended)
- Native Hono integration
- Active development and community
- Full Zod v3/v4 support
- Better TypeScript support

### Option 2: Custom OpenAPI Middleware
- Build on top of existing Hono setup
- Use zod-to-json-schema for schema generation
- Manual Swagger UI integration

### Option 3: tRPC + OpenAPI Plugin
- Type-safe end-to-end
- Automatic OpenAPI generation
- More significant refactor required

## Action Items

- [ ] Research and evaluate alternatives (see options above)
- [ ] Create proof-of-concept with selected alternative
- [ ] Document migration strategy
- [ ] Update route definitions incrementally
- [ ] Ensure backward compatibility with existing clients
- [ ] Update API documentation
- [ ] Update deployment pipeline if needed
- [ ] Remove chanfana dependency

## Estimated Effort
2-3 days for full migration

## References
- Chanfana repository: https://github.com/cloudflare/chanfana
- Hono Zod OpenAPI: https://github.com/honojs/middleware/tree/main/packages/zod-openapi
- Related issue: Zod v4 compatibility blocked by chanfana (fixed temporarily by downgrading to v3)

## Notes
- We recently had to downgrade from Zod v4 to v3 because chanfana doesn't support Zod v4
- This downgrade was necessary to fix TypeScript compilation errors
- This is a clear indicator that chanfana is not keeping up with the ecosystem
