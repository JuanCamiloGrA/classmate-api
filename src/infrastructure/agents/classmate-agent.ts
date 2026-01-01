/**
 * ClassmateAgent - AI Chat Agent for Classmate Application
 * Extends AIChatAgent from Cloudflare Agents SDK
 *
 * Features:
 * - Stateful conversation management via Durable Object SQLite
 * - Mode-based tool and prompt configuration
 * - Human-in-the-Loop (HITL) support for sensitive operations
 * - WebSocket-based real-time communication
 * - Batched D1 persistence via alarm-based sync
 */

import { verifyToken } from "@clerk/backend";
import { AIChatAgent } from "agents/ai-chat-agent";
import {
	convertToModelMessages,
	createGateway,
	createUIMessageStream,
	createUIMessageStreamResponse,
	stepCountIs,
	streamText,
} from "ai";
import type { Connection, ConnectionContext } from "partyserver";
import { resolveSecretBinding } from "../../config/bindings";
import type { MessageRole } from "../../domain/entities/chat";
import { createModeManager, type ModeManager } from "../ai/config/modes";
import type { AgentMode, ChatMessageMetadata } from "../ai/tools/definitions";
import { executions } from "../ai/tools/executions";
import { cleanupMessages, processToolCalls } from "../ai/utils";
import { AssetsPromptService } from "../prompt/assets.prompt.service";

// ============================================
// CONSTANTS
// ============================================

/** Debounce time for D1 sync (10 seconds) */
const SYNC_DEBOUNCE_MS = 10_000;

// ============================================
// AGENT STATE TYPE
// ============================================

interface ClassmateAgentState {
	userId: string;
	organizationId?: string;
	currentMode: AgentMode;
	currentContextId?: string;
	currentContextType?: string;
	createdAt: number;
	lastActiveAt: number;
	/** Last sequence number synced to D1 */
	lastSyncedSequence: number;
}

// ============================================
// MESSAGE CONVERSION TYPES
// ============================================

interface ConvertedMessage {
	role: MessageRole;
	content: string;
	sequence: number;
}

// ============================================
// CLASSMATE AGENT
// ============================================

/**
 * ClassmateAgent extends AIChatAgent with custom state management
 * Uses any for Env to avoid strict type constraints from Cloudflare.Env
 */
// biome-ignore lint/suspicious/noExplicitAny: Agent SDK has strict Env constraints
export class ClassmateAgent extends AIChatAgent<any, ClassmateAgentState> {
	private modeManager: ModeManager | null = null;
	private gateway: ReturnType<typeof createGateway> | null = null;
	private getMessagesLimiter = new Map<
		string,
		{
			windowStartMs: number;
			count: number;
			lastAtMs: number;
			penaltyUntilMs: number;
		}
	>();

	/** Initial state for the agent */
	override initialState: ClassmateAgentState = {
		userId: "",
		organizationId: undefined,
		currentMode: "DEFAULT",
		currentContextId: undefined,
		currentContextType: undefined,
		createdAt: Date.now(),
		lastActiveAt: Date.now(),
		lastSyncedSequence: 0,
	};

	// ============================================
	// LIFECYCLE METHODS
	// ============================================

	/**
	 * Called when WebSocket connection is established
	 * Extracts user identity from connection context and initializes state
	 */
	override async onConnect(connection: Connection, ctx: ConnectionContext) {
		const url = new URL(ctx.request.url);
		const token = url.searchParams.get("_clerk_session_token");
		if (!token) {
			console.error(
				"[ClassmateAgent] Missing _clerk_session_token in connection",
			);
			connection.close(4001, "Unauthorized: Missing session token");
			return;
		}

		let userId: string;
		let orgId: string | undefined;
		try {
			const secretKey = await resolveSecretBinding(
				this.env.CLERK_SECRET_KEY,
				"CLERK_SECRET_KEY",
			);
			const session = await verifyToken(token, { secretKey });
			userId = session.sub;
			orgId = session.org_id ?? undefined;
		} catch (error) {
			console.error("[ClassmateAgent] Token verification failed:", error);
			connection.close(4001, "Unauthorized: Invalid session token");
			return;
		}

		// Preserve sync state if reconnecting to same conversation
		const existingState = this.state;
		const preserveSyncState =
			existingState?.userId === userId && existingState?.lastSyncedSequence > 0;

		// Update state with user info
		this.setState({
			userId,
			organizationId: orgId || undefined,
			currentMode: "DEFAULT",
			currentContextId: undefined,
			currentContextType: undefined,
			createdAt: preserveSyncState ? existingState.createdAt : Date.now(),
			lastActiveAt: Date.now(),
			lastSyncedSequence: preserveSyncState
				? existingState.lastSyncedSequence
				: 0,
		});

		console.log(`[ClassmateAgent] Connected: userId=${userId}, orgId=${orgId}`);
	}

