import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getStudentByEmail, getStudentPortfolio } from "@/lib/sheets";

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
    const data = await getStudentPortfolio(studentName);
    return Response.json(data);
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
