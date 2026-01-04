# Auditoría de Seguridad — Classmate Agent (Agents / ClassmateAgent)

**Fecha:** 4 de enero de 2026

## Alcance revisado
- Documentación: `docs/classmate-agent/CLASSMATE_AGENT.md`
- Configuración Worker/DO/Secrets: `wrangler.jsonc`
- Entry point y hard-gate: `src/index.ts`
- Auth util WS/HTTP: `src/interfaces/http/routes/chat.ts`
- Durable Object Agent: `src/infrastructure/agents/classmate-agent.ts`
- Endpoint interno DO→Worker: `src/interfaces/http/routes/internal-chats.ts`
- Tooling/HITL: `src/infrastructure/ai/utils.ts`, `src/infrastructure/ai/tools/*`, `src/infrastructure/ai/config/*`
- Skill assets: `assets/agents/classmate/skills/**/*.txt`
- Prompt loader: `src/infrastructure/prompt/assets.prompt.service.ts`

---

## 1) Resumen Ejecutivo
**Postura general:** buena base de seguridad (hard gate antes de crear el DO, autenticación Clerk, UUID validation, ownership check en D1, separación de herramientas por modo, HITL para operaciones destructivas, secretos en Secrets Store).  
**Riesgos principales (prioridad alta):**
1. **Token de sesión en querystring (`_clerk_session_token`)** aceptado para WS/HTTP y procesado por el DO: alta probabilidad de exposición por logs, referers, historial, proxies y tooling.
2. **Endpoint interno `/internal/chats/sync` auto-provisiona chats** si no existen: combinado con “internal key” (shared secret) puede permitir creación/contaminación de chats si esa key se filtra o se reutiliza en otro entorno.
3. **Ausencia de anti-replay / binding DO↔chatId** en llamadas internas: el DO envía `chatId=this.name` y `userId` desde state, pero el servidor interno confía en lo recibido tras validar la internal key (no valida además que el emisor sea el DO esperado).
4. **Prompt-supply-chain**: skills/prompt se cargan desde `ASSETS` (`assets.prompt.service.ts`), lo cual es correcto, pero no hay verificación de integridad/versionado; si el pipeline de assets se ve comprometido, se compromete el “policy layer” del agente.

---

## 2) Arquitectura y Superficies de Ataque

### 2.1 Rutas / entrada del Worker
- `src/index.ts` intercepta `if (url.pathname.startsWith("/agents/"))` y aplica:
  - CORS específico con `ALLOWED_ORIGIN` (Secrets Store)
  - `verifyClerkAuth(...)` (Clerk)
  - Validación UUID (`UUID_REGEX`)
  - Ownership check en D1: `chatRepo.exists(auth.userId, conversationId)`
  - Luego llama `routeAgentRequest(request, env, { cors })`
**Puntos fuertes**
- **Hard gating antes del DO** reduce creación ilimitada de DOs y evita acceso a chat ajeno.
- Rate-limit “edge guardrail” para `/get-messages` (mitiga loops/polling runaway).
**Gaps**
- No aparece **rate limit por usuario/chat** para POST/WS beyond guardrail específico de `get-messages`.
- El CORS hace fallback a `allowedOrigins[0]` o `"*"` si no hay `Origin`. En `/agents/*` esto puede abrir la superficie a clientes no-browser (no aplica CORS de browser), pero sí impacta navegadores si `allowedOrigins` queda vacío o mal configurado.

### 2.2 Auth de WebSocket
- `src/interfaces/http/routes/chat.ts#L20` permite token en query `?_clerk_session_token=...` y lo valida con `verifyToken(...)`.
**Riesgo alto**
- **JWT en querystring** es un anti-pattern de seguridad. Se filtra fácilmente:
  - logs de CDN/WAF/proxy
  - historial del navegador
  - capturas de errores/observability
  - referer en navegación (si aplica)
  - herramientas como `wscat`, etc.

### 2.3 Durable Object (ClassmateAgent)
- `src/infrastructure/agents/classmate-agent.ts`:
  - `onConnect` exige `_clerk_session_token` en query; verifica token y setea state.
  - `onRequest`: si no `state.userId`, intenta derivarlo desde query token.
  - `onChatMessage`: procesa tools/HITL, llama LLM via AI Gateway.
  - Persistencia: `syncToD1()` llama `POST /internal/chats/sync` con header `X-Internal-Key`.
  - `cleanupEmptyChat()` llama `POST /internal/chats/cleanup-empty` con `X-Internal-Key`.
