import { address } from "./address.js";
import { del, favorite } from "./fetchUtils.js";

const gallery = document.getElementById("gallery");
const mediaDialog = document.getElementById("media-dialog");
const viewerStage = document.getElementById("viewer-stage");
const viewerClose = document.getElementById("viewer-close");
const viewerPrevious = document.getElementById("viewer-previous");
const viewerNext = document.getElementById("viewer-next");
const viewerDelete = document.getElementById("viewer-delete");
const viewerFavorite = document.getElementById("viewer-favorite");

export function initViewer({ getItems, loadVariants, updatePreview, showPreviewError }) {
    let selectedItem = null;
    let viewerOpener = null;

    function verifyBounds(item) {
        return item != null && getItems().includes(item);
    }

    function renderViewer(item) {
        if (!item) { return; }

        const original = item.variants.find(file => file.kind === "ORIGINAL");
        if (!original) {
            console.error(`No viewable media found for ${item.id}`);
            return;
        }
        selectedItem = item;

        if (original.mime.startsWith("video/")) {
            const media = document.createElement("video");
            media.className = "viewer-media";
            media.src = address(`/api/files/${original.id}/content`);
            media.controls = true;
            media.preload = "metadata";
            media.muted = false;
            media.autoplay = false;

            viewerStage.replaceChildren(media);
        } else {
            const media = document.createElement("img");
            media.className = "viewer-media";
            media.src = address(`/api/files/${original.id}/content`);
            media.decoding = "async";

            viewerStage.replaceChildren(media);
        }
    }

    function closeViewer() {
        if (mediaDialog.open) {
            mediaDialog.close();
            selectedItem = null;
            viewerOpener?.focus();
            viewerOpener = null;
        }
    }

    function selectMedia(item) {
        if (verifyBounds(item)) {
            renderViewer(item);
        }
    }

    function selectMediaPrevious() {
        const items = getItems();
        const currentIndex = items.indexOf(selectedItem);
        if (currentIndex > 0) {
            selectMedia(items[currentIndex - 1]);
        }
    }

    function selectMediaNext() {
        const items = getItems();
        const currentIndex = items.indexOf(selectedItem);
        if (currentIndex !== -1 && currentIndex < items.length - 1) {
            selectMedia(items[currentIndex + 1]);
        }
    }

    function toggleFavorite() {
        if (verifyBounds(selectedItem)) {
            if (selectedItem.favorite) {
                selectedItem.card.classList.remove("is-favorite");
                selectedItem.favorite = false;
            } else {
                selectedItem.card.classList.add("is-favorite");
                selectedItem.favorite = true;
            }
            fetch(
                address(`/api/files/${selectedItem.id}`),
                favorite(selectedItem.favorite)
            )
                .then(response => {
                    console.log(response);
                })
                .catch(error => {
                    console.error(error);
                });
        }
    }

    async function remove() {
        function undoRemoving(item, nextNeighbor, lastIndex) {
            gallery.insertBefore(item.card, nextNeighbor);
            getItems().splice(lastIndex, 0, item);
        }

        if (verifyBounds(selectedItem)) {
            const item = selectedItem;
            const items = getItems();
            const lastIndex = items.indexOf(item);
            const nextNeighbor = item.card.nextSibling;

            gallery.removeChild(item.card);
            items.splice(lastIndex, 1);
            closeViewer();

            fetch(
                address(`/api/files/${item.id}`),
                del()
            )
                .then(response => {
                    if (response.status === 404) {
                        console.warn("Already deleted");
                    } else if (!response.ok) {
                        undoRemoving(item, nextNeighbor, lastIndex);
                        throw new Error("Delete failed");
                    }
                })
                .catch(error => {
                    console.error("Failed to delete, restoring item:", error);
                    undoRemoving(item, nextNeighbor, lastIndex);
                });
        }
    }

    viewerClose.addEventListener("click", closeViewer);
    viewerPrevious.addEventListener("click", selectMediaPrevious);
    viewerNext.addEventListener("click", selectMediaNext);
    viewerFavorite.addEventListener("click", toggleFavorite);
    viewerDelete.addEventListener("click", remove);

    return async function openViewer(item, opener) {
        try {
            await fetch(address(`/api/files/${item.id}`), {
                method: "PATCH"
            });
            await loadVariants(item);
            item.hasBeenVisible = true;
            item.isVisible = true;
            updatePreview(item, true);
        } catch (error) {
            console.error(`Error opening media ${item.id}:`, error);
            showPreviewError(item);
            return;
        }

        if (!mediaDialog.open) {
            viewerOpener = opener;
            mediaDialog.showModal();
        }
        selectMedia(item);
        viewerClose.focus();
    };
}