import type { CgiContext } from "../../../dist";

export default ({ $_SERVER, $_POST, $_SESSION, redirect }: CgiContext) => {
	if ($_SERVER.REQUEST_METHOD === "POST") {
		const username = $_POST.username;
		const password = $_POST.password;

		// Simple authentication (in real app, check against database)
		if (username === "demo" && password === "password") {
			$_SESSION.user = {
				username,
				loginTime: new Date().toISOString(),
			};
			return redirect("/profile.cgi");
		}

		return (
			<div>
				<h1>Login Failed</h1>
				<p>Invalid username or password.</p>
				<a href="/login.cgi">Try again</a>
			</div>
		);
	}

	const user = $_SESSION.user;
	if (user) {
		return redirect("/profile.cgi");
	}

	return (
		<div>
			<h1>Login</h1>
			<form method="post">
				<div>
					<label htmlFor="username">Username:</label>
					<input type="text" id="username" name="username" required />
					<small>(Use "demo")</small>
				</div>
				<div>
					<label htmlFor="password">Password:</label>
					<input type="password" id="password" name="password" required />
					<small>(Use "password")</small>
				</div>
				<button type="submit">Login</button>
			</form>
			<p>
				<a href="/">Back to home</a>
			</p>
		</div>
	);
};
