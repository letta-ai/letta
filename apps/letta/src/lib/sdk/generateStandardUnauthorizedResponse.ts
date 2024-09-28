export function generateStandardUnauthorizedResponse() {
  return new Response(JSON.stringify({ message: 'Unauthorized' }), {
    status: 401,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}
