import React, { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link } from "react-router-dom";
import API from "../services/api";
import { setCurrentSeason, setSeasons } from "../redux/season/actions";

const TopBarLeague = () => {
  const [isLoadingSeasons, setIsLoadingSeasons] = React.useState(false);

  const seasons = useSelector((state) => state.Season.seasons);
  const currentSeason = useSelector((state) => state.Season.currentSeason);
  const dispatch = useDispatch();

  useEffect(() => {
    const fetchSeasons = async () => {
      setIsLoadingSeasons(true);
      try {
        const res = await API.post("/season/search");
        if (res.ok && res.data) {
          dispatch(setSeasons(res.data));

          if (!currentSeason && res.data.length > 0) {
            dispatch(setCurrentSeason(res.data[0]));
          }
        }
      } catch (error) {
        console.log(error);
      } finally {
        setIsLoadingSeasons(false);
      }
    };

    fetchSeasons();
  }, [dispatch, currentSeason]);

  const handleSeasonChange = (e) => {
    const selectedSeasonId = e.target.value;
    const selectedSeason = seasons.find((season) => season._id === selectedSeasonId);
    if (selectedSeason) {
      dispatch(setCurrentSeason(selectedSeason));
    }
  };

  return (
    <>
      {!isLoadingSeasons && seasons.length > 0 && (
        <div className="flex items-center pr-4">
          <select
            value={currentSeason?._id || ""}
            onChange={handleSeasonChange}
            className="bg-gray-700 text-white border border-gray-600 rounded px-2 py-1">
            {seasons.map((season) => (
              <option key={season._id} value={season._id}>
                {season.name}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="flex items-center pr-4">
        <Link to={currentSeason?.name?.includes("Season 2") ? "./rules/leagueSeason2" : "./rules/leagueSeason1"} className="ml-2">
          Rules
        </Link>
      </div>
      <div className="flex items-center pr-4">
        <Link to="/league/users" className="ml-2">
          Players
        </Link>
      </div>
      <div className="flex items-center pr-4">
        <Link to="/league/clans" className="ml-2">
          Clans
        </Link>
      </div>
      <div className="flex items-center pr-4">
        <Link to="/league/calendar" className="ml-2">
          Calendar
        </Link>
      </div>
      <div className="flex items-center pr-4">
        <Link to="/league/results" className="ml-2">
          Results
        </Link>
      </div>
      <div className="flex items-center pr-4">
        <Link to="/league/stats" className="ml-2">
          Stats
        </Link>
      </div>
      <div className="flex items-center pr-4">
        <Link to="/league/votes" className="ml-2">
          Votes
        </Link>
      </div>
    </>
  );
};

export default TopBarLeague;
