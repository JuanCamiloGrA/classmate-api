R2 Storage Path Standard v1.0

Estructura Base

Todas las rutas de almacenamiento persistente deben seguir estrictamente este formato:

users/:userId/:category/:year/:month/:uuid-:filename

Definición de Segmentos

users: Prefijo estático para namespace de usuarios.

:userId: El ID único del usuario (Clerk ID).

:category: El módulo funcional al que pertenece el archivo.

:year/:month: Fecha de creación (UTC) para particionamiento.

:uuid: UUID v4 generado en el backend/frontend para garantizar unicidad.

:filename: Nombre original sanitizado (solo caracteres seguros) para legibilidad en el dashboard de R2.

Categorías Aprobadas

Usa estas categorías para mantener el bucket organizado. No inventes categorías nuevas sin actualizarlas aquí.

Categoría

Descripción

Ejemplo de Contenido

Retención

scribe_exports

Productos finales de Scribe

PDFs generados, LaTeX compilado

Permanente

class_audio

Grabaciones de clases

MP3, M4A, MP4 (Audio only)

Permanente

rubrics

Archivos de contexto

PDFs de rúbricas, capturas de pantalla

Permanente

user_uploads

Archivos generales de Library

PDFs, lecturas, imágenes sueltas

Permanente

avatars

Imágenes de perfil

JPG, PNG

Sobreescribible

temp

Procesamiento intermedio

Chunks de audio, archivos temporales

24 Horas

Ejemplos Reales

Un PDF generado por Scribe:
users/user_2b8c9.../scribe_exports/2025/10/550e8400...-ensayo-final.pdf

Una grabación de clase:
users/user_2b8c9.../class_audio/2025/10/a1b2c3d4...-neuroscience-lec4.m4a

Una rúbrica subida:
users/user_2b8c9.../rubrics/2025/10/99887766...-midterm-requirements.pdf
