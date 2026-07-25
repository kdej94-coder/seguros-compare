# SegurosCompare 🛡️

> **Comparador automático de cotizaciones de seguros a partir de archivos PDF.**

Herramienta open source que automatiza el proceso de comparación de propuestas de seguros. Suba las cotizaciones en PDF de distintas aseguradoras y el sistema extraerá los datos relevantes, los organizará en tablas comparativas y recomendará la mejor opción.

## 🚀 ¿Qué problema resuelve?

En el sector asegurador, los agentes y promotores comparan manualmente cotizaciones de múltiples aseguradoras usando hojas de Excel. Este proceso:

- Es **lento** y propenso a errores de captura.
- Requiere **conocimiento técnico** para interpretar cada formato de PDF.
- Se repite **cada vez** que hay una renovación o nueva solicitud.

**SegurosCompare** automatiza todo esto: suba los PDFs y obtenga al instante la comparativa y la recomendación.

## ✨ Características

- 📤 **Carga de PDFs**: Arrastre o seleccione múltiples archivos PDF de cotizaciones.
- 🔍 **Extracción automática de datos**: Identifica aseguradora, prima neta, sumas aseguradas, coberturas y más.
- 📊 **Dashboard interactivo**: Visualice todas las propuestas en tablas comparativas dinámicas.
- ⭐ **Recomendación automática**: Motor de evaluación que selecciona la mejor propuesta según costo y cobertura.
- 🖨️ **Exportar / Imprimir**: Genere un reporte ejecutivo listo para presentar al cliente.
- 🧹 **Limpiar datos**: Reinicie el comparativo para un nuevo estudio.

## 🛠️ Tecnologías

| Tecnología | Uso |
|---|---|
| **Node.js** | Runtime del servidor |
| **Express** | Framework HTTP / API REST |
| **pdf-parse** | Extracción de texto de archivos PDF |
| **Multer** | Manejo de carga de archivos |
| **HTML5 / CSS3 / JS** | Interfaz de usuario (frontend) |

## 📦 Instalación

### Pre-requisitos

- [Node.js](https://nodejs.org/) v18 o superior

### Pasos

1. **Clone el repositorio:**
   ```bash
   git clone https://github.com/tu-usuario/seguros-compare.git
   cd seguros-compare
   ```

2. **Instale las dependencias:**
   ```bash
   npm install
   ```

3. **Inicie la aplicación:**
   ```bash
   npm start
   ```

4. **Abra su navegador en:**
   ```
   http://localhost:3000
   ```

## 📂 Estructura del Proyecto

```
seguros-compare/
├── public/              # Frontend (HTML, CSS, JS)
│   ├── index.html       # Página principal del dashboard
│   ├── styles.css       # Estilos del dashboard
│   └── app.js           # Lógica del frontend
├── uploads/             # Directorio temporal para PDFs subidos
├── server.js            # Servidor Express y lógica de extracción
├── package.json         # Dependencias y scripts
├── .gitignore           # Archivos excluidos de Git
└── README.md            # Este archivo
```

## 🤝 Contribuciones

¡Las contribuciones son bienvenidas! Si desea mejorar el proyecto:

1. Haga un fork del repositorio.
2. Cree una rama para su feature (`git checkout -b feature/nueva-funcionalidad`).
3. Haga commit de sus cambios (`git commit -m 'Agrega nueva funcionalidad'`).
4. Haga push a la rama (`git push origin feature/nueva-funcionalidad`).
5. Abra un Pull Request.

### Ideas para contribuir

- [ ] Soporte para más formatos de aseguradoras mexicanas (HDI, AXA, Zurich, etc.)
- [ ] Extracción de deducibles y cláusulas de valor de reposición
- [ ] Persistencia en base de datos (SQLite / PostgreSQL)
- [ ] Autenticación de usuarios
- [ ] Gráficos interactivos (Chart.js / D3.js)
- [ ] Soporte multi-idioma

## 📄 Licencia

Este proyecto está bajo la licencia [MIT](LICENSE).

---

Hecho con ❤️ para la comunidad de código abierto.
