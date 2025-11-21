import { describe, expect, it } from "vitest";
import { CreateClassSchema, UpdateClassSchema } from "./class.validator";

describe("ClassValidator", () => {
	describe("CreateClassSchema", () => {
		const basePayload = {
			subject_id: "b7ad644d-cad5-4c8b-a8f7-25df59f9752a",
		};

		it("accepts empty link strings by treating them as null", () => {
			const result = CreateClassSchema.safeParse({
				...basePayload,
				link: "",
			});

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.link).toBeNull();
			}
		});

		it("preserves valid URLs after trimming", () => {
			const result = CreateClassSchema.safeParse({
				...basePayload,
				link: " https://example.com/class ",
			});

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.link).toBe("https://example.com/class");
			}
		});

		it("still rejects invalid URL strings", () => {
			const result = CreateClassSchema.safeParse({
				...basePayload,
				link: "not-a-url",
			});

			expect(result.success).toBe(false);
		});
	});

	describe("UpdateClassSchema", () => {
		it("allows clearing the link by sending an empty string", () => {
			const result = UpdateClassSchema.safeParse({
				link: "",
			});

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.link).toBeNull();
			}
		});

		it("requires url format when link is present", () => {
			const result = UpdateClassSchema.safeParse({
				link: "invalid",
			});

			expect(result.success).toBe(false);
		});
	});
});
