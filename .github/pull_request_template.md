## Summary

- 

## Changes

- 

## Verification

- [ ] `pnpm lint`
- [ ] `pnpm test`
- [ ] `pnpm exec tsc --noEmit`
- [ ] `pnpm build`

## Architecture Checklist

- [ ] No cross-feature UI imports from `@/app/(features)/other/*`
- [ ] Feature lib imports are same-feature or `@feature-lib/content/*` only
- [ ] Shared imports use aliases (`@shared/*`, `@app-shared/*`, `@feature-lib/*`)
- [ ] Local feature `_components` use relative imports

## Risks / Follow-ups

- 
