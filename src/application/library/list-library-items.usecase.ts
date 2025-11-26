import type {
	LibraryFilters,
	LibraryRepository,
} from "../../domain/repositories/library.repository";
import { type LibraryItemDTO, toLibraryItemDTO } from "./library.dto";

export interface ListLibraryItemsInput {
	userId: string;
	filters: LibraryFilters;
}

export interface ListLibraryItemsResult {
	data: LibraryItemDTO[];
	total: number;
}

/**
 * Use case for listing library items.
 * Aggregates user files and scribe projects into a unified list.
 */
export class ListLibraryItemsUseCase {
	constructor(private readonly libraryRepository: LibraryRepository) {}

	async execute(input: ListLibraryItemsInput): Promise<ListLibraryItemsResult> {
		const { data, total } = await this.libraryRepository.findAll(
			input.userId,
			input.filters,
		);

		return {
			data: data.map((item) => toLibraryItemDTO(item)),
			total,
		};
	}
}
