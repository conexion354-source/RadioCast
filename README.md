# Radio Cast

Webapp para automatizar radio online con una consola de operación profesional.

## Incluye
- reproducción de radio por URL
- spots automáticos
- pisadores manuales
- publicidades por intervalo
- persistencia en localStorage
- identidad visual Radio Cast
- workflow para GitHub Pages

## Uso
```bash
npm install
npm run dev
```

## Modo escritorio
```bash
npm run dev:desktop
```

Esto abre Radio Cast dentro de Electron, con ventana nativa y sin varias de las limitaciones típicas del navegador.

## Builds
Web para GitHub Pages:
```bash
npm run build
```

Build de escritorio:
```bash
npm run build:desktop
```

Instalador Mac:
```bash
npm run dist:mac
```

Instalador Windows:
```bash
npm run dist:win
```

Los instaladores salen en la carpeta `release/`.

## Publicar en GitHub Pages
Cambiá el valor `base` en `vite.config.js` por el nombre real de tu repositorio.

## GitHub Actions
Hay un workflow en `.github/workflows/desktop-build.yml` para generar builds de Mac y Windows desde GitHub.
