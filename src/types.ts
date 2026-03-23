export type StatusLevel = "operational" | "degraded" | "outage" | "unknown";

export const STATUS_EMOJI: Record<StatusLevel, string> = {
  operational: "🟢",
  degraded: "🟡",
  outage: "🔴",
  unknown: "⚪",
};

export interface ServiceStatus {
  name: string;
  status: StatusLevel;
  summary: string;
  updatedAt: string;
  source: string;
}

export interface ComponentStatus {
  name: string;
  status: StatusLevel;
  summary: string;
}

export interface Incident {
  title: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  components: string[];
}

export interface ServiceDetail extends ServiceStatus {
  components: ComponentStatus[];
  incidents: Incident[];
  thirdPartyReports: {
    downdetector?: { reportCount: number; trend: "rising" | "stable" | "falling" };
    statusgator?: { status: StatusLevel; summary: string };
  };
}

export interface AIVibeCheck {
  provider: string;
  officialStatus: ServiceStatus;
  vibes: {
    source: string;
    sentiment: string;
    url: string;
  }[];
}

export type ServiceCategory = "cloud" | "cdn" | "devtools" | "ai" | "comms" | "infra";

export interface Fetcher {
  fetch(): Promise<ServiceStatus>;
}

export interface DetailFetcher {
  fetchDetail(): Promise<ServiceDetail>;
}