**Puntos fuertes**
- No ejecuta herramientas destructivas automáticamente: HITL (sin `execute`) + ejecuciones en `executions.ts` tras `APPROVAL.YES`.
- Herramientas por modo: EXAM/STUDY/REVIEW read-only; DEFAULT incluye create + HITL de delete/update.
- Debounce alarm para sync reduce load.
**Gaps**
- El DO **vuelve a validar token** por su cuenta (bien) pero **requiere query token** (mismo problema).
- `extractTextFromMessage` hace fallback a `JSON.stringify(msg.parts)`; si “parts” incluye datos sensibles (p.ej. tool inputs con PII), puede terminar persistido/enviado al endpoint interno.
- Logs en ejecuciones HITL imprimen IDs y `reason`; si `reason` incluye PII, queda en logs.

### 2.4 Endpoint interno DO→Worker
- `src/interfaces/http/routes/internal-chats.ts` protege por `X-Internal-Key == INTERNAL_API_KEY`.
**Puntos fuertes**
- El secreto está en Secrets Store (`wrangler.jsonc` binding `INTERNAL_API_KEY`).
**Riesgo alto**
- `SyncChatMessagesEndpoint` hace **auto-provision chat** si no existe:
  - `if (!chatExists) await chatRepository.create({ id: chatId, userId })`
  - Esto contradice parcialmente el modelo “provision via POST /chats” y abre puerta a:
    - creación de chats sin pasar cuotas (si se obtiene el internal key)
    - state poisoning / spam de chats en nombre de un `userId` arbitrario enviado en body (si internal key se filtra)
- `verifyInternalKey` compara igualdad simple; no es un gran problema aquí (no suele ser explotable remotamente con timing por Cloudflare), pero lo ideal es comparación constante.

### 2.5 Tools/HITL
- `src/infrastructure/ai/utils.ts`:
  - Ejecuta tools HITL solo si `part.output === APPROVAL.YES`.
  - Si no, lanza “User denied…”.
**Riesgos**
- Si el cliente permite `addToolResult` sin UI confiable (p.ej. XSS), podría auto-aprobar herramientas. Esto es una **dependencia del frontend**, pero el backend podría reforzar:
  - atar approval a sesión/CSRF
  - revalidar que el tool call pertenece a ese usuario/chat

### 2.6 Skills / prompt-loading
- `src/infrastructure/ai/config/skills.ts` carga skills por path fijo bajo `agents/classmate/skills/...`
- `AssetsPromptService` hace fetch a `http://assets/${path}` usando `ASSETS` fetcher.
**Riesgos**
- Supply-chain de prompt: si se compromete `ASSETS`, se compromete policy del agente.
- No hay “allowlist” a nivel loader más allá del registry (esto está bien), pero no hay integridad/versión (hash).

---

## 3) Hallazgos (priorizados)

### [ALTO] A1 — Tokens en querystring (`_clerk_session_token`)
**Evidencia**
- `src/interfaces/http/routes/chat.ts#L35-L57`
- `src/infrastructure/agents/classmate-agent.ts#L118-L141` y `#L238-L256`
**Impacto**
- Exposición del token = secuestro de sesión / acceso a datos del usuario + acceso a DO si pasa hard gate.
**Recomendaciones**
- Migrar a uno de estos patrones:
  1. **Authorization header en WebSocket** (si el cliente y Cloudflare lo soportan en tu caso).
  2. **Cookie SameSite + CORS credentials** para WS (dependiendo del dominio y Clerk).
  3. **Ticket de WS de un solo uso**:
     - Cliente autentica via HTTP normal (cookie/header) → server emite `ws_ticket` corto (TTL 30-60s, single-use) ligado a `userId` + `chatId`.
     - WS conecta con `?ticket=...` (el ticket no es el token de Clerk) y el DO valida contra D1/KV.
- Si se mantiene temporalmente:
  - asegurar scrubbing en logs/observability (redact query)
  - prohibir referer leaks (policies)
  - TTL y rotación estricta de tokens

---

### [ALTO] A2 — Auto-provisioning en endpoint interno `/internal/chats/sync`
**Evidencia**
- `src/interfaces/http/routes/internal-chats.ts#L149-L175`
**Impacto**
- Si `INTERNAL_API_KEY` se filtra (o se usa en un entorno equivocado), un atacante puede crear chats en nombre de cualquier `userId` y poblar mensajes en D1 (integridad + quotas + facturación).
- También permite “bypass” conceptual del “chat provisioning gate”.
**Recomendaciones**
- Eliminar auto-provisioning del endpoint interno en producción:
  - En vez de crear, devolver `404` o `409` y loggear “chat missing”.
- Alternativa segura: permitirlo solo si:
  - el request incluye un **HMAC** calculado desde (`chatId`, `userId`, `lastSyncedSequence`, `timestamp`) con una key distinta por entorno
  - y/o el chat existe en una tabla “provisioned” con cuota ya aplicada.

---

