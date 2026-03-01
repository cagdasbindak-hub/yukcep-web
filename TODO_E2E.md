# YukCep E2E TODO

Date: 2026-02-28

- [x] Align role button behavior with product rule: hide opposite role action and avoid redundant self-role action on welcome for logged-in users.
- [x] Add direct navigation paths so role-specific users can still reach core actions:
  - employer -> post new load
  - driver -> search/find loads
- [x] Update live E2E assertions for role-aware welcome UI (buttons can differ by role).
- [x] Fix signup profile role persistence so employer account does not drift back to driver after reload.
- [x] Re-run full 21-checkpoint E2E and fix all failures until pass.
- [x] Harden E10 assigned verification: avoid brittle nested locator, poll refresh until status propagation.
- [x] Verify no "Teklif gönderilemedi" in end-to-end run.
- [ ] Finalize with build, commit, push, deploy verification.
