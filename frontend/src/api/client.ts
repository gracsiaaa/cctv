import axios from "axios";

// Assume API is on same host port 8000
const host = window.location.hostname;
export const API_URL = `http://${host}:8000/api`;

export const apiClient = axios.create({
  baseURL: API_URL,
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("cctv_admin_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
