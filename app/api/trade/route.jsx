import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getStudentByEmail, writeTradeForm } from "@/lib/sheets";

export async function POST(request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email)
    return Response.json({ error: "Not authenticated" }, { status: 401 });

  const studentName = await getStudentByEmail(session.user.email);
  if (!studentName)
    return Response.json(
      { error: "Not a registered student" },
      { status: 403 }
    );

  const { action, coin, amountType, amount } = await request.json();
  if (!["BUY", "SELL"].includes(action))
    return Response.json({ error: "Invalid action" }, { status: 400 });
  if (!coin || !amount || parseFloat(amount) <= 0)
    return Response.json({ error: "Invalid coin or amount" }, { status: 400 });

  try {
    const result = await writeTradeForm(
      studentName,
      action,
      coin,
      amountType || "Dollar Amount",
      amount
    );
    return Response.json(result);
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
