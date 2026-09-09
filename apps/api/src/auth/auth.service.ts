import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  private async verifyCredentials(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });
    if (!user) throw new UnauthorizedException('Invalid email or password');
    if (user.status === 'DISABLED') {
      throw new UnauthorizedException('This account is disabled');
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Invalid email or password');
    return user;
  }

  async login(email: string, password: string) {
    const user = await this.verifyCredentials(email, password);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
    const token = await this.jwt.signAsync({ sub: user.id, email: user.email });
    return { token, user: await this.me(user.id) };
  }

  /** Current user with roles, department and teams; password hash stripped. */
  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        primaryDepartment: true,
        designation: true,
        roles: { include: { role: true } },
        teamMemberships: { include: { team: true } },
      },
    });
    if (!user) throw new UnauthorizedException();

    const { passwordHash: _omit, roles, teamMemberships, ...safe } = user;
    return {
      ...safe,
      roles: roles.map((r) => r.role.key),
      roleNames: roles.map((r) => r.role.name),
      teams: teamMemberships.map((t) => ({ id: t.team.id, name: t.team.name })),
    };
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();

    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) throw new BadRequestException('Current password is incorrect');

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
    return { ok: true };
  }
}
