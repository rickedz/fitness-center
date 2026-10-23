import { NextResponse } from "next/server";
import { createClient } from "@/app/lib/supabase/server";
import { createAdminClient } from "@/app/lib/supabase/admin";
import type { Role } from "@/app/lib/auth";

const roles: Role[] = ["admin", "staff", "trainer", "client"];

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });
  }

  const body = await request.json().catch(() => null) as {
    name?: unknown; email?: unknown; password?: unknown; role?: unknown; title?: unknown;
  } | null;

  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const role = body?.role;
  const title = typeof body?.title === "string" ? body.title.trim() : "";

  if (!name || !/^\S+@\S+\.\S+$/.test(email) || password.length < 8 || !roles.includes(role as Role)) {
    return NextResponse.json({ error: "Provide a name, valid email, password of at least 8 characters, and role." }, { status: 400 });
  }

  const initials = name.split(/\s+/).map((word) => word[0]).join("").toUpperCase().slice(0, 2);
  const colors = ["orange", "blue", "teal", "red", "purple", "lime"];
  const color = colors[Math.floor(Math.random() * colors.length)];
  const userTitle = title || (role === "admin" ? "Administrator" : role === "staff" ? "Staff Member" : "Basic Member");

  const admin = createAdminClient();
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: name, avatar_initials: initials, avatar_color: color, title: userTitle },
  });

  if (authError || !authData.user) {
    return NextResponse.json({ error: authError?.message ?? "Unable to create user." }, { status: 400 });
  }

  const { error: profileError } = await admin.from("profiles").update({
    full_name: name,
    avatar_initials: initials,
    avatar_color: color,
    title: userTitle,
    role,
  }).eq("id", authData.user.id);

  if (profileError) {
    await admin.auth.admin.deleteUser(authData.user.id);
    return NextResponse.json({ error: `Unable to create the user profile: ${profileError.message}` }, { status: 500 });
  }

  return NextResponse.json({ id: authData.user.id }, { status: 201 });
}
