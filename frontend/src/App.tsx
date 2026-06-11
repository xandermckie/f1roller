import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { Layout } from "@/components/Layout";
import { AssignPage } from "@/pages/AssignPage";
import { LandingPage } from "@/pages/LandingPage";
import { PlayPage } from "@/pages/PlayPage";
import { RaceDetailPage } from "@/pages/RaceDetailPage";
import { RatingsPage } from "@/pages/RatingsPage";
import { ResultsPage } from "@/pages/ResultsPage";
import { RollPage } from "@/pages/RollPage";
import { SeasonPage } from "@/pages/SeasonPage";
import { SourcesPage } from "@/pages/SourcesPage";
import { TeamPage } from "@/pages/TeamPage";
import { TransferPage } from "@/pages/TransferPage";

const queryClient = new QueryClient();

export function App(): React.ReactElement {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<LandingPage />} />
            <Route path="/play" element={<PlayPage />} />
            <Route path="/roll" element={<RollPage />} />
            <Route path="/assign" element={<AssignPage />} />
            <Route path="/team" element={<TeamPage />} />
            <Route path="/season" element={<SeasonPage />} />
            <Route path="/season/race/:round" element={<RaceDetailPage />} />
            <Route path="/results" element={<ResultsPage />} />
            <Route path="/sources" element={<SourcesPage />} />
            <Route path="/ratings" element={<RatingsPage />} />
            <Route path="/transfer" element={<TransferPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
