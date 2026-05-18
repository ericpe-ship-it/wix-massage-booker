import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const body = await req.json();
    const base44 = createClientFromRequest(req);

    const booking = body.data;
    if (!booking || !booking.date || !booking.start_time) {
      return Response.json({ error: 'Missing booking data' }, { status: 400 });
    }

    // Only process bookings with a real user email (skip guests)
    if (!booking.user_email || booking.user_email === 'guest@admin') {
      return Response.json({ skipped: true, reason: 'guest booking' });
    }

    // Safety cutoff: only create calendar events for bookings created on or after 2026-05-18
    const createdDate = booking.created_date ? new Date(booking.created_date) : null;
    const cutoff = new Date('2026-05-18T00:00:00Z');
    if (!createdDate || createdDate < cutoff) {
      return Response.json({ skipped: true, reason: 'booking predates cutoff' });
    }

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlecalendar');

    // Build start/end datetime strings in the booking's local date + time
    const startDateTime = `${booking.date}T${booking.start_time}:00`;
    const endDateTime = `${booking.date}T${booking.end_time}:00`;

    // Fetch schedule config for timezone and location
    const configs = await base44.asServiceRole.entities.ScheduleConfig.list();
    const config = configs[0] || {};
    const timezone = config.timezone || 'America/Chicago';
    const location = config.location_text || '';

    const event = {
      summary: `Massage - ${booking.user_name || booking.user_email}`,
      description: booking.notes ? `Notes: ${booking.notes}` : 'Massage session booked via the massage app.',
      location,
      start: {
        dateTime: startDateTime,
        timeZone: timezone
      },
      end: {
        dateTime: endDateTime,
        timeZone: timezone
      },
      attendees: [
        { email: booking.user_email }
      ],
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 60 },
          { method: 'popup', minutes: 30 }
        ]
      }
    };

    const calendarId = 'CDRoffice@wix.com';
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?sendUpdates=all`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(event)
      }
    );

    const result = await response.json();

    if (!response.ok) {
      console.error('Google Calendar API error:', JSON.stringify(result));
      return Response.json({ error: result.error?.message || 'Calendar API error' }, { status: 500 });
    }

    // Store the calendar event ID on the booking record
    await base44.asServiceRole.entities.Booking.update(booking.id, {
      calendar_event_id: result.id
    });

    return Response.json({ success: true, event_id: result.id });
  } catch (error) {
    console.error('createGoogleCalendarEvent error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});