export default (ctx: any) => {
	ctx.header("Content-Type", "application/json");
	return {
		get: ctx.$_GET,
		post: ctx.$_POST,
		cookie: ctx.$_COOKIE,
		request: ctx.$_REQUEST,
	};
};
