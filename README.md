# financam

Aplicación mobile-first para finanzas personales enfocada en **organización financiera quincenal**.

## Propuesta de valor

> Recibo mi quincena, la app me dice cómo organizarla, cuánto separar, cuánto puedo gastar y cómo voy con mis metas y deudas.

## Estado del proyecto

Este repositorio contiene actualmente los siguientes bloques del MVP:

- **foundation**
- **accounts-and-transactions-core**
- **pay-cycle-core**

Incluye:

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
npm run verify
npm run prebuild
npm run dev
npm run android
npm run ios
```

## Runtime local oficial (Android/iOS)

El flujo oficial para desarrollo local es **Expo Development Builds**, NO Expo Go puro.

### Prerrequisitos

- Node.js LTS + npm
- Android Studio (SDK + emulador) para Android
- Xcode + simulador para iOS (solo macOS)
- Dependencias instaladas con `npm install`

### Flujo recomendado

1. Verificación estática/automática:
   - `npm run verify`
2. Sincronización nativa:
   - `npm run prebuild`
3. Arranque por plataforma:
   - Android: `npm run android`
   - iOS: `npm run ios`
4. Iteración con dev client:
   - `npm run dev`

### Smoke verification mínima

En un dev build de Android/iOS validar:

- la app arranca sin pantalla roja de error técnico;
- el shell redirige correctamente a `/plan`;
- SQLite inicializa (`financam.db`) sin errores;
- `hasSeenOnboarding` persiste entre reinicios (MMKV);
- no se persiste información financiera en MMKV.

### Limitaciones de entorno (CI/host sin SDK)

Si `npm run android` falla con errores como:

- `Failed to resolve the Android SDK path`
- `Error: spawn adb ENOENT`

el entorno **no tiene Android SDK/adb configurado**. En ese caso:

1. Definir `ANDROID_HOME` al SDK local (ejemplo: `~/Android/Sdk`).
2. Agregar `platform-tools` al `PATH` para exponer `adb`.
3. Abrir un emulador desde Android Studio (o conectar dispositivo físico con depuración USB).
4. Reintentar `npm run android` y completar la smoke verification en runtime real.

### Expo Go vs Dev Builds

- **Dev Builds (soportado y default):** compatible con módulos nativos usados por la app (MMKV, SQLite, Router).
- **Expo Go puro (no objetivo de este cambio):** no es el path principal ni una meta soportada para readiness.

Si en el futuro se quisiera habilitar fallback para Expo Go, debe ser un cambio separado con tradeoffs explícitos (peor rendimiento/consistencia) y sin mover la fuente de verdad financiera fuera de SQLite.

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
