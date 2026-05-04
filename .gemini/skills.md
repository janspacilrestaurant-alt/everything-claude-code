# ECC Skills Bundle for Gemini CLI

> Experimental port of ECC core skills to Gemini CLI.
> Load with `@.gemini/skills.md` or reference specific sections as needed.
> Source: Everything Claude Code — https://github.com/janspacilrestaurant-alt/everything-claude-code

---

## 1. Development Workflow

### Plan → Code → Test → Review → Ship

1. **Plan** before editing large features. Write down what will change and why.
2. **Test-first** for bug fixes and new functionality where feasible.
3. **Self-review** before pushing: read the diff as if you're a reviewer.
4. **Security check** on every commit (see Section 3).
5. **Conventional commit** message (`feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `ci`).
6. Keep changes **self-contained** and easy to revert.

### Feature Development Steps

1. Read the relevant existing code before proposing changes.
2. Write a short implementation plan (bullet list is fine) for anything touching 3+ files.
3. Implement the smallest change that solves the problem.
4. Run the project's test suite / linter before finishing.
5. Flag anything deferred or out of scope as a follow-up note.

---

## 2. Coding Standards

> Source skill: `coding-standards`

### Core Principles

| Principle | Rule |
|-----------|------|
| **Readability** | Code is read more than written. Prefer clear names over clever tricks. |
| **KISS** | Simplest solution that works. No premature optimisation. |
| **DRY** | Extract repeated logic into named functions. |
| **YAGNI** | Don't add features before they're needed. |
| **Immutability** | Prefer non-mutating updates (`{...obj}`, `[...arr]`) over in-place mutation. |
| **Error handling** | Fail loudly with clear messages. Never silently swallow errors. |
| **No magic numbers** | Name every significant constant. |
| **No secrets** | Never hardcode API keys, passwords, or tokens. |

### Naming

```typescript
// GOOD — descriptive
const marketSearchQuery = 'election'
const isUserAuthenticated = true
async function fetchMarketData(marketId: string) {}
function isValidEmail(email: string): boolean {}

// BAD — opaque
const q = 'election'
const flag = true
async function market(id: string) {}
function email(e) {}
```

### Immutability (critical)

```typescript
// GOOD
const updatedUser = { ...user, name: 'New Name' }
const updatedArray = [...items, newItem]

// BAD
user.name = 'New Name'
items.push(newItem)
```

### Error Handling

```typescript
// GOOD
async function fetchData(url: string) {
  try {
    const response = await fetch(url)
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    return await response.json()
  } catch (error) {
    console.error('Fetch failed:', error)
    throw new Error('Failed to fetch data')
  }
}

// BAD — no error handling
async function fetchData(url) {
  return (await fetch(url)).json()
}
```

### Async — parallel when possible

```typescript
// GOOD
const [users, markets] = await Promise.all([fetchUsers(), fetchMarkets()])

// BAD — unnecessary sequential
const users = await fetchUsers()
const markets = await fetchMarkets()
```

### Anti-patterns to reject

- Functions longer than ~50 lines — extract helpers.
- Nesting deeper than 3 levels — use early returns.
- `any` in TypeScript — use proper types or `unknown`.
- Comments that restate the code — comment *why*, not *what*.
- `SELECT *` queries — name the columns you need.

---

## 3. Security Checklist

Run before every commit:

- [ ] No hardcoded API keys, passwords, or tokens
- [ ] All external / user input validated at the boundary
- [ ] Parameterised queries for every database write
- [ ] HTML output sanitised where applicable
- [ ] Auth/authz checked for every sensitive route
- [ ] Error messages scrubbed of sensitive internals
- [ ] Dependencies not pinned to a known-vulnerable version
- [ ] No `eval`, `exec`, or dynamic code generation on user input

---

## 4. API Design

> Source skill: `api-design`

### REST Conventions

```
GET    /api/resources           # list
GET    /api/resources/:id       # single item
POST   /api/resources           # create
PUT    /api/resources/:id       # full replace
PATCH  /api/resources/:id       # partial update
DELETE /api/resources/:id       # delete
GET    /api/resources?status=active&limit=20&offset=0
```

### Response Envelope

```typescript
interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  meta?: { total: number; page: number; limit: number }
}
```

### Input Validation (Zod example)

```typescript
import { z } from 'zod'

const CreateSchema = z.object({
  name: z.string().min(1).max(200),
  endDate: z.string().datetime(),
})

const validated = CreateSchema.parse(body) // throws ZodError on failure
```

---

## 5. Testing Standards

### AAA Pattern

```typescript
test('returns empty array when no results match', () => {
  // Arrange
  const query = 'zzz-no-match'
  // Act
  const result = search(query)
  // Assert
  expect(result).toEqual([])
})
```

### Good test names

```typescript
// GOOD — describe the scenario
test('throws when API key is missing')
test('falls back to cache when network fails')
test('returns 400 for invalid email format')

// BAD — vague
test('works')
test('test search')
```

### Coverage targets

- Unit tests for all non-trivial pure functions.
- Integration tests for every public API endpoint.
- At least one sad-path test per feature.

---

## 6. Code Review Checklist

When reviewing a diff, verify:

- [ ] Logic is correct and handles edge cases
- [ ] No obvious performance regressions (N+1, missing index, large allocations)
- [ ] Security checklist items pass (Section 3)
- [ ] Naming is clear without needing a comment
- [ ] Tests exist for the new/changed behaviour
- [ ] No dead code or commented-out blocks left in
- [ ] PR description explains *why*, not just *what*

---

## 7. Delivery Standards

- Run `lint` + `typecheck` + `test` before marking work done.
- Prefer contained local implementations over adding new third-party runtime dependencies.
- Update `CHANGELOG` / release notes for user-visible changes.
- Keep PRs small — one logical change per PR.
- Link relevant issue/ticket in the commit message or PR description.

---

*Generated from ECC skill bundle. Regenerate with `/skill-create` or update manually when conventions change.*
