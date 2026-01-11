import React, { useState, useEffect } from "react";
import Loader from "../../components/Loader";
import { useParams } from "react-router";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import Modal from "../../components/Modal";
import { useNavigate } from "react-router-dom";
import { MdDelete } from "react-icons/md";
import Player from "../../components/Player";
import { useSelector } from "react-redux";
import API from "../../services/api";

const Details = () => {
  const [clanRanked, setClanRanked] = useState(null);
  const [loading, setLoading] = useState(true);
  const [allPlayers, setAllPlayers] = useState([]);
  const [playerSelected, setPlayerSelected] = useState(null);
  const [open, setOpen] = useState(false);

  const clanRankedId = useParams().id;
  const navigate = useNavigate();

  const realUser = useSelector((state) => state.Auth.user);

  const get = async () => {
    const { ok, data } = await API.post(`/clanRanked/search`, {
      _id: clanRankedId,
    });
    if (!ok) toast.error("Erreur while fetching ranked clan");

    const clanData = data[0];
    setClanRanked(clanData);

    const { ok: okPlayers, data: dataPlayers } = await API.post(`/user/search`, {});
    if (!okPlayers) toast.error("Erreur while fetching players");

    setAllPlayers(dataPlayers.filter((player) => !clanData?.players?.some((p) => p.userId?.toString() === player._id?.toString())));

    setLoading(false);
  };

  useEffect(() => {
    get();
  }, [clanRankedId]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setClanRanked({ ...clanRanked, [name]: value });
  };

  const handleAddPlayer = async () => {
    if (playerSelected === null) return setOpen(false);

    const { ok, data } = await API.put(`/clanRanked/${clanRankedId}/addPlayer`, {
      userId: playerSelected._id,
    });
    if (!ok) return toast.error("Erreur while adding player to ranked clan");

    setClanRanked(data);
    setAllPlayers(allPlayers.filter((player) => player._id !== playerSelected._id));

    setOpen(false);
    toast.success("Player added to ranked clan successfully");
    get(); // Refresh to get updated player list
  };

  const handleSubmit = async () => {
    const { ok, data } = await API.put(`/clanRanked/${clanRankedId}`, clanRanked);
    if (!ok) return toast.error("Erreur while updating ranked clan");

    setClanRanked(data);
    toast.success("Ranked clan updated successfully");
  };

  const handleDelete = async () => {
    const confirm = window.confirm("Are you sure you want to delete this ranked clan ?");
    if (!confirm) return;

    const { ok } = await API.remove(`/clanRanked/${clanRankedId}`);
    if (!ok) return toast.error("Erreur while deleting ranked clan");

    toast.success("Ranked clan deleted successfully");
    navigate("../clans");
  };

  const handleDeletePlayer = async (playerId) => {
    const confirm = window.confirm("Are you sure you want to remove this player from the ranked clan ?");
    if (!confirm) return;

    const { ok, data } = await API.remove(`/clanRanked/${clanRankedId}/removePlayer`, {
      userId: playerId,
    });
    if (!ok) return toast.error("Erreur while removing player from ranked clan");

    setClanRanked(data.clanRanked);
    setAllPlayers([...allPlayers, data.player]);
    toast.success("Player removed from ranked clan successfully");
  };

  if (loading) return <Loader />;

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold text-center">Ranked Clan details</h1>

      {realUser?.role === "ADMIN" && (
        <button
          className="ml-4 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
          onClick={async () => {
            const res = await API.post(`/clanRanked/${clanRankedId}/updateStat`);
            if (res.ok) {
              toast.success("Ranked clan updated");
              return setClanRanked(res.data);
            }
            return toast.error("Error while updating stat");
          }}>
          Sync
        </button>
      )}

      <div className="mb-4">
        <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="name">
          Name
        </label>
        <input
          type="text"
          id="name"
          name="name"
          value={clanRanked?.name || ""}
          onChange={handleChange}
          className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
          placeholder="Name of the ranked clan"
          disabled={realUser?.role !== "ADMIN"}
        />
      </div>
      <div className="mb-4">
        <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="players">
          Players
        </label>
        <div>
          {clanRanked?.players?.map((player, index) => (
            <div key={index} className="flex items-center">
              {realUser?.role === "ADMIN" && (
                <MdDelete size={20} color="red" className="cursor-pointer" onClick={() => handleDeletePlayer(player.userId)} />
              )}
              <Player player={{ _id: player.userId, userName: player.userName }} />
            </div>
          ))}
        </div>

        {realUser?.role === "ADMIN" && (
          <div className="flex items-center justify-center">
            <button
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
              onClick={() => {
                setPlayerSelected(null);
                setOpen(true);
              }}>
              Add player
            </button>
          </div>
        )}
      </div>
      {realUser?.role === "ADMIN" && (
        <div className="flex items-center justify-between">
          <button
            className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
            onClick={handleDelete}>
            Delete
          </button>
          <button
            className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
            onClick={handleSubmit}>
            Update
          </button>
        </div>
      )}

      <Modal isOpen={open} onClose={() => setOpen(false)} title="Add player">
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="name">
            Name
          </label>
          <select
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            id="playerId"
            name="playerId"
            onChange={(e) => setPlayerSelected(allPlayers.find((player) => player._id === e.target.value))}>
            <option value="" disabled selected>
              Select a player
            </option>
            {allPlayers.map((player) => (
              <option key={player._id} value={player._id}>
                {player.userName}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center justify-between">
          <button
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
            onClick={handleAddPlayer}>
            Add player
          </button>
        </div>
      </Modal>
    </div>
  );
};

export default Details;
