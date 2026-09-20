# Lenguaje de Diseño — Replicable entre pestañas (Tareas → Horarios → Hoy/Perfil)

> Memoria de diseño para que cualquier pestaña tenga el mismo estilo minimalista
> "liquid glass" que la pestaña **Tareas**. Las fuentes mandan si hay discrepancia:
> consulta `app/(tabs)/tasks.tsx`, `src/components/tasks/*` y `src/components/schedule/*`.
>
> **Estado:** ✅ Tareas (origen) · ✅ Horarios (replicado) · ⬜ Hoy · ⬜ Perfil

---

## 1. Paleta (dark / liquid glass)

| Token | Valor | Uso |
|---|---|---|
| Fondo pantalla | `#000000` | Todas las pantallas |
| Fondo sheet | `#1C1C1E` | Modales bottom sheets |
| Texto primario | `#FFFFFF` | Títulos, valores activos |
| Texto secundario | `#71717A` | Metas, labels inactivos |
| Texto suave | `#A1A1AA` | Subtítulos de pantalla |
| Texto terciario | `#52525B` | Placeholders, "Hora Libre" |
| Hairline | `rgba(255,255,255,0.08–0.12)` | Separadores 0.5px |
| Tarjeta glass | `rgba(255,255,255,0.07)` | Cards + inputs de formulario |
| Fila presionada | `rgba(255,255,255,0.04)` | Highlight de fila |
| Píldora activa | `#FFFFFF` | Segmented / selector de día |

## 2. Tipografía

| Elemento | Tamaño / peso / tracking |
|---|---|
| Título grande (colapsable) | 34 / 800 / **-0.8** |
| Título compacto (sticky bar) | 17 / 700 / -0.4 |
| Título de fila | 15 / 600 / -0.2 |
| Meta de fila (horas, iconos) | 11 / 500 / #71717A, separador `•` #3F3F46 |
| Labels segment control | 12.5 / 600 / **-0.1** (activo 800) |
| Header de sección grupo | 13 / 600 / #8E8E93, letterSpacing **0.2**, sentence case (nada de MAYÚSCULAS) |
| Título de modal | 17 / 700 / -0.3 |
| Subtítulo de modal (`N registradas`) | 11 / 500 / #71717A |

## 3. Sticky bar superior (Apple Notes / WhatsApp)

- `position: absolute`, alto `insets.top + 56`, `zIndex: 100`.
- Fondo: `BlurView` dark — intensidad **75 iOS / 90 Android** — con fade-in por scroll (`scrollY.interpolate([18,38] → [0,1])`).
- Hairline inferior `rgba(255,255,255,0.12)`.
- Layout de 3 columnas `paddingHorizontal: 20`: izquierda (pill/botón), centro **título compacto**, derecha **acción principal**.
- Título compacto aparece con fade+slide (`[40,60]` → opacity 0→1, translateY 6→0).
- El título grande colapsa en scroll: opacity `[4,45] → [1,0]`, translateY -24, scale 0.92, con `titleCoverBlock` de fondo `#000000` + `zIndex 20` para no transparentar el contenido.
- ScrollView: `bounces`, `alwaysBounceVertical`, `keyboardShouldPersistTaps`, `onScrollBeginDrag` → `Keyboard.dismiss()`, `scrollEventThrottle: 16`.

## 4. Botones glass

### Circulares (header de pantalla)
- **44×44**, `borderRadius: 22`, `borderCurve: 'continuous'`, press scale 0.9 (spring speed 40 / bounciness 4).
- **Variante blanca (acción principal):** `rgba(255,255,255,0.92)`, icono `#18181B`. Ej: `+` en Tareas, `BookOpen` en Horarios.
- **Variante oscura (secundaria):** icono `#FFFFFF`.
- iOS: `GlassView` nativo (`isInteractive`); fallback Android/web: `BlurView` + borde. Respetar `AccessibilityInfo.isReduceTransparencyEnabled()`.

### Cabecera de modal — `NativeGlassIconButton`
- iOS: SwiftUI `buttonStyle('.glass')` + `buttonBorderShape('circle')`, **58×58**, icono SF Symbol `xmark` / `checkmark` / `back` (chevron.backward).
- Android/web: `BlurView` + sheen translúcido, union actual `'xmark' | 'checkmark' | 'back'`.
- `variant="prominent"` para la acción de guardar.

## 5. Segment control / selector de días

