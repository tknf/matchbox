import type { CgiContext } from "../../../dist";

export default ({ $_SERVER, $_FILES }: CgiContext) => {
	if ($_SERVER.REQUEST_METHOD === "POST") {
		const file = $_FILES.file as File;
		if (!file) {
			return (
				<div>
					<h1>No File Selected</h1>
					<p>Please select a file to upload.</p>
					<a href="/single-upload.cgi">Try again</a>
				</div>
			);
		}

		const fileInfo = {
			name: file.name,
			size: file.size,
			type: file.type,
			lastModified: new Date(file.lastModified).toISOString(),
		};

		// In a real application, you would save the file to disk or cloud storage
		// const buffer = await file.arrayBuffer();
		// await fs.writeFile(`./uploads/${file.name}`, Buffer.from(buffer));

		return (
			<div>
				<h1>File Uploaded Successfully!</h1>

				<h2>File Information:</h2>
				<ul>
					<li>Name: {fileInfo.name}</li>
					<li>Size: {Math.round(fileInfo.size / 1024)} KB</li>
					<li>Type: {fileInfo.type}</li>
					<li>Last Modified: {fileInfo.lastModified}</li>
				</ul>

				<p>
					<a href="/single-upload.cgi">Upload Another</a> | <a href="/">Home</a>
				</p>
			</div>
		);
	}

	return (
		<div>
			<h1>Single File Upload</h1>
			<form method="post" enctype="multipart/form-data">
				<div>
					<label htmlFor="file">Choose a file:</label>
					<input type="file" id="file" name="file" required />
				</div>
				<button type="submit">Upload</button>
			</form>
			<p>
				<a href="/">Back to home</a>
			</p>
		</div>
	);
};
