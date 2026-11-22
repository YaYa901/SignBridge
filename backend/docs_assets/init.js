window.addEventListener('load', function () {
  window.ui = SwaggerUIBundle({
    url: '/openapi.json',
    dom_id: '#swagger-ui',
    deepLinking: true,
    withCredentials: true,
    requestInterceptor: function (request) {
      request.headers['X-SignBridge'] = '1';
      return request;
    },
    presets: [SwaggerUIBundle.presets.apis],
    layout: 'BaseLayout'
  });
});
