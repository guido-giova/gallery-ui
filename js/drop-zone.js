import { uploadFiles } from './management.js';
import { loadImages } from './load.js';

export function initDropZone() {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    let dragDepth = 0;

    const hasFiles = (e) => e.dataTransfer?.types?.includes('Files');

    window.addEventListener('dragenter', (e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        dragDepth++;
        document.body.classList.add('is-dragging');
    });

    window.addEventListener('dragleave', (e) => {
        if (!hasFiles(e)) return;
        dragDepth = Math.max(0, dragDepth - 1);
        if (dragDepth === 0) document.body.classList.remove('is-dragging');
    });

    window.addEventListener('dragover', (e) => {
        if (!hasFiles(e)) return;
        e.preventDefault(); // required since drop isn't allowed by default
        dropZone.classList.toggle('is-dragover', dropZone.contains(e.target));
    });

    window.addEventListener('drop', async (e) => {
        if (!hasFiles(e)) return;
        e.preventDefault(); // stop browser from opening file
        dragDepth = 0;
        document.body.classList.remove('is-dragging');
        dropZone.classList.remove('is-dragover');

        await uploadFiles(e.dataTransfer.files);
        await loadImages();
    });

    fileInput.addEventListener('change', async () => {
        await uploadFiles(fileInput.files);
        await loadImages();
        fileInput.value = '';
    });
}
