export default () =>
	new Response("Custom Response", {
		status: 201,
		headers: { "content-type": "text/plain" },
	});
