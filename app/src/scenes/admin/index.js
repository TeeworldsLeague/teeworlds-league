import React from "react";
import { Route, Routes } from "react-router-dom";
import Users from "../users";
import Maps from "./maps";
import FooterLeague from "../../components/FooterLeague";

const Admin = () => {
  return (
    <div className="flex flex-1">
      <div className="flex min-h-screen w-full flex-col">
        <div className="flex-1">
          <Routes>
            <Route path="/users/*" element={<Users />} />
            <Route path="/maps/*" element={<Maps />} />
            <Route path="/*" index element={<Users />} />
          </Routes>
        </div>
        <FooterLeague />
      </div>
    </div>
  );
};

export default Admin;
