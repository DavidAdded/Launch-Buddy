import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { TodoList } from "./todo-list";

export default async function TodosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("scopes")
    .eq("id", user.id)
    .single();

  const scopes: string[] = Array.isArray(profile?.scopes) ? profile.scopes : [];
  if (!scopes.includes("todos")) redirect("/");

  const [
    { data: myItems },
    { data: sharedItems },
    { data: allProfiles },
    { data: customers },
  ] = await Promise.all([
    supabase
      .from("todo_items")
      .select("id, label, checked, assigned_to, user_id, position, customer_id")
      .eq("user_id", user.id)
      .order("position"),
    supabase
      .from("todo_items")
      .select("id, label, checked, assigned_to, user_id, position, customer_id")
      .eq("assigned_to", user.id)
      .neq("user_id", user.id)
      .order("position"),
    supabase
      .from("profiles")
      .select("id, first_name, last_name")
      .order("first_name"),
    supabase.from("customers").select("id, name").order("name"),
  ]);

  const profileMap = new Map(
    (allProfiles ?? []).map((p) => [
      p.id,
      [p.first_name, p.last_name].filter(Boolean).join(" ") || "Unnamed",
    ]),
  );

  const customerMap = new Map((customers ?? []).map((c) => [c.id, c.name]));

  const myItemsWithCustomer = (myItems ?? []).map((item) => ({
    ...item,
    customer_name: item.customer_id
      ? (customerMap.get(item.customer_id) ?? null)
      : null,
  }));

  const sharedWithMe = (sharedItems ?? []).map((item) => ({
    ...item,
    sharer_name: profileMap.get(item.user_id) ?? "Unknown",
    customer_name: item.customer_id
      ? (customerMap.get(item.customer_id) ?? null)
      : null,
  }));

  const users = (allProfiles ?? [])
    .filter((p) => p.id !== user.id)
    .map((p) => ({
      id: p.id,
      displayName:
        [p.first_name, p.last_name].filter(Boolean).join(" ") || "Unnamed",
    }));

  const customerOptions = (customers ?? []).map((c) => ({
    id: c.id,
    name: c.name,
  }));

  return (
    <div className="min-h-screen bg-zinc-50 font-sans dark:bg-black">
      <header className="border-b border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto flex  items-center justify-between px-6 py-4">
          <Breadcrumbs
            items={[{ label: "Home", href: "/" }, { label: "To-do List" }]}
          />
          <div className="flex items-center gap-3">
            <Link
              href="/profile"
              className="cursor-pointer rounded-full border border-zinc-200 px-4 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Profile
            </Link>
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="cursor-pointer rounded-full border border-zinc-200 px-4 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Sign Out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto  px-6 py-10">
        <TodoList
          myItems={myItemsWithCustomer}
          sharedWithMe={sharedWithMe}
          currentUserId={user.id}
          users={users}
          customers={customerOptions}
        />
      </main>
    </div>
  );
}
