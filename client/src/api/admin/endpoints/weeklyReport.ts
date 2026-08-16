import { authedFetch } from "../../utils";

export interface WeeklyReportStatus {
  emailEnabled: boolean;
  sender: string | null;
  schedule: string;
  scheduleLabel: string;
}

export interface SendTestWeeklyReportResponse {
  recipient: string;
  organizations: number;
  emails: number;
}

export function fetchWeeklyReportStatus(): Promise<WeeklyReportStatus> {
  return authedFetch<WeeklyReportStatus>("/admin/weekly-report");
}

export function sendTestWeeklyReport(): Promise<SendTestWeeklyReportResponse> {
  return authedFetch<SendTestWeeklyReportResponse>("/admin/weekly-report/send-test", undefined, { method: "POST" });
}
