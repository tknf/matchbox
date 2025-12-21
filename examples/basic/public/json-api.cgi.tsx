import type { CgiContext } from "../../../dist";

export default ({
	$_GET,
	$_SERVER,
	header,
	status,
	request_headers,
}: CgiContext) => {
	const format = $_GET.format;

	const data = {
		message: "Hello from JSON API",
		timestamp: new Date().toISOString(),
		method: $_SERVER.REQUEST_METHOD,
		headers: request_headers(),
	};

	header("Content-Type", "application/json; charset=utf-8");

	if (format === "pretty") {
		status(200);
	}

	return data;
};
