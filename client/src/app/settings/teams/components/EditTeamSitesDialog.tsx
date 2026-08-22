"use client";

import { useExtracted } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "@/components/ui/sonner";

import { Team } from "@/api/admin/endpoints/teams";
import { useUpdateTeamSites } from "@/api/admin/hooks/useTeams";
import { useGetSitesFromOrg } from "@/api/admin/hooks/useSites";
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

interface EditTeamSitesDialogProps {
  team?: Team;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSuccess?: () => void;
}

// Team name and membership live in SWALHA Auth; only site assignment is Analytics-owned.
export function EditTeamSitesDialog({
  team,
  open = false,
  onOpenChange,
  onSuccess,
}: EditTeamSitesDialogProps) {
  const t = useExtracted();
  const { data: activeOrganization } = authClient.useActiveOrganization();
  const { data: sitesData, isLoading: isLoadingSites } = useGetSitesFromOrg(activeOrganization?.id);

  const updateTeamSites = useUpdateTeamSites();

  const [selectedSiteIds, setSelectedSiteIds] = useState<number[]>([]);

  useEffect(() => {
    if (open && team) {
      setSelectedSiteIds(team.sites.map((s) => s.siteId));
    }
  }, [open, team]);

  const sites = sitesData?.sites || [];

  const handleSiteToggle = (siteId: number) => {
    setSelectedSiteIds((prev) =>
      prev.includes(siteId)
        ? prev.filter((id) => id !== siteId)
        : [...prev, siteId]
    );
  };

  const handleSelectAllSites = () => {
    if (selectedSiteIds.length === sites.length) {
      setSelectedSiteIds([]);
    } else {
      setSelectedSiteIds(sites.map((s) => s.siteId));
    }
  };

  const handleSubmit = async () => {
    if (!activeOrganization?.id || !team) return;

    try {
      await updateTeamSites.mutateAsync({
        organizationId: activeOrganization.id,
        teamId: team.id,
        data: { siteIds: selectedSiteIds },
      });
      toast.success(t("Team sites updated successfully"));
      onOpenChange?.(false);
      onSuccess?.();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("Failed to update team sites")
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("Team Sites")}</DialogTitle>
          <DialogDescription>
            {t("Select which sites belong to {name}. Only team members (and admins/owners) will be able to access these sites.", {
              name: team?.name ?? "",
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="space-y-2">
            <Label className="font-medium">{t("Sites")}</Label>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="select-all-sites"
                  checked={
                    sites.length > 0 &&
                    selectedSiteIds.length === sites.length
                  }
                  onCheckedChange={handleSelectAllSites}
                />
                <Label
                  htmlFor="select-all-sites"
                  className="text-sm font-medium cursor-pointer"
                >
                  {t("Select all")} ({sites.length})
                </Label>
              </div>
              <div className="border rounded-lg divide-y max-h-60 overflow-y-auto">
                {isLoadingSites ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-center space-x-3 p-2.5 animate-pulse">
                      <div className="h-4 w-4 rounded bg-neutral-200 dark:bg-neutral-700" />
                      <div className="h-4 w-36 rounded bg-neutral-200 dark:bg-neutral-700" />
                    </div>
                  ))
                ) : sites.length === 0 ? (
                  <div className="p-3 text-sm text-muted-foreground text-center">
                    {t("No sites in this organization")}
                  </div>
                ) : (
                  sites.map((site) => (
                    <div
                      key={site.siteId}
                      className="flex items-center space-x-3 p-2.5 hover:bg-muted/50"
                    >
                      <Checkbox
                        id={`site-${site.siteId}`}
                        checked={selectedSiteIds.includes(site.siteId)}
                        onCheckedChange={() => handleSiteToggle(site.siteId)}
                      />
                      <Label
                        htmlFor={`site-${site.siteId}`}
                        className="flex-1 cursor-pointer text-sm"
                      >
                        <span className="font-medium">{site.name}</span>
                      </Label>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange?.(false)}>
            {t("Cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={updateTeamSites.isPending} variant="success">
            {updateTeamSites.isPending ? t("Saving...") : t("Save Changes")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
