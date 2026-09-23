import { notFound, redirect } from "next/navigation";
import type {
  Branch,
  Business,
  Membership,
  Page,
  Settings,
} from "@rental-fleet/contracts";
import { api, currentContext } from "@/lib/api";
import { ResourcePanel } from "../resource-panel";
export default async function Section({
  params,
  searchParams,
}: {
  params: Promise<{ section: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { section } = await params;
  if (!["business", "users", "branches", "settings"].includes(section))
    notFound();
  const c = await currentContext();
  if (section === "users" && !c.permissions.includes("user.read"))
    redirect("/access-denied");
  const requested = Number((await searchParams).page ?? 1);
  const page = Number.isInteger(requested) && requested >= 1 ? requested : 1;
  const endpoint = {
    business: "/businesses/current",
    users: `/memberships?page=${page}&limit=20`,
    branches: `/branches?page=${page}&limit=20`,
    settings: "/settings",
  }[section]!;
  const initial = await api<
    Business | Page<Branch> | Page<Membership> | Settings
  >(endpoint);
  return (
    <>
      <span className="eyebrow">QUẢN LÝ KHÔNG GIAN LÀM VIỆC</span>
      <h1>
        {
          {
            business: "Doanh nghiệp",
            users: "Thành viên",
            branches: "Chi nhánh",
            settings: "Cài đặt",
          }[section]
        }
      </h1>
      <ResourcePanel
        section={section as "business" | "users" | "branches" | "settings"}
        context={c}
        initial={initial}
      />
    </>
  );
}
