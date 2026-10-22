import { PageHeader } from "@/components/ui/primitives";
import { RentalWizard } from "@/features/rentals/rental-wizard";
import { rentalContext } from "@/features/rentals/server";
export default async function NewRentalPage() {
  const context = await rentalContext("rental.manage");
  return (
    <>
      <PageHeader
        title="Tạo hợp đồng"
        description="Chọn thời gian, xe sẵn sàng và khách hàng trước khi xác nhận."
      />
      <RentalWizard
        key={context.business.id}
        businessId={context.business.id}
        currency={context.business.currency}
      />
    </>
  );
}
