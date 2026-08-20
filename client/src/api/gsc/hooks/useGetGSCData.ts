import { useQuery } from "@tanstack/react-query";
import { DateTime } from "luxon";
import { Time } from "../../../components/DateSelector/types";
import { getTimezone, useStore } from "../../../lib/store";
import { getStartAndEndDate } from "../../utils";
import { fetchGSCData, GSCDimension } from "../endpoints";

// The GSC API only accepts whole-day date ranges and keeps ~16 months of
// history, so sub-day dashboard ranges are widened to whole days and
// all-time is clamped to Google's maximum lookback.
function getGSCDateRange(time: Time): { startDate: string; endDate: string } {
  const today = DateTime.now().setZone(getTimezone());
  if (time.mode === "past-minutes") {
    // The newer edge is only "now" until the window is stepped back, after which
    // ending on today would widen the report past what the dashboard shows.
    return {
      startDate: today.minus({ minutes: time.pastMinutesStart }).toISODate() ?? "",
      endDate: today.minus({ minutes: time.pastMinutesEnd }).toISODate() ?? "",
    };
  }
  if (time.mode === "all-time") {
    return {
      startDate: today.minus({ months: 16 }).toISODate() ?? "",
      endDate: today.toISODate() ?? "",
    };
  }
  const { startDate, endDate } = getStartAndEndDate(time);
  return { startDate: startDate ?? "", endDate: endDate ?? "" };
}

/**
 * Hook to fetch data from Google Search Console for a specific dimension
 */
export function useGetGSCData(dimension: GSCDimension) {
  const { site, time, timezone } = useStore();
  const { startDate, endDate } = getGSCDateRange(time);

  return useQuery({
    queryKey: ["gsc-data", dimension, site, startDate, endDate, timezone],
    queryFn: () => {
      return fetchGSCData(site!, {
        dimension,
        startDate,
        endDate,
        // Resolve the "system" sentinel — the API needs a real IANA zone
        timeZone: getTimezone(),
      });
    },
    enabled: !!site,
    // Refetch less frequently since GSC data updates slowly
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
