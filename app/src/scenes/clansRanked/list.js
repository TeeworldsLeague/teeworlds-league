import React, { useState, useEffect } from "react";
import api from "../../services/api";
import Loader from "../../components/Loader";
import { useNavigate } from "react-router-dom";
import Modal from "../../components/Modal";
import { useSelector } from "react-redux";
import StatColored from "../../components/StatColored";
import toast from "react-hot-toast";

const List = () => {
  const [clansRanked, setClansRanked] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    sort: "points",
    asc: false,
  });
  const [open, setOpen] = useState(false);
  const [newClanRanked, setNewClanRanked] = useState({ name: "" });

  const navigate = useNavigate();

  const realUser = useSelector((state) => state.Auth.user);

  useEffect(() => {
    const fetchData = async () => {
      const { ok, data } = await api.post(`/clanRanked/search`, {
        ...filters,
      });
      if (!ok) toast.error("Erreur while fetching ranked clans");

      setClansRanked(data);
      setLoading(false);
    };

    fetchData();
  }, [filters]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    const newClanRankedModified = { ...newClanRanked, [name]: value };
    setNewClanRanked(newClanRankedModified);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const { ok, data } = await api.post("/clanRanked", newClanRanked);
    if (!ok) return toast.error("Error while creating ranked clan");

    setOpen(false);
    setNewClanRanked({ name: "" });
    return navigate(`./${data._id}`);
  };

  if (loading) return <Loader />;

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold text-center">Ranked Clans</h1>
      <div className="flex justify-between items-center mb-4">
        <div className="space-x-2">
          {realUser?.role === "ADMIN" && (
            <button className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded" onClick={() => setOpen(true)}>
              Create ranked clan
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col justify-center mt-4">
        <table className="table-auto w-full">
          <thead>
            <tr>
              {[{ label: "Name", key: "name" }].map(({ label, key }) => (
                <th
                  key={key}
                  className="px-4 py-2 cursor-pointer hover:underline"
                  onClick={() =>
                    setFilters({
                      ...filters,
                      sort: key,
                      asc: !filters.asc,
                    })
                  }>
                  {label}
                  {filters.sort === key && <span>{filters.asc ? " ▲" : " ▼"}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {clansRanked.map((clanRanked) => (
              <tr key={clanRanked._id} className="cursor-pointer hover:bg-gray-100" onClick={() => navigate(`./${clanRanked._id}`)}>
                <td className="border px-4 py-2">{clanRanked.name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal isOpen={open} onClose={() => setOpen(false)} title="Create ranked clan">
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="name">
              Name
            </label>
            <input
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              id="name"
              type="text"
              placeholder="Name"
              name="name"
              value={newClanRanked.name}
              onChange={handleChange}
            />
          </div>
          <div className="flex items-center justify-between">
            <button
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
              type="submit">
              Create ranked clan
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default List;
