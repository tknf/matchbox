# File Upload Example

This example demonstrates file upload handling in Matchbox.

## Features

- **Single File Upload**: Upload one file at a time
- **Multiple File Upload**: Upload multiple files simultaneously
- **Image Upload with Preview**: Upload images and see a preview
- **File Information Display**: View uploaded file metadata

## Getting Started

Install dependencies:

```bash
pnpm install
```

Run the development server:

```bash
pnpm dev
```

Open your browser and navigate to `http://localhost:5173/`

## Examples

### Single File Upload

- `/single-upload.cgi` - Upload a single file
  - Displays file name, size, type, and last modified date
  - Shows file information after upload

### Multiple File Upload

- `/multiple-upload.cgi` - Upload multiple files at once
  - Select multiple files using the file input
  - Displays information for all uploaded files

### Image Upload with Preview

- `/image-upload.cgi` - Upload images with preview
  - Only accepts image files
  - Shows a preview of the uploaded image
  - Converts image to base64 for display

## How It Works

File uploads in Matchbox are handled using the standard `FormData` API:

```typescript
// Single file
const formData = await request.formData();
const file = formData.get("file") as File;

// Multiple files
const files = formData.getAll("files") as File[];
```

Files are received as `File` objects with the following properties:

- `name`: File name
- `size`: File size in bytes
- `type`: MIME type
- `lastModified`: Last modified timestamp

## Production Considerations

In a production environment, you would typically:

1. Save files to disk or cloud storage (S3, Azure Blob, etc.)
2. Validate file types and sizes
3. Scan files for viruses
4. Generate unique filenames to prevent conflicts
5. Implement proper error handling
6. Add upload progress indicators
7. Set file size limits

Example of saving to disk:

```typescript
import { writeFile } from "fs/promises";

const buffer = await file.arrayBuffer();
await writeFile(`./uploads/${file.name}`, Buffer.from(buffer));
```
