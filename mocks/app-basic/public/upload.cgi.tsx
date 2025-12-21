export default (ctx: any) => {
	const upload = ctx.$_FILES.upload;
	const files = Array.isArray(upload) ? upload : [upload];
	ctx.header("Content-Type", "application/json");
	return {
		names: files.map((file: File) => file.name),
		isArray: Array.isArray(upload),
		postKeys: Object.keys(ctx.$_POST),
	};
};
