/**
 * ClassmateAgent - AI Chat Agent for Classmate Application
 * Extends AIChatAgent from Cloudflare Agents SDK
 *
 * Features:
 * - Stateful conversation management via Durable Object SQLite
 * - Mode-based tool and prompt configuration
 * - Human-in-the-Loop (HITL) support for sensitive operations
 * - WebSocket-based real-time communication
 */
import { AIChatAgent } from "agents/ai-chat-agent";
import {
	convertToModelMessages,
	createGateway,
	stepCountIs,
	streamText,
} from "ai";
import type { Connection, ConnectionContext } from "partyserver";
import { resolveSecretBinding } from "../../config/bindings";
import { createModeManager, type ModeManager } from "../ai/config/modes";
import type { AgentMode, ChatMessageMetadata } from "../ai/tools/definitions";
import { AssetsPromptService } from "../prompt/assets.prompt.service";

// ============================================
// AGENT STATE TYPE
// ============================================

interface ClassmateAgentState {
	userId: string;
	organizationId?: string;
	currentMode: AgentMode;
	currentContextId?: string;
	createdAt: number;
	lastActiveAt: number;
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

	/** Initial state for the agent */
	override initialState: ClassmateAgentState = {
		userId: "",
		organizationId: undefined,
		currentMode: "DEFAULT",
		currentContextId: undefined,
		createdAt: Date.now(),
		lastActiveAt: Date.now(),
	};

	// ============================================
	// LIFECYCLE METHODS
	// ============================================

	/**
	 * Called when WebSocket connection is established
	 * Extracts user identity from connection context and initializes state
	 */
	override async onConnect(connection: Connection, ctx: ConnectionContext) {
		// Extract userId from connection request URL (passed via query params)
		const url = new URL(ctx.request.url);
		const userId = url.searchParams.get("userId");
		const orgId = url.searchParams.get("orgId");

		if (!userId) {
			console.error("[ClassmateAgent] No userId provided in connection");
			connection.close(4001, "Unauthorized: Missing userId");
			return;
		}

		// Update state with user info
		this.setState({
			userId,
			organizationId: orgId || undefined,
			currentMode: "DEFAULT",
			currentContextId: undefined,
			createdAt: Date.now(),
			lastActiveAt: Date.now(),
		});

		console.log(`[ClassmateAgent] Connected: userId=${userId}, orgId=${orgId}`);
	}

	/**
	 * Main chat message handler
	 * Processes incoming messages and streams AI responses
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

		// Update state if mode changed
		if (mode !== this.state.currentMode) {
			this.setState({
				...this.state,
				currentMode: mode,
				lastActiveAt: Date.now(),
			});
		}

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

		// Convert UI messages to model messages
		const modelMessages = await convertToModelMessages(this.messages);

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

		// Return streaming response with metadata
		return result.toUIMessageStreamResponse({
			messageMetadata: ({ part }) => {
				if (part.type === "start") {
					return {
						mode,
						modelId: config.modelId,
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
		});
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
