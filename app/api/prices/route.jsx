import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getPriceData } from "@/lib/sheets";

export async function GET(request) {
  const session = await getServerSession(authOptions);
  if (!session)
    return Response.json({ error: "Not authenticated" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const full = searchParams.get("full") === "true";

  try {
    const data = await getPriceData(full);
    return Response.json(data);
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
