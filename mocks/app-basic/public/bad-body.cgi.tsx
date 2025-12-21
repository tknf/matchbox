export default (ctx: any) => {
	ctx.header("Content-Type", "application/json");
	return ctx.$_POST;
};
