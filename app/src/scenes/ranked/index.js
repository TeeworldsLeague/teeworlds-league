import React from "react";
import { Route, Routes } from "react-router-dom";
import Users from "../users";
import FooterRanked from "../../components/FooterRanked";
import Queues from "./queues";
import ResultsRanked from "./resultsRanked";
import StatsRanked from "./statsRanked";
import Modes from "./modes";
import Tournaments from "./tournaments";
import ClansRanked from "../clansRanked";

const Ranked = () => {
  return (
    <div className="flex flex-1">
      <div className="flex min-h-screen w-full flex-col">
        <div className="flex-1">
          <Routes>
            <Route path="/users/*" element={<Users />} />
            <Route path="/clans/*" element={<ClansRanked />} />
            <Route path="/queues/*" element={<Queues />} />
            <Route path="/results/*" element={<ResultsRanked />} />
            <Route path="/stats/*" element={<StatsRanked />} />
            <Route path="/modes/*" element={<Modes />} />
            <Route path="/tournaments/*" element={<Tournaments />} />
            <Route path="" element={<Users />} />
          </Routes>
        </div>
        <FooterRanked />
      </div>
    </div>
  );
};

export default Ranked;
