# Arquitectura base de financam

## Capas

### `domain`
Contiene tipos, entidades y puertos. No depende de React, Expo ni SQLite.

### `application`
Orquesta casos de uso mediante puertos del dominio.

### `infrastructure`
Implementa acceso a SQLite, MMKV y guardrails de persistencia.

### `presentation`
Compone providers, hooks y pantallas.

### `store`
Estado efímero de UI y preferencias no financieras.

## Reglas de dependencia

- `presentation -> application -> domain`
- `infrastructure -> domain`
- `store` no es fuente de verdad financiera
- `domain` no conoce detalles de framework

## Persistencia

### SQLite
Fuente de verdad canónica del dominio financiero.

Tablas fundacionales:

- `quincenas`
- `financial_plans`
- `operational_movements`
- `schema_migrations`

### MMKV
Uso permitido:

- preferencias visuales
- flags de onboarding
- cache descartable de UI

Implementación actual:

- `src/infrastructure/persistence/preferences-storage.ts` define el seam/factory para preferencias.
- El backend default del seam es MMKV vía `createMMKVStateStorage()`.
- Zustand consume el seam; no conoce detalles del motor subyacente.

Uso prohibido:

- saldos canónicos
- movimientos financieros
- presupuestos planeados
- datos de deuda o metas como fuente primaria

## Offline-first

La app arranca contra persistencia local y no depende de red para su flujo base.

## Runtime local oficial

- **Path principal:** Expo Development Builds (`expo run:android` / `expo run:ios` + `expo start --dev-client`).
- **Expo Go puro:** fuera del objetivo de estabilización; no se fuerza compatibilidad por encima de arquitectura.

Rationale: el stack usa módulos nativos (MMKV y SQLite). Forzar Expo Go como default implicaría comprometer consistencia/rendimiento y romper el límite arquitectónico de persistencia.

## Política de fallback Expo Go (opcional futura)

Solo como política futura y explícitamente inferior:

- podría añadirse un backend alterno de preferencias detrás del seam;
- nunca debe mover datos financieros a stores no canónicos;
- no reemplaza el flujo oficial con Development Builds.

## Decisiones abiertas

- si `QuincenaId` será UUID o derivado del rango de fechas
- si el naming final de tablas quedará en inglés técnico o español consistente
