import { fromHono } from "chanfana";

import type { Bindings } from "./config/bindings";
import { createApp } from "./interfaces";
import {
	CreateClassEndpoint,
	GetClassEndpoint,
	HardDeleteClassEndpoint,
	ListClassesEndpoint,
	SoftDeleteClassEndpoint,
	UpdateClassEndpoint,
} from "./interfaces/http/routes/classes";
import {
	CreateProfileEndpoint,
	GetProfileEndpoint,
} from "./interfaces/http/routes/profiles";
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

export default {
	async fetch(request: Request, env: Bindings, ctx: ExecutionContext) {
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
		// Profile endpoints
		apiApp.post("/profiles", CreateProfileEndpoint);
		apiApp.get("/profiles/me", GetProfileEndpoint);

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

		return apiApp.fetch(request, env, ctx);
	},
};
