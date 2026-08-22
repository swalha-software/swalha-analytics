"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useExtracted } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "@/components/ui/sonner";

import { GetOrganizationMembersResponse, updateMemberSiteAccess } from "@/api/admin/endpoints/auth";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth";

import { SiteAccessMultiSelect } from "./SiteAccessMultiSelect";

type Member = GetOrganizationMembersResponse["data"][0];

interface EditMemberDialogProps {
  member: Member | null;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function EditMemberDialog({
  member,
  open,
  onClose,
  onSuccess,
}: EditMemberDialogProps) {
  const { data: activeOrganization } = authClient.useActiveOrganization();
  const queryClient = useQueryClient();
  const t = useExtracted();

  const [restrictSiteAccess, setRestrictSiteAccess] = useState(false);
  const [selectedSiteIds, setSelectedSiteIds] = useState<number[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open && member) {
      setRestrictSiteAccess(member.siteAccess?.hasRestrictedSiteAccess ?? false);
      setSelectedSiteIds(member.siteAccess?.siteIds ?? []);
    }
  }, [open, member]);

  const handleSave = async () => {
    if (!member || !activeOrganization?.id) return;

    if (restrictSiteAccess && selectedSiteIds.length === 0) {
      toast.error(t("Please select at least one site or disable site restrictions"));
      return;
    }

    setIsSaving(true);
    try {
      await updateMemberSiteAccess(activeOrganization.id, member.id, {
        hasRestrictedSiteAccess: restrictSiteAccess,
        siteIds: selectedSiteIds,
      });

      queryClient.invalidateQueries({ queryKey: ["organization-members"] });
      toast.success(t("Site access updated successfully"));
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error(error.message || t("Failed to update site access"));
    } finally {
      setIsSaving(false);
    }
  };

  if (!member) return null;

  // Only plain members can be restricted; roles are managed in SWALHA Auth.
  const isRestrictable = member.role === "member";

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("Site Access")}</DialogTitle>
          <DialogDescription>
            {t("Choose which sites {name} can access in Analytics.", {
              name: member.user.name || member.user.email,
            })}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>{t("Email")}</Label>
            <div className="text-sm text-neutral-500 dark:text-neutral-300">{member.user.email}</div>
          </div>

          <div className="grid gap-2">
            <Label>{t("Role")}</Label>
            <div className="text-sm text-neutral-500 dark:text-neutral-300 capitalize">
              {member.role === "admin" ? t("Admin") : member.role === "owner" ? t("Owner") : t("Member")}
            </div>
          </div>

          {isRestrictable ? (
            <>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="restrict-access"
                  checked={restrictSiteAccess}
                  onCheckedChange={checked => {
                    setRestrictSiteAccess(!!checked);
                    if (!checked) {
                      setSelectedSiteIds([]);
                    }
                  }}
                />
                <Label htmlFor="restrict-access" className="cursor-pointer">
                  {t("Restrict access to specific sites")}
                </Label>
              </div>
              {restrictSiteAccess ? (
                <div className="ps-6">
                  <SiteAccessMultiSelect selectedSiteIds={selectedSiteIds} onChange={setSelectedSiteIds} />
                  <p className="text-xs text-neutral-500 dark:text-neutral-300 mt-2">
                    {member.teams?.length
                      ? t(
                          "This member will have access to the selected sites, plus sites granted through their teams ({teams}).",
                          { teams: member.teams.map(team => team.name).join(", ") }
                        )
                      : t("This member will only have access to the selected sites.")}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-neutral-500 dark:text-neutral-300 ps-6">
                  {member.teams?.length
                    ? t(
                        "This member has access to sites granted through their teams ({teams}), plus any site not assigned to a team.",
                        { teams: member.teams.map(team => team.name).join(", ") }
                      )
                    : t("This member has access to all sites in the organization.")}
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-neutral-500 dark:text-neutral-300">
              {member.role === "owner" ? t("Organization owners") : t("Admins")}{" "}
              {t("automatically have access to all sites.")}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("Cancel")}
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !isRestrictable} variant="success">
            {isSaving ? t("Saving...") : t("Save Changes")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
