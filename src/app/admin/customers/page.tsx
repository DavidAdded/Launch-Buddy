import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getIsAdmin } from "@/lib/admin";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { AddCustomerForm } from "./add-customer-form";
import { CustomerRow } from "./customer-row";

export default async function AdminCustomersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const isAdmin = await getIsAdmin();
  if (!isAdmin) redirect("/");

  const { data: customers } = await supabase
    .from("customers")
    .select("id, name, fortnox_id, created_at")
    .order("name", { ascending: true });

  return (
    <div className="min-h-screen bg-zinc-50 font-sans dark:bg-black">
      <header className="border-b border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto flex  items-center justify-between px-6 py-4">
          <Breadcrumbs
            items={[
              { label: "Home", href: "/" },
              { label: "Admin", href: "/admin" },
              { label: "Customers" },
            ]}
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
        <section className="mb-10">
          <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Add Customer
          </h2>
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <AddCustomerForm />
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Customers
          </h2>
          {customers && customers.length > 0 ? (
            <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
              {customers.map((customer, i) => (
                <div
                  key={customer.id}
                  className={`${
                    i < customers.length - 1
                      ? "border-b border-zinc-100 dark:border-zinc-800"
                      : ""
                  }`}
                >
                  <CustomerRow
                    customer={{
                      id: customer.id,
                      name: customer.name,
                      fortnox_id: customer.fortnox_id,
                    }}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-zinc-300 p-12 text-center dark:border-zinc-700">
              <p className="text-zinc-500 dark:text-zinc-400">
                No customers yet. Add your first company above.
              </p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
