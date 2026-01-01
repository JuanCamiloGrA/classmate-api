import { routeAgentRequest } from "agents";
import { fromHono } from "chanfana";

import type { Bindings } from "./config/bindings";
import { resolveSecretBinding } from "./config/bindings";
import { ClassmateAgent } from "./infrastructure/agents/classmate-agent";
import { DatabaseFactory } from "./infrastructure/database/client";
import { D1ChatRepository } from "./infrastructure/database/repositories/chat.repository";
import { createApp } from "./interfaces";
import { verifyClerkAuth } from "./interfaces/http/routes/chat";
import {
	CreateChatEndpoint,
	DeleteChatEndpoint,
	GetChatEndpoint,
	GetChatMessagesEndpoint,
	ListChatsEndpoint,
	UpdateChatEndpoint,
} from "./interfaces/http/routes/chats";
import {
	CreateClassEndpoint,
	GetClassEndpoint,
	HardDeleteClassEndpoint,
	ListClassesEndpoint,
	SoftDeleteClassEndpoint,
	UpdateClassEndpoint,
} from "./interfaces/http/routes/classes";
import { GenerateClassAudioUploadUrlEndpoint } from "./interfaces/http/routes/classes-generate-upload-url";
import { ProcessClassAudioEndpoint } from "./interfaces/http/routes/classes-process-audio";
import { ProcessClassUrlEndpoint } from "./interfaces/http/routes/classes-process-url";
import { CreateFeedbackEndpoint } from "./interfaces/http/routes/feedback";
import { SyncChatMessagesEndpoint } from "./interfaces/http/routes/internal-chats";
import {
	ConfirmUploadEndpoint,
	DeleteLibraryItemEndpoint,
	GenerateUploadUrlEndpoint,
	GetStorageUsageEndpoint,
	ListLibraryEndpoint,
} from "./interfaces/http/routes/library";
import {
	CreateNotificationEndpoint,
	DeleteNotificationEndpoint,
	GetNotificationEndpoint,
	GetUnreadCountEndpoint,
	ListNotificationsEndpoint,
	MarkAllNotificationsReadEndpoint,
	MarkNotificationReadEndpoint,
} from "./interfaces/http/routes/notifications";
import { GetProfileEndpoint } from "./interfaces/http/routes/profiles";
import {
	GenerateProfileScribeStyleUploadUrlEndpoint,
	UpdateProfileScribeStyleEndpoint,
} from "./interfaces/http/routes/profiles-scribe-style";
import {
	GenerateScribeAnswerUploadUrlEndpoint,
	GenerateScribeRubricUploadUrlEndpoint,
	GetScribeProjectEndpoint,
	IterateScribeEndpoint,
	ListScribeProjectsEndpoint,
	ListScribeTemplatesEndpoint,
	UnlockScribePdfEndpoint,
} from "./interfaces/http/routes/scribe";
import {
	CreateSubjectEndpoint,
	HardDeleteSubjectEndpoint,
	ListSubjectsEndpoint,
	SoftDeleteSubjectEndpoint,
	UpdateSubjectEndpoint,
} from "./interfaces/http/routes/subjects";
import {
	CreateTaskEndpoint,
	GetTaskEndpoint,
	HardDeleteTaskEndpoint,
	ListTasksEndpoint,
	SoftDeleteTaskEndpoint,
	UpdateTaskEndpoint,
} from "./interfaces/http/routes/tasks";
import {
	CreateTermEndpoint,
	HardDeleteTermEndpoint,
	ListTermsEndpoint,
	SoftDeleteTermEndpoint,
	UpdateTermEndpoint,
} from "./interfaces/http/routes/terms";
import { ConfirmUploadByKeyEndpoint } from "./interfaces/http/routes/uploads";
import {
	CreateProfileEndpoint,
	UpdateProfileFromClerkEndpoint,
} from "./interfaces/http/routes/webhooks-clerk";
import { UUID_REGEX } from "./interfaces/http/validators/chat.validator";
import { SummarizeClassWorkflow } from "./workflows/summarize-class";

