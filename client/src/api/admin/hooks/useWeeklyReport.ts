import { useMutation, useQuery } from "@tanstack/react-query";
import { fetchWeeklyReportStatus, sendTestWeeklyReport } from "../endpoints/weeklyReport";

export function useWeeklyReportStatus() {
  return useQuery({
    queryKey: ["admin-weekly-report-status"],
    queryFn: fetchWeeklyReportStatus,
    staleTime: 1000 * 60 * 5,
  });
}

export function useSendTestWeeklyReport() {
  return useMutation({
    mutationFn: sendTestWeeklyReport,
  });
}
