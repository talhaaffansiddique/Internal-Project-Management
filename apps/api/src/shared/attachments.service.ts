import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { EntityType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { StorageService } from '../storage/storage.service.js';

export interface UploadedFileLike {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
}

@Injectable()
export class AttachmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async upload(actorId: string, file: UploadedFileLike) {
    const { key, size } = await this.storage.save(
      file.buffer,
      file.originalname,
    );
    return this.prisma.attachment.create({
      data: {
        originalFilename: file.originalname,
        storageKey: key,
        mimeType: file.mimetype || 'application/octet-stream',
        sizeBytes: size,
        uploadedById: actorId,
      },
    });
  }

  async get(id: string) {
    const a = await this.prisma.attachment.findUnique({
      where: { id },
      include: { uploadedBy: { select: { id: true, fullName: true } } },
    });
    if (!a) throw new NotFoundException('Attachment not found');
    return a;
  }

  async streamFor(id: string) {
    const attachment = await this.get(id);
    return { attachment, stream: this.storage.stream(attachment.storageKey) };
  }

  listForEntity(entityType: EntityType, entityId: string) {
    return this.prisma.attachment.findMany({
      where: { entityType, entityId },
      orderBy: { createdAt: 'asc' },
      include: { uploadedBy: { select: { id: true, fullName: true } } },
    });
  }

  async linkToEntity(
    id: string,
    entityType: EntityType,
    entityId: string,
  ) {
    const a = await this.prisma.attachment.findUnique({ where: { id } });
    if (!a) throw new NotFoundException('Attachment not found');
    if (
      a.entityId &&
      (a.entityId !== entityId || a.entityType !== entityType)
    ) {
      throw new ForbiddenException(
        'Attachment is already linked to another record',
      );
    }
    return this.prisma.attachment.update({
      where: { id },
      data: { entityType, entityId },
    });
  }

  /** Link a caller's own still-unlinked attachments to an entity (used by comments). */
  async linkMany(
    ids: string[],
    entityType: EntityType,
    entityId: string,
    actorId: string,
  ) {
    if (!ids?.length) return;
    await this.prisma.attachment.updateMany({
      where: { id: { in: ids }, uploadedById: actorId, entityId: null },
      data: { entityType, entityId },
    });
  }

  async remove(id: string, actorId: string) {
    const a = await this.prisma.attachment.findUnique({ where: { id } });
    if (!a) throw new NotFoundException('Attachment not found');
    if (a.uploadedById !== actorId) {
      throw new ForbiddenException(
        'You can only delete attachments you uploaded',
      );
    }
    await this.storage.remove(a.storageKey);
    await this.prisma.attachment.delete({ where: { id } });
    return { ok: true };
  }
}
