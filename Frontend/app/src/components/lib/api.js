// const API = "http://localhost:6569";
const API = "http://localhost:6569";

export async function uploadPDF(file) {
  const fd = new FormData();
  fd.append("file", file);
  await fetch(`${API}/ingest`, { method: "POST", body: fd });
}

export async function askQuestion(q) {
  const res = await fetch(`${API}/query?question=${encodeURIComponent(q)}`, {
    method: "POST",
  });
  return res.json();
}

