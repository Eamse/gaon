import { Router } from 'express';
import prisma from './db.js';
import { protect } from './auth.js';

const router = Router();
router.use(protect);

/** Date 객체를 해당 날짜의 시작(00:00:00)으로 설정합니다. */
const startOfDay = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

/** 날짜 범위를 최대 90일로 제한합니다. */
const clampRange = (from, to, maxDays = 90) => {
  const end = startOfDay(to);
  const start = startOfDay(from);
  const diffDays = Math.floor((end - start) / (1000 * 60 * 60 * 24));
  if (diffDays >= maxDays) {
    start.setDate(end.getDate() - (maxDays - 1));
  }
  if (start > end) return { from: end, to: end };
  return { from: start, to: end };
};

/** 문자열을 Date 객체로 파싱하고, 실패 시 fallback 값을 반환합니다. */
const parseDate = (value, fallback) => {
  const ts = Date.parse(value);
  if (Number.isNaN(ts)) return startOfDay(fallback);
  return startOfDay(new Date(ts));
};

/** 지정된 기간 동안의 방문 로그를 집계하여 VisitStat 테이블에 저장(upsert)합니다. */
const aggregateVisitStats = async (from, to) => {
  const endExclusive = new Date(to);
  endExclusive.setDate(endExclusive.getDate() + 1);

  const rows = await prisma.$queryRaw`
    SELECT date_trunc('day', "createdAt")::date AS date,
           "path",
           COUNT(*)::int            AS pv,
           COUNT(DISTINCT "ipHash") AS uv
    FROM "VisitLog"
    WHERE "createdAt" >= ${from} AND "createdAt" < ${endExclusive}
    GROUP BY date, "path"
  `;

  await Promise.all(
    rows.map((row) =>
      prisma.visitStat.upsert({
        where: {
          date_path: {
            date: new Date(row.date),
            path: row.path,
          },
        },
        update: {
          pv: Number(row.pv),
          uv: Number(row.uv),
        },
        create: {
          date: new Date(row.date),
          path: row.path,
          pv: Number(row.pv),
          uv: Number(row.uv),
        },
      }),
    ),
  );
};

/** GET /api/metrics/daily - 일별 방문 통계를 조회합니다. */
router.get('/daily', async (req, res, next) => {
  try {
    const today = startOfDay(new Date());
    const defaultFrom = new Date(today);
    defaultFrom.setDate(today.getDate() - 6);

    const from = req.query.from
      ? parseDate(req.query.from, defaultFrom)
      : defaultFrom;
    const to = req.query.to ? parseDate(req.query.to, today) : today;
    const { from: rangeFrom, to: rangeTo } = clampRange(from, to, 90);

    await aggregateVisitStats(rangeFrom, rangeTo);

    const stats = await prisma.visitStat.findMany({
      where: {
        date: {
          gte: rangeFrom,
          lte: rangeTo,
        },
      },
      orderBy: [{ date: 'desc' }, { path: 'asc' }],
    });

    res.json({
      ok: true,
      range: {
        from: rangeFrom,
        to: rangeTo,
      },
      stats,
    });
  } catch (err) {
    next(err);
  }
});

/** GET /api/metrics/overview - 대시보드에 필요한 주요 통계 데이터를 조회합니다. */
router.get('/overview', async (req, res, next) => {
  try {
    const today = startOfDay(new Date());
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const visitorsTodayAgg = await prisma.visitStat.aggregate({
      where: { date: today },
      _sum: { uv: true },
    });
    const visitorsToday = visitorsTodayAgg._sum.uv || 0;

    const inquiriesMonth = await prisma.inquiry.count({
      where: {
        createdAt: {
          gte: firstDayOfMonth,
        },
      },
    });

    const totalProjects = await prisma.project.count();

    const pendingInquiries = await prisma.inquiry.count({
      where: {
        status: { in: ['new', 'ing'] },
      },
    });

    const recentInquiries = await prisma.inquiry.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
    });
    const recentProjects = await prisma.project.findMany({
      take: 3,
      orderBy: { createdAt: 'desc' },
    });

    const activities = [
      ...recentInquiries.map((iq) => ({
        type: 'new', // icon: envelope
        icon: 'envelope',
        title: '새로운 견적 문의',
        meta: `${iq.userName} · ${iq.spaceType || '-'} · ${new Date(
          iq.createdAt,
        ).toLocaleDateString()}`,
        date: iq.createdAt,
      })),
      ...recentProjects.map((pj) => ({
        type: 'project', // icon: hammer
        icon: 'hammer',
        title: '프로젝트 등록',
        meta: `${pj.title} · ${pj.location || '-'} · ${new Date(
          pj.createdAt,
        ).toLocaleDateString()}`,
        date: pj.createdAt,
      })),
    ]
      .sort((a, b) => b.date - a.date)
      .slice(0, 5);

    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 6);

    const dailyStats = await prisma.visitStat.groupBy({
      by: ['date'],
      where: {
        date: { gte: sevenDaysAgo },
      },
      _sum: {
        uv: true,
      },
      orderBy: {
        date: 'asc',
      },
    });

    const visitorTrend = {
      labels: dailyStats.map((stat) =>
        new Date(stat.date).toLocaleDateString('ko-KR', {
          month: 'numeric',
          day: 'numeric',
        }),
      ),
      data: dailyStats.map((stat) => stat._sum.uv || 0),
    };

    res.json({
      ok: true,
      visitorsToday,
      inquiriesMonth,
      totalProjects,
      pendingInquiries,
      recentActivities: activities,
      visitorTrend,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
