export const handler = async () => {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
    body: JSON.stringify({
      status: 'ok',
      name: 'ارسمها لو تقدر',
      platform: 'Netlify',
      timestamp: Date.now(),
    }),
  };
};
