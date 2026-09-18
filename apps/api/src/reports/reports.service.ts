import { Injectable } from '@nestjs/common';
import { ProcurementStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';

const DAY_MS = 24 * 60 * 60 * 1000;

function bump(map: Record<string, number>, key: string) {
  map[key] = (map[key] ?? 0) + 1;
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Brief §18 — Management Reporting. One combined payload for the Super Admin dashboard. */
  async overview() {
    const [tickets, projects, tasks, meetings, trainings, procurement, workload] =
      await Promise.all([
        this.ticketStats(),
        this.projectStats(),
        this.taskStats(),
        this.meetingStats(),
        this.trainingStats(),
        this.procurementStats(),
        this.workloadStats(),
      ]);
    return { tickets, projects, tasks, meetings, trainings, procurement, workload };
  }

  private async ticketStats() {
    const rows = await this.prisma.ticket.findMany({
      select: {
        statusKey: true,
        type: true,
        createdAt: true,
        closedAt: true,
        team: { select: { name: true } },
        requester: {
          select: { primaryDepartment: { select: { name: true } } },
        },
      },
    });
    const byStatus: Record<string, number> = {};
    const byType: Record<string, number> = {};
    const byDepartment: Record<string, number> = {};
    const byTeam: Record<string, number> = {};
    let resolvedCount = 0;
    let totalResolutionMs = 0;
    for (const t of rows) {
      bump(byStatus, t.statusKey);
      bump(byType, t.type);
      bump(byDepartment, t.requester?.primaryDepartment?.name ?? 'Unassigned');
      if (t.team?.name) bump(byTeam, t.team.name);
      if (t.closedAt) {
        resolvedCount += 1;
        totalResolutionMs += Math.max(0, t.closedAt.getTime() - t.createdAt.getTime());
      }
    }
    return {
      total: rows.length,
      open: rows.filter((t) => !['resolved', 'closed'].includes(t.statusKey)).length,
      byStatus,
      byType,
      byDepartment,
      byTeam,
      avgResolutionDays: resolvedCount ? totalResolutionMs / resolvedCount / DAY_MS : null,
      resolvedCount,
    };
  }

  private async projectStats() {
    const rows = await this.prisma.project.findMany({
      select: { statusKey: true, targetDate: true, title: true, number: true },
    });
    const byStatus: Record<string, number> = {};
    const now = new Date();
    const delayed: { number: number; title: string; targetDate: Date | null }[] = [];
    for (const p of rows) {
      bump(byStatus, p.statusKey);
      if (
        p.targetDate &&
        p.targetDate < now &&
        !['completed', 'delayed'].includes(p.statusKey)
      ) {
        delayed.push({ number: p.number, title: p.title, targetDate: p.targetDate });
      } else if (p.statusKey === 'delayed') {
        delayed.push({ number: p.number, title: p.title, targetDate: p.targetDate });
      }
    }
    return { total: rows.length, byStatus, delayed };
  }

  private async taskStats() {
    const rows = await this.prisma.task.findMany({
      select: { statusKey: true, dueDate: true },
    });
    const byStatus: Record<string, number> = {};
    const now = new Date();
    let overdue = 0;
    for (const t of rows) {
      bump(byStatus, t.statusKey);
      if (t.dueDate && t.dueDate < now && t.statusKey !== 'done') overdue += 1;
    }
    return { total: rows.length, byStatus, overdue };
  }

  private async meetingStats() {
    const participants = await this.prisma.meetingParticipant.findMany({
      select: { response: true, attended: true },
    });
    const byResponse: Record<string, number> = {};
    let attended = 0;
    for (const p of participants) {
      bump(byResponse, p.response);
      if (p.attended) attended += 1;
    }
    const totalMeetings = await this.prisma.meeting.count();
    return {
      totalMeetings,
      byResponse,
      attendanceRate: participants.length ? attended / participants.length : null,
      pendingResponses: byResponse['PENDING'] ?? 0,
    };
  }

  private async trainingStats() {
    const rows = await this.prisma.training.findMany({
      select: { statusKey: true },
    });
    const byStatus: Record<string, number> = {};
    for (const t of rows) bump(byStatus, t.statusKey);
    const followUpRequired = await this.prisma.trainingParticipant.count({
      where: { ackStatus: 'NEEDS_FOLLOW_UP' },
    });
    const completed = byStatus['completed'] ?? 0;
    return {
      total: rows.length,
      byStatus,
      completed,
      completionRate: rows.length ? completed / rows.length : null,
      followUpRequired,
    };
  }

  private async procurementStats() {
    const rows = await this.prisma.procurementRequest.findMany({
      select: { statusKey: true },
    });
    const byStatus: Record<string, number> = {};
    for (const r of rows) bump(byStatus, r.statusKey);
    const pendingStatuses: ProcurementStatus[] = [
      ProcurementStatus.SUBMITTED,
      ProcurementStatus.AWAITING_DIRECTOR,
      ProcurementStatus.AWAITING_FINAL_APPROVAL,
    ];
    const pendingApproval = rows.filter((r) =>
      pendingStatuses.includes(r.statusKey),
    ).length;
    return { total: rows.length, byStatus, pendingApproval };
  }

  private async workloadStats() {
    const rows = await this.prisma.activity.findMany({
      where: { status: 'OPEN' },
      select: {
        dueAt: true,
        assignedTo: { select: { id: true, fullName: true } },
      },
    });
    const now = new Date();
    const byUser = new Map<string, { userId: string; fullName: string; open: number; overdue: number }>();
    for (const a of rows) {
      const key = a.assignedTo.id;
      const entry = byUser.get(key) ?? {
        userId: key,
        fullName: a.assignedTo.fullName,
        open: 0,
        overdue: 0,
      };
      entry.open += 1;
      if (a.dueAt < now) entry.overdue += 1;
      byUser.set(key, entry);
    }
    const perEmployee = [...byUser.values()].sort((a, b) => b.open - a.open).slice(0, 15);
    return {
      totalOpenActivities: rows.length,
      totalOverdueActivities: rows.filter((a) => a.dueAt < now).length,
      perEmployee,
    };
  }
}
