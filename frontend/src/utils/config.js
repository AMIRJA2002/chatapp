// Utility function to get the backend URL
export const getBackendUrl = () => {
  // If REACT_APP_API_URL is set, use it
  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL;
  }
  
  // If running in production/Docker, use relative URL (nginx will proxy)
  // Otherwise use localhost for development
  const hostname = window.location.hostname;
  const port = window.location.port;
  
  // If running on port 3000 (development), use localhost:8009
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    if (port === '3000' || !port) {
      return 'http://localhost:8009';
    }
  }
  
  // For Docker/production, use same origin (nginx will proxy)
  return '';
};