	/**
	 * Handle non-WebSocket requests (HTTP polling, POSTs, etc.).
	 * Adds a guardrail for excessive polling on /get-messages and ensures
	 * user identity is available when using token-based auth.
	 */
	override async onRequest(request: Request) {
		const url = new URL(request.url);

		// Guardrail: /get-messages polling can spam if WebSocket isn't established.
		if (request.method === "GET" && url.pathname.endsWith("/get-messages")) {
			const clientIp =
				request.headers.get("CF-Connecting-IP") ||
				request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ||
				request.headers.get("X-Client-IP") ||
				"unknown";
			const clientKey = `${clientIp}:${this.name}`;

			const nowMs = Date.now();
			const windowMs = 10_000;
			const maxPerWindow = 30;
			const minIntervalMs = 250;
			const penaltyMs = 2_000;

			const entry = this.getMessagesLimiter.get(clientKey) ?? {
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

			const deltaMs = entry.lastAtMs
				? nowMs - entry.lastAtMs
				: Number.POSITIVE_INFINITY;
			entry.lastAtMs = nowMs;
			entry.count += 1;

			// Apply penalty window if client is too aggressive.
			if (deltaMs < minIntervalMs || entry.count > maxPerWindow) {
				entry.penaltyUntilMs = Math.max(
					entry.penaltyUntilMs,
					nowMs + penaltyMs,
				);
			}

			this.getMessagesLimiter.set(clientKey, entry);

			if (entry.penaltyUntilMs > nowMs) {
				return new Response(
					JSON.stringify({
						error: "Too Many Requests",
						message:
							"Polling too frequently. Establish a WebSocket connection instead.",
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

		// Ensure state has userId for HTTP-based flows (POST without WS).
		// If state isn't set yet, try deriving it from the Clerk session token.
		if (!this.state?.userId) {
			const token = url.searchParams.get("_clerk_session_token");
			if (token) {
				try {
					const secretKey = await resolveSecretBinding(
						this.env.CLERK_SECRET_KEY,
						"CLERK_SECRET_KEY",
					);
					const session = await verifyToken(token, { secretKey });
					this.setState({
						...this.state,
						userId: session.sub,
						organizationId: session.org_id ?? undefined,
						lastActiveAt: Date.now(),
					});
				} catch (_error) {
					return new Response("Unauthorized", { status: 401 });
				}
			}
		}

		return await super.onRequest(request);
	}

	/**
	 * Called when WebSocket connection is closed
	 * Triggers immediate sync to D1 before disconnecting
	 */
	override async onClose(
		_connection: Connection,
		code: number,
		reason: string,
		_wasClean: boolean,
	) {
		console.log(
			`[ClassmateAgent] Connection closed: code=${code}, reason=${reason}`,
		);

		// Trigger immediate sync on disconnect
		if (this.state?.userId && this.messages.length > 0) {
			try {
				await this.syncToD1();
			} catch (error) {
				console.error("[ClassmateAgent] Failed to sync on disconnect:", error);
			}
		}
	}

	/**
	 * Main chat message handler
	 * Processes incoming messages and streams AI responses
	 * Uses the official createUIMessageStream pattern for proper HTTP POST support
	 */
	// biome-ignore lint/suspicious/noExplicitAny: AI SDK uses complex generic types
	async onChatMessage(onFinish: any, options?: { abortSignal?: AbortSignal }) {
		// Check authentication
		if (!this.state?.userId) {
			console.error("[ClassmateAgent] No userId in state");
			return new Response("Unauthorized", { status: 401 });
		}

		// Extract metadata from the last message
		const metadata = this.extractMessageMetadata();
		const mode = metadata.mode || this.state.currentMode;

		// Update state if mode or context changed
		const stateUpdates: Partial<ClassmateAgentState> = {
			lastActiveAt: Date.now(),
		};

		if (mode !== this.state.currentMode) {
			stateUpdates.currentMode = mode;
		}
		if (metadata.contextId !== this.state.currentContextId) {
			stateUpdates.currentContextId = metadata.contextId;
		}
		if (metadata.contextType !== this.state.currentContextType) {
			stateUpdates.currentContextType = metadata.contextType;
		}

		this.setState({ ...this.state, ...stateUpdates });

		// Initialize services if needed
		await this.ensureServicesInitialized();

		// These are guaranteed to be initialized after ensureServicesInitialized()
		if (!this.modeManager || !this.gateway) {
			throw new Error("Services failed to initialize");
		}

		// Load configuration for current mode
		const config = await this.modeManager.getConfiguration(mode);

		// Create AI Gateway model
		const model = this.gateway(config.modelId);

		// Schedule D1 sync alarm (debounced)
		await this.scheduleSyncAlarm();

		// Use createUIMessageStream pattern (official Cloudflare Agents approach)
		const stream = createUIMessageStream({
			execute: async ({ writer }) => {
				// Clean up incomplete tool calls to prevent API errors
				const cleanedMessages = cleanupMessages(this.messages);

				// Process any pending HITL tool calls (user approvals/denials)
				const processedMessages = await processToolCalls({
					messages: cleanedMessages,
					dataStream: writer,
					tools: config.tools,
					executions,
				});

				// Convert UI messages to model messages
				const modelMessages = await convertToModelMessages(processedMessages);

				// Stream response with tools
				const result = streamText({
					model,
					system: config.systemPrompt,
					messages: modelMessages,
					tools: config.tools,
					stopWhen: stepCountIs(5), // Allow up to 5 tool-calling steps
					onFinish,
					abortSignal: options?.abortSignal,
				});

				// Merge the stream with metadata
				writer.merge(
					result.toUIMessageStream({
						messageMetadata: ({ part }) => {
							if (part.type === "start") {
								return {
									mode,
									modelId: config.modelId,
									skills: config.skills,
									timestamp: Date.now(),
								};
							}
							if (part.type === "finish") {
								return {
									totalTokens: part.totalUsage?.totalTokens,
									finishReason: part.finishReason,
								};
							}
						},
					}),
				);
			},
		});

		return createUIMessageStreamResponse({ stream });
	}

	/**
	 * Alarm handler for batched D1 sync
	 * Called automatically when the scheduled alarm fires
	 * Note: Using arrow function property to match AIChatAgent base class signature
	 */
	override alarm = async () => {
		console.log("[ClassmateAgent] Alarm fired, syncing to D1...");
		try {
			await this.syncToD1();
		} catch (error) {
			console.error("[ClassmateAgent] Alarm sync failed:", error);
			// Reschedule alarm to retry
			await this.scheduleSyncAlarm();
		}
	};

	// ============================================
	// D1 SYNC METHODS
	// ============================================

	/**
	 * Schedule a sync alarm with debouncing
	 * If an alarm is already scheduled within the debounce window, skip
	 */
	private async scheduleSyncAlarm(): Promise<void> {
		try {
			const currentAlarm = await this.ctx.storage.getAlarm();
			if (currentAlarm === null) {
				await this.ctx.storage.setAlarm(Date.now() + SYNC_DEBOUNCE_MS);
				console.log(
					`[ClassmateAgent] Scheduled sync alarm for ${SYNC_DEBOUNCE_MS}ms`,
				);
			}
		} catch (error) {
			console.error("[ClassmateAgent] Failed to schedule alarm:", error);
		}
	}

	/**
	 * Sync messages to D1 database
	 * Assumes chat was already provisioned via POST /chats (hard gate enforces this)
	 */
	private async syncToD1(): Promise<void> {
		if (!this.state?.userId || this.messages.length === 0) {
			console.log("[ClassmateAgent] Nothing to sync");
			return;
		}

		const chatId = this.name; // Durable Object name is the chat ID
		const userId = this.state.userId;

		// Convert UI messages to sync format
		const messagesToSync = this.convertMessagesForSync();

		// Filter only new messages (after lastSyncedSequence)
		const newMessages = messagesToSync.filter(
			(m) => m.sequence > this.state.lastSyncedSequence,
		);

		if (newMessages.length === 0) {
			console.log("[ClassmateAgent] No new messages to sync");
			return;
		}

		// Build the API URL for internal sync endpoint
		const apiBaseUrl = this.getApiBaseUrl();

		try {
			// Sync messages to D1 (chat was pre-provisioned via POST /chats)
			const response = await fetch(`${apiBaseUrl}/internal/chats/sync`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"X-Internal-Key": await this.getInternalApiKey(),
				},
				body: JSON.stringify({
					chatId,
					userId,
					lastSyncedSequence: this.state.lastSyncedSequence,
					messages: newMessages.map((m) => ({
						chatId,
						userId,
						role: m.role,
						sequence: m.sequence,
						content: m.content,
					})),
				}),
			});

			if (!response.ok) {
				const errorText = await response.text();
				// If chat not found (404), log error but don't crash - chat may have been deleted
				if (response.status === 404) {
					console.error(
						`[ClassmateAgent] Chat not found in D1 (may be deleted): ${chatId}`,
					);
					return;
				}
				throw new Error(`Sync failed: ${response.status} - ${errorText}`);
			}

			const result = (await response.json()) as { synced: number };

			// Update state with new sync position
			const newLastSynced = this.state.lastSyncedSequence + result.synced;
			this.setState({
				...this.state,
				lastSyncedSequence: newLastSynced,
			});

			console.log(
				`[ClassmateAgent] Synced ${result.synced} messages, lastSequence=${newLastSynced}`,
			);
		} catch (error) {
			console.error("[ClassmateAgent] D1 sync error:", error);
			throw error;
		}
	}

	/**
	 * Convert UI messages to sync-friendly format with sequence numbers
	 */
	private convertMessagesForSync(): ConvertedMessage[] {
		return this.messages.map((msg, index) => ({
			role: msg.role as MessageRole,
			content: this.extractTextFromMessage(msg),
			sequence: index + 1, // 1-based sequence
		}));
	}

	/**
	 * Extract text content from a UI message
	 * AI SDK v6 uses parts array instead of content string
	 */
	// biome-ignore lint/suspicious/noExplicitAny: UIMessage type varies by SDK version
	private extractTextFromMessage(msg: any): string {
		// AI SDK v6: messages have parts array
		if (msg.parts && Array.isArray(msg.parts)) {
			const textParts = msg.parts
				.filter((p: { type: string }) => p.type === "text")
				.map((p: { text: string }) => p.text);
			if (textParts.length > 0) {
				return textParts.join("\n");
			}
			// Fallback: serialize all parts
			return JSON.stringify(msg.parts);
		}
		// Legacy: content field (AI SDK v5 or earlier)
		if (typeof msg.content === "string") {
			return msg.content;
		}
		if (msg.content) {
			return JSON.stringify(msg.content);
		}
		return "";
	}

	/**
	 * Get the API base URL from environment
	 */
	private getApiBaseUrl(): string {
		// In production, use the worker's own URL
		// This allows the DO to call back to the main worker
		return (
			this.env.API_BASE_URL ||
			this.env.WORKER_URL ||
			"https://api.classmate.studio"
		);
	}

	/**
	 * Get internal API key for DO-to-Worker communication
	 */
	private async getInternalApiKey(): Promise<string> {
		return await resolveSecretBinding(
			this.env.INTERNAL_API_KEY,
			"INTERNAL_API_KEY",
		);
	}

	// ============================================
	// HELPER METHODS
	// ============================================

	/**
	 * Extract metadata from the last user message
	 */
	private extractMessageMetadata(): ChatMessageMetadata {
		const lastMessage = this.messages[this.messages.length - 1];

		// Check for metadata in message (AI SDK v5+ format)
		if (lastMessage && "metadata" in lastMessage) {
			const meta = lastMessage.metadata as ChatMessageMetadata | undefined;
			return {
				mode: meta?.mode,
				contextId: meta?.contextId,
				contextType: meta?.contextType,
			};
		}

		return {};
	}

	/**
	 * Ensure AI services are initialized
	 */
	private async ensureServicesInitialized(): Promise<void> {
		if (this.modeManager && this.gateway) return;

		// Initialize AI Gateway
		const apiKey = await resolveSecretBinding(
			this.env.AI_GATEWAY_API_KEY,
			"AI_GATEWAY_API_KEY",
		);
		this.gateway = createGateway({ apiKey });

		// Initialize Mode Manager with prompt service
		const promptService = new AssetsPromptService(this.env.ASSETS);
		this.modeManager = createModeManager(promptService);
	}
}
