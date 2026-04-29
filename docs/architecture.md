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

Uso prohibido:

- saldos canónicos
- movimientos financieros
- presupuestos planeados
- datos de deuda o metas como fuente primaria

## Offline-first

La app arranca contra persistencia local y no depende de red para su flujo base.

## Decisiones abiertas

- si `QuincenaId` será UUID o derivado del rango de fechas
- si el naming final de tablas quedará en inglés técnico o español consistente
