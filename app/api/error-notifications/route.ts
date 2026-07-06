import { NextResponse } from "next/server";
import { isAuthenticated } from "../../lib/auth";
import { deleteErrorNotification } from "../../lib/errorNotifications";

export const runtime = "nodejs";

export async function DELETE(request: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  const id = new URL(request.url).searchParams.get("id")?.trim();

  if (!id) {
    return NextResponse.json({ message: "삭제할 오류 ID가 필요합니다." }, { status: 400 });
  }

  const deleted = await deleteErrorNotification(id);

  if (!deleted) {
    return NextResponse.json({ message: "오류 메시지를 찾을 수 없습니다." }, { status: 404 });
  }

  return NextResponse.json({ deleted: true });
}
