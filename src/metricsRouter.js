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

export default router;
