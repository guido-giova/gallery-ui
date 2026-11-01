import { address } from "./address.js";

const ACCEPTED = ["image/", "video/"];

export async function uploadFiles(files) {
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

    const formData = new FormData();
    for (const file of accepted) {
        formData.append("files", file);
    }

    try {
        const response = await fetch(address("/api/files/upload"), {
            method: "POST",
            body: formData,
        });

        if (!response.ok) {
            throw new Error(`Upload failed: ${response.status}`);
        }

        const results = await response.json();
        console.log("Upload successful:", results);

        return results;
    } catch (error) {
        console.error("Error uploading files:", error);
    }
}
