export default (ctx: any) => {
	ctx.status(201);
	ctx.header("X-Test", "ok");
	ctx.$_SESSION.user = "alice";
	return "<h1>Hello String</h1>";
};
