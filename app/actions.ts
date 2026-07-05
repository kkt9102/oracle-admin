"use server";

import { redirect } from "next/navigation";
import {
  clearAdminSession,
  createAdminSession,
  validateAdminCredentials,
} from "./lib/auth";

export async function loginAction(formData: FormData) {
  const username = String(formData.get("username") || "").trim();
  const password = String(formData.get("password") || "");

  if (!validateAdminCredentials(username, password)) {
    redirect("/?error=invalid");
  }

  await createAdminSession();
  redirect("/");
}

export async function logoutAction() {
  await clearAdminSession();
  redirect("/");
}
