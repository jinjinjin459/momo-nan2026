// Secret fields are not emitted by `wrangler types`; non-secret bindings are generated.
interface Env {
  GEMINI_API_KEY?: string
  GEMINI_API_KEYS?: string
}
