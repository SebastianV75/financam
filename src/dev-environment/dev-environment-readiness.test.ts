import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();

function readJson<T>(relativePath: string): T {
  const absolutePath = path.join(rootDir, relativePath);
  return JSON.parse(fs.readFileSync(absolutePath, 'utf8')) as T;
}

describe('Dev environment readiness contract', () => {
  it('define Dev Builds como path oficial y no Expo Go como objetivo principal', () => {
    const readme = fs.readFileSync(path.join(rootDir, 'README.md'), 'utf8');

    expect(readme).toContain('Expo Development Builds');
    expect(readme).toContain('NO Expo Go puro');
    expect(readme).toContain('Expo Go puro (no objetivo de este cambio)');
  });

  it('mantiene coherencia de módulos nativos requeridos para prebuild', () => {
    const appJson = readJson<{
      expo: { plugins: string[] };
    }>('app.json');
    const packageJson = readJson<{
      dependencies: Record<string, string>;
      scripts: Record<string, string>;
    }>('package.json');

    expect(appJson.expo.plugins).toEqual(
      expect.arrayContaining(['expo-router', 'expo-sqlite', 'expo-dev-client']),
    );
    expect(packageJson.dependencies['expo-dev-client']).toBeDefined();
    expect(packageJson.dependencies['expo-system-ui']).toBeDefined();
    expect(packageJson.scripts.prebuild).toContain('expo prebuild');
  });

  it('documenta prerequisitos y bloqueo explícito por falta de Android SDK/adb', () => {
    const readme = fs.readFileSync(path.join(rootDir, 'README.md'), 'utf8');

    expect(readme).toContain('Android Studio (SDK + emulador)');
    expect(readme).toContain('Failed to resolve the Android SDK path');
    expect(readme).toContain('Error: spawn adb ENOENT');
    expect(readme).toContain('el entorno **no tiene Android SDK/adb configurado**');
  });

  it('declara checklist de verificación exhaustiva y smoke del runtime soportado', () => {
    const packageJson = readJson<{
      scripts: Record<string, string>;
    }>('package.json');
    const readme = fs.readFileSync(path.join(rootDir, 'README.md'), 'utf8');

    expect(packageJson.scripts.verify).toBe('npm run lint && npm run typecheck && npm test');
    expect(readme).toContain('npm run prebuild');
    expect(readme).toContain('npm run android');
    expect(readme).toContain('npm run ios');
    expect(readme).toContain('la app arranca sin pantalla roja de error técnico');
    expect(readme).toContain('SQLite inicializa (`financam.db`) sin errores');
  });

  it('mantiene política de fallback Expo Go como opcional e inferior', () => {
    const readme = fs.readFileSync(path.join(rootDir, 'README.md'), 'utf8');
    const architectureDoc = fs.readFileSync(path.join(rootDir, 'docs/architecture.md'), 'utf8');

    expect(readme).toContain('fallback para Expo Go');
    expect(readme).toContain('debe ser un cambio separado');
    expect(architectureDoc).toContain('Política de fallback Expo Go (opcional futura)');
    expect(architectureDoc).toContain('no reemplaza el flujo oficial con Development Builds');
  });
});
