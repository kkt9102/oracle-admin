import { NextResponse } from "next/server";
import { isAuthenticated } from "../../../lib/auth";
import { getListeningPorts } from "../../../lib/ports";

export const runtime = "nodejs";

export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  return NextResponse.json(await getListeningPorts());
}
