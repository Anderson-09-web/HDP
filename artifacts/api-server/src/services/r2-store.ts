import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

export type StoredObject = {
  path: string;
  kind: "file" | "directory";
  size: number;
  updatedAt: string;
  content?: string | null;
};

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for Cloudflare R2`);
  return value;
}

export class R2Store {
  private readonly bucket: string;
  private readonly client: S3Client;

  constructor() {
    this.bucket = required("R2_BUCKET");
    this.client = new S3Client({
      region: "auto",
      endpoint: required("R2_ENDPOINT"),
      credentials: {
        accessKeyId: required("R2_ACCESS_KEY"),
        secretAccessKey: required("R2_SECRET_KEY"),
      },
      forcePathStyle: true,
    });
  }

  async check() {
    await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
  }

  async list(prefix = "", includeContent = false): Promise<StoredObject[]> {
    const result = await this.client.send(
      new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: prefix ? `${prefix.replace(/\/+$/, "")}/` : undefined,
        Delimiter: "/",
      }),
    );
    const directories = (result.CommonPrefixes ?? []).map((item) => ({
      path: String(item.Prefix ?? "").replace(/\/$/, ""),
      kind: "directory" as const,
      size: 0,
      updatedAt: new Date().toISOString(),
      content: null,
    }));
    const files = await Promise.all(
      (result.Contents ?? [])
        .filter((item) => item.Key && !item.Key.endsWith("/"))
        .map(async (item) => {
          const key = item.Key as string;
          const entry: StoredObject = {
            path: key,
            kind: "file",
            size: Number(item.Size ?? 0),
            updatedAt: (item.LastModified ?? new Date()).toISOString(),
            content: null,
          };
          if (includeContent && entry.size <= 500_000) {
            entry.content = await this.readText(key);
          }
          return entry;
        }),
    );
    return [...directories, ...files].sort((a, b) => a.path.localeCompare(b.path));
  }

  async listAll(): Promise<StoredObject[]> {
    const objects: StoredObject[] = [];
    let continuationToken: string | undefined;
    do {
      const result = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          ContinuationToken: continuationToken,
        }),
      );
      for (const item of result.Contents ?? []) {
        if (!item.Key || item.Key.endsWith("/")) continue;
        objects.push({
          path: item.Key,
          kind: "file",
          size: Number(item.Size ?? 0),
          updatedAt: (item.LastModified ?? new Date()).toISOString(),
          content: null,
        });
      }
      continuationToken = result.IsTruncated
        ? result.NextContinuationToken
        : undefined;
    } while (continuationToken);
    return objects;
  }

  async putText(key: string, content: string) {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: content,
        ContentType: "text/plain; charset=utf-8",
      }),
    );
    return {
      path: key,
      kind: "file" as const,
      size: Buffer.byteLength(content),
      updatedAt: new Date().toISOString(),
      content,
    };
  }

  async putDirectory(key: string) {
    const normalized = key.endsWith("/") ? key : `${key}/`;
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: normalized, Body: "" }),
    );
    return {
      path: normalized.slice(0, -1),
      kind: "directory" as const,
      size: 0,
      updatedAt: new Date().toISOString(),
      content: null,
    };
  }

  async read(key: string) {
    return this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async readText(key: string) {
    const result = await this.read(key);
    return (await result.Body?.transformToString("utf8")) ?? "";
  }

  async delete(key: string) {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }
}