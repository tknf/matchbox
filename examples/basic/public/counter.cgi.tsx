import type { CgiContext } from "../../../dist";

export default ({ $_GET }: CgiContext) => {
	const count = Number.parseInt($_GET.count || "0", 10);

	return (
		<div>
			<h1>Counter Example</h1>
			<p>Current count: {count}</p>
			<div>
				<a href={`/counter.cgi?count=${count + 1}`}>Increment</a>
				{" | "}
				<a href={`/counter.cgi?count=${count - 1}`}>Decrement</a>
				{" | "}
				<a href="/counter.cgi?count=0">Reset</a>
			</div>
		</div>
	);
};
