import { address } from "./address.js";

const ACCEPTED = ["image/", "video/"];

export async function uploadFiles(files, onUploadSuccess) {
    const all = [...files];
    const accepted = all.filter((file) =>
        ACCEPTED.some((prefix) => file.type.startsWith(prefix)),
    );
    const skipped = all.filter((file) => !accepted.includes(file));

    if (skipped.length > 0) {
        console.warn(
            "Skipped unsupported files:",
            skipped.map((f) => `${f.name} (${f.type || "unknown type"})`),
        );
    }

    if (accepted.length === 0) { return; }

    const uploads = [];

    for (const file of accepted) {
        const formData = new FormData();
        formData.append("file", file);

        try {
            const response = await fetch(address("/api/files/upload"), {
                method: "POST",
                body: formData,
            });

            if (!response.ok) {
                throw new Error(`Upload failed: ${response.status}`);
            }

            const result = await response.json();
            uploads.push(result);
            console.log("Upload successful:", result);
        } catch (error) {
            console.error(`Error uploading file ${file.name}:`, error);
            continue;
        }

        await onUploadSuccess?.();
    }

    return uploads;
}
