# Repository instructions

- Keep TypeScript strict. Do not weaken compiler options or introduce `any`.
- Validate all external input before it reaches application or storage logic.
- Return errors as JSON using the shared `{ "error": { "code", "message", "details"? } }` shape.
- Add or update tests for every behavior change, including HTTP status and response contracts.
- Keep the API database-free unless persistence is explicitly requested.