### [ALTO] A3 — Falta de autenticación fuerte “DO identity” en llamadas internas
**Evidencia**
- DO llama a `POST /internal/chats/sync` con secret compartido `X-Internal-Key`.
- El server interno no verifica que el emisor sea el DO correcto para `chatId`.
**Impacto**
- Con internal key, cualquiera puede “simular” al DO y sync/cleanup chats arbitrarios.
**Recomendaciones**
- Añadir **proof-of-origin**:
  - Opción 1: usar **Service Binding** interno en vez de URL pública (si viable) y bloquear el endpoint en edge.
  - Opción 2: HMAC por request con secret rotado + `timestamp` + anti-replay.
  - Opción 3: emitir token interno por DO instance (per-chat) al momento de provision (guardado en D1) y exigirlo en sync.

---

### [MEDIO] M1 — Persistencia/logging de contenidos potencialmente sensibles
**Evidencia**
- `src/infrastructure/agents/classmate-agent.ts#L593-L614` serializa `msg.parts` si no hay texto.
- `src/infrastructure/ai/tools/executions.ts#L74-L77` loggea `reason`.
- `syncToD1()` manda `content` sin redacción.
**Impacto**
- PII o materiales sensibles podrían quedar en logs o persistir más de lo previsto.
**Recomendaciones**
- Redactar/limitar logs (no loggear `reason`, o truncar).
- Sanitizar `extractTextFromMessage` para NO serializar `parts` completos; solo texto.
- Considerar cifrado a nivel de aplicación para ciertos campos o política de retención.

---

### [MEDIO] M2 — Rate limiting incompleto para `/agents/*`
**Evidencia**
- Existe guardrail para `GET .../get-messages` en `src/index.ts` y `src/infrastructure/agents/classmate-agent.ts`, pero no un rate limit general por IP/user/chat en WS/POST.
**Impacto**
- Posible abuso (DoS lógico / costos LLM) con conexiones/chats válidos.
**Recomendaciones**
- Rate limit por `userId` y/o `chatId`:
  - mensajes por minuto
  - conexiones concurrentes por chat
  - tool calls por ventana de tiempo
- Rechazar payloads demasiado grandes y establecer límites (tamaño de mensaje).

---

### [BAJO] L1 — Comparación de internal key sin constant-time
**Evidencia**
- `src/interfaces/http/routes/internal-chats.ts#L71-L79` compara `providedKey === expectedKey`.
**Impacto**
- Bajo en Cloudflare (timing remoto difícil), pero buena práctica.
**Recomendación**
- Usar comparación constante (subtle crypto) o librería util.

---

## 4) Controles existentes (positivos)
- **Hard gate antes de DO**: `src/index.ts#L225-L305` (auth Clerk + UUID + D1 ownership).
- **Secrets Store**: `wrangler.jsonc#L45-L125` incluyendo `AI_GATEWAY_API_KEY`, `CLERK_*`, `INTERNAL_API_KEY`.
- **Separación por modo** de herramientas: `src/infrastructure/ai/tools/tool-registry.ts#L55-L97`.
- **HITL** implementado correctamente (no `execute` en tools destructivas; executions separados): `src/infrastructure/ai/tools/task-tools.ts#L263-L285`, `src/infrastructure/ai/tools/executions.ts`.
- **Guardrails anti-polling**: `src/index.ts#L102-L182` y `src/infrastructure/agents/classmate-agent.ts#L173-L234`.

---

## 5) Acciones recomendadas (plan breve)
**Inmediato (1–3 días)**
- Eliminar/evitar `_clerk_session_token` en query; implementar ticket one-time.
- Desactivar auto-provisioning en `/internal/chats/sync` (devolver 404/409).
- Redactar logs de ejecuciones HITL y evitar `JSON.stringify(parts)` en persistencia.
**Corto plazo (1–2 semanas)**
- Añadir proof-of-origin forma HMAC + timestamp + anti-replay en endpoints internos.
- Rate limit por `userId/chatId` para mensajes y tool calls.
- Política de límites de tamaño para mensajes/parts y tool inputs.
**Medio plazo (2–6 semanas)**
- Integridad/versionado de skills/prompts en ASSETS (hash/manifest).
- Auditoría de frontend HITL (evitar auto-approve por XSS; atar approvals a sesión).

---

## 6) Referencias de archivos clave
- Hard gate y routing agent: `src/index.ts`
- Auth con token en query: `src/interfaces/http/routes/chat.ts`
- DO agent y sync interno: `src/infrastructure/agents/classmate-agent.ts`
- Endpoints internos: `src/interfaces/http/routes/internal-chats.ts`
- HITL processing: `src/infrastructure/ai/utils.ts`
- Registry de tools por modo: `src/infrastructure/ai/tools/tool-registry.ts`
- Loader de skills: `src/infrastructure/ai/config/skills.ts`, `src/infrastructure/prompt/assets.prompt.service.ts`
- Secrets/DO binding: `wrangler.jsonc`
