import React from "react";
import { Link } from "react-router-dom";

const TopBarAdmin = () => {
  return (
    <>
      <div className="flex items-center pr-4">
        <Link to="/admin/clans" className="ml-2">
          Clans
        </Link>
      </div>
      <div className="flex items-center pr-4">
        <Link to="/admin/users" className="ml-2">
          Users
        </Link>
      </div>
      <div className="flex items-center pr-4">
        <Link to="/admin/maps" className="ml-2">
          Maps
        </Link>
      </div>
    </>
  );
};

export default TopBarAdmin;
