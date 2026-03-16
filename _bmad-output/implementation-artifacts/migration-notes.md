# Migration Notes

Date: 2026-03-16

## Storage
- New encrypted state key: `km-app-secure-v2`
- Legacy encrypted key supported for migration: `azure-openai-prototype-secure-v1`
- Legacy plain key supported for migration: `azure-openai-prototype-config-v1`

## Migration Flow
1. On unlock, app tries `km-app-secure-v2` first.
2. If missing, app attempts legacy encrypted key with same password.
3. If still missing, app attempts legacy plain key.
4. Migrated state is re-encrypted into v2 key and legacy key removed.

## Provider Defaults
- Active provider defaults to `local-browser` for new users.
- Legacy Azure config is mapped into optional Azure provider settings.
