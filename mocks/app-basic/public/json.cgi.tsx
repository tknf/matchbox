export default (ctx: any) => {
	ctx.header("Content-Type", "application/json");
	return { data: "forced JSON" };
};
