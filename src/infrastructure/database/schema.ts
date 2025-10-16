import { sql } from "drizzle-orm";
import {
	index,
	integer,
	primaryKey,
	real,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

const timestampDefault = sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`;

export const profiles = sqliteTable("profiles", {
	id: text("id").primaryKey(),
	email: text("email").unique(),
	name: text("name"),
	subscriptionTier: text("subscription_tier", {
		enum: ["free", "pro", "premium"],
	})
		.notNull()
		.default("free"),
	storageUsedBytes: integer("storage_used_bytes").notNull().default(0),
	createdAt: text("created_at").notNull().default(timestampDefault),
	updatedAt: text("updated_at").notNull().default(timestampDefault),
});

export const terms = sqliteTable(
	"terms",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => profiles.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		order: integer("order").notNull(),
		isDeleted: integer("is_deleted").notNull().default(0),
		deletedAt: text("deleted_at"),
		createdAt: text("created_at").notNull().default(timestampDefault),
		updatedAt: text("updated_at").notNull().default(timestampDefault),
	},
	(table) => [index("idx_terms_user_id").on(table.userId)],
);

export const subjects = sqliteTable(
	"subjects",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => profiles.id, { onDelete: "cascade" }),
		termId: text("term_id")
			.notNull()
			.references(() => terms.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		isDeleted: integer("is_deleted").notNull().default(0),
		deletedAt: text("deleted_at"),
		createdAt: text("created_at").notNull().default(timestampDefault),
		updatedAt: text("updated_at").notNull().default(timestampDefault),
	},
	(table) => [
		index("idx_subjects_user_id_term_id").on(table.userId, table.termId),
	],
);

export const tasks = sqliteTable(
	"tasks",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => profiles.id, { onDelete: "cascade" }),
		subjectId: text("subject_id")
			.notNull()
			.references(() => subjects.id, { onDelete: "cascade" }),
		title: text("title").notNull(),
		dueDate: text("due_date"),
		status: text("status", { enum: ["todo", "doing", "done"] })
			.notNull()
			.default("todo"),
		content: text("content"),
		grade: real("grade"),
		isDeleted: integer("is_deleted").notNull().default(0),
		deletedAt: text("deleted_at"),
		createdAt: text("created_at").notNull().default(timestampDefault),
		updatedAt: text("updated_at").notNull().default(timestampDefault),
	},
	(table) => [
		index("idx_tasks_user_id_subject_id").on(table.userId, table.subjectId),
	],
);

export const classes = sqliteTable(
	"classes",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => profiles.id, { onDelete: "cascade" }),
		subjectId: text("subject_id")
			.notNull()
			.references(() => subjects.id, { onDelete: "cascade" }),
		title: text("title"),
		startDate: text("start_date"),
		endDate: text("end_date"),
		link: text("link"),
		content: text("content"),
		summary: text("summary"),
		isDeleted: integer("is_deleted").notNull().default(0),
		deletedAt: text("deleted_at"),
		createdAt: text("created_at").notNull().default(timestampDefault),
		updatedAt: text("updated_at").notNull().default(timestampDefault),
	},
	(table) => [
		index("idx_classes_user_id_subject_id").on(table.userId, table.subjectId),
	],
);

export const userFiles = sqliteTable(
	"user_files",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => profiles.id, { onDelete: "cascade" }),
		r2Key: text("r2_key").notNull().unique(),
		originalFilename: text("original_filename").notNull(),
		mimeType: text("mime_type").notNull(),
		sizeBytes: integer("size_bytes").notNull(),
		createdAt: text("created_at").notNull().default(timestampDefault),
	},
	(table) => [index("idx_user_files_user_id").on(table.userId)],
);

export const taskResources = sqliteTable(
	"task_resources",
	{
		taskId: text("task_id")
			.notNull()
			.references(() => tasks.id, { onDelete: "cascade" }),
		fileId: text("file_id")
			.notNull()
			.references(() => userFiles.id, { onDelete: "cascade" }),
		associationType: text("association_type", {
			enum: ["resource", "embedded_content"],
		}).notNull(),
	},
	(table) => [primaryKey({ columns: [table.taskId, table.fileId] })],
);

export const classResources = sqliteTable(
	"class_resources",
	{
		classId: text("class_id")
			.notNull()
			.references(() => classes.id, { onDelete: "cascade" }),
		fileId: text("file_id")
			.notNull()
			.references(() => userFiles.id, { onDelete: "cascade" }),
		associationType: text("association_type", {
			enum: ["resource", "embedded_content"],
		}).notNull(),
	},
	(table) => [primaryKey({ columns: [table.classId, table.fileId] })],
);

export const feedback = sqliteTable("feedback", {
	id: text("id").primaryKey(),
	userId: text("user_id").references(() => profiles.id, {
		onDelete: "set null",
	}),
	userEmail: text("user_email"),
	message: text("message").notNull(),
	pageContext: text("page_context"),
	createdAt: text("created_at").notNull().default(timestampDefault),
});

export const chats = sqliteTable(
	"chats",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => profiles.id, { onDelete: "cascade" }),
		title: text("title"),
		lastMessageAt: text("last_message_at"),
		messageCount: integer("message_count").default(0),
		isPinned: integer("is_pinned").notNull().default(0),
		isArchived: integer("is_archived").notNull().default(0),
		model: text("model"),
		temperature: real("temperature"),
		isDeleted: integer("is_deleted").notNull().default(0),
		deletedAt: text("deleted_at"),
		createdAt: text("created_at").notNull().default(timestampDefault),
		updatedAt: text("updated_at").notNull().default(timestampDefault),
	},
	(table) => [index("idx_chats_user_id").on(table.userId)],
);

export const messages = sqliteTable(
	"messages",
	{
		id: text("id").primaryKey(),
		chatId: text("chat_id")
			.notNull()
			.references(() => chats.id, { onDelete: "cascade" }),
		userId: text("user_id")
			.notNull()
			.references(() => profiles.id, { onDelete: "cascade" }),
		role: text("role", {
			enum: ["user", "assistant", "system", "tool"],
		}).notNull(),
		sequence: integer("sequence").notNull(),
		content: text("content").notNull(),
		status: text("status", {
			enum: ["streaming", "complete", "error"],
		}),
		latencyMs: integer("latency_ms"),
		inputTokens: integer("input_tokens"),
		outputTokens: integer("output_tokens"),
		errorMessage: text("error_message"),
		toolCalls: text("tool_calls"),
		createdAt: text("created_at").notNull().default(timestampDefault),
	},
	(table) => [
		index("idx_messages_chat_id").on(table.chatId),
		uniqueIndex("idx_messages_chat_id_sequence").on(
			table.chatId,
			table.sequence,
		),
	],
);

export type Profile = typeof profiles.$inferSelect;
export type NewProfile = typeof profiles.$inferInsert;
export const profileSchema = createSelectSchema(profiles);
export const newProfileSchema = createInsertSchema(profiles);

export type Term = typeof terms.$inferSelect;
export type NewTerm = typeof terms.$inferInsert;
export const termSchema = createSelectSchema(terms);
export const newTermSchema = createInsertSchema(terms);

export type Subject = typeof subjects.$inferSelect;
export type NewSubject = typeof subjects.$inferInsert;
export const subjectSchema = createSelectSchema(subjects);
export const newSubjectSchema = createInsertSchema(subjects);

export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
export const taskSchema = createSelectSchema(tasks);
export const newTaskSchema = createInsertSchema(tasks);

export type Class = typeof classes.$inferSelect;
export type NewClass = typeof classes.$inferInsert;
export const classSchema = createSelectSchema(classes);
export const newClassSchema = createInsertSchema(classes);

export type UserFile = typeof userFiles.$inferSelect;
export type NewUserFile = typeof userFiles.$inferInsert;
export const userFileSchema = createSelectSchema(userFiles);
export const newUserFileSchema = createInsertSchema(userFiles);

export type TaskResource = typeof taskResources.$inferSelect;
export type NewTaskResource = typeof taskResources.$inferInsert;
export const taskResourceSchema = createSelectSchema(taskResources);
export const newTaskResourceSchema = createInsertSchema(taskResources);

export type ClassResource = typeof classResources.$inferSelect;
export type NewClassResource = typeof classResources.$inferInsert;
export const classResourceSchema = createSelectSchema(classResources);
export const newClassResourceSchema = createInsertSchema(classResources);

export type Feedback = typeof feedback.$inferSelect;
export type NewFeedback = typeof feedback.$inferInsert;
export const feedbackSchema = createSelectSchema(feedback);
export const newFeedbackSchema = createInsertSchema(feedback);

export type Chat = typeof chats.$inferSelect;
export type NewChat = typeof chats.$inferInsert;
export const chatSchema = createSelectSchema(chats);
export const newChatSchema = createInsertSchema(chats);

export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
export const messageSchema = createSelectSchema(messages);
export const newMessageSchema = createInsertSchema(messages);
