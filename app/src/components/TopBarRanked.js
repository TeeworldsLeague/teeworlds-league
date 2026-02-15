import React from "react";
import { useSelector } from "react-redux";
import { Link } from "react-router-dom";

const TopBarRanked = () => {
  const user = useSelector((state) => state.Auth.user);

  return (
    <>
      <div className="flex items-center pr-4">
        <Link to="/ranked/users" className="ml-2">
          Players
        </Link>
      </div>
      <div className="flex items-center pr-4">
        <Link to="/ranked/clans" className="ml-2">
          Clans
        </Link>
      </div>
      <div className="flex items-center pr-4">
        <Link to="/ranked/results" className="ml-2">
          Results
        </Link>
      </div>
      <div className="flex items-center pr-4">
        <Link to="/ranked/stats" className="ml-2">
          Stats
        </Link>
      </div>
      <div className="flex items-center pr-4">
        <Link to="/ranked/queues" className="ml-2">
          Queues
        </Link>
      </div>
      {/* <div className="flex items-center pr-4">
        <Link to="/ranked/tournaments" className="ml-2">
          Tournaments
        </Link>
      </div> */}
      {user?.role === "ADMIN" && (
        <div className="flex items-center pr-4">
          <Link to="/ranked/modes" className="ml-2">
            Modes
          </Link>
        </div>
      )}
    </>
  );
};

export default TopBarRanked;
