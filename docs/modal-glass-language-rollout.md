# Modal Glass Language — Rollout Plan (2016-09)

> **Regla de oro:** El modal canónico es **`MinimalistTaskModal.tsx` en "Modo Crear"** (form mode).
> Todo modal del app debe reproducir **exactamente** ese lenguaje — no "parecido".
> Los cambios se hacen **por pestaña, en incrementos**: schedule primero, luego settings.
> Después de cada incremento: `npx tsc --noEmit` (exit 0) + tests + commit + push a `feature/schedule-session`.

---

## 0 · CAMBIO #1 (obligatorio, primer commit): "Modo Crear" en TODOS los modals

Rediseñar los 6 modals que NO siguen el lenguaje glass para que sean recontrucciones del
modal de tareas en **Modo Crear (form mode)**. Los 6:

| # | Archivo | Pestaña | Estado hoy vs canónico |
|---|---------|---------|------------------------|
| 1 | `src/components/schedule/MinimalistAssignSlotModal.tsx` | schedule | Backdrop frost ✅ · header: título izquierda, SIN X glass, SIN título centrado |
| 2 | `src/components/schedule/MinimalistDayTasksModal.tsx` | schedule | Backdrop plano `rgba(0,0,0,0.72)` ❌ frost · SIN X glass · título izquierda |
| 3 | `src/components/settings/SystemSettingsModal.tsx` | settings | Flat completo `#1C1C1E`, sin glass, rediseño estructural (§3) |
| 4 | `src/components/settings/ReminderTimeModal.tsx` | settings | Flat completo, hora → **context menu nativo** (§3.6) |
| 5 | `src/components/auth/ClassAuthModal.tsx` | settings | Flat `#1C1C1E`, sin glass (§3) |
| 6 | `src/components/profile/MinimalistCredentialModal.tsx` | settings | Flat `#1C1C1E`, sin glass (§3) |

### Los tokens EXACTOS a replicar (form mode canónico)

**Backdrop (frost + dim ligero + fade):**
```tsx
<BlurView intensity={48} tint="dark" style={StyleSheet.absoluteFill} />
<View style={{ backgroundColor: 'rgba(0, 0, 0, 0.38)', ...StyleSheet.absoluteFill }} />
```
- Frost: `BlurView intensity 48 / tint dark` · dim: `rgba(0,0,0,0.38)` · fade: `Animated.timing` ~240ms.
- **NO** negros planos `rgba(0,0,0,0.72)`; **NO** drag-line gris centrada arriba.

**Header (patrón canónico — botones glass + título centrado):**
- Botón X glass **58×58**, redondo, `NativeGlassIconButton` con SF Symbol `xmark` (tasks/).
- Título **centrado absoluto**, blanco `#FFFFFF`, **17px / 700** / letterSpacing −0.3.
- Filigrana inferior: hairline `rgba(255,255,255,0.12)`.
- Lado derecho: segundo `NativeGlassIconButton` **58×58** (checkmark) cuando haya acción primaria.

**Cards / inputs glass (cards ligeras, sin bordes duros):**
```tsx
backgroundColor: 'rgba(255, 255, 255, 0.07)',  // glass card
borderRadius: 16,
overflow: 'hidden',
// separador entre filas:
// hairline 0.5px rgba(255,255,255,0.12), inset izquierdo 54
```
- Valor activo: `#A1A1A6` weight 500 · placeholder/detalle gris: `#8E8E93`.
- Títulos de sección: 13px, `#8E8E93`, weight 600, letterSpacing 0.2.
- Botones principales tipo iOS tint `#0A84FF` (o glass según contexto).

### Checklist por modal (CAMBIO #1)

Para **AssignSlot** y **DayTasks** (schedule):
- [ ] Backdrop → BlurView frost + `rgba(0,0,0,0.38)` dim + fade (DayTasks está plano; AssignSlot ya usado frotado).
- [ ] Header: **X glass 58×58** (import `NativeGlassIconButton`) + **título centrado** (17/700) + hairline.
- [ ] Cards de sujetos/materias → glass `rgba(255,255,255,0.07)` radius 16 con hairlines inset 54.
- [ ] Confirmar `npx tsc --noEmit` exit 0 → `npm test` → commit `feat(schedule): glass form language en modals` → push.

---

## 1 · Orden general (acordado)

1. **Schedule** (2 modals) — liderado por el CAMBIO #1. Commit + push.
2. **Settings** — rediseño estructural + el mismo CAMBIO #1. Commit + push en incrementos por modal.

---

## 2 · INCREMENTO SCHEDULE (después del CAMBIO #1)

Ya tienen glass cards/hairlines/haptics en gran medida; el delta real es el header y backdrop
(ver checklist #1). Sin más cambios estructurales. Verificar, commit, push.

---

## 3 · INCREMENTO SETTINGS (rediseño estructural explicitado por el usuario)

Requisitos exactos del usuario (esto es una **reescritura de diseño**, no solo estilos):

### 3.1 · `SystemSettingsModal` — pantalla completa, no bottom sheet
- **Fullscreen** (no hoja inferior, no arrastre). Sin **drag-line gris centrada** arriba.
- Arriba: **foto de perfil** + **nombre** (estudiante) debajo.
- Después, las demás opciones del sistema.
- **Eliminar redundancia "Nombre de estudiante"** (el estudiante ya está arriba con su foto).
- **Eliminar vista de credencial digital** (fuera del lenguaje glass; es contenido planar legacy).
- Animación: **slide desde la derecha** (tipo panel ChatGPT), `-Clase` de entrada desde la
  derecha + haptics, optimizada para rendimiento (transform-only, no layout).
- Botones glass / cards glass según §0.

### 3.2 · Foto + nombre arriba
Patrón: foto circular glass (dot hairline) → debajo nombre `#FFFFFF` 17/700 → debajo el resto.

### 3.3 · Quitar "Nombre de estudiante" redundante
El header ya muestra el nombre; eliminar la fila repetida.

### 3.4 · Sin credencial digital
Quitar pantalla/vista de "credencial digital" del sistema de settings.

### 3.5 · Animación de apertura: slide desde la derecha (ChatGPT)
Como los paneles laterales de ChatGPT: el modal entra deslizando desde el borde derecho.
Cuidar rendimiento (evitar BlurView pesado si se jitterea; usar translateX + fade solo).

### 3.6 · Modal de hora de aviso → context menu nativo
`ReminderTimeModal` se convierte en **context menu nativo** (`@react-native-menu/menu`
`UIMenu`, como ya se usa en otros gestos del app) con las opciones de hora compactas en vez
de un sheet. Eliminar el sheet.

---

## 4 · Tokens globales de referencia (rompecabezas de consistencia)

| Token | Valor |
|-------|-------|
| Sheet bg | `#1C1C1E` (fallback plano) · glass: `rgba(255,255,255,0.07)` cards + hairline 0.12 |
| Frost | `BlurView intensity 48 tint dark` + dim `rgba(0,0,0,0.38)` |
| Título | `#FFFFFF` 17px/700, letterSpacing −0.3, centrado |
| Detalle/subtitulo | `#8E8E93` 12px/500 |
| Valor activo | `#A1A1A6` weight 500 |
| Placeholder | `#8E8E93` |
| Botón X/glass | `NativeGlassIconButton` 58×58 SF `xmark`/`checkmark`/`chevron.backward` |
| Hairline | `rgba(255,255,255,0.12)` 0.5px, inset 54 |
| Radius card | 16 · hairline botones 12 |
| Haptics | `triggerHaptic` + sonidos (`playModalCloseSound`) en close |
