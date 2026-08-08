import apiRequest from "./client";

export function registerUser(name, email, password) {
  return apiRequest("/auth/register", {
    method: "POST",
    body: JSON.stringify({ full_name: name, email, password }),
  });
}

export function loginUser(email, password) {
  return apiRequest("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}