import type { CgiContext } from "../../../dist";

export default async ({ $_SERVER, $_FILES }: CgiContext) => {
	if ($_SERVER.REQUEST_METHOD === "POST") {
		const file = $_FILES.image as File;

		if (!file) {
			return (
				<div>
					<h1>No Image Selected</h1>
					<p>Please select an image to upload.</p>
					<a href="/image-upload.cgi">Try again</a>
				</div>
			);
		}

		// Check if it's an image
		if (!file.type.startsWith("image/")) {
			return (
				<div>
					<h1>Invalid File Type</h1>
					<p>Please select an image file (jpg, png, gif, etc.).</p>
					<a href="/image-upload.cgi">Try again</a>
				</div>
			);
		}

		// Convert to base64 for preview
		const buffer = await file.arrayBuffer();
		const base64 = Buffer.from(buffer).toString("base64");
		const dataUrl = `data:${file.type};base64,${base64}`;

		const fileInfo = {
			name: file.name,
			size: file.size,
			type: file.type,
		};

		return (
			<div>
				<h1>Image Uploaded Successfully!</h1>

				<h2>Preview:</h2>
				<img
					src={dataUrl}
					alt={file.name}
					style="max-width: 500px; max-height: 500px; border: 1px solid #ccc;"
				/>

				<h2>Image Information:</h2>
				<ul>
					<li>Name: {fileInfo.name}</li>
					<li>Size: {Math.round(fileInfo.size / 1024)} KB</li>
					<li>Type: {fileInfo.type}</li>
				</ul>

				<p>
					<a href="/image-upload.cgi">Upload Another</a> | <a href="/">Home</a>
				</p>
			</div>
		);
	}

	return (
		<div>
			<h1>Image Upload with Preview</h1>
			<form method="post" enctype="multipart/form-data">
				<div>
					<label htmlFor="image">Choose an image:</label>
					<input
						type="file"
						id="image"
						name="image"
						accept="image/*"
						required
					/>
				</div>
				<button type="submit">Upload</button>
			</form>
			<p>
				<a href="/">Back to home</a>
			</p>
		</div>
	);
};
