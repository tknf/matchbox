export default async (ctx: any) => {
	await new Promise((resolve) => setTimeout(resolve, 50));
	ctx.header("Content-Type", "application/json");
	return { done: true };
};
