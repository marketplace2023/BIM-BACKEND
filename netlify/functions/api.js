let cachedHandler;

exports.handler = async (event, context) => {
  if (!cachedHandler) {
    const { getHandler } = require('../../dist/netlify');
    cachedHandler = await getHandler();
  }

  return cachedHandler(event, context);
};
