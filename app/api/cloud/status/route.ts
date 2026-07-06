import { NextResponse } from "next/server";
import { isAuthenticated } from "../../../lib/auth";
import { getCloudStatus } from "../../../lib/cloud";

export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json(await getCloudStatus());
}
