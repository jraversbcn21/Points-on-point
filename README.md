# points on point - Chrome Extension

Una extensión de Chrome para lista de tareas con recordatorios que aparecen como toasts persistentes en cualquier página web.

## Características

- ✅ Lista de tareas simple y compacta
- ⏰ Recordatorios opcionales con fecha y hora
- 🔔 Toasts persistentes que aparecen en cualquier página
- 🌍 Soporte multilingüe (Español/Inglés)
- 💾 Almacenamiento local (chrome.storage.local)
- 🎨 Diseño sobrio y compacto

## Instalación

### Desarrollo

1. Clona o descarga este repositorio
2. Instala las dependencias:
   ```bash
   npm install
   ```
3. Construye la extensión:
   ```bash
   npm run build
   ```
4. Abre Chrome y ve a `chrome://extensions/`
5. Activa el "Modo de desarrollador" en la esquina superior derecha
6. Haz clic en "Cargar extensión sin empaquetar"
7. Selecciona la carpeta `dist` del proyecto

### Uso

1. Haz clic en el icono de la extensión en la barra de herramientas
2. Añade tareas escribiendo en el campo de texto y presionando "Añadir"
3. Opcionalmente, establece un recordatorio con fecha y hora
4. Marca las tareas como completadas con el radio button
5. Elimina tareas con el botón "×"
6. Los recordatorios aparecerán como toasts en la esquina inferior derecha de cualquier página

## Scripts disponibles

- `npm run dev` - Modo desarrollo con Vite
- `npm run build` - Construir la extensión para producción
- `npm run zip` - Crear archivo ZIP de la extensión

## Estructura del proyecto

```
src/
├── popup/           # Interfaz React del popup
├── background/      # Service Worker para alarmas
├── content/         # Content script para toasts
└── common/          # Utilidades compartidas (storage, i18n, tipos)
```

## Tecnologías

- React 18
- TypeScript
- Vite
- Chrome Extensions API (Manifest V3)
- CSS moderno

## Licencia

MIT
