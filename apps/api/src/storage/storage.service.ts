import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { createReadStream, existsSync } from 'node:fs';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import { join, resolve } from 'node:path';

/**
 * Local-disk file storage for development.
 * Swap this implementation for an S3 / Cloudflare R2 driver before go-live —
 * the interface (save / stream / remove) stays the same.
 */
@Injectable()
export class StorageService {
  private readonly dir = resolve(process.env.UPLOAD_DIR ?? './uploads');

  async save(
    buffer: Buffer,
    originalName: string,
  ): Promise<{ key: string; size: number }> {
    await mkdir(this.dir, { recursive: true });
    const safe = (originalName || 'file')
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .slice(-80);
    const key = `${randomUUID()}__${safe}`;
    await writeFile(join(this.dir, key), buffer);
    return { key, size: buffer.length };
  }

  private pathFor(key: string): string {
    const full = join(this.dir, key);
    if (!existsSync(full)) {
      throw new NotFoundException('File missing from storage');
    }
    return full;
  }

  stream(key: string) {
    return createReadStream(this.pathFor(key));
  }

  async remove(key: string): Promise<void> {
    try {
      await unlink(join(this.dir, key));
    } catch {
      // already gone — nothing to do
    }
  }
}
