# YukCep Agent Routine

This repository follows a mandatory operational routine for every task:

1. Run `npm run ops:check` first.
2. Read both sources before coding:
   - Runtime error/work logs (`WARN/ERROR`)
   - Feedback board items (especially rows tagged as actionable / `Yapacağım`)
3. Fix issues found in logs and feedback backlog before unrelated enhancements.
4. Re-run verification:
   - `npm run lint`
   - `npm run build`
   - `npm run smoke`
   - `npm run ops:check`
5. Then complete `commit + push + deploy`.

If backlog remains blocked by external access (e.g. Supabase SQL permissions), record it in `LAUNCH_TODO.md` under blocked items.
