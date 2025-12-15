# R2 Storage Path Standard v1.0

## Path Structure
All persistent storage paths must follow: `users/:userId/:category/:year/:month/:uuid-:filename`

## Segments
- `users`: Static prefix for user namespace
- `:userId`: Clerk user ID
- `:category`: Functional module (see approved categories below)
- `:year/:month`: UTC creation date for partitioning
- `:uuid`: Backend/frontend generated UUID v4 for uniqueness
- `:filename`: Sanitized original filename for R2 dashboard readability

## Approved Categories

| Category | Description | Content Types | Retention |
|----------|-------------|---------------|-----------|
| `scribe_exports` | Scribe final products | PDFs, LaTeX compiled | Permanent |
| `class_audio` | Class recordings | MP3, M4A, MP4 (audio only) | Permanent |
| `rubrics` | Context files | Rubric PDFs, screenshots | Permanent |
| `user_uploads` | Library general files | PDFs, readings, loose images | Permanent |
| `avatars` | Profile images | JPG, PNG | Overwritable |
| `temp` | Intermediate processing | Audio chunks, temp files | 24 hours |

**Note**: Use only these categories. Don't create new ones without updating this guide.

## Examples
- Scribe PDF: `users/user_2b8c9.../scribe_exports/2025/10/550e8400...-ensayo-final.pdf`
- Class recording: `users/user_2b8c9.../class_audio/2025/10/a1b2c3d4...-neuroscience-lec4.m4a`
- Rubric upload: `users/user_2b8c9.../rubrics/2025/10/99887766...-midterm-requirements.pdf`
