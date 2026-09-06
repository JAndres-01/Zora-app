# Zora 2.0 — Asistente Académico Universitario Nativo

[![React Native](https://img.shields.io/badge/React_Native-0.86.3-000000?style=for-the-badge&logo=react)](https://reactnative.dev/)
[![Expo SDK](https://img.shields.io/badge/Expo_SDK-57.0.0-000000?style=for-the-badge&logo=expo)](https://expo.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-000000?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
![Architecture](https://img.shields.io/badge/Architecture-100%25_Local--First-000000?style=for-the-badge)

**Zora** es una aplicación móvil académica de alto rendimiento diseñada específicamente para estudiantes universitarios. Implementada con una arquitectura **100% Local-First**, garantiza soberanía absoluta sobre los datos personales y académicos, operando de manera completamente autónoma sin depender de servidores en la nube ni conexión a internet.

---

## ⚡ Principios de Ingeniería

1. **Local-First & Privacidad Absoluta:**
   Todos los horarios, materias, tareas y credenciales se almacenan exclusivamente en el dispositivo del usuario (`@react-native-async-storage/async-storage` y el sistema de archivos del sandbox). No existen servidores de telemetría ni bases de datos remotas.
2. **Capa Dual de Almacenamiento (In-Memory Cache + Persistencia Reactiva):**
   Para eliminar el retardo de I/O en disco, el motor de almacenamiento mantiene copias en memoria sincronizadas con un bus de eventos reactivo (`subscribeToPersonalStorage`). Las lecturas de vista son instantáneas (0ms).
3. **Estética Minimalista OLED (Pure Black):**
   Paleta visual optimizada para pantallas OLED/AMOLED (`#000000`), reduciendo drásticamente el consumo de batería en jornadas de estudio prolongadas.
4. **Microinteracciones y Rendimiento:**
   Animaciones fluidas a 60–120 FPS delegadas al hilo nativo (`useNativeDriver: true`) combinadas con retroalimentación háptica táctil precisa (`expo-haptics`).

---

## 📱 Módulos Principales

- **Dashboard Diario (`today.tsx`):**  
  Hero inteligente en tiempo real con ticker dinámico que detecta automáticamente la clase en curso, calcula el tiempo restante del bloque académico y muestra las entregas pendientes prioritarias del día.
- **Horarios y Matriz Semanal (`schedule.tsx`):**  
  Vista dual con alternador suave entre:
  - *Vista Diaria:* Lista abierta de bloques horarios con pastilla deslizante y estado de tareas asociadas.
  - *Matriz Semanal:* Grilla matricial completa con navegación bidireccional y tarjetas de bloque interactivas.
- **Gestión de Tareas (`tasks.tsx`):**  
  Búsqueda con *debounce*, filtros por estado (Pendientes / Completadas) y materia, selector rápido de fecha académica de entrega y soporte para adjuntar archivos locales.
- **Perfil y Credencial Digital (`settings.tsx`):**  
  Tarjeta de identificación del estudiante con visualizador nativo seguro de credencial (soporte para PDF e imágenes protegido contra fallos de WebView en Android y adaptable al sandbox de iOS).
- **Métricas y Análisis Académico (`stats/`):**  
  Mapa de calor de actividad anual, balance de dedicación por materia y estadísticas vitales de cumplimiento.
- **Notificaciones Locales (`personalNotifications.ts`):**  
  Sistema de alertas y recordatorios programados en el reloj del sistema operativo (clases y tareas) sin necesidad de servicios Push remotos.

---

## 🛠️ Stack Tecnológico

| Componente | Tecnología |
| :--- | :--- |
| **Framework Móvil** | React Native 0.86.3 |
| **Ecosistema & Runtime** | Expo SDK 57.0.0 |
| **Enrutamiento y Navegación** | Expo Router 57 (File-based Routing) |
| **Lenguaje & Tipado** | TypeScript 6.0 (Modo Estricto) |
| **Biblioteca de UI** | React 19.2.3 |
| **Almacenamiento Local** | `@react-native-async-storage/async-storage` |
| **Efectos Nativos** | `expo-blur`, `expo-haptics`, `expo-notifications`, `expo-sharing` |
| **Iconografía** | `lucide-react-native` |
| **Testing** | Jest + React Native Testing Library |

---

## 🚀 Inicio Rápido

### Requisitos Previos

- **Node.js**: Versión LTS recomendada (>= 20.x).
- **Gestor de Paquetes**: `npm` (incluido con Node.js).
- **Expo Go** o simulador nativo (Xcode Simulator para iOS / Android Studio Emulator).

### Instalación

```bash
# 1. Clonar el repositorio
git clone https://github.com/JAndres-01/Zora-app.git
cd Zora-app

# 2. Instalar dependencias
npm install

# 3. Iniciar el servidor de desarrollo Metro
npm start
```

Desde la consola interactiva de Expo:
- Presiona `a` para abrir en un emulador Android conectado.
- Presiona `i` para abrir en el simulador de iOS (macOS).
- Escanea el código QR con la app **Expo Go** en tu dispositivo físico.

---

## 🧪 Pruebas y Control de Calidad

Zora cuenta con una cobertura completa de pruebas unitarias sobre sus motores matemáticos de horarios, utilidades de fecha académica y capa de persistencia local:

```bash
# Ejecutar la suite completa de pruebas unitarias
npm test

# Verificación de compilación estricta de TypeScript (0 errores)
npx tsc --noEmit
```

---

## 📂 Estructura del Código

```text
Zora/
├── app/                              # Rutas basadas en archivos (Expo Router)
│   ├── _layout.tsx                   # Layout raíz con proveedores globales
│   ├── index.tsx                     # Redirección inicial hacia (tabs)/today
│   └── (tabs)/                       # Pestañas principales de navegación
│       ├── _layout.tsx               # Isla flotante de pestañas con BlurView
│       ├── today.tsx                 # Tab: Dashboard Diario y En Vivo
│       ├── schedule.tsx              # Tab: Horarios y Matriz Semanal
│       ├── tasks.tsx                 # Tab: Entregas y Tareas
│       └── settings.tsx              # Tab: Perfil, Ajustes y Métricas
├── src/
│   ├── components/                   # Componentes de presentación organizados por dominio
│   │   ├── common/                   # Modales genéricos, visores y confirmaciones
│   │   ├── effects/                  # Efectos visuales nativos (ej. confeti de logro)
│   │   ├── navigation/               # Barra de navegación flotante y tabs
│   │   ├── profile/                  # Tarjetas y visores de credencial estudiantil
│   │   ├── schedule/                 # Vistas diaria y matricial de horarios
│   │   ├── settings/                 # Formularios de ajustes y configuración de semestre
│   │   ├── stats/                    # Gráficos, balance por materia y heatmap
│   │   ├── tasks/                    # Filas, modales y selectores de tareas
│   │   └── today/                    # Ticker en vivo y resumen del día
│   ├── constants/                    # Bloques horarios, fechas y tokens de diseño
│   ├── context/                      # Contexto de autenticación y perfil local
│   ├── lib/                          # Motores de cálculo de horario, fechas y persistencia
│   └── types/                        # Tipado TypeScript unificado del dominio
├── assets/                           # Identidad gráfica (iconos y splash screen OLED)
├── jest.setup.js                     # Configuración y mocks de pruebas Jest
└── package.json                      # Manifiesto de dependencias y scripts
```

---

## 📄 Licencia

Este proyecto está distribuido bajo la licencia MIT. Consulta el archivo [LICENSE](./LICENSE) para más detalles.
