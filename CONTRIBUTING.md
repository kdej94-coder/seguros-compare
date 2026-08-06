# Contribuir a SegurosCompare

¡Gracias por tu interés en contribuir a **SegurosCompare**!

## Código de Conducta

Este proyecto sigue el [Código de Conducta del Contributor Covenant](https://www.contributor-covenant.org/). Al participar, te comprometemos a mantener un ambiente respetuoso y colaborativo.

## ¿Cómo puedo contribuir?

### Reportar Bugs
1. Verifica que el bug no haya sido reportado previamente en los [Issues](https://github.com/kdej94-coder/seguros-compare/issues).
2. Crea un nuevo Issue con la etiqueta `bug` describiendo:
   - Pasos para reproducir el problema
   - Comportamiento esperado vs. observado
   - Capturas de pantalla (si aplica)

### Proponer Funcionalidades
1. Abre un Issue con la etiqueta `enhancement`.
2. Describe la funcionalidad y su valor para el usuario.

### Enviar Código

1. **Fork** el repositorio.
2. **Clona** tu fork:
   ```bash
   git clone https://github.com/TU-USUARIO/seguros-compare.git
   cd seguros-compare
   ```
3. **Crea una rama** para tu cambio:
   ```bash
   git checkout -b feature/mi-mejora
   ```
4. **Realiza tus cambios** y asegúrate de que las pruebas pasen:
   ```bash
   npm test
   ```
5. **Haz commit** con un mensaje descriptivo:
   ```bash
   git commit -m "feat: descripción clara del cambio"
   ```
6. **Sube tu rama**:
   ```bash
   git push origin feature/mi-mejora
   ```
7. **Abre un Pull Request** en GitHub hacia la rama `main`.

## Convenciones de Commits

Usamos [Conventional Commits](https://www.conventionalcommits.org/):
- `feat:` Nueva funcionalidad
- `fix:` Corrección de bug
- `docs:` Cambios en documentación
- `style:` Formato (sin cambio de lógica)
- `refactor:` Reestructuración de código
- `test:` Agregar o modificar pruebas
- `chore:` Tareas de mantenimiento

## Requisitos para PRs
- Todas las pruebas unitarias deben pasar (`npm test`).
- El PR debe incluir una descripción clara de los cambios realizados.
- Si agrega una nueva funcionalidad, incluya pruebas unitarias correspondientes.
