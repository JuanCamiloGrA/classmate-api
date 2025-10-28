import {
	DeleteObjectCommand,
	GetObjectCommand,
	S3Client,
} from "@aws-sdk/client-s3";
import type { StorageService } from "../../domain/services/storage.service";

interface R2StorageServiceOptions {
	endpoint: string;
	accessKeyId: string;
	secretAccessKey: string;
	bucketName: string;
}

/**
 * R2 Storage Service Adapter
 * Implements StorageService using Cloudflare R2 via S3 SDK
 */
export class R2StorageService implements StorageService {
	private readonly client: S3Client;
	private readonly bucketName: string;

	constructor(options: R2StorageServiceOptions) {
		this.client = new S3Client({
			region: "auto",
			endpoint: options.endpoint,
			credentials: {
				accessKeyId: options.accessKeyId,
				secretAccessKey: options.secretAccessKey,
			},
		});
		this.bucketName = options.bucketName;
		console.log("📦 [R2_STORAGE] Initialized R2 storage service");
	}

	async getFileBytes(key: string): Promise<Uint8Array> {
		try {
			console.log("⬇️ [R2_STORAGE] Downloading file", { key });
			const command = new GetObjectCommand({
				Bucket: this.bucketName,
				Key: key,
			});

			const response = await this.client.send(command);

			if (!response.Body) {
				throw new Error("No body in R2 response");
			}

			const arrayBuffer = await response.Body.transformToByteArray();
			console.log("✅ [R2_STORAGE] File downloaded successfully", {
				key,
				size: arrayBuffer.length,
			});
			return arrayBuffer;
		} catch (error) {
			console.error("❌ [R2_STORAGE] Failed to download file", {
				key,
				error: error instanceof Error ? error.message : String(error),
			});
			throw error;
		}
	}

	async deleteFile(key: string): Promise<void> {
		try {
			console.log("🗑️ [R2_STORAGE] Deleting file", { key });
			const command = new DeleteObjectCommand({
				Bucket: this.bucketName,
				Key: key,
			});

			await this.client.send(command);
			console.log("✅ [R2_STORAGE] File deleted successfully", { key });
		} catch (error) {
			console.error("❌ [R2_STORAGE] Failed to delete file", {
				key,
				error: error instanceof Error ? error.message : String(error),
			});
			throw error;
		}
	}
}
