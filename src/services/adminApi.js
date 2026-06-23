async function postJson(path, body = {}) {
  const response = await fetch(path, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "Admin request failed");
  }

  return data;
}

export async function loginAdminServerSession(email) {
  return postJson("/api/admin/login", { email });
}

export async function logoutAdminServerSession() {
  return postJson("/api/admin/logout");
}
