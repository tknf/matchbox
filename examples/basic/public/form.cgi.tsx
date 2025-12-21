import type { CgiContext } from "../../../dist";

export default ({ $_SERVER, $_POST }: CgiContext) => {
	if ($_SERVER.REQUEST_METHOD === "POST") {
		const name = $_POST.name;
		const email = $_POST.email;

		return (
			<div>
				<h1>Form Submitted!</h1>
				<p>Name: {String(name)}</p>
				<p>Email: {String(email)}</p>
				<a href="/form.cgi">Back to form</a>
			</div>
		);
	}

	return (
		<div>
			<h1>Contact Form</h1>
			<form method="post">
				<div>
					<label htmlFor="name">Name:</label>
					<input type="text" id="name" name="name" required />
				</div>
				<div>
					<label htmlFor="email">Email:</label>
					<input type="email" id="email" name="email" required />
				</div>
				<button type="submit">Submit</button>
			</form>
		</div>
	);
};
