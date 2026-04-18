import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sheetsClient } from '@/lib/sheets';

const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const clean = s => parseFloat(String(s || '').replace(/[$,%]/g, '')) || null;

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: 'Not authenticated' }, { status: 401 });

  try {
    const sheets = await sheetsClient();

    // Read the full leaderboard sheet to find the history blocks
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `'🏆 Leaderboard'!A1:AZ300`,
    });

    const rows = res.data.values || [];
    if (!rows.length) return Response.json({ students: [], intraday: [], daily: [] });

    // Find the header row that contains "Timestamp" — marks start of intraday block
    let intradayCol = -1, dailyCol = -1;
    let intradayStudents = [], dailyStudents = [];

    for (let c = 0; c < (rows[0]?.length || 0); c++) {
      if (rows[0][c] === 'Timestamp') {
        intradayCol = c;
        // Next row has student names
        intradayStudents = (rows[1] || []).slice(c + 1).filter(s => s && s.trim());
      }
      if (rows[0][c] === 'Date') {
        dailyCol = c;
        dailyStudents = (rows[1] || []).slice(c + 1).filter(s => s && s.trim());
      }
    }

    // Parse intraday data
    const intraday = [];
    if (intradayCol >= 0) {
      for (let r = 2; r < rows.length; r++) {
        const row = rows[r];
        if (!row || !row[intradayCol]) continue;
        const timestamp = row[intradayCol];
        const entry = { t: timestamp };
        intradayStudents.forEach((name, i) => {
          const val = clean(row[intradayCol + 1 + i]);
          if (val !== null && val > 0) entry[name] = val;
        });
        if (Object.keys(entry).length > 1) intraday.push(entry);
      }
    }

    // Parse daily data
    const daily = [];
    if (dailyCol >= 0) {
      for (let r = 2; r < rows.length; r++) {
        const row = rows[r];
        if (!row || !row[dailyCol]) continue;
        const date = row[dailyCol];
        const entry = { t: date };
        dailyStudents.forEach((name, i) => {
          const val = clean(row[dailyCol + 1 + i]);
          if (val !== null && val > 0) entry[name] = val;
        });
        if (Object.keys(entry).length > 1) daily.push(entry);
      }
    }

    // Use whichever student list is more complete
    const students = intradayStudents.length >= dailyStudents.length
      ? intradayStudents
      : dailyStudents;

    return Response.json({ students, intraday, daily });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