type GetMessagesEdgeLimitEntry = {
	windowStartMs: number;
	count: number;
	lastAtMs: number;
	penaltyUntilMs: number;
};

// Best-effort guardrail to avoid infinite polling loops on /get-messages.
// Note: this is in-memory per isolate; it's still valuable to protect local dev
// and reduce accidental runaway loops in production.
const getMessagesEdgeLimiter = new Map<string, GetMessagesEdgeLimitEntry>();

function getClientIp(request: Request): string {
	return (
		request.headers.get("CF-Connecting-IP") ||
		request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ||
		request.headers.get("X-Client-IP") ||
		"unknown"
	);
}

export default {
	async fetch(request: Request, env: Bindings, ctx: ExecutionContext) {
		const url = new URL(request.url);

		// ============================================
		// AGENT ROUTES - Handle BEFORE Hono/Chanfana
		// These need direct access to routeAgentRequest
		// ============================================
		if (url.pathname.startsWith("/agents/")) {
			// Edge guardrail: if the frontend falls back to polling and starts spamming
			// GET .../get-messages (often across many random conversation IDs), stop the
			// runaway loop quickly with 429.
			if (request.method === "GET" && url.pathname.endsWith("/get-messages")) {
				const clientIp = getClientIp(request);
				const key = `agents:get-messages:${clientIp}`;

				const nowMs = Date.now();
				const windowMs = 10_000;
				const maxPerWindow = 60;
				const minIntervalMs = 150;
				const penaltyMs = 2_000;

				const entry = getMessagesEdgeLimiter.get(key) ?? {
					windowStartMs: nowMs,
					count: 0,
					lastAtMs: 0,
					penaltyUntilMs: 0,
				};

				if (nowMs - entry.windowStartMs >= windowMs) {
					entry.windowStartMs = nowMs;
					entry.count = 0;
					entry.penaltyUntilMs = 0;
				}

				const deltaMs = entry.lastAtMs ? nowMs - entry.lastAtMs : Infinity;
				entry.lastAtMs = nowMs;
				entry.count += 1;

				if (deltaMs < minIntervalMs || entry.count > maxPerWindow) {
					entry.penaltyUntilMs = Math.max(
						entry.penaltyUntilMs,
						nowMs + penaltyMs,
					);
				}

				getMessagesEdgeLimiter.set(key, entry);

				if (entry.penaltyUntilMs > nowMs) {
					// CORS headers are computed a bit later; return a minimal safe response here.
					return new Response(
						JSON.stringify({
							error: "Too Many Requests",
							message:
								"Polling too frequently (GET /get-messages). A stable WebSocket connection should be used.",
						}),
						{
							status: 429,
							headers: {
								"Content-Type": "application/json",
								"Retry-After": "2",
								"Cache-Control": "no-store",
							},
						},
					);
				}
			}

			// Get allowed origin for CORS with credentials
			const requestOrigin = request.headers.get("Origin");
			const allowedOriginSecret = await resolveSecretBinding(
				env.ALLOWED_ORIGIN,
				"ALLOWED_ORIGIN",
			);
			const allowedOrigins = allowedOriginSecret
				.split(",")
				.map((v) => v.trim())
				.filter(Boolean);

			// Check if request origin is allowed
			const isOriginAllowed =
				requestOrigin &&
				(allowedOrigins.includes("*") ||
					allowedOrigins.includes(requestOrigin));
			const corsOrigin = isOriginAllowed ? requestOrigin : allowedOrigins[0];

			// CORS headers for credentials
			const requestAllowedHeaders = request.headers.get(
				"Access-Control-Request-Headers",
			);

			const corsHeaders = {
				"Access-Control-Allow-Origin": corsOrigin || "*",
				"Access-Control-Allow-Credentials": "true",
				"Access-Control-Allow-Methods": "GET, POST, OPTIONS",
				"Access-Control-Allow-Headers":
					requestAllowedHeaders || "Content-Type, Authorization",
				"Access-Control-Max-Age": "86400",
				Vary: "Origin",
			};

			// Handle CORS preflight
			if (request.method === "OPTIONS") {
				return new Response(null, {
					status: 204,
					headers: corsHeaders,
				});
			}

			// Verify Clerk authentication
			const auth = await verifyClerkAuth(request, env);
			if (!auth) {
				return new Response(JSON.stringify({ error: "Unauthorized" }), {
					status: 401,
					headers: {
						"Content-Type": "application/json",
						...corsHeaders,
					},
				});
			}

			// ============================================
			// HARD GATE: Verify chat ownership in D1
			// ============================================
			// Parse URL: /agents/:agentName/:conversationId/...
			const pathParts = url.pathname.split("/").filter(Boolean);
			// pathParts[0] = "agents", pathParts[1] = agentName, pathParts[2] = conversationId
			const conversationId = pathParts[2];

			// 1. Reject if not UUID
			if (!conversationId || !UUID_REGEX.test(conversationId)) {
				return new Response(
					JSON.stringify({
						error: "Forbidden",
						code: "INVALID_CHAT_ID",
					}),
					{
						status: 403,
						headers: {
							"Content-Type": "application/json",
							...corsHeaders,
						},
					},
				);
			}

			// 2. Check D1 ownership (chat exists AND owned by user AND not deleted)
			const db = DatabaseFactory.create(env.DB);
			const chatRepo = new D1ChatRepository(db);
			const chatExists = await chatRepo.exists(auth.userId, conversationId);

			if (!chatExists) {
				return new Response(
					JSON.stringify({
						error: "Forbidden",
						code: "CHAT_FORBIDDEN",
					}),
					{
						status: 403,
						headers: {
							"Content-Type": "application/json",
							...corsHeaders,
						},
					},
				);
			}

			// 3. Only NOW call routeAgentRequest() - chat is verified

			// Route to the agent (handles both WebSocket and HTTP).
			// IMPORTANT: Do not re-create/wrap the Request for WebSocket upgrades.
			// Some platforms will strip forbidden headers (like Upgrade) when
			// constructing a new Request, causing the client to fall back to polling.
			const response = await routeAgentRequest(request, env, {
				cors: corsHeaders,
			});

			if (response) return response;

			// If we reach here, the agent didn't respond.

			// Agent not found
			return new Response(JSON.stringify({ error: "Agent not found" }), {
				status: 404,
				headers: {
					"Content-Type": "application/json",
					...corsHeaders,
				},
			});
		}

		// ============================================
		// REGULAR API ROUTES - Via Hono/Chanfana
		// ============================================
		const honoApp = createApp({});

		// Setup OpenAPI registry
		const apiApp = fromHono(honoApp, {
			docs_url: "/",
			openapi_url: "/openapi.json",
			schema: {
				info: {
					title: "Classmate API",
					version: "1.0.0",
					description: "API for educational profile and content management",
				},
				servers: [
					{
						url: new URL(request.url).origin,
						description: "Current Server",
					},
				],
			},
		});

		// Register OpenAPI endpoints
		// Clerk webhooks
		apiApp.post("/webhooks/clerk/user.created", CreateProfileEndpoint);
		apiApp.post("/webhooks/clerk/user.updated", UpdateProfileFromClerkEndpoint);

		// Profile endpoints
		apiApp.get("/profiles/me", GetProfileEndpoint);
		apiApp.post(
			"/profiles/me/scribe-style/upload-url",
			GenerateProfileScribeStyleUploadUrlEndpoint,
		);
		apiApp.put("/profiles/me/scribe-style", UpdateProfileScribeStyleEndpoint);

		// Term endpoints
		apiApp.get("/terms", ListTermsEndpoint);
		apiApp.post("/terms", CreateTermEndpoint);
		apiApp.put("/terms/:id", UpdateTermEndpoint);
		apiApp.delete("/terms/:id", SoftDeleteTermEndpoint);
		apiApp.delete("/terms/:id/hard", HardDeleteTermEndpoint);

		// Subject endpoints
		apiApp.get("/subjects", ListSubjectsEndpoint);
		apiApp.post("/subjects", CreateSubjectEndpoint);
		apiApp.put("/subjects/:id", UpdateSubjectEndpoint);
		apiApp.delete("/subjects/:id", SoftDeleteSubjectEndpoint);
		apiApp.delete("/subjects/:id/hard", HardDeleteSubjectEndpoint);

		// Task endpoints
		apiApp.get("/tasks", ListTasksEndpoint);
		apiApp.get("/tasks/:id", GetTaskEndpoint);
		apiApp.post("/tasks", CreateTaskEndpoint);
		apiApp.put("/tasks/:id", UpdateTaskEndpoint);
		apiApp.delete("/tasks/:id", SoftDeleteTaskEndpoint);
		apiApp.delete("/tasks/:id/hard", HardDeleteTaskEndpoint);

		// Class endpoints
		apiApp.get("/classes", ListClassesEndpoint);
		apiApp.get("/classes/:id", GetClassEndpoint);
		apiApp.post("/classes", CreateClassEndpoint);
		apiApp.put("/classes/:id", UpdateClassEndpoint);
		apiApp.delete("/classes/:id", SoftDeleteClassEndpoint);
		apiApp.delete("/classes/:id/hard", HardDeleteClassEndpoint);
		apiApp.post(
			"/classes/:classId/generate-upload-url",
			GenerateClassAudioUploadUrlEndpoint,
		);
		apiApp.post("/classes/:classId/process-audio", ProcessClassAudioEndpoint);
		apiApp.post("/classes/:classId/process-url", ProcessClassUrlEndpoint);

		// Feedback endpoints
		apiApp.post("/feedback", CreateFeedbackEndpoint);

		// Scribe endpoints
		apiApp.post("/scribe/upload-url", GenerateScribeRubricUploadUrlEndpoint);
		apiApp.post(
			"/scribe/projects/:id/answer-upload-url",
			GenerateScribeAnswerUploadUrlEndpoint,
		);
		apiApp.post("/scribe", IterateScribeEndpoint);
		apiApp.get("/scribe", ListScribeProjectsEndpoint);
		apiApp.get("/scribe/templates", ListScribeTemplatesEndpoint);
		apiApp.get("/scribe/:id", GetScribeProjectEndpoint);
		apiApp.post("/scribe/:id/unlock_pdf", UnlockScribePdfEndpoint);

		// Library endpoints
		apiApp.get("/library", ListLibraryEndpoint);
		apiApp.get("/library/storage", GetStorageUsageEndpoint);
		apiApp.post("/library/upload/presigned", GenerateUploadUrlEndpoint);
		apiApp.post("/library/upload/confirm", ConfirmUploadEndpoint);
		apiApp.delete("/library/:id", DeleteLibraryItemEndpoint);

		// Generic uploads endpoints
		apiApp.post("/uploads/confirm", ConfirmUploadByKeyEndpoint);

		// Notification endpoints
		apiApp.get("/notifications", ListNotificationsEndpoint);
		apiApp.get("/notifications/unread-count", GetUnreadCountEndpoint);
		apiApp.get("/notifications/:id", GetNotificationEndpoint);
		apiApp.post("/notifications", CreateNotificationEndpoint);
		apiApp.post("/notifications/:id/read", MarkNotificationReadEndpoint);
		apiApp.post("/notifications/read-all", MarkAllNotificationsReadEndpoint);
		apiApp.delete("/notifications/:id", DeleteNotificationEndpoint);

		// Chat endpoints (public)
		apiApp.post("/chats", CreateChatEndpoint);
		apiApp.get("/chats", ListChatsEndpoint);
		apiApp.get("/chats/:id", GetChatEndpoint);
		apiApp.get("/chats/:id/messages", GetChatMessagesEndpoint);
		apiApp.put("/chats/:id", UpdateChatEndpoint);
		apiApp.delete("/chats/:id", DeleteChatEndpoint);

		// Internal endpoints (DO → Worker)
		apiApp.post("/internal/chats/sync", SyncChatMessagesEndpoint);

		return apiApp.fetch(request, env, ctx);
	},
};

// Export workflow for Cloudflare Workers
export { SummarizeClassWorkflow };

// Export ClassmateAgent Durable Object for Cloudflare Workers
export { ClassmateAgent };
