import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getStudentByEmail, writeSellAll } from "@/lib/sheets";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email)
    return Response.json({ error: "Not authenticated" }, { status: 401 });

  const studentName = await getStudentByEmail(session.user.email);
  if (!studentName)
    return Response.json(
      { error: "Not a registered student" },
      { status: 403 }
    );

  try {
    const result = await writeSellAll(studentName);
    return Response.json(result);
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
