import React, { useState, useEffect } from "react";
import api from "../../../services/api";
import Loader from "../../../components/Loader";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import Modal from "../../../components/Modal";
import { useSelector } from "react-redux";

const List = () => {
  const [maps, setMaps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({});
  const [newMap, setNewMap] = useState({
    name: "",
    serverNames: [],
  });
  const [showCreateMap, setShowCreateMap] = useState(false);
  const [serverNameInput, setServerNameInput] = useState("");

  const realUser = useSelector((state) => state.Auth.user);
  const navigate = useNavigate();

  const get = async () => {
    const { ok, data } = await api.post(`/map/search`, { ...filters });
    if (!ok) toast.error("Error while fetching maps");

    setMaps(data || []);
    setLoading(false);
  };

  useEffect(() => {
    get();
  }, [filters]);

  const handleCreateMapChange = (e) => {
    const { name, value } = e.target;
    setNewMap({ ...newMap, [name]: value });
  };

  const handleAddServerName = () => {
    if (serverNameInput.trim()) {
      setNewMap({
        ...newMap,
        serverNames: [...newMap.serverNames, serverNameInput.trim()],
      });
      setServerNameInput("");
    }
  };

  const handleRemoveServerName = (index) => {
    setNewMap({
      ...newMap,
      serverNames: newMap.serverNames.filter((_, i) => i !== index),
    });
  };

  const handleCreateMap = async () => {
    const { ok, data } = await api.post(`/map`, newMap);
    if (!ok) return toast.error("Error while creating map");

    get();
    setShowCreateMap(false);
    navigate(`./${data._id}`);
    toast.success("Map created successfully");
  };

  if (loading) return <Loader />;

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold text-center">Maps</h1>

      {realUser?.role === "ADMIN" && (
        <button className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded" onClick={() => setShowCreateMap(true)}>
          Create map
        </button>
      )}

      <div className="flex flex-col justify-center mt-4">
        <table className="table-auto w-full">
          <thead>
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Server Names</th>
            </tr>
          </thead>
          <tbody>
            {maps.length === 0 ? (
              <tr>
                <td colSpan="2" className="border px-4 py-2 text-center text-gray-500">
                  No maps found
                </td>
              </tr>
            ) : (
              maps.map((map) => (
                <tr key={map._id} className="cursor-pointer hover:bg-gray-100" onClick={() => navigate(`./${map._id}`)}>
                  <td className="border px-4 py-2">{map.name}</td>
                  <td className="border px-4 py-2">{map.serverNames && map.serverNames.length > 0 ? map.serverNames.join(", ") : "-"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal
        isOpen={showCreateMap}
        onClose={() => {
          setShowCreateMap(false);
          setNewMap({ name: "", serverNames: [] });
          setServerNameInput("");
        }}
        title="Create map">
        <label className="block mt-4" htmlFor="name">
          <span className="text-gray-700">Map Name</span>
          <input
            type="text"
            name="name"
            className="form-input mt-1 block w-full border border-gray-300 rounded-md p-2"
            onChange={handleCreateMapChange}
            value={newMap.name}
            placeholder="e.g., ctf_5"
          />
        </label>
        <label className="block mt-4" htmlFor="serverNames">
          <span className="text-gray-700">Server Names</span>
          <div className="flex mt-1">
            <input
              type="text"
              className="form-input block w-full border border-gray-300 rounded-md p-2"
              onChange={(e) => setServerNameInput(e.target.value)}
              value={serverNameInput}
              placeholder="Add server name"
              onKeyPress={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddServerName();
                }
              }}
            />
            <button type="button" className="ml-2 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded" onClick={handleAddServerName}>
              Add
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {newMap.serverNames.map((serverName, index) => (
              <span key={index} className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800">
                {serverName}
                <button type="button" className="ml-2 text-blue-600 hover:text-blue-800" onClick={() => handleRemoveServerName(index)}>
                  ×
                </button>
              </span>
            ))}
          </div>
        </label>
        <div className="flex items-end justify-end mt-4">
          <button className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded" onClick={handleCreateMap}>
            Create
          </button>
        </div>
      </Modal>
    </div>
  );
};

export default List;
