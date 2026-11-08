"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Pagination } from "@/components/data-display/table";

export function PortalPagination({
  page,
  limit,
  total,
}: {
  page: number;
  limit: number;
  total: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Pagination
      page={page}
      limit={limit}
      total={total}
      disabled={pending}
      onPage={(next) =>
        startTransition(() => router.push(`/portal?page=${next}`, { scroll: false }))
      }
    />
  );
}
