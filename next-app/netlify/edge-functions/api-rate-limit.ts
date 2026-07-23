type EdgeContext = {
  next(): Promise<Response>;
};

export default function apiRateLimit(_request: Request, context: EdgeContext) {
  return context.next();
}

export const config = {
  path: '/api/*',
  rateLimit: {
    windowLimit: 180,
    windowSize: 60,
    aggregateBy: ['ip', 'domain'],
  },
};
