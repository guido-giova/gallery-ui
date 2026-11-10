import { address } from "./address.js";
import {post} from "./fetchUtils.js";
import { initViewer } from "./viewer.js";

const gallery = document.getElementById('gallery');

let items;
let previewObserver;
const itemsByCard = new WeakMap();

export async function loadImages() {
    try {
        const response = await fetch(address("/api/files"));

        if (!response.ok) {
            throw new Error(`Failed to load images: ${response.status}`);
        }

        const fragment = document.createDocumentFragment();
        items = (await response.json()).map(item => {
            const result = { ...item };
            result.card = makeShell(result);
            fragment.append(result.card);
            return result;
        });

        previewObserver?.disconnect();
        previewObserver = createPreviewObserver();
        gallery.replaceChildren(fragment);

        if (previewObserver) {
            items.forEach(item => previewObserver.observe(item.card));
        }

        if (!previewObserver) {
            items.forEach(item => loadVisiblePreview(item));
        }
    } catch (error) {
        console.error("Error loading images:", error);
    }
}

function createPreviewObserver() {
    if (!("IntersectionObserver" in window)) {
        return null;
    }

    return new IntersectionObserver(entries => {
        entries.forEach(entry => {
            const item = itemsByCard.get(entry.target);
            if (!item) {
                return;
            }

            item.isVisible = entry.isIntersecting;
            if (item.isVisible) {
                item.hasBeenVisible = true;
                loadVisiblePreview(item);
            } else if (item.variants && item.hasBeenVisible) {
                updatePreview(item, item.isVisible);
            }
        });
    });
}

function makeShell(item) {
    const card = document.createElement("button");
    card.className = "media-card";
    card.type = "button";
    card.classList.add("is-unloaded");
    itemsByCard.set(card, item);
    if (item.favorite) {
        card.classList.add("is-favorite");
    }

    if (item.reviewed === false) {
        const reviewIndicator = document.createElement("span");
        reviewIndicator.className = "review-indicator";
        reviewIndicator.textContent = "*";
        reviewIndicator.setAttribute("role", "img");
        reviewIndicator.setAttribute("aria-label", "Not reviewed");
        reviewIndicator.title = "Not reviewed";
        card.append(reviewIndicator);
    }

    card.addEventListener("click", () => openViewer(item, card));

    return card;
}

function loadingIcon() {
    const icon = document.createElement("span");
    icon.className = "loading-icon";
    icon.setAttribute("aria-hidden", "true");
    return icon;
}

function loadVariants(item) {
    if (item.variants) {
        return Promise.resolve(item.variants);
    }
    if (item.variantsPromise) {
        return item.variantsPromise;
    }

    item.variantsPromise = (async () => {
        const response = await fetch(address(`/api/files/${item.id}`));
        if (!response.ok) {
            throw new Error(`Failed to load files for ${item.id}: ${response.status}`);
        }

        const files = await response.json();
        if (!Array.isArray(files)) {
            throw new Error(`Invalid files response for ${item.id}`);
        }
        if (!files.some(file => file.kind === "LOW_RES")) {
            throw new Error(`No LOW_RES variant found for ${item.id}`);
        }

        item.variants = files;
        item.isVideo = files.some(file => file.mime.startsWith("video/"));
        item.card.classList.toggle("is-video", item.isVideo);
        return files;
    })().catch(error => {
        item.variantsPromise = null;
        throw error;
    });

    return item.variantsPromise;
}

function getPreviewVariant(item, isVisible) {
    const lowRes = item.variants.find(file => file.kind === "LOW_RES");
    const thumbnail = item.variants.find(file => file.kind === "THUMBNAIL");
    return isVisible ? thumbnail ?? null : lowRes ?? null;
}

function updatePreview(item, isVisible) {
    const variant = getPreviewVariant(item, isVisible);
    if (!variant) {
        releasePreview(item);
        item.card.replaceChildren();
        item.card.classList.remove("is-loading", "is-error");
        item.card.classList.add("is-unloaded");
        return;
    }

    if (item.previewVariantId === variant.id) {
        if (isVisible && item.previewElement instanceof HTMLVideoElement && item.previewElement.paused) {
            item.previewElement.play().catch(error => {
                console.warn(`Could not play preview for ${item.id}:`, error);
            });
        }
        return;
    }

    releasePreview(item);
    const source = address(`/api/files/${variant.id}/content`);
    let preview;
    item.card.classList.remove("is-unloaded", "is-error");
    item.card.classList.add("is-loading");

    item.card.replaceChildren(loadingIcon());
    if (variant.mime.startsWith("video/")) {
        preview = document.createElement("video");
        preview.controls = false;
        preview.preload = "metadata";
        preview.muted = true;
        preview.autoplay = true;
        preview.loop = true;
        preview.playsInline = true;
    } else {
        preview = document.createElement("img");
        preview.decoding = "async";
        preview.alt = "";
    }

    preview.className = "media-preview";
    item.previewElement = preview;
    item.previewVariantId = variant.id;
    item.card.append(preview);
    item.card.classList.toggle("is-video", item.isVideo);
    const readyEvent = preview instanceof HTMLVideoElement ? "loadeddata" : "load";
    preview.addEventListener(readyEvent, () => {
        if (item.previewElement === preview) {
            item.card.classList.remove("is-loading");
            item.card.querySelector(".loading-icon")?.remove();
        }
    }, { once: true });
    preview.addEventListener("error", () => {
        if (item.previewElement === preview) {
            showPreviewError(item);
        }
    }, { once: true });
    preview.src = source;

    if (preview instanceof HTMLVideoElement) {
        preview.play().catch(error => {
            console.warn(`Could not play preview for ${item.id}:`, error);
        });
    }
}

async function loadVisiblePreview(item) {
    item.card.classList.remove("is-unloaded", "is-error");
    item.card.classList.add("is-loading");
    if (!item.card.querySelector(".loading-icon")) {
        item.card.prepend(loadingIcon());
    }

    try {
        await loadVariants(item);
        updatePreview(item, item.isVisible ?? true);
    } catch (error) {
        console.error(`Error loading files for ${item.id}:`, error);
        showPreviewError(item);
    }
}

function releasePreview(item) {
    const preview = item.previewElement;
    if (preview instanceof HTMLVideoElement) {
        preview.pause();
        preview.removeAttribute("src");
        preview.load();
    } else if (preview instanceof HTMLImageElement) {
        preview.removeAttribute("src");
    }
    item.previewElement = null;
    item.previewVariantId = null;
}

function showPreviewError(item) {
    item.card.classList.remove("is-loading");
    item.card.classList.add("is-error");
    item.card.replaceChildren();
    const message = document.createElement("span");
    message.className = "preview-error";
    message.textContent = "Preview unavailable";
    item.card.append(message);
    item.card.setAttribute("aria-label", `Preview unavailable for ${item.id}`);
}

const openViewer = initViewer({
    getItems: () => items,
    loadVariants,
    updatePreview,
    showPreviewError
});
