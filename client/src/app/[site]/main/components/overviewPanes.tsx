"use client";

import { useExtracted } from "next-intl";
import { ReactNode } from "react";
import { cn } from "../../../../lib/utils";
import {
  StandardSectionTabs,
  type StandardSectionTab,
} from "../../components/shared/StandardSection/StandardSectionTabs";
import { OVERVIEW_PANE_HOMES, type OverviewPaneId } from "../overviewLayout";
import { useCountriesTabs } from "./sections/Countries";
import { useDevicesTabs } from "./sections/Devices";
import { useEventsTabs } from "./sections/Events";
import { usePagesTabs } from "./sections/Pages";
import { UtmMenu, useReferrerTabs, useUtmTabs } from "./sections/Referrers";

export type OverviewPaneDef = {
  /** Label for the draggable chip in edit mode. */
  label: ReactNode;
  /** The tab items this pane contributes to its card ("utm" contributes five). */
  tabs: StandardSectionTab<string>[];
};

export function useOverviewPaneDefs(): Record<OverviewPaneId, OverviewPaneDef> {
  const t = useExtracted();
  const referrerTabs = useReferrerTabs();
  const utmTabs = useUtmTabs();
  const pagesTabs = usePagesTabs();
  const devicesTabs = useDevicesTabs();
  const countriesTabs = useCountriesTabs();
  const eventsTabs = useEventsTabs();

  const single = (tabs: StandardSectionTab<string>[], value: string): OverviewPaneDef => {
    const tab = tabs.find(item => item.value === value)!;
    return { label: tab.label, tabs: [tab] };
  };

  return {
    referrers: single(referrerTabs, "referrers"),
    channels: single(referrerTabs, "channels"),
    utm: { label: t("UTM"), tabs: utmTabs },
    pages: single(pagesTabs, "pages"),
    page_title: single(pagesTabs, "page_title"),
    entry_pages: single(pagesTabs, "entry_pages"),
    exit_pages: single(pagesTabs, "exit_pages"),
    hostname: single(pagesTabs, "hostname"),
    browsers: single(devicesTabs, "browsers"),
    devices: single(devicesTabs, "devices"),
    os: single(devicesTabs, "os"),
    dimensions: single(devicesTabs, "dimensions"),
    countries: single(countriesTabs, "countries"),
    regions: single(countriesTabs, "regions"),
    cities: single(countriesTabs, "cities"),
    languages: single(countriesTabs, "languages"),
    map: single(countriesTabs, "map"),
    timezones: single(countriesTabs, "timezones"),
    events: single(eventsTabs, "events"),
    outbound: single(eventsTabs, "outbound"),
    buttons: single(eventsTabs, "buttons"),
    forms: single(eventsTabs, "forms"),
    copies: single(eventsTabs, "copies"),
  };
}

export function paneNeedsTallCard(paneId: string): boolean {
  return OVERVIEW_PANE_HOMES[paneId as OverviewPaneId] === "events";
}

export function OverviewTabbedCard({ paneIds }: { paneIds: string[] }) {
  const paneDefs = useOverviewPaneDefs();

  const panes = paneIds.filter((id): id is OverviewPaneId => id in paneDefs);
  const tabs = panes.flatMap(id => paneDefs[id].tabs);
  const defaultValue = (tabs.find(tab => tab.showInTabs !== false) ?? tabs[0])?.value;
  if (!defaultValue) return null;

  const hasUtm = panes.includes("utm");
  const tall = panes.some(paneNeedsTallCard);

  return (
    <StandardSectionTabs
      defaultValue={defaultValue}
      tabs={tabs}
      className={cn(tall && "h-[483px]")}
      renderTabsListEnd={
        hasUtm ? ({ value, setValue }) => <UtmMenu value={value} setValue={setValue} /> : undefined
      }
    />
  );
}
