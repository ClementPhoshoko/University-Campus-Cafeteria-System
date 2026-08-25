const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api/v1';

export async function getHealth() {
  const response = await fetch(`${apiBaseUrl}/health`);
  if (!response.ok) throw new Error('API health check failed');
  return response.json();
}
