import type {
	SubjectClassItem,
	SubjectWithClasses,
} from "../../domain/entities/subject";
import type { ClassRepository } from "../../domain/repositories/class.repository";
import type { SubjectRepository } from "../../domain/repositories/subject.repository";
import { NotFoundError } from "../../interfaces/http/middleware/error-handler";

/**
 * Pagination options for class listing within a subject.
 */
export interface GetSubjectOptions {
	/** Page number (1-based, defaults to 1) */
	page?: number;
	/** Items per page (defaults to 20, max 100) */
	limit?: number;
}

/**
 * Use case for retrieving a single subject with paginated classes.
 *
 * @class GetSubjectUseCase
 * @example
 * ```typescript
 * const useCase = new GetSubjectUseCase(subjectRepository, classRepository);
 * const subject = await useCase.execute(userId, subjectId, { page: 1, limit: 20 });
 * ```
 */
export class GetSubjectUseCase {
	/**
	 * @param subjectRepository - Repository for subject persistence
	 * @param classRepository - Repository for class persistence
	 */
	constructor(
		private subjectRepository: SubjectRepository,
		private classRepository: ClassRepository,
	) {}

	/**
	 * Execute subject retrieval with paginated classes.
	 * @param userId - The authenticated user ID
	 * @param subjectId - The subject ID to retrieve
	 * @param options - Pagination options for classes
	 * @returns Subject with paginated classes
	 * @throws NotFoundError if subject not found or doesn't belong to user
	 */
	async execute(
		userId: string,
		subjectId: string,
		options: GetSubjectOptions = {},
	): Promise<SubjectWithClasses> {
		const subject = await this.subjectRepository.findByIdAndUserId(
			userId,
			subjectId,
		);

		if (!subject) {
			throw new NotFoundError("Subject not found");
		}

		const page = Math.max(1, options.page ?? 1);
		const limit = Math.min(100, Math.max(1, options.limit ?? 20));
		const offset = (page - 1) * limit;

		const classResult = await this.classRepository.findAll(userId, {
			subjectId,
			limit,
			offset,
			sortBy: "startDate",
			sortOrder: "desc",
		});

		const classes: SubjectClassItem[] = classResult.data.map((c) => ({
			id: c.id,
			title: c.title,
			startDate: c.startDate,
			endDate: c.endDate,
			link: c.link,
			meetingLink: c.meetingLink,
			status: c.status,
			aiStatus: c.aiStatus,
			topics: c.topics,
			durationSeconds: c.durationSeconds,
			roomLocation: c.roomLocation,
			isProcessed: c.isProcessed,
			createdAt: c.createdAt,
			updatedAt: c.updatedAt,
		}));

		const totalPages = Math.ceil(classResult.total / limit);

		return {
			...subject,
			classes,
			pagination: {
				total: classResult.total,
				page,
				limit,
				totalPages,
			},
		};
	}
}
