import { Router } from 'express';
import prisma from './db.js';
import { protect } from './auth.js';

const router = Router();
router.use(protect);

const startOfDay = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

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

const parseDate = (value, fallback) => {
  const ts = Date.parse(value);
  if (Number.isNaN(ts)) return startOfDay(fallback);
  return startOfDay(new Date(ts));
};

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
      })
    )
  );
};

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

// 📌 대시보드 오버뷰 통계 (GET /api/metrics/overview)
router.get('/overview', async (req, res, next) => {
  try {
    const today = startOfDay(new Date());
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    // 1. 오늘 방문자 수 (VisitStat에서 조회)
    // 오늘 날짜의 VisitStat 레코드를 모두 합산
    const visitorsTodayAgg = await prisma.visitStat.aggregate({
      where: { date: today },
      _sum: { uv: true },
    });
    const visitorsToday = visitorsTodayAgg._sum.uv || 0;

    // 2. 이번 달 문의 수
    const inquiriesMonth = await prisma.inquiry.count({
      where: {
        createdAt: {
          gte: firstDayOfMonth,
        },
      },
    });

    // 3. 총 프로젝트 수
    const totalProjects = await prisma.project.count();

    // 4. 대기 중인 문의 수 (status: 'new' or 'ing')
    const pendingInquiries = await prisma.inquiry.count({
      where: {
        status: { in: ['new', 'ing'] },
      },
    });

    // 5. 최근 활동 (최근 문의 5개 + 최근 프로젝트 3개 + 최근 갤러리 3개)
    // - 문의
    const recentInquiries = await prisma.inquiry.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
    });
    // - 프로젝트
    const recentProjects = await prisma.project.findMany({
      take: 3,
      orderBy: { createdAt: 'desc' },
    });

    // 활동 리스트 통합 및 정렬
    const activities = [
      ...recentInquiries.map((iq) => ({
        type: 'new', // icon: envelope
        icon: 'envelope',
        title: '새로운 견적 문의',
        meta: `${iq.userName} · ${iq.spaceType || '-'} · ${new Date(
          iq.createdAt
        ).toLocaleDateString()}`,
        date: iq.createdAt,
      })),
      ...recentProjects.map((pj) => ({
        type: 'project', // icon: hammer
        icon: 'hammer',
        title: '프로젝트 등록',
        meta: `${pj.title} · ${pj.location || '-'} · ${new Date(
          pj.createdAt
        ).toLocaleDateString()}`,
        date: pj.createdAt,
      })),
    ]
      .sort((a, b) => b.date - a.date)
      .slice(0, 5); // 최신 5개만

    // 6. 방문자 추이 (최근 7일)
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
        })
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
