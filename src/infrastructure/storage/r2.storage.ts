import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { StorageRepository } from "../../domain/repositories/storage.repository";

interface R2StorageAdapterOptions {
	endpoint: string;
	accessKeyId: string;
	secretAccessKey: string;
}

export class R2StorageAdapter implements StorageRepository {
	private readonly client: S3Client;

	constructor(options: R2StorageAdapterOptions) {
		this.client = new S3Client({
			region: "auto",
			endpoint: options.endpoint,
			credentials: {
				accessKeyId: options.accessKeyId,
				secretAccessKey: options.secretAccessKey,
			},
		});
	}

	async generatePresignedPutUrl(
		bucket: string,
		key: string,
		contentType: string,
		expiresInSeconds: number,
	): Promise<string> {
		const command = new PutObjectCommand({
			Bucket: bucket,
			Key: key,
			ContentType: contentType,
		});

		return getSignedUrl(this.client, command, {
			expiresIn: expiresInSeconds,
		});
	}
}
