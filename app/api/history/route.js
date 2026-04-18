import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getStudentByEmail, sheetsClient } from "@/lib/sheets";

const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const clean = (s) => parseFloat(String(s).replace(/[$,%]/g, "")) || 0;

export async function GET(request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email)
    return Response.json({ error: "Not authenticated" }, { status: 401 });

  const isTeacher = session.user.email === process.env.TEACHER_EMAIL;
  const { searchParams } = new URL(request.url);
  const requestedStudent = searchParams.get("student");

  let studentName;
  if (isTeacher && requestedStudent) {
    studentName = requestedStudent;
  } else {
    studentName = await getStudentByEmail(session.user.email);
  }

  if (!studentName)
    return Response.json({ error: "Student not found" }, { status: 404 });

  try {
    const sheets = await sheetsClient();

    // Read intraday history (col U/V = 21/22) and daily history (col W/X = 23/24)
    const [intraRes, dailyRes] = await Promise.all([
      sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range: `'${studentName}'!U41:V540`,
      }),
      sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range: `'${studentName}'!W41:X240`,
      }),
    ]);

    const intraday = (intraRes.data.values || [])
      .filter((r) => r[0] && r[1])
      .map((r) => ({ t: r[0], v: clean(r[1]) }))
      .filter((r) => r.v > 0);

    const daily = (dailyRes.data.values || [])
      .filter((r) => r[0] && r[1])
      .map((r) => ({ t: r[0], v: clean(r[1]) }))
      .filter((r) => r.v > 0);

    return Response.json({ intraday, daily });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
