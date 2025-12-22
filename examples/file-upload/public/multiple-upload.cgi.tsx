import type { CgiContext } from "../../../dist";

export default ({ $_SERVER, $_FILES }: CgiContext) => {
	if ($_SERVER.REQUEST_METHOD === "POST") {
		const files = $_FILES.files as File[];

		if (!files || files.length === 0) {
			return (
				<div>
					<h1>No Files Selected</h1>
					<p>Please select at least one file to upload.</p>
					<a href="/multiple-upload.cgi">Try again</a>
				</div>
			);
		}

		const fileInfos = files.map((file) => ({
			name: file.name,
			size: file.size,
			type: file.type,
			lastModified: new Date(file.lastModified).toISOString(),
		}));

		return (
			<div>
				<h1>Files Uploaded Successfully!</h1>
				<p>Uploaded {files.length} file(s)</p>

				<h2>File Information:</h2>
				{fileInfos.map((info, index) => (
					<div key={index} style="margin-bottom: 20px; padding: 10px; border: 1px solid #ccc;">
						<h3>
							File {index + 1}: {info.name}
						</h3>
						<ul>
							<li>Size: {Math.round(info.size / 1024)} KB</li>
							<li>Type: {info.type}</li>
							<li>Last Modified: {info.lastModified}</li>
						</ul>
					</div>
				))}

				<p>
					<a href="/multiple-upload.cgi">Upload More</a> | <a href="/">Home</a>
				</p>
			</div>
		);
	}

	return (
		<div>
			<h1>Multiple File Upload</h1>
			<form method="post" enctype="multipart/form-data">
				<div>
					<label htmlFor="files">Choose files:</label>
					<input type="file" id="files" name="files" multiple required />
				</div>
				<button type="submit">Upload</button>
			</form>
			<p>
				<a href="/">Back to home</a>
			</p>
		</div>
	);
};
