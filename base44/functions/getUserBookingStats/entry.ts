import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || !['admin', 'super_admin'].includes(user.role)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { startDate, endDate } = await req.json();

    const allBookings = await base44.asServiceRole.entities.Booking.list('-date', 2000);

    const filtered = allBookings.filter(b => {
      if (!b.date) return false;
      if (startDate && b.date < startDate) return false;
      if (endDate && b.date > endDate) return false;
      return true;
    });

    const statsMap = {};
    for (const booking of filtered) {
      const key = booking.user_email || booking.user_id || 'unknown';
      if (!statsMap[key]) {
        statsMap[key] = {
          user_email: booking.user_email || '',
          user_name: booking.user_name || booking.user_email || 'Unknown',
          total: 0,
          completed: 0,
          cancelled: 0,
          late_cancelled: 0,
          no_show: 0,
          booked: 0,
          confirmed: 0,
        };
      }
      statsMap[key].total++;
      const s = booking.status;
      if (statsMap[key][s] !== undefined) statsMap[key][s]++;
    }

    const results = Object.values(statsMap).sort((a, b) => b.total - a.total);

    return Response.json({ stats: results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});