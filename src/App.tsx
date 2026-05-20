import React from "react";
import GlobeView from "@/components/Globe/GlobeView";
import Navbar from "@/components/UI/Navbar";
import Analytics from "@/components/Sidebar/Analytics";
import useAppStore from "@/store/useAppStore";

export default function App(): JSX.Element {
  const country = useAppStore((s) => s.selectedCountry);

  return (
    <div className="min-h-screen relative isolate overflow-hidden">
      <Navbar />
      {!country && <GlobeView />}
      {country && <Analytics country={country} />}
    </div>
  );
}
