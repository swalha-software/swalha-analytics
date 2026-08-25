"use client";
import { ReactNode } from "react";
import { useGetLiveUserCount } from "../../../api/analytics/hooks/useGetLiveUserCount";
import { useInView } from "../../../hooks/useInView";
import { useSetPageTitle } from "../../../hooks/useSetPageTitle";
import { LITE_DASHBOARD } from "../../../lib/const";
import { useStore } from "../../../lib/store";
import { SubHeader } from "../components/SubHeader/SubHeader";
import { MainSection } from "./components/MainSection/MainSection";
import { MainSectionLite } from "./components/MainSection/MainSectionLite";
import { OverviewGrid } from "./components/OverviewGrid";
import { CountriesLite } from "./components/sections/CountriesLite";
import { DevicesLite } from "./components/sections/DevicesLite";
import { Events } from "./components/sections/Events";
import { PagesLite } from "./components/sections/PagesLite";

function LazySection({ children, height = "405px" }: { children: ReactNode; height?: string }) {
  const { ref, isInView } = useInView({ persistVisibility: true, rootMargin: "100px 0px" });
  return (
    <div ref={ref} style={{ minHeight: isInView ? undefined : height }}>
      {isInView ? children : null}
    </div>
  );
}

export default function MainPage() {
  const { site } = useStore();

  if (!site) {
    return null;
  }

  return <MainPageContent />;
}

function MainPageContent() {
  const { data } = useGetLiveUserCount(5);

  useSetPageTitle(`${data?.count ?? "…"} user${data?.count === 1 ? "" : "s"} online`);

  if (LITE_DASHBOARD) {
    return (
      <div className="p-2 md:p-4 max-w-[1100px] mx-auto space-y-3">
        <SubHeader />
        <MainSectionLite />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-3">
          <LazySection>
            <PagesLite />
          </LazySection>
          <LazySection>
            <DevicesLite />
          </LazySection>
          <LazySection>
            <CountriesLite />
          </LazySection>
          <LazySection height="394px">
            <Events />
          </LazySection>
        </div>
      </div>
    );
  }

  return (
    <div className="p-2 md:p-4 max-w-[1100px] mx-auto space-y-3">
      <SubHeader />
      <MainSection />
      <OverviewGrid />
    </div>
  );
}
