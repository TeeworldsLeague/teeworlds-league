import React, { useState, useEffect } from "react";
import Loader from "../../../components/Loader";
import { useParams, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useSelector } from "react-redux";
import api from "../../../services/api";

const Detail = () => {
  const [map, setMap] = useState(null);
  const [loading, setLoading] = useState(true);
  const [serverNameInput, setServerNameInput] = useState("");

  const mapId = useParams().id;
  const navigate = useNavigate();

  const realUser = useSelector((state) => state.Auth.user);

  const get = async () => {
    const { ok, data } = await api.get(`/map/${mapId}`);
    if (!ok) {
      toast.error("Error while fetching map");
      setLoading(false);
      return;
    }

    setMap(data);
    setLoading(false);
  };

  useEffect(() => {
    get();
  }, [mapId]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setMap({ ...map, [name]: value });
  };

  const handleAddServerName = () => {
    if (serverNameInput.trim()) {
      setMap({
        ...map,
        serverNames: [...(map.serverNames || []), serverNameInput.trim()],
      });
      setServerNameInput("");
    }
  };

  const handleRemoveServerName = (index) => {
    setMap({
      ...map,
      serverNames: map.serverNames.filter((_, i) => i !== index),
    });
  };

  const handleSubmit = async () => {
    const { ok, data } = await api.put(`/map/${mapId}`, map);
    if (!ok) return toast.error("Error while updating map");

    setMap(data);
    toast.success("Map updated successfully");
  };

  const handleDelete = async () => {
    const confirm = window.confirm("Are you sure you want to delete this map?");
    if (!confirm) return;

    const { ok } = await api.remove(`/map/${mapId}`);
    if (!ok) return toast.error("Error while deleting map");

    toast.success("Map deleted successfully");
    navigate("../../maps");
  };

  if (loading) return <Loader />;

  if (!map) {
    return (
      <div className="p-4">
        <p className="text-center text-gray-500">Map not found</p>
      </div>
    );
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold text-center">Map details</h1>

      <div className="mb-4">
        <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="name">
          Name
        </label>
        <input
          type="text"
          id="name"
          name="name"
          value={map.name || ""}
          onChange={handleChange}
          className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
          placeholder="Map name"
          disabled={realUser?.role !== "ADMIN"}
        />
      </div>

      <div className="mb-4">
        <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="serverNames">
          Server Names
        </label>
        <div className="flex">
          <input
            type="text"
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            onChange={(e) => setServerNameInput(e.target.value)}
            value={serverNameInput}
            placeholder="Add server name"
            disabled={realUser?.role !== "ADMIN"}
            onKeyPress={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddServerName();
              }
            }}
          />
          {realUser?.role === "ADMIN" && (
            <button type="button" className="ml-2 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded" onClick={handleAddServerName}>
              Add
            </button>
          )}
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {map.serverNames &&
            map.serverNames.map((serverName, index) => (
              <span key={index} className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800">
                {serverName}
                {realUser?.role === "ADMIN" && (
                  <button type="button" className="ml-2 text-blue-600 hover:text-blue-800" onClick={() => handleRemoveServerName(index)}>
                    ×
                  </button>
                )}
              </span>
            ))}
        </div>
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
    </div>
  );
};

export default Detail;
