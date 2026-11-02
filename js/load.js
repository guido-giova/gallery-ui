import { address } from "./address.js";
import {post, del, favorite} from "./fetchUtils.js";

const gallery = document.getElementById('gallery');
const mediaDialog = document.getElementById('media-dialog');
const viewerStage = document.getElementById("viewer-stage");
const viewerData = document.getElementById("viewer-data");
const viewerThumbnails = document.getElementById("viewer-thumbnails");
const viewerClose = document.getElementById("viewer-close");
const viewerPrevious = document.getElementById("viewer-previous");
const viewerNext = document.getElementById("viewer-next");
const viewerDelete = document.getElementById("viewer-delete");
const viewerFavorite = document.getElementById("viewer-favorite");

let items;
let selectedItem = null;
let viewerOpener = null;

export async function loadImages() {
    try {
        const response = await fetch(address("/api/files"));

        if (!response.ok) {
            throw new Error(`Failed to load images: ${response.status}`);
        }

        const fragment = document.createDocumentFragment();

        items = await Promise.all((await response.json())
            .map(async (item) => {
                const result = { ...item };

                result.card = await makeCard(result);
                fragment.append(result.card);

                return result;
            }));

        gallery.replaceChildren(fragment);
    } catch (error) {
        console.error("Error loading images:", error);
    }
}

async function makeCard(item) {
    const card = document.createElement("button");
    card.className = "media-card";
    card.type = "button";
    if (item.isFavorite) {
        card.classList.add("is-favorite");
    }

    const response = await fetch(address(`/api/files/${item.id}`));
    if (!response.ok) {
        throw new Error(`Failed to load files for ${item.id}: ${response.status}`);
    }

    const files = await response.json();
    item.variants = files;
    const thumbnail = files.find(file => file.kind === "THUMBNAIL");
    if (!thumbnail) {
        throw new Error(`No thumbnail found for ${item.id}`);
    }

    if (thumbnail.mime.startsWith("video/")) {
        const preview = document.createElement("video");
        preview.className = "media-preview";
        preview.src = address(`/api/files/${thumbnail.id}/content`);
        preview.loading  = "lazy";
        preview.controls = false;
        preview.preload = "metadata";
        preview.muted = true;
        preview.autoplay = true;
        preview.loop = true;
        card.append(preview);
        card.addEventListener("click", () => openViewer(item, preview));
    } else {
        const preview = document.createElement("img");
        preview.className = "media-preview";
        preview.src = address(`/api/files/${thumbnail.id}/content`);
        preview.loading  = "lazy";
        preview.decoding = "async";
        card.append(preview);
        card.addEventListener("click", () => openViewer(item, preview));
    }

    return card;
}

function openViewer(item, opener) {
    if (!mediaDialog.open) {
        viewerOpener = opener;
        mediaDialog.showModal();
    }
    selectMedia(item);
    viewerClose.focus();
}

function renderViewer(item) {
    if (!item) { return; }
    
    const og = item.variants.find(file => file.kind === "ORIGINAL");
    selectedItem = og;

    if (og.mime.startsWith("video/")) {
        const media = document.createElement("video");
        media.className = "viewer-media";
        media.src = address(`/api/files/${og.id}/content`);
        media.controls = true;
        media.preload = "metadata";
        media.muted = false;
        media.autoplay = false;

        viewerStage.replaceChildren(media);
    } else {
        const media = document.createElement("img");
        media.className = "viewer-media";
        media.src = address(`/api/files/${og.id}/content`);
        media.decoding = "async";

        viewerStage.replaceChildren(media);
    }
}

function closeViewer() {
    if (mediaDialog.open) {
        mediaDialog.close();
        selectedItem = null;
    }
}

function verifyBounds(item) {
    return item != null && items.includes(item);
}

function selectMedia(item) {
    if (verifyBounds(item)) {
        renderViewer(item);
    }
}

function selectMediaPrevious() {
    const currentIndex = items.indexOf(selectedItem);
    if (currentIndex > 0) {
        selectMedia(items[currentIndex - 1]);
    }
}

function selectMediaNext() {
    const currentIndex = items.indexOf(selectedItem);
    if (currentIndex !== -1 && currentIndex < items.length - 1) {
        selectMedia(items[currentIndex + 1]);
    }
}

function toggleFavorite() {
    if (verifyBounds(selectedItem)) {
        if (selectedItem["isFavorite"]) {
            notFavorite(selectedItem);
        } else {
            makeFavorite(selectedItem);
        }
        fetch(
            address(`/api/files/${selectedItem["id"]}`),
            favorite(selectedItem["isFavorite"])
        )
        .then(r => {
            console.log(r)
        })
        .catch(e => {
            console.error(e);
        })
    }
}

function makeFavorite(item) {
    item["card"].classList.add("is-favorite");
    item["isFavorite"] = true;
}

function notFavorite(item) {
    item["card"].classList.remove("is-favorite");
    item["isFavorite"] = false;
}

async function remove() {
    function undoRemoving(data, nextNeighbor, lastIndex) {
        // Reinsert elements
        gallery.insertBefore(data["card"], nextNeighbor);
        items.splice(lastIndex, 0, data);
    }

    if (verifyBounds(selectedItem)) {
        const data = selectedItem;

        const lastIndex = items.indexOf(data);
        const nextNeighbor = data["card"].nextSibling;

        gallery.removeChild(data["card"]);
        items.splice(lastIndex, 1); // remove item
        closeViewer();

        fetch(
            address(`/api/files/${data["id"]}`),
            del()
        )
            .then(r => {
                if (r.status === 404) {
                    console.warn("Already deleted");
                } else if (!r.ok) {
                    undoRemoving(data, nextNeighbor, lastIndex);
                    throw new Error("Delete failed");
                }
            })
            .catch(error => {
                console.error("Failed to delete, restoring item:", error);
                undoRemoving(data, nextNeighbor, lastIndex);
            });
    }
}

viewerClose.addEventListener("click", closeViewer);
viewerPrevious.addEventListener("click", selectMediaPrevious);
viewerNext.addEventListener("click", selectMediaNext);
viewerFavorite.addEventListener("click", toggleFavorite);
viewerDelete.addEventListener("click", remove);
