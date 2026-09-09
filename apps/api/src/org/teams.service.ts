import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateTeamDto, UpdateTeamDto } from './org.dto.js';

@Injectable()
export class TeamsService {
  constructor(private readonly prisma: PrismaService) {}

  list(includeInactive = false) {
    return this.prisma.team.findMany({
      where: includeInactive ? {} : { active: true },
      orderBy: { name: 'asc' },
      include: {
        department: { select: { id: true, name: true } },
        _count: { select: { members: true } },
      },
    });
  }

  async get(id: string) {
    const team = await this.prisma.team.findUnique({
      where: { id },
      include: {
        department: { select: { id: true, name: true } },
        members: {
          orderBy: { user: { fullName: 'asc' } },
          include: {
            user: { select: { id: true, fullName: true, email: true } },
          },
        },
      },
    });
    if (!team) throw new NotFoundException('Team not found');
    return {
      ...team,
      members: team.members.map((m) => ({
        membershipId: m.id,
        ...m.user,
        joinedAt: m.createdAt,
      })),
    };
  }

  async create(dto: CreateTeamDto) {
    const name = dto.name.trim();
    if (await this.prisma.team.findUnique({ where: { name } })) {
      throw new ConflictException('A team with this name already exists');
    }
    return this.prisma.team.create({
      data: {
        name,
        departmentId: dto.departmentId ?? null,
        description: dto.description?.trim() || null,
      },
    });
  }

  async update(id: string, dto: UpdateTeamDto) {
    await this.getRaw(id);
    return this.prisma.team.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        departmentId: dto.departmentId,
        description: dto.description?.trim(),
        active: dto.active,
      },
    });
  }

  async addMember(teamId: string, userId: string) {
    await this.getRaw(teamId);
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const existing = await this.prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
    });
    if (existing) {
      throw new ConflictException('User is already a member of this team');
    }
    await this.prisma.teamMember.create({ data: { teamId, userId } });
    return this.get(teamId);
  }

  async removeMember(teamId: string, userId: string) {
    await this.getRaw(teamId);
    await this.prisma.teamMember.deleteMany({ where: { teamId, userId } });
    return this.get(teamId);
  }

  private async getRaw(id: string) {
    const team = await this.prisma.team.findUnique({ where: { id } });
    if (!team) throw new NotFoundException('Team not found');
    return team;
  }
}
