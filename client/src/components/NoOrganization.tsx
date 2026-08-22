import { Building } from "lucide-react";
import { useExtracted } from "next-intl";
import { ManageInSwalhaAuthButton } from "./ManageInSwalhaAuth";
import { Card, CardDescription, CardTitle } from "./ui/card";

export function NoOrganization({
  message,
}: {
  message?: string;
}) {
  const t = useExtracted();

  return (
    <div className="w-full ">
      <Card className="p-6 flex flex-col items-center text-center w-full">
        <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
          <Building className="h-6 w-6 text-primary" />
        </div>
        <CardTitle className="mb-2 text-xl">{t("No Organization")}</CardTitle>
        <CardDescription className="mb-6">
          {message || t("You're not a member of any organization yet — manage organizations in SWALHA Auth.")}
        </CardDescription>
        <ManageInSwalhaAuthButton />
      </Card>
    </div>
  );
}
