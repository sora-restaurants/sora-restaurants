# Owner dashboard UI integration boundary

This branch is a UI-only contract preview. It does not add database schema, RLS, checkout, authentication, SSE, or deployment changes.

## File ownership

- Owner UI: `apps/web/src/owner/**` and `apps/web/src/app/preview/owner/page.tsx`.
- Customer handoff: `apps/web/src/components/menu/OrderingUnavailable.tsx` is standalone. The customer-experience branch owns the eventual `/t/[token]` and `Menu.tsx` integration.
- Shared backend: untouched. Restaurant operations owns migrations, RLS, authenticated session commands, and the atomic `submit_order` check.

## Adapter dependency

Replace `createMockSessionAdapter()` with an authenticated server adapter only after the backend publishes:

1. Restaurant-scoped table/session read results matching `ManagedTable`.
2. Authorized open/close commands and their stable conflict codes.
3. The stable `TABLE_SESSION_NOT_ACTIVE` checkout error mapping.
4. A real QR renderer or generated QR image source for `PrintableQrCard`.

The dashboard's “Accepted Order Value” label is deliberate: it uses VAT-inclusive order totals, excludes cancelled and rejected orders, is scoped to the restaurant timezone, and does not claim payment verification.
