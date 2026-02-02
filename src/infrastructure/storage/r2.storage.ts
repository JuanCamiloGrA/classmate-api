import {
	GetObjectCommand,
	HeadObjectCommand,
	PutObjectCommand,
	S3Client,
} from "@aws-sdk/client-s3";
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

	async generatePresignedGetUrl(
		bucket: string,
		key: string,
		expiresInSeconds: number,
	): Promise<string> {
		const command = new GetObjectCommand({
			Bucket: bucket,
			Key: key,
		});

		return getSignedUrl(this.client, command, {
			expiresIn: expiresInSeconds,
		});
	}

	async putObject(
		bucket: string,
		key: string,
		body: ArrayBuffer | Uint8Array,
		contentType: string,
	): Promise<void> {
		const payload = body instanceof ArrayBuffer ? new Uint8Array(body) : body;
		const command = new PutObjectCommand({
			Bucket: bucket,
			Key: key,
			Body: payload,
			ContentType: contentType,
		});

		await this.client.send(command);
	}

	async headObject(
		bucket: string,
		key: string,
	): Promise<{ sizeBytes: number; etag: string } | null> {
		try {
			const command = new HeadObjectCommand({
				Bucket: bucket,
				Key: key,
			});

			const response = await this.client.send(command);

			return {
				sizeBytes: response.ContentLength ?? 0,
				etag: response.ETag ?? "",
			};
		} catch (error) {
			// If object doesn't exist, return null
			if (
				error &&
				typeof error === "object" &&
				"name" in error &&
				error.name === "NotFound"
			) {
				return null;
			}
			throw error;
		}
	}
}
