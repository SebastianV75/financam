# financam

Aplicación mobile-first para finanzas personales enfocada en **organización financiera quincenal**.

## Propuesta de valor

> Recibo mi quincena, la app me dice cómo organizarla, cuánto separar, cuánto puedo gastar y cómo voy con mis metas y deudas.

## Estado del proyecto

Este repositorio contiene el **foundation** del MVP:

- shell de navegación con Expo Router
- arquitectura por capas
- contratos iniciales del dominio financiero
- persistencia local con SQLite
- Zustand restringido a UI/orquestación
- MMKV restringido a preferencias/cache no financiera
- base offline-first local

## Principios arquitectónicos

1. **SQLite es la fuente de verdad** del dominio financiero.
2. **MMKV no almacena datos financieros canónicos**.
3. **Zustand no reemplaza persistencia**; solo orquesta estado de UI.
4. **Plan financiero** y **movimientos operativos** comparten contexto, pero no se mezclan como una sola entidad.
5. La **quincena** es el contenedor operativo central del producto.

## Estructura

```text
app/                    # shell y rutas Expo Router
src/
  application/          # casos de uso y orquestación
  domain/               # entidades, value objects y puertos
  infrastructure/       # SQLite, MMKV y adaptadores
  presentation/         # providers, hooks y componentes de pantalla
  shared/               # constantes, configuración y utilidades
  store/                # stores Zustand no canónicos
docs/                   # documentación técnica base
```

## Scripts

```bash
npm install
npm run lint
npm run typecheck
npm test
npm run start
```

## Navegación actual

- `Plan`
- `Movimientos`

Son placeholders arquitectónicos para validar shell, providers y límites entre capas.

## Documentación técnica

- [`docs/architecture.md`](docs/architecture.md)

## Próximos pasos

- definir la identidad final de `QuincenaId`
- agregar módulos de cuentas y transacciones reales
- extender migraciones para cuentas, categorías, metas y deudas
