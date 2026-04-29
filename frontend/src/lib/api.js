import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({
  baseURL: API,
});

export async function fetchSettings() {
  const { data } = await api.get("/settings");
  return data;
}

export async function saveSettings(settings) {
  const payload = {
    single_fields: settings.single_fields,
    box_fields: settings.box_fields,
    line_items: settings.line_items,
    calculation: settings.calculation,
    calibration: settings.calibration,
  };
  const { data } = await api.post("/settings", payload);
  return data;
}

export async function resetSettings() {
  const { data } = await api.post("/settings/reset");
  return data;
}

export async function generatePdf(invoiceData) {
  const response = await api.post(
    "/generate-pdf",
    { data: invoiceData },
    { responseType: "blob" }
  );
  return response.data;
}
