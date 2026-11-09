export const handler = async () => {
  const iceServers: Array<{ urls: string[]; username?: string; credential?: string }> = [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
  ];

  const turnUrl = process.env.TURN_URL;
  const turnUsername = process.env.TURN_USERNAME;
  const turnCredential = process.env.TURN_CREDENTIAL;

  if (turnUrl) {
    const turnConfig: { urls: string[]; username?: string; credential?: string } = {
      urls: turnUrl.split(',').map((u) => u.trim()),
    };
    if (turnUsername) {
      turnConfig.username = turnUsername;
    }
    if (turnCredential) {
      turnConfig.credential = turnCredential;
    }
    iceServers.push(turnConfig);
  }

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify({
      iceServers,
      hasTurn: Boolean(turnUrl),
    }),
  };
};