- Contenedor: `BlurView` dark **55 iOS / 90 Android**, bg `#000000`, borde 1 `rgba(255,255,255,0.08)`, padding 3, **radius 14**, alto 42.
- Píldora blanca deslizante: **radius 11**, sombra negra `shadowOpacity 0.15 / radius 4 / elevation 3` (spring `SPRING_SLIDE_INDICATOR`).
- Labels 12.5/600/-0.1; activo `#000000` 800, inactivo `#71717A`. Iconos permitidos (CalendarDays/LayoutGrid en Horarios).
- Alineado en: `TasksSegmentControl`, segmento Horario (Diaria/Matriz), selector de días `MinimalistDayView`.

## 6. Filas (gestos estilo Spotify)

- Sin bordes de tarjeta: hairline separador `rgba(255,255,255,0.08)`, dots de color 6px, metas con `•` #3F3F46, iconos #71717A.
- Gestos: check de completado a la izquierda, favoritos swipe a la derecha, papelera swipe izquierda (patrón Spotify en `MinimalistTaskRow`).
- Título de materia en fila de clase (Horarios): 15/600 (ya no 700).

## 7. Modal bottom sheet

- Sheet `#1C1C1E`, **radius 28 superior** `borderCurve: 'continuous'`, **sin bordes** (⚠️ no reintroducir el borde brillante `rgba(255,255,255,0.12)` que se eliminó).
- Backdrop negro al 72% (`rgba(0,0,0,0.72)`), drag handle 36×5 `rgba(255,255,255,0.25)`.
- Header: drag handle + `X`/`Check` glass a los lados (58px de side para centrar el título) + título centrado 17/700.
- **GroupCard:** `rgba(255,255,255,0.07)` + `BlurView intensity 24`, radius 16, sin borde; hairlines internos 0.5px `rgba(255,255,255,0.12)`.
- **Inputs glass:** título 17.5/700/-0.3, notas/profesor 14.5 `#D4D4D8`, hairline entre campos, placeholder #71717A.

## 8. Menú de materias (context menu nativo iOS)

- `@react-native-menu/menu`: acción por materia con `image: 'circle.fill'` + `imageColor: subj.color` (hex OK) + `state: 'on'/'off'`.
- Item "General (Sin materia)": icono `tray` gris.
- `themeVariant="dark"`, haptic `selection`. En web, fallback a sub-página real (no código muerto).
- En el modal de tarea también hay fila de materia con `ChevronDown` en iOS.

## 9. Búsqueda (píldora del header)

- Píldora 92×44, dos zonas táctiles de 44 separadas por hairline; izquierda filtro de materias (punto de color activo), derecha buscar.
- Expand al focar, haptic `light`.

## 10. Estados vacíos

- Icono 36 `#27272A` (ej. `CheckCircle2`), título 14.5/600 `#E4E4E7`, subtexto 12 `#71717A`.

## 11. Motion / haptics

- `LAYOUT_EASE` (listas/layout), springs solo para microinteracciones (píldora segment, press scale).
- Entrada escalonada `useCardEntrance(n, key)` por pantalla.
- Haptics: `selection` (filtros, menús), `light` (acciones), `medium` (primarias/submit), `success`/`heavy` (check completado).
- Sonidos `personalAudio` (save, trash, confetti…).

## 12. Específico de Horarios (decisiones tomadas)

- **Matriz semanal:** el grid es estructura tipo tabla → **mantiene bordes** suavizados (`rgba(255,255,255,0.06)` celdas, `0.05` headers); la celda HOY es píldora blanca.
- Botón "Materias": **circular 44×44 glass blanco** con `BookOpen` (sin texto, patrón `+` de Tareas).
- Modal de materias: header X/back + Check glass, formulario en tarjeta glass (nombre + profesor), lista en GroupCard con encabezado "Registradas (n)".

---

## Checklist de replicación

- [x] Sticky bar blur + hairline + título compacto + acción derecha
- [x] Título grande colapsable (opacity/translate/scale) sincronizado al scroll
- [x] Botón circular glass 44×44 (variante blanca para acción principal)
- [x] Segment control BlurView 55/90, radius 14, píldora radius 11, sombra 0.15, tracking -0.1
- [x] Filas sin bordes + hairlines + dots de color + metas `•`
- [x] Modales: sheet sin borde brillante, radius 28, títulos 17/700, header X/Check glass
- [x] Formularios + listas en GroupCard `rgba(255,255,255,0.07)` radius 16 sin borde
- [x] Headers de sección 13/600 #8E8E93 letterSpacing 0.2 sentence case
- [x] Estados vacíos con icono 36 #27272A + título 14.5/600
- [x] Entrada escalonada `useCardEntrance` + springs + haptics
- [x] Grid de matriz: bordes estructurales suavizados (0.05–0.06) [Horarios]