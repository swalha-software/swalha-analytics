import { useQuery } from "@tanstack/react-query";
import { authedFetch } from "../api/utils";

interface Configs {
  mapboxToken: string;
  liteDashboard: boolean;
  emailEnabled: boolean;
}

export function useConfigs() {
  const { data, isLoading, error } = useQuery<Configs>({
    queryKey: ["configs"],
    queryFn: () => authedFetch<Configs>("/config"),
  });

  return {
    configs: data,
    isLoading,
    error,
  };
}
